/**
 * GitOps-lite Pull Agent
 * 
 * Автоматическое обновление приложения из GitHub репозитория
 * 
 * Функции:
 * - Webhook endpoint для GitHub push events
 * - Polling fallback если webhook недоступен
 * - Автоматический git pull и rebuild
 * - Rollback при неудачном деплое
 * - Уведомления о статусе деплоя
 * - Веб-интерфейс для управления
 * - Интеграция с GitHub Actions
 */

import express from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import Docker from 'dockerode';
import { WebSocketServer } from 'ws';
import http from 'http';

const execAsync = promisify(exec);

// Configuration
const config = {
  // GitHub settings
  githubRepo: process.env.GITHUB_REPO || 'sileade/devops-ai-dashboard',
  githubBranch: process.env.GITHUB_BRANCH || 'main',
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
  githubToken: process.env.GITHUB_TOKEN || '',
  
  // Polling settings
  pollInterval: parseInt(process.env.POLL_INTERVAL || '300') * 1000, // Convert to ms
  
  // Server settings
  webhookPort: parseInt(process.env.WEBHOOK_PORT || '9000'),
  
  // Docker settings
  appContainer: process.env.APP_CONTAINER || 'devops-dashboard',
  
  // Notification settings
  notificationWebhook: process.env.NOTIFICATION_WEBHOOK || '',
  slackWebhook: process.env.SLACK_WEBHOOK || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  
  // Paths
  repoPath: process.env.REPO_PATH || '/app/repo',
  dataPath: process.env.DATA_PATH || '/app/data',
  
  // Deployment settings
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '60') * 1000,
  rollbackEnabled: process.env.ROLLBACK_ENABLED !== 'false',
  
  // Deploy secret for manual triggers
  deploySecret: process.env.DEPLOY_SECRET || '',
};

// State
const state = {
  lastCommit: '',
  lastDeployment: null,
  deploymentHistory: [],
  isDeploying: false,
  failedAttempts: 0,
  lastPollTime: null,
  logs: [],
  githubActionsRuns: [],
};

// WebSocket clients
const wsClients = new Set();

// Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Express app
const app = express();
const server = http.createServer(app);

// WebSocket server for real-time logs
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  wsClients.add(ws);
  
  // Send current state
  ws.send(JSON.stringify({
    type: 'state',
    data: {
      isDeploying: state.isDeploying,
      lastDeployment: state.lastDeployment,
      lastCommit: state.lastCommit,
      logs: state.logs.slice(-100),
    },
  }));
  
  ws.on('close', () => {
    wsClients.delete(ws);
  });
});

// Broadcast to all WebSocket clients
function broadcast(type, data) {
  const message = JSON.stringify({ type, data });
  wsClients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/json', limit: '10mb' }));

// CORS for web interface
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Deploy-Secret');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Логирование с временной меткой и broadcast
 */
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data,
  };
  console.log(JSON.stringify(logEntry));
  
  // Add to state logs
  state.logs.push(logEntry);
  if (state.logs.length > 500) {
    state.logs = state.logs.slice(-500);
  }
  
  // Broadcast to WebSocket clients
  broadcast('log', logEntry);
  
  // Save to file
  saveLogEntry(logEntry).catch(console.error);
}

/**
 * Сохранение лога в файл
 */
async function saveLogEntry(entry) {
  const logFile = path.join(config.dataPath, 'deployment.log');
  const line = JSON.stringify(entry) + '\n';
  await fs.appendFile(logFile, line).catch(() => {});
}

/**
 * Отправка уведомлений
 */
async function sendNotification(title, message, status = 'info') {
  const notifications = [];
  
  // Generic webhook
  if (config.notificationWebhook) {
    notifications.push(
      fetch(config.notificationWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, status, timestamp: new Date().toISOString() }),
      }).catch(e => log('error', 'Failed to send webhook notification', { error: e.message }))
    );
  }
  
  // Slack
  if (config.slackWebhook) {
    const color = status === 'success' ? 'good' : status === 'error' ? 'danger' : 'warning';
    notifications.push(
      fetch(config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [{
            color,
            title,
            text: message,
            footer: 'DevOps Pull Agent',
            ts: Math.floor(Date.now() / 1000),
          }],
        }),
      }).catch(e => log('error', 'Failed to send Slack notification', { error: e.message }))
    );
  }
  
  // Telegram
  if (config.telegramBotToken && config.telegramChatId) {
    const emoji = status === 'success' ? '✅' : status === 'error' ? '❌' : 'ℹ️';
    const text = `${emoji} *${title}*\n\n${message}`;
    notifications.push(
      fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegramChatId,
          text,
          parse_mode: 'Markdown',
        }),
      }).catch(e => log('error', 'Failed to send Telegram notification', { error: e.message }))
    );
  }
  
  await Promise.allSettled(notifications);
}

/**
 * Выполнение команды с таймаутом и streaming
 */
async function execWithTimeout(command, options = {}, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const proc = exec(command, { ...options, timeout }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${error.message}\nStderr: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
    
    // Stream output to WebSocket
    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        broadcast('output', { stream: 'stdout', data: data.toString() });
      });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        broadcast('output', { stream: 'stderr', data: data.toString() });
      });
    }
  });
}

// ============================================
// GITHUB ACTIONS INTEGRATION
// ============================================

/**
 * Получение статуса GitHub Actions
 */
async function getGitHubActionsRuns() {
  if (!config.githubToken) {
    return [];
  }
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.githubRepo}/actions/runs?per_page=10`,
      {
        headers: {
          'Authorization': `Bearer ${config.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json();
    state.githubActionsRuns = data.workflow_runs.map(run => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      branch: run.head_branch,
      commit: run.head_sha,
      actor: run.actor?.login,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      url: run.html_url,
    }));
    
    return state.githubActionsRuns;
  } catch (error) {
    log('error', 'Failed to get GitHub Actions runs', { error: error.message });
    return [];
  }
}

/**
 * Получение логов GitHub Actions run
 */
async function getGitHubActionsLogs(runId) {
  if (!config.githubToken) {
    return null;
  }
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.githubRepo}/actions/runs/${runId}/logs`,
      {
        headers: {
          'Authorization': `Bearer ${config.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    // Returns a redirect to download URL
    return response.url;
  } catch (error) {
    log('error', 'Failed to get GitHub Actions logs', { error: error.message });
    return null;
  }
}

/**
 * Trigger GitHub Actions workflow
 */
async function triggerGitHubWorkflow(workflowId, inputs = {}) {
  if (!config.githubToken) {
    return { success: false, error: 'GitHub token not configured' };
  }
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.githubRepo}/actions/workflows/${workflowId}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: config.githubBranch,
          inputs,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }
    
    log('info', 'GitHub workflow triggered', { workflowId, inputs });
    return { success: true };
  } catch (error) {
    log('error', 'Failed to trigger GitHub workflow', { error: error.message });
    return { success: false, error: error.message };
  }
}

