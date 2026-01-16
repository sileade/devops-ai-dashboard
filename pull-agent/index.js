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
 */

import express from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import Docker from 'dockerode';

const execAsync = promisify(exec);

// Configuration
const config = {
  // GitHub settings
  githubRepo: process.env.GITHUB_REPO || 'sileade/devops-ai-dashboard',
  githubBranch: process.env.GITHUB_BRANCH || 'main',
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
  
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
};

// State
const state = {
  lastCommit: '',
  lastDeployment: null,
  deploymentHistory: [],
  isDeploying: false,
  failedAttempts: 0,
  lastPollTime: null,
};

// Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Express app
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/json', limit: '10mb' }));

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Логирование с временной меткой
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
 * Выполнение команды с таймаутом
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
  });
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
 * Проверка наличия обновлений
 */
async function checkForUpdates() {
  const currentCommit = await getCurrentCommit();
  const remoteCommit = await getRemoteCommit();
  
  if (!currentCommit || !remoteCommit) {
    return { hasUpdates: false, error: 'Failed to get commits' };
  }
  
  return {
    hasUpdates: currentCommit !== remoteCommit,
    currentCommit,
    remoteCommit,
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
    const { stdout } = await execAsync(`git pull origin ${config.githubBranch}`, { cwd: config.repoPath });
    
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
 * Rebuild и restart контейнера
 */
async function rebuildAndRestart() {
  try {
    log('info', 'Starting rebuild process');
    
    // Build new image
    const buildResult = await execWithTimeout(
      'docker-compose build --no-cache app',
      { cwd: config.repoPath },
      600000 // 10 minutes timeout
    );
    log('info', 'Build completed', { output: buildResult.stdout });
    
    // Restart container
    const restartResult = await execWithTimeout(
      'docker-compose up -d app',
      { cwd: config.repoPath },
      120000 // 2 minutes timeout
    );
    log('info', 'Container restarted', { output: restartResult.stdout });
    
    return { success: true };
  } catch (error) {
    log('error', 'Rebuild failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Проверка здоровья приложения
 */
async function healthCheck(timeout = config.healthCheckTimeout) {
  const startTime = Date.now();
  const checkInterval = 5000; // 5 seconds
  
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
      const response = await fetch('http://localhost:3000/api/health', { timeout: 5000 });
      if (response.ok) {
        log('info', 'Health check passed');
        return { healthy: true };
      }
    } catch (error) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  log('error', 'Health check failed - timeout');
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
    await sendNotification(
      'Rollback Completed',
      `Successfully rolled back to commit ${previousCommit.substring(0, 7)}`,
      'warning'
    );
    
    return { success: true };
  } catch (error) {
    log('error', 'Rollback failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

// ============================================
// DEPLOYMENT LOGIC
// ============================================

/**
 * Основной процесс деплоя
 */
async function deploy(trigger = 'manual') {
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
  };
  
  state.lastDeployment = deployment;
  
  try {
    log('info', 'Starting deployment', { trigger, previousCommit });
    await sendNotification(
      'Deployment Started',
      `Starting deployment from ${trigger}. Previous commit: ${previousCommit?.substring(0, 7)}`,
      'info'
    );
    
    // Step 1: Git pull
    const pullResult = await gitPull();
    if (!pullResult.success) {
      throw new Error(`Git pull failed: ${pullResult.error}`);
    }
    
    const newCommit = await getCurrentCommit();
    deployment.newCommit = newCommit;
    
    // Step 2: Rebuild and restart
    const rebuildResult = await rebuildAndRestart();
    if (!rebuildResult.success) {
      throw new Error(`Rebuild failed: ${rebuildResult.error}`);
    }
    
    // Step 3: Health check
    const health = await healthCheck();
    if (!health.healthy) {
      throw new Error('Health check failed');
    }
    
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
    
    await sendNotification(
      'Deployment Successful',
      `Successfully deployed commit ${newCommit?.substring(0, 7)} in ${Math.round(deployment.duration / 1000)}s`,
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
    
    // Try rollback
    if (config.rollbackEnabled && previousCommit) {
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

// ============================================
// API ROUTES
// ============================================

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
  
  // Handle ping events
  if (event === 'ping') {
    log('info', 'Webhook ping received');
    return res.json({ message: 'Pong!' });
  }
  
  res.json({ message: 'Event not handled', event });
});

// Manual deploy endpoint
app.post('/deploy', async (req, res) => {
  const { force = false } = req.body || {};
  
  if (state.isDeploying && !force) {
    return res.status(409).json({ error: 'Deployment in progress' });
  }
  
  log('info', 'Manual deployment triggered');
  
  // Start deployment asynchronously
  deploy('manual').catch(console.error);
  
  res.json({ message: 'Deployment triggered' });
});

// Check for updates endpoint
app.get('/check-updates', async (req, res) => {
  const result = await checkForUpdates();
  res.json(result);
});

// Rollback endpoint
app.post('/rollback', async (req, res) => {
  const { commit } = req.body || {};
  
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
  } catch (error) {
    log('error', 'Polling error', { error: error.message });
  }
}

// ============================================
// STARTUP
// ============================================

async function init() {
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
  app.listen(config.webhookPort, '0.0.0.0', () => {
    log('info', 'Pull Agent started', {
      port: config.webhookPort,
      repo: config.githubRepo,
      branch: config.githubBranch,
      pollInterval: config.pollInterval / 1000,
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