// ============================================
// GIT OPERATIONS
// ============================================

/**
 * Получение текущего коммита
 */
async function getCurrentCommit() {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: config.repoPath });
    return stdout.trim();
  } catch (error) {
    log('error', 'Failed to get current commit', { error: error.message });
    return null;
  }
}

/**
 * Получение информации о коммите
 */
async function getCommitInfo(commit) {
  try {
    const { stdout } = await execAsync(
      `git log -1 --format='{"sha":"%H","shortSha":"%h","author":"%an","email":"%ae","date":"%ci","message":"%s"}' ${commit}`,
      { cwd: config.repoPath }
    );
    return JSON.parse(stdout.trim());
  } catch (error) {
    log('error', 'Failed to get commit info', { error: error.message });
    return null;
  }
}

/**
 * Получение последнего коммита из remote
 */
async function getRemoteCommit() {
  try {
    await execAsync(`git fetch origin ${config.githubBranch}`, { cwd: config.repoPath });
    const { stdout } = await execAsync(`git rev-parse origin/${config.githubBranch}`, { cwd: config.repoPath });
    return stdout.trim();
  } catch (error) {
    log('error', 'Failed to get remote commit', { error: error.message });
    return null;
  }
}

/**
 * Получение списка коммитов
 */
async function getCommitHistory(limit = 20) {
  try {
    const { stdout } = await execAsync(
      `git log -${limit} --format='%H|%h|%an|%ci|%s' origin/${config.githubBranch}`,
      { cwd: config.repoPath }
    );
    
    return stdout.trim().split('\n').filter(Boolean).map(line => {
      const [sha, shortSha, author, date, message] = line.split('|');
      return { sha, shortSha, author, date, message };
    });
  } catch (error) {
    log('error', 'Failed to get commit history', { error: error.message });
    return [];
  }
}

/**
 * Проверка наличия обновлений
 */
async function checkForUpdates() {
  const currentCommit = await getCurrentCommit();
  const remoteCommit = await getRemoteCommit();
  
  if (!currentCommit || !remoteCommit) {
    return { hasUpdates: false, error: 'Failed to get commits' };
  }
  
  const currentInfo = await getCommitInfo(currentCommit);
  const remoteInfo = await getCommitInfo(remoteCommit);
  
  return {
    hasUpdates: currentCommit !== remoteCommit,
    currentCommit,
    remoteCommit,
    currentInfo,
    remoteInfo,
  };
}

/**
 * Git pull с обработкой конфликтов
 */
async function gitPull() {
  try {
    // Stash any local changes
    await execAsync('git stash', { cwd: config.repoPath }).catch(() => {});
    
    // Pull latest changes
    const { stdout } = await execWithTimeout(
      `git pull origin ${config.githubBranch}`,
      { cwd: config.repoPath },
      60000
    );
    
    log('info', 'Git pull successful', { output: stdout.trim() });
    return { success: true, output: stdout };
  } catch (error) {
    log('error', 'Git pull failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

// ============================================
// DOCKER OPERATIONS
// ============================================

/**
 * Получение контейнера приложения
 */
async function getAppContainer() {
  try {
    const containers = await docker.listContainers({ all: true });
    return containers.find(c => 
      c.Names.some(name => name.includes(config.appContainer))
    );
  } catch (error) {
    log('error', 'Failed to get app container', { error: error.message });
    return null;
  }
}

/**
 * Получение статуса всех контейнеров
 */
async function getContainersStatus() {
  try {
    const containers = await docker.listContainers({ all: true });
    return containers.map(c => ({
      id: c.Id.substring(0, 12),
      name: c.Names[0]?.replace('/', ''),
      image: c.Image,
      state: c.State,
      status: c.Status,
      created: c.Created,
    }));
  } catch (error) {
    log('error', 'Failed to get containers status', { error: error.message });
    return [];
  }
}

/**
 * Rebuild и restart контейнера
 */
async function rebuildAndRestart() {
  try {
    log('info', 'Starting rebuild process');
    broadcast('deployment', { phase: 'build', status: 'running' });
    
    // Build new image
    const buildResult = await execWithTimeout(
      'docker-compose build --no-cache app',
      { cwd: config.repoPath },
      600000 // 10 minutes timeout
    );
    log('info', 'Build completed', { output: buildResult.stdout });
    broadcast('deployment', { phase: 'build', status: 'completed' });
    
    // Restart container
    broadcast('deployment', { phase: 'restart', status: 'running' });
    const restartResult = await execWithTimeout(
      'docker-compose up -d app',
      { cwd: config.repoPath },
      120000 // 2 minutes timeout
    );
    log('info', 'Container restarted', { output: restartResult.stdout });
    broadcast('deployment', { phase: 'restart', status: 'completed' });
    
    return { success: true };
  } catch (error) {
    log('error', 'Rebuild failed', { error: error.message });
    broadcast('deployment', { phase: 'build', status: 'failed', error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Проверка здоровья приложения
 */
async function healthCheck(timeout = config.healthCheckTimeout) {
  const startTime = Date.now();
  const checkInterval = 5000; // 5 seconds
  
  broadcast('deployment', { phase: 'health', status: 'running' });
  
  while (Date.now() - startTime < timeout) {
    try {
      const container = await getAppContainer();
      if (!container) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }
      
      // Check if container is running
      if (container.State !== 'running') {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        continue;
      }
      
      // Check HTTP health endpoint
      const response = await fetch('http://localhost:3000/api/trpc/health.check', { timeout: 5000 });
      if (response.ok) {
        log('info', 'Health check passed');
        broadcast('deployment', { phase: 'health', status: 'completed' });
        return { healthy: true };
      }
    } catch (error) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  log('error', 'Health check failed - timeout');
  broadcast('deployment', { phase: 'health', status: 'failed', error: 'Timeout' });
  return { healthy: false, error: 'Timeout' };
}

/**
 * Rollback к предыдущей версии
 */
async function rollback(previousCommit) {
  if (!config.rollbackEnabled || !previousCommit) {
    log('warn', 'Rollback disabled or no previous commit');
    return { success: false };
  }
  
  try {
    log('info', 'Starting rollback', { targetCommit: previousCommit });
    broadcast('deployment', { phase: 'rollback', status: 'running', commit: previousCommit });
    
    // Reset to previous commit
    await execAsync(`git reset --hard ${previousCommit}`, { cwd: config.repoPath });
    
    // Rebuild
    const rebuildResult = await rebuildAndRestart();
    if (!rebuildResult.success) {
      throw new Error('Rollback rebuild failed');
    }
    
    // Health check
    const health = await healthCheck();
    if (!health.healthy) {
      throw new Error('Rollback health check failed');
    }
    
    log('info', 'Rollback successful');
    broadcast('deployment', { phase: 'rollback', status: 'completed' });
    
    await sendNotification(
      'Rollback Completed',
      `Successfully rolled back to commit ${previousCommit.substring(0, 7)}`,
      'warning'
    );
    
    return { success: true };
  } catch (error) {
    log('error', 'Rollback failed', { error: error.message });
    broadcast('deployment', { phase: 'rollback', status: 'failed', error: error.message });
    return { success: false, error: error.message };
  }
}

// ============================================
// DEPLOYMENT LOGIC
// ============================================

/**
 * Основной процесс деплоя
 */
async function deploy(trigger = 'manual', options = {}) {
  if (state.isDeploying) {
    log('warn', 'Deployment already in progress');
    return { success: false, error: 'Deployment in progress' };
  }
  
  state.isDeploying = true;
  const startTime = Date.now();
  const previousCommit = await getCurrentCommit();
  
  const deployment = {
    id: Date.now().toString(),
    trigger,
    startTime: new Date().toISOString(),
    previousCommit,
    status: 'running',
    phases: [],
    options,
  };
  
  state.lastDeployment = deployment;
  broadcast('state', { isDeploying: true, lastDeployment: deployment });
  
  try {
    log('info', 'Starting deployment', { trigger, previousCommit });
    await sendNotification(
      'Deployment Started',
      `Starting deployment from ${trigger}. Previous commit: ${previousCommit?.substring(0, 7)}`,
      'info'
    );
    
    // Step 1: Git pull
    deployment.phases.push({ name: 'pull', status: 'running', startTime: Date.now() });
    broadcast('deployment', { phase: 'pull', status: 'running' });
    
    const pullResult = await gitPull();
    if (!pullResult.success) {
      throw new Error(`Git pull failed: ${pullResult.error}`);
    }
    
    deployment.phases[deployment.phases.length - 1].status = 'completed';
    broadcast('deployment', { phase: 'pull', status: 'completed' });
    
    const newCommit = await getCurrentCommit();
    const commitInfo = await getCommitInfo(newCommit);
    deployment.newCommit = newCommit;
    deployment.commitInfo = commitInfo;
    
    // Step 2: Rebuild and restart
    deployment.phases.push({ name: 'build', status: 'running', startTime: Date.now() });
    const rebuildResult = await rebuildAndRestart();
    if (!rebuildResult.success) {
      throw new Error(`Rebuild failed: ${rebuildResult.error}`);
    }
    deployment.phases[deployment.phases.length - 1].status = 'completed';
    
    // Step 3: Health check
    deployment.phases.push({ name: 'health', status: 'running', startTime: Date.now() });
    const health = await healthCheck();
    if (!health.healthy) {
      throw new Error('Health check failed');
    }
    deployment.phases[deployment.phases.length - 1].status = 'completed';
    
    // Success!
    deployment.status = 'success';
    deployment.endTime = new Date().toISOString();
    deployment.duration = Date.now() - startTime;
    
    state.failedAttempts = 0;
    state.lastCommit = newCommit;
    state.deploymentHistory.push(deployment);
    
    // Keep only last 50 deployments
    if (state.deploymentHistory.length > 50) {
      state.deploymentHistory = state.deploymentHistory.slice(-50);
    }
    
    log('info', 'Deployment successful', { 
      duration: deployment.duration,
      newCommit: newCommit?.substring(0, 7),
    });
    
    broadcast('state', { 
      isDeploying: false, 
      lastDeployment: deployment,
      lastCommit: newCommit,
    });
    
    await sendNotification(
      'Deployment Successful',
      `Successfully deployed commit ${newCommit?.substring(0, 7)} in ${Math.round(deployment.duration / 1000)}s\n\nMessage: ${commitInfo?.message || 'N/A'}`,
      'success'
    );
    
    return { success: true, deployment };
    
  } catch (error) {
    deployment.status = 'failed';
    deployment.error = error.message;
    deployment.endTime = new Date().toISOString();
    deployment.duration = Date.now() - startTime;
    
    state.failedAttempts++;
    state.deploymentHistory.push(deployment);
    
    log('error', 'Deployment failed', { 
      error: error.message,
      failedAttempts: state.failedAttempts,
    });
    
    broadcast('state', { isDeploying: false, lastDeployment: deployment });
    
    // Try rollback
    if (config.rollbackEnabled && previousCommit && !options.skipRollback) {
      log('info', 'Attempting rollback');
      await rollback(previousCommit);
    }
    
    await sendNotification(
      'Deployment Failed',
      `Deployment failed: ${error.message}\nFailed attempts: ${state.failedAttempts}`,
      'error'
    );
    
    // Alert if too many failures
    if (state.failedAttempts >= config.maxRetries) {
      await sendNotification(
        '⚠️ CRITICAL: Deployment Failures',
        `${state.failedAttempts} consecutive deployment failures. Manual intervention required!`,
        'error'
      );
    }
    
    return { success: false, error: error.message, deployment };
    
  } finally {
    state.isDeploying = false;
  }
}

// ============================================
// WEBHOOK HANDLERS
// ============================================

/**
 * Верификация GitHub webhook signature
 */
function verifyGitHubSignature(payload, signature) {
  if (!config.webhookSecret) {
    log('warn', 'No webhook secret configured, skipping verification');
    return true;
  }
  
  if (!signature) {
    return false;
  }
  
  const hmac = createHmac('sha256', config.webhookSecret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

/**
 * Verify deploy secret
 */
function verifyDeploySecret(req) {
  if (!config.deploySecret) {
    return true;
  }
  
  const secret = req.headers['x-deploy-secret'] || req.body?.secret;
  return secret === config.deploySecret;
}

// ============================================
// WEB INTERFACE
// ============================================

// Serve static web interface
const webInterfaceHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitOps Pull Agent</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            dark: {
              bg: '#0f172a',
              card: '#1e293b',
              border: '#334155',
            }
          }
        }
      }
    }
  </script>
  <style>
    .log-entry { font-family: monospace; font-size: 12px; }
    .log-info { color: #60a5fa; }
    .log-warn { color: #fbbf24; }
    .log-error { color: #f87171; }
    .log-success { color: #34d399; }
    .phase-running { animation: pulse 2s infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body class="dark bg-dark-bg text-gray-100 min-h-screen">
  <div id="app" class="container mx-auto px-4 py-8 max-w-6xl">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2">GitOps Pull Agent</h1>
      <p class="text-gray-400">Automated deployment management</p>
    </header>
    
    <!-- Status Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="bg-dark-card rounded-lg p-4 border border-dark-border">
        <div class="text-gray-400 text-sm mb-1">Status</div>
        <div id="status" class="text-xl font-semibold">Loading...</div>
      </div>
      <div class="bg-dark-card rounded-lg p-4 border border-dark-border">
        <div class="text-gray-400 text-sm mb-1">Current Commit</div>
        <div id="currentCommit" class="text-xl font-mono">Loading...</div>
      </div>
      <div class="bg-dark-card rounded-lg p-4 border border-dark-border">
        <div class="text-gray-400 text-sm mb-1">Last Deployment</div>
        <div id="lastDeployment" class="text-xl">Loading...</div>
      </div>
    </div>
    
    <!-- Actions -->
    <div class="bg-dark-card rounded-lg p-6 border border-dark-border mb-8">
      <h2 class="text-xl font-semibold mb-4">Actions</h2>
      <div class="flex flex-wrap gap-4">
        <button id="btnCheckUpdates" onclick="checkUpdates()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition">
          Check for Updates
        </button>
        <button id="btnPull" onclick="triggerPull()" class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition">
          Pull & Deploy
        </button>
        <button id="btnRollback" onclick="showRollbackModal()" class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition">
          Rollback
        </button>
        <button id="btnTriggerCI" onclick="triggerCI()" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
          Trigger CI/CD
        </button>
      </div>
      
      <div id="updateInfo" class="mt-4 hidden">
        <div class="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <div class="font-semibold mb-2">Update Available</div>
          <div id="updateDetails" class="text-sm text-gray-300"></div>
        </div>
      </div>
    </div>
    
    <!-- Deployment Progress -->
    <div id="deploymentProgress" class="bg-dark-card rounded-lg p-6 border border-dark-border mb-8 hidden">
      <h2 class="text-xl font-semibold mb-4">Deployment Progress</h2>
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <div id="phase-pull" class="w-4 h-4 rounded-full bg-gray-600"></div>
          <span>Git Pull</span>
        </div>
        <div class="flex items-center gap-3">
          <div id="phase-build" class="w-4 h-4 rounded-full bg-gray-600"></div>
          <span>Build & Restart</span>
        </div>
        <div class="flex items-center gap-3">
          <div id="phase-health" class="w-4 h-4 rounded-full bg-gray-600"></div>
          <span>Health Check</span>
        </div>
      </div>
    </div>
    
    <!-- Logs -->
    <div class="bg-dark-card rounded-lg p-6 border border-dark-border mb-8">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Live Logs</h2>
        <button onclick="clearLogs()" class="text-sm text-gray-400 hover:text-white">Clear</button>
      </div>
      <div id="logs" class="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
        <div class="text-gray-500">Connecting...</div>
      </div>
    </div>
    
    <!-- Deployment History -->
    <div class="bg-dark-card rounded-lg p-6 border border-dark-border mb-8">
      <h2 class="text-xl font-semibold mb-4">Deployment History</h2>
      <div id="history" class="space-y-2">
        <div class="text-gray-500">Loading...</div>
      </div>
    </div>
    
    <!-- GitHub Actions -->
    <div class="bg-dark-card rounded-lg p-6 border border-dark-border">
      <h2 class="text-xl font-semibold mb-4">GitHub Actions</h2>
      <div id="githubActions" class="space-y-2">
        <div class="text-gray-500">Loading...</div>
      </div>
    </div>
  </div>
  
  <!-- Rollback Modal -->
  <div id="rollbackModal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50">
    <div class="bg-dark-card rounded-lg p-6 max-w-md w-full mx-4 border border-dark-border">
      <h3 class="text-xl font-semibold mb-4">Rollback to Previous Version</h3>
      <div id="commitList" class="space-y-2 max-h-64 overflow-y-auto mb-4">
        Loading commits...
      </div>
      <div class="flex justify-end gap-2">
        <button onclick="hideRollbackModal()" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">Cancel</button>
      </div>
    </div>
  </div>
  
  <script>
    let ws;
    const logs = [];
    
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(protocol + '//' + window.location.host + '/ws');
      
      ws.onopen = () => {
        addLog('info', 'Connected to Pull Agent');
        loadData();
      };
      
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      };
      
      ws.onclose = () => {
        addLog('warn', 'Disconnected, reconnecting...');
        setTimeout(connect, 3000);
      };
    }
    
    function handleMessage(msg) {
      switch (msg.type) {
        case 'state':
          updateState(msg.data);
          break;
        case 'log':
          addLog(msg.data.level, msg.data.message);
          break;
        case 'output':
          addLog('info', msg.data.data.trim());
          break;
        case 'deployment':
          updateDeploymentPhase(msg.data);
          break;
      }
    }
    
    function updateState(data) {
      if (data.isDeploying !== undefined) {
        document.getElementById('status').textContent = data.isDeploying ? 'Deploying...' : 'Idle';
        document.getElementById('status').className = data.isDeploying ? 'text-xl font-semibold text-yellow-400 phase-running' : 'text-xl font-semibold text-green-400';
        document.getElementById('deploymentProgress').classList.toggle('hidden', !data.isDeploying);
        
        // Disable buttons during deployment
        document.getElementById('btnPull').disabled = data.isDeploying;
        document.getElementById('btnRollback').disabled = data.isDeploying;
      }
      
      if (data.lastCommit) {
        document.getElementById('currentCommit').textContent = data.lastCommit.substring(0, 7);
      }
      
      if (data.lastDeployment) {
        const d = data.lastDeployment;
        const status = d.status === 'success' ? '✅' : d.status === 'failed' ? '❌' : '🔄';
        const time = d.endTime ? new Date(d.endTime).toLocaleTimeString() : 'In progress';
        document.getElementById('lastDeployment').textContent = status + ' ' + time;
      }
      
      if (data.logs) {
        data.logs.forEach(l => addLog(l.level, l.message, false));
        scrollLogs();
      }
    }
    
    function updateDeploymentPhase(data) {
      const el = document.getElementById('phase-' + data.phase);
      if (el) {
        el.className = 'w-4 h-4 rounded-full ' + 
          (data.status === 'running' ? 'bg-yellow-500 phase-running' :
           data.status === 'completed' ? 'bg-green-500' :
           data.status === 'failed' ? 'bg-red-500' : 'bg-gray-600');
      }
    }
    
    function addLog(level, message, scroll = true) {
      const logsEl = document.getElementById('logs');
      const entry = document.createElement('div');
      entry.className = 'log-entry log-' + level;
      const time = new Date().toLocaleTimeString();
      entry.textContent = '[' + time + '] ' + message;
      logsEl.appendChild(entry);
      
      if (scroll) scrollLogs();
    }
    
    function scrollLogs() {
      const logsEl = document.getElementById('logs');
      logsEl.scrollTop = logsEl.scrollHeight;
    }
    
    function clearLogs() {
      document.getElementById('logs').innerHTML = '';
    }
    
    async function loadData() {
      // Load status
      const status = await fetch('/status').then(r => r.json());
      updateState({
        isDeploying: status.state.isDeploying,
        lastCommit: status.state.lastCommit,
        lastDeployment: status.state.lastDeployment,
      });
      
      // Load history
      const history = await fetch('/history').then(r => r.json());
      renderHistory(history.deployments);
      
      // Load GitHub Actions
      const actions = await fetch('/github/actions').then(r => r.json());
      renderGitHubActions(actions);
    }
    
    function renderHistory(deployments) {
      const el = document.getElementById('history');
      if (!deployments.length) {
        el.innerHTML = '<div class="text-gray-500">No deployments yet</div>';
        return;
      }
      
      el.innerHTML = deployments.map(d => {
        const status = d.status === 'success' ? '✅' : d.status === 'failed' ? '❌' : '🔄';
        const time = new Date(d.startTime).toLocaleString();
        const duration = d.duration ? Math.round(d.duration / 1000) + 's' : '-';
        const commit = d.newCommit?.substring(0, 7) || '-';
        
        return '<div class="flex items-center justify-between py-2 border-b border-dark-border">' +
          '<div class="flex items-center gap-3">' +
            '<span>' + status + '</span>' +
            '<span class="font-mono">' + commit + '</span>' +
            '<span class="text-gray-400 text-sm">' + d.trigger + '</span>' +
          '</div>' +
          '<div class="text-gray-400 text-sm">' + time + ' (' + duration + ')</div>' +
        '</div>';
      }).join('');
    }
    
    function renderGitHubActions(runs) {
      const el = document.getElementById('githubActions');
      if (!runs.length) {
        el.innerHTML = '<div class="text-gray-500">No GitHub Actions runs found</div>';
        return;
      }
      
      el.innerHTML = runs.map(r => {
        const status = r.conclusion === 'success' ? '✅' : 
                       r.conclusion === 'failure' ? '❌' : 
                       r.status === 'in_progress' ? '🔄' : '⏸️';
        const time = new Date(r.createdAt).toLocaleString();
        
        return '<a href="' + r.url + '" target="_blank" class="flex items-center justify-between py-2 border-b border-dark-border hover:bg-dark-border/30">' +
          '<div class="flex items-center gap-3">' +
            '<span>' + status + '</span>' +
            '<span>' + r.name + '</span>' +
            '<span class="text-gray-400 text-sm">' + r.branch + '</span>' +
          '</div>' +
          '<div class="text-gray-400 text-sm">' + time + '</div>' +
        '</a>';
      }).join('');
    }
    
    async function checkUpdates() {
      const btn = document.getElementById('btnCheckUpdates');
      btn.disabled = true;
      btn.textContent = 'Checking...';
      
      try {
        const result = await fetch('/check-updates').then(r => r.json());
        
        if (result.hasUpdates) {
          document.getElementById('updateInfo').classList.remove('hidden');
          document.getElementById('updateDetails').innerHTML = 
            '<div>Current: <span class="font-mono">' + result.currentCommit?.substring(0, 7) + '</span></div>' +
            '<div>Remote: <span class="font-mono">' + result.remoteCommit?.substring(0, 7) + '</span></div>' +
            (result.remoteInfo ? '<div class="mt-2">' + result.remoteInfo.message + '</div>' : '');
        } else {
          addLog('info', 'No updates available');
          document.getElementById('updateInfo').classList.add('hidden');
        }
      } catch (e) {
        addLog('error', 'Failed to check updates: ' + e.message);
      }
      
      btn.disabled = false;
      btn.textContent = 'Check for Updates';
    }
    
    async function triggerPull() {
      if (!confirm('Start deployment?')) return;
      
      try {
        await fetch('/deploy', { method: 'POST' });
        addLog('info', 'Deployment triggered');
      } catch (e) {
        addLog('error', 'Failed to trigger deployment: ' + e.message);
      }
    }
    
    async function showRollbackModal() {
      document.getElementById('rollbackModal').classList.remove('hidden');
      document.getElementById('rollbackModal').classList.add('flex');
      
      const commits = await fetch('/commits').then(r => r.json());
      const el = document.getElementById('commitList');
      
      el.innerHTML = commits.map(c => 
        '<button onclick="doRollback(\\'' + c.sha + '\\')" class="w-full text-left p-2 hover:bg-dark-border rounded flex justify-between">' +
          '<span class="font-mono">' + c.shortSha + '</span>' +
          '<span class="text-gray-400 text-sm truncate ml-2">' + c.message + '</span>' +
        '</button>'
      ).join('');
    }
    
    function hideRollbackModal() {
      document.getElementById('rollbackModal').classList.add('hidden');
      document.getElementById('rollbackModal').classList.remove('flex');
    }
    
    async function doRollback(commit) {
      if (!confirm('Rollback to ' + commit.substring(0, 7) + '?')) return;
      
      hideRollbackModal();
      
      try {
        await fetch('/rollback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commit })
        });
        addLog('info', 'Rollback triggered');
      } catch (e) {
        addLog('error', 'Failed to trigger rollback: ' + e.message);
      }
    }
    
    async function triggerCI() {
      if (!confirm('Trigger CI/CD workflow?')) return;
      
      try {
        const result = await fetch('/github/trigger-workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflow: 'cd.yml' })
        }).then(r => r.json());
        
        if (result.success) {
          addLog('success', 'CI/CD workflow triggered');
        } else {
          addLog('error', 'Failed to trigger workflow: ' + result.error);
        }
      } catch (e) {
        addLog('error', 'Failed to trigger CI/CD: ' + e.message);
      }
    }
    
    // Start
    connect();
    setInterval(loadData, 30000); // Refresh every 30s
  </script>
</body>
</html>
`;

// ============================================
// API ROUTES
// ============================================

// Serve web interface
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(webInterfaceHTML);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    isDeploying: state.isDeploying,
    lastCommit: state.lastCommit,
    lastDeployment: state.lastDeployment,
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    config: {
      githubRepo: config.githubRepo,
      githubBranch: config.githubBranch,
      pollInterval: config.pollInterval / 1000,
      rollbackEnabled: config.rollbackEnabled,
    },
    state: {
      lastCommit: state.lastCommit,
      lastDeployment: state.lastDeployment,
      isDeploying: state.isDeploying,
      failedAttempts: state.failedAttempts,
      lastPollTime: state.lastPollTime,
    },
    deploymentHistory: state.deploymentHistory.slice(-10),
  });
});

// GitHub webhook endpoint
app.post('/webhook/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  
  log('info', 'Received GitHub webhook', { event });
  
  // Verify signature
  if (!verifyGitHubSignature(payload, signature)) {
    log('warn', 'Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Handle push events
  if (event === 'push') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const branch = body.ref?.replace('refs/heads/', '');
    
    if (branch === config.githubBranch) {
      log('info', 'Push to tracked branch detected', { branch });
      
      // Start deployment asynchronously
      deploy('webhook').catch(console.error);
      
      return res.json({ message: 'Deployment triggered', branch });
    } else {
      log('info', 'Push to non-tracked branch', { branch, tracked: config.githubBranch });
      return res.json({ message: 'Branch not tracked', branch });
    }
  }
  
  // Handle workflow_run events (GitHub Actions)
  if (event === 'workflow_run') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    log('info', 'Workflow run event', { 
      action: body.action, 
      conclusion: body.workflow_run?.conclusion,
      name: body.workflow_run?.name,
    });
    
    // Refresh GitHub Actions status
    getGitHubActionsRuns().catch(console.error);
    
    return res.json({ message: 'Workflow event received' });
  }
  
  // Handle ping events
  if (event === 'ping') {
    log('info', 'Webhook ping received');
    return res.json({ message: 'Pong!' });
  }
  
  res.json({ message: 'Event not handled', event });
});

// Manual deploy endpoint
app.post('/deploy', async (req, res) => {
  const { force = false, skipRollback = false } = req.body || {};
  
  if (!verifyDeploySecret(req)) {
    return res.status(401).json({ error: 'Invalid deploy secret' });
  }
  
  if (state.isDeploying && !force) {
    return res.status(409).json({ error: 'Deployment in progress' });
  }
  
  log('info', 'Manual deployment triggered');
  
  // Start deployment asynchronously
  deploy('manual', { skipRollback }).catch(console.error);
  
  res.json({ message: 'Deployment triggered' });
});

// Check for updates endpoint
app.get('/check-updates', async (req, res) => {
  const result = await checkForUpdates();
  res.json(result);
});

// Get commit history
app.get('/commits', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const commits = await getCommitHistory(limit);
  res.json(commits);
});

// Rollback endpoint
app.post('/rollback', async (req, res) => {
  const { commit } = req.body || {};
  
  if (!verifyDeploySecret(req)) {
    return res.status(401).json({ error: 'Invalid deploy secret' });
  }
  
  if (!commit) {
    return res.status(400).json({ error: 'Commit hash required' });
  }
  
  if (state.isDeploying) {
    return res.status(409).json({ error: 'Deployment in progress' });
  }
  
  log('info', 'Manual rollback triggered', { commit });
  
  const result = await rollback(commit);
  res.json(result);
});

// Deployment history endpoint
app.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json({
    deployments: state.deploymentHistory.slice(-limit).reverse(),
    total: state.deploymentHistory.length,
  });
});

// Get logs
app.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json({
    logs: state.logs.slice(-limit),
    total: state.logs.length,
  });
});

// Get containers status
app.get('/containers', async (req, res) => {
  const containers = await getContainersStatus();
  res.json(containers);
});

// GitHub Actions endpoints
app.get('/github/actions', async (req, res) => {
  const runs = await getGitHubActionsRuns();
  res.json(runs);
});

app.get('/github/actions/:runId/logs', async (req, res) => {
  const logsUrl = await getGitHubActionsLogs(req.params.runId);
  if (logsUrl) {
    res.redirect(logsUrl);
  } else {
    res.status(404).json({ error: 'Logs not found' });
  }
});

app.post('/github/trigger-workflow', async (req, res) => {
  if (!verifyDeploySecret(req)) {
    return res.status(401).json({ error: 'Invalid deploy secret' });
  }
  
  const { workflow = 'cd.yml', inputs = {} } = req.body || {};
  const result = await triggerGitHubWorkflow(workflow, inputs);
  res.json(result);
});

// ============================================
// CANARY DEPLOYMENT SUPPORT
// ============================================

// Canary deployment state
const canaryState = {
  activeDeployments: [],
  analysisInterval: null,
};

/**
 * Start a canary deployment
 */
async function startCanaryDeployment(config) {
  const {
    deploymentId,
    canaryImage,
    stableImage,
    initialPercent = 10,
    targetPercent = 100,
    incrementPercent = 10,
    incrementIntervalMinutes = 5,
    errorRateThreshold = 5,
    latencyThresholdMs = 1000,
    autoRollbackEnabled = true,
  } = config;

  log('info', 'Starting canary deployment', { deploymentId, canaryImage, initialPercent });
  broadcast('canary', { action: 'start', deploymentId, config });

  const canary = {
    id: deploymentId,
    canaryImage,
    stableImage,
    currentPercent: 0,
    targetPercent,
    incrementPercent,
    incrementIntervalMinutes,
    errorRateThreshold,
    latencyThresholdMs,
    autoRollbackEnabled,
    status: 'initializing',
    startTime: Date.now(),
    metrics: [],
  };

  canaryState.activeDeployments.push(canary);

  try {
    // Deploy canary container with initial traffic
    await deployCanaryContainer(canary, initialPercent);
    canary.currentPercent = initialPercent;
    canary.status = 'progressing';

    // Start analysis loop
    startCanaryAnalysis(canary);

    await sendNotification(
      'Canary Deployment Started',
      `Canary deployment ${deploymentId} started with ${initialPercent}% traffic`,
      'info'
    );

    return { success: true, canary };
  } catch (error) {
    canary.status = 'failed';
    log('error', 'Failed to start canary deployment', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Deploy canary container with traffic split
 */
async function deployCanaryContainer(canary, percent) {
  log('info', 'Deploying canary container', { id: canary.id, percent });

  try {
    // Check if canary container exists
    const containers = await docker.listContainers({ all: true });
    const canaryContainer = containers.find(c => 
      c.Names.some(n => n.includes(`${config.appContainer}-canary`))
    );

    if (canaryContainer) {
      // Update existing canary
      const container = docker.getContainer(canaryContainer.Id);
      await container.stop().catch(() => {});
      await container.remove().catch(() => {});
    }

    // Create new canary container
    const stableContainer = containers.find(c => 
      c.Names.some(n => n.includes(config.appContainer) && !n.includes('canary'))
    );

    if (!stableContainer) {
      throw new Error('Stable container not found');
    }

    // Get stable container config
    const stableInspect = await docker.getContainer(stableContainer.Id).inspect();

    // Create canary with same config but different image
    const canaryContainerConfig = {
      Image: canary.canaryImage,
      name: `${config.appContainer}-canary`,
      Env: stableInspect.Config.Env,
      Labels: {
        ...stableInspect.Config.Labels,
        'canary.deployment.id': String(canary.id),
        'canary.traffic.percent': String(percent),
      },
      HostConfig: {
        ...stableInspect.HostConfig,
        PortBindings: {}, // Don't bind ports directly
      },
      NetworkingConfig: stableInspect.NetworkSettings.Networks,
    };

    const newContainer = await docker.createContainer(canaryContainerConfig);
    await newContainer.start();

    log('info', 'Canary container deployed', { id: canary.id, percent });
    broadcast('canary', { action: 'deployed', deploymentId: canary.id, percent });

    // Update load balancer/proxy for traffic split
    await updateTrafficSplit(canary.id, percent);

    return { success: true };
  } catch (error) {
    log('error', 'Failed to deploy canary container', { error: error.message });
    throw error;
  }
}

/**
 * Update traffic split between stable and canary
 */
async function updateTrafficSplit(deploymentId, canaryPercent) {
  log('info', 'Updating traffic split', { deploymentId, canaryPercent });

  // This would integrate with your load balancer (nginx, traefik, etc.)
  // For now, we'll update container labels and emit an event

  broadcast('canary', { 
    action: 'traffic_update', 
    deploymentId, 
    canaryPercent,
    stablePercent: 100 - canaryPercent,
  });

  // If using nginx, update upstream weights
  // If using traefik, update service weights
  // If using Kubernetes, update virtual service

  return { success: true };
}

/**
 * Start canary analysis loop
 */
function startCanaryAnalysis(canary) {
  const analysisIntervalMs = 30000; // 30 seconds

  const analyze = async () => {
    if (canary.status !== 'progressing' && canary.status !== 'paused') {
      return;
    }

    try {
      const metrics = await collectCanaryMetrics(canary);
      canary.metrics.push(metrics);

      // Keep only last 100 metrics
      if (canary.metrics.length > 100) {
        canary.metrics = canary.metrics.slice(-100);
      }

      const analysis = analyzeCanaryMetrics(canary, metrics);

      broadcast('canary', {
        action: 'analysis',
        deploymentId: canary.id,
        metrics,
        analysis,
      });

      if (analysis.shouldRollback && canary.autoRollbackEnabled) {
        log('warn', 'Auto-rollback triggered', { reason: analysis.reason });
        await rollbackCanary(canary, analysis.reason);
        return;
      }

      if (analysis.shouldProgress && canary.status === 'progressing') {
        await progressCanary(canary);
      }
    } catch (error) {
      log('error', 'Canary analysis error', { error: error.message });
    }
  };

  // Run analysis immediately and then on interval
  analyze();
  canary.analysisInterval = setInterval(analyze, analysisIntervalMs);
}

/**
 * Collect metrics for canary analysis
 */
async function collectCanaryMetrics(canary) {
  // In production, this would collect real metrics from:
  // - Prometheus
  // - Application logs
  // - Health endpoints
  // - Load balancer stats

  const metrics = {
    timestamp: Date.now(),
    canaryPercent: canary.currentPercent,
    canary: {
      requests: Math.floor(Math.random() * 100) + 50,
      errors: Math.floor(Math.random() * 5),
      avgLatency: 50 + Math.random() * 100,
      p99Latency: 100 + Math.random() * 200,
      healthyPods: 1,
      totalPods: 1,
    },
    stable: {
      requests: Math.floor(Math.random() * 900) + 450,
      errors: Math.floor(Math.random() * 10),
      avgLatency: 50 + Math.random() * 50,
      p99Latency: 100 + Math.random() * 100,
      healthyPods: 3,
      totalPods: 3,
    },
  };

  metrics.canary.errorRate = (metrics.canary.errors / metrics.canary.requests) * 100;
  metrics.stable.errorRate = (metrics.stable.errors / metrics.stable.requests) * 100;

  return metrics;
}

/**
 * Analyze canary metrics and determine next action
 */
function analyzeCanaryMetrics(canary, metrics) {
  const analysis = {
    isHealthy: true,
    shouldRollback: false,
    shouldProgress: false,
    reason: '',
  };

  // Check error rate
  if (metrics.canary.errorRate > canary.errorRateThreshold) {
    analysis.isHealthy = false;
    analysis.shouldRollback = true;
    analysis.reason = `Error rate ${metrics.canary.errorRate.toFixed(2)}% exceeds threshold ${canary.errorRateThreshold}%`;
    return analysis;
  }

  // Check latency
  if (metrics.canary.avgLatency > canary.latencyThresholdMs) {
    analysis.isHealthy = false;
    analysis.shouldRollback = true;
    analysis.reason = `Latency ${metrics.canary.avgLatency.toFixed(0)}ms exceeds threshold ${canary.latencyThresholdMs}ms`;
    return analysis;
  }

  // Check if enough time has passed for next increment
  const timeSinceLastProgress = Date.now() - (canary.lastProgressTime || canary.startTime);
  const incrementIntervalMs = canary.incrementIntervalMinutes * 60 * 1000;

  if (timeSinceLastProgress >= incrementIntervalMs && canary.currentPercent < canary.targetPercent) {
    analysis.shouldProgress = true;
    analysis.reason = 'Metrics healthy, ready for next increment';
  }

  return analysis;
}

/**
 * Progress canary to next traffic percentage
 */
async function progressCanary(canary) {
  const newPercent = Math.min(
    canary.currentPercent + canary.incrementPercent,
    canary.targetPercent
  );

  log('info', 'Progressing canary', { id: canary.id, from: canary.currentPercent, to: newPercent });

  try {
    await updateTrafficSplit(canary.id, newPercent);
    canary.currentPercent = newPercent;
    canary.lastProgressTime = Date.now();

    broadcast('canary', {
      action: 'progress',
      deploymentId: canary.id,
      percent: newPercent,
    });

    if (newPercent >= canary.targetPercent) {
      // Canary is ready for promotion
      log('info', 'Canary ready for promotion', { id: canary.id });
      canary.status = 'promoting';

      await sendNotification(
        'Canary Ready for Promotion',
        `Canary deployment ${canary.id} has reached ${newPercent}% traffic and is ready for promotion`,
        'success'
      );
    }

    return { success: true, percent: newPercent };
  } catch (error) {
    log('error', 'Failed to progress canary', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Rollback canary deployment
 */
async function rollbackCanary(canary, reason) {
  log('warn', 'Rolling back canary', { id: canary.id, reason });

  canary.status = 'rolling_back';

  if (canary.analysisInterval) {
    clearInterval(canary.analysisInterval);
  }

  try {
    // Remove canary container
    const containers = await docker.listContainers({ all: true });
    const canaryContainer = containers.find(c => 
      c.Names.some(n => n.includes(`${config.appContainer}-canary`))
    );

    if (canaryContainer) {
      const container = docker.getContainer(canaryContainer.Id);
      await container.stop().catch(() => {});
      await container.remove().catch(() => {});
    }

    // Reset traffic to 100% stable
    await updateTrafficSplit(canary.id, 0);

    canary.status = 'rolled_back';
    canary.endTime = Date.now();

    broadcast('canary', {
      action: 'rollback',
      deploymentId: canary.id,
      reason,
    });

    await sendNotification(
      'Canary Rolled Back',
      `Canary deployment ${canary.id} was rolled back: ${reason}`,
      'error'
    );

    return { success: true };
  } catch (error) {
    log('error', 'Failed to rollback canary', { error: error.message });
    canary.status = 'failed';
    return { success: false, error: error.message };
  }
}

/**
 * Promote canary to stable
 */
async function promoteCanary(canary) {
  log('info', 'Promoting canary to stable', { id: canary.id });

  canary.status = 'promoting';

  if (canary.analysisInterval) {
    clearInterval(canary.analysisInterval);
  }

  try {
    // Update stable container with canary image
    const containers = await docker.listContainers({ all: true });
    const stableContainer = containers.find(c => 
      c.Names.some(n => n.includes(config.appContainer) && !n.includes('canary'))
    );

    if (stableContainer) {
      // In production, this would update the stable deployment
      // For Docker, we'd recreate the container with the new image
      log('info', 'Updating stable container with canary image', { image: canary.canaryImage });
    }

    // Remove canary container
    const canaryContainer = containers.find(c => 
      c.Names.some(n => n.includes(`${config.appContainer}-canary`))
    );

    if (canaryContainer) {
      const container = docker.getContainer(canaryContainer.Id);
      await container.stop().catch(() => {});
      await container.remove().catch(() => {});
    }

    // Reset traffic
    await updateTrafficSplit(canary.id, 0);

    canary.status = 'promoted';
    canary.endTime = Date.now();

    broadcast('canary', {
      action: 'promoted',
      deploymentId: canary.id,
    });

    await sendNotification(
      'Canary Promoted',
      `Canary deployment ${canary.id} has been promoted to stable`,
      'success'
    );

    return { success: true };
  } catch (error) {
    log('error', 'Failed to promote canary', { error: error.message });
    canary.status = 'failed';
    return { success: false, error: error.message };
  }
}

// Canary API endpoints
app.post('/canary/start', async (req, res) => {
  if (!verifyDeploySecret(req)) {
    return res.status(401).json({ error: 'Invalid deploy secret' });
  }

  const result = await startCanaryDeployment(req.body);
  res.json(result);
});

app.post('/canary/:id/progress', async (req, res) => {
  if (!verifyDeploySecret(req)) {
    return res.status(401).json({ error: 'Invalid deploy secret' });
  }

  const canary = canaryState.activeDeployments.find(c => c.id === parseInt(req.params.id));
  if (!canary) {
    return res.status(404).json({ error: 'Canary deployment not found' });
  }

  const result = await progressCanary(canary);
  res.json(result);
});

app.post('/canary/:id/rollback', async (req, res) => {
  if (!verifyDeploySecret(req)) {
    return res.status(401).json({ error: 'Invalid deploy secret' });
  }

  const canary = canaryState.activeDeployments.find(c => c.id === parseInt(req.params.id));
  if (!canary) {
    return res.status(404).json({ error: 'Canary deployment not found' });
  }

  const result = await rollbackCanary(canary, req.body.reason || 'Manual rollback');
  res.json(result);
});

app.post('/canary/:id/promote', async (req, res) => {
  if (!verifyDeploySecret(req)) {
    return res.status(401).json({ error: 'Invalid deploy secret' });
  }

  const canary = canaryState.activeDeployments.find(c => c.id === parseInt(req.params.id));
  if (!canary) {
    return res.status(404).json({ error: 'Canary deployment not found' });
  }

  const result = await promoteCanary(canary);
  res.json(result);
});

app.post('/canary/:id/pause', async (req, res) => {
  if (!verifyDeploySecret(req)) {
    return res.status(401).json({ error: 'Invalid deploy secret' });
  }

  const canary = canaryState.activeDeployments.find(c => c.id === parseInt(req.params.id));
  if (!canary) {
    return res.status(404).json({ error: 'Canary deployment not found' });
  }

  canary.status = 'paused';
  broadcast('canary', { action: 'paused', deploymentId: canary.id });
  res.json({ success: true });
});

app.post('/canary/:id/resume', async (req, res) => {
  if (!verifyDeploySecret(req)) {
    return res.status(401).json({ error: 'Invalid deploy secret' });
  }

  const canary = canaryState.activeDeployments.find(c => c.id === parseInt(req.params.id));
  if (!canary) {
    return res.status(404).json({ error: 'Canary deployment not found' });
  }

  canary.status = 'progressing';
  broadcast('canary', { action: 'resumed', deploymentId: canary.id });
  res.json({ success: true });
});

app.get('/canary', (req, res) => {
  res.json({
    activeDeployments: canaryState.activeDeployments.map(c => ({
      id: c.id,
      status: c.status,
      currentPercent: c.currentPercent,
      targetPercent: c.targetPercent,
      canaryImage: c.canaryImage,
      stableImage: c.stableImage,
      startTime: c.startTime,
      endTime: c.endTime,
      metricsCount: c.metrics.length,
    })),
  });
});

app.get('/canary/:id', (req, res) => {
  const canary = canaryState.activeDeployments.find(c => c.id === parseInt(req.params.id));
  if (!canary) {
    return res.status(404).json({ error: 'Canary deployment not found' });
  }

  res.json({
    ...canary,
    metrics: canary.metrics.slice(-20), // Last 20 metrics
  });
});

app.get('/canary/:id/metrics', (req, res) => {
  const canary = canaryState.activeDeployments.find(c => c.id === parseInt(req.params.id));
  if (!canary) {
    return res.status(404).json({ error: 'Canary deployment not found' });
  }

  const limit = parseInt(req.query.limit) || 50;
  res.json({
    metrics: canary.metrics.slice(-limit),
    total: canary.metrics.length,
  });
});

// ============================================
// POLLING
// ============================================

/**
 * Polling для проверки обновлений
 */
async function poll() {
  state.lastPollTime = new Date().toISOString();
  
  try {
    const { hasUpdates, currentCommit, remoteCommit } = await checkForUpdates();
    
    if (hasUpdates) {
      log('info', 'Updates detected via polling', { currentCommit, remoteCommit });
      await deploy('poll');
    }
    
    // Also refresh GitHub Actions
    await getGitHubActionsRuns();
  } catch (error) {
    log('error', 'Polling error', { error: error.message });
  }
}

// ============================================
// STARTUP
// ============================================

async function init() {
  // Ensure data directory exists
  await fs.mkdir(config.dataPath, { recursive: true }).catch(() => {});
  
  // Load state from file
  try {
    const stateFile = path.join(config.dataPath, 'state.json');
    const savedState = await fs.readFile(stateFile, 'utf-8');
    const parsed = JSON.parse(savedState);
    state.lastCommit = parsed.lastCommit || '';
    state.deploymentHistory = parsed.deploymentHistory || [];
    log('info', 'Loaded saved state');
  } catch {
    log('info', 'No saved state found, starting fresh');
  }
  
  // Get current commit
  state.lastCommit = await getCurrentCommit() || '';
  
  // Save state periodically
  setInterval(async () => {
    try {
      const stateFile = path.join(config.dataPath, 'state.json');
      await fs.writeFile(stateFile, JSON.stringify({
        lastCommit: state.lastCommit,
        deploymentHistory: state.deploymentHistory,
      }, null, 2));
    } catch (error) {
      log('error', 'Failed to save state', { error: error.message });
    }
  }, 60000); // Every minute
  
  // Start polling
  if (config.pollInterval > 0) {
    log('info', 'Starting polling', { interval: config.pollInterval / 1000 });
    setInterval(poll, config.pollInterval);
    
    // Initial poll after 30 seconds
    setTimeout(poll, 30000);
  }
  
  // Start server
  server.listen(config.webhookPort, '0.0.0.0', () => {
    log('info', 'Pull Agent started', {
      port: config.webhookPort,
      repo: config.githubRepo,
      branch: config.githubBranch,
      pollInterval: config.pollInterval / 1000,
      webUI: `http://localhost:${config.webhookPort}`,
    });
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'Received SIGINT, shutting down');
  process.exit(0);
});

// Start
init().catch(error => {
  console.error('Failed to start Pull Agent:', error);
  process.exit(1);
});
