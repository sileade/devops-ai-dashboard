/**
 * GitOps Page
 * 
 * Управление автоматическими деплоями через Pull Agent
 * - Статус деплоя
 * - Ручной pull/deploy
 * - История деплоев
 * - Интеграция с GitHub Actions
 * - Rollback
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
  GitBranch, 
  GitCommit, 
  Play, 
  RotateCcw, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Terminal,
  ExternalLink,
  Settings,
  Loader2,
  Rocket,
  History,
  Github,
  Webhook
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface DeploymentStatus {
  isDeploying: boolean;
  lastCommit: string;
  lastDeployment: {
    id: string;
    status: string;
    trigger: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    newCommit?: string;
    error?: string;
  } | null;
  failedAttempts: number;
}

interface Deployment {
  id: string;
  status: string;
  trigger: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  previousCommit?: string;
  newCommit?: string;
  error?: string;
  commitInfo?: {
    message: string;
    author: string;
  };
}

interface GitHubRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  branch: string;
  commit: string;
  actor: string;
  createdAt: string;
  url: string;
}

interface Commit {
  sha: string;
  shortSha: string;
  author: string;
  date: string;
  message: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export default function GitOps() {
  const [pullAgentUrl, setPullAgentUrl] = useState('http://localhost:9000');
  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [githubRuns, setGithubRuns] = useState<GitHubRun[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [updateInfo, setUpdateInfo] = useState<{ hasUpdates: boolean; remoteCommit?: string; remoteInfo?: { message: string } } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load Pull Agent URL from localStorage
  useEffect(() => {
    const savedUrl = localStorage.getItem('pullAgentUrl');
    if (savedUrl) {
      setPullAgentUrl(savedUrl);
    }
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const wsUrl = pullAgentUrl.replace('http', 'ws') + '/ws';
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          toast.success('Connected to Pull Agent');
        };
        
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          handleWebSocketMessage(msg);
        };
        
        ws.onclose = () => {
          console.log('WebSocket disconnected');
          // Reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        wsRef.current = ws;
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [pullAgentUrl]);

  // Handle WebSocket messages
  const handleWebSocketMessage = (msg: { type: string; data: unknown }) => {
    switch (msg.type) {
      case 'state':
        const stateData = msg.data as DeploymentStatus & { logs?: LogEntry[] };
        setStatus({
          isDeploying: stateData.isDeploying,
          lastCommit: stateData.lastCommit,
          lastDeployment: stateData.lastDeployment,
          failedAttempts: 0,
        });
        setIsDeploying(stateData.isDeploying);
        if (stateData.logs) {
          setLogs(stateData.logs);
        }
        break;
      case 'log':
        const logData = msg.data as LogEntry;
        setLogs(prev => [...prev.slice(-499), logData]);
        break;
      case 'deployment':
        // Deployment phase update
        break;
    }
  };

  // Scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Fetch data from Pull Agent
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch status
      const statusRes = await fetch(`${pullAgentUrl}/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus({
          isDeploying: statusData.state.isDeploying,
          lastCommit: statusData.state.lastCommit,
          lastDeployment: statusData.state.lastDeployment,
          failedAttempts: statusData.state.failedAttempts,
        });
        setIsDeploying(statusData.state.isDeploying);
      }
      
      // Fetch history
      const historyRes = await fetch(`${pullAgentUrl}/history`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setDeployments(historyData.deployments);
      }
      
      // Fetch GitHub Actions
      const actionsRes = await fetch(`${pullAgentUrl}/github/actions`);
      if (actionsRes.ok) {
        const actionsData = await actionsRes.json();
        setGithubRuns(actionsData);
      }
      
      // Fetch commits
      const commitsRes = await fetch(`${pullAgentUrl}/commits`);
      if (commitsRes.ok) {
        const commitsData = await commitsRes.json();
        setCommits(commitsData);
      }
      
      // Fetch logs
      const logsRes = await fetch(`${pullAgentUrl}/logs`);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to connect to Pull Agent');
    }
    setIsLoading(false);
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [pullAgentUrl]);

  // Check for updates
  const checkUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      const res = await fetch(`${pullAgentUrl}/check-updates`);
      if (res.ok) {
        const data = await res.json();
        setUpdateInfo(data);
        if (data.hasUpdates) {
          toast.info('Updates available!');
        } else {
          toast.success('Already up to date');
        }
      }
    } catch (error) {
      toast.error('Failed to check for updates');
    }
    setIsCheckingUpdates(false);
  };

  // Trigger deployment
  const triggerDeploy = async () => {
    try {
      const res = await fetch(`${pullAgentUrl}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        toast.success('Deployment triggered');
        setIsDeploying(true);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to trigger deployment');
      }
    } catch (error) {
      toast.error('Failed to trigger deployment');
    }
  };

  // Trigger rollback
  const triggerRollback = async (commit: string) => {
    try {
      const res = await fetch(`${pullAgentUrl}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commit }),
      });
      if (res.ok) {
        toast.success('Rollback triggered');
        setShowRollbackDialog(false);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to trigger rollback');
      }
    } catch (error) {
      toast.error('Failed to trigger rollback');
    }
  };

  // Trigger GitHub Actions workflow
  const triggerWorkflow = async () => {
    try {
      const res = await fetch(`${pullAgentUrl}/github/trigger-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: 'cd.yml' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('CI/CD workflow triggered');
      } else {
        toast.error(data.error || 'Failed to trigger workflow');
      }
    } catch (error) {
      toast.error('Failed to trigger workflow');
    }
  };

  // Save Pull Agent URL
  const savePullAgentUrl = () => {
    localStorage.setItem('pullAgentUrl', pullAgentUrl);
    toast.success('Pull Agent URL saved');
    fetchData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Success</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'running':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getGitHubStatusBadge = (status: string, conclusion: string | null) => {
    if (status === 'in_progress') {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> In Progress</Badge>;
    }
    if (conclusion === 'success') {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Success</Badge>;
    }
    if (conclusion === 'failure') {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GitOps Deployments</h1>
          <p className="text-muted-foreground">Manage automatic deployments via Pull Agent</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            {isDeploying ? (
              <div className="flex items-center gap-2 text-yellow-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xl font-semibold">Deploying...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-xl font-semibold">Idle</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Commit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <GitCommit className="w-5 h-5 text-muted-foreground" />
              <code className="text-xl font-mono">{status?.lastCommit?.substring(0, 7) || '---'}</code>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Deployment</CardDescription>
          </CardHeader>
          <CardContent>
            {status?.lastDeployment ? (
              <div className="flex items-center gap-2">
                {getStatusBadge(status.lastDeployment.status)}
                <span className="text-sm text-muted-foreground">
                  {status.lastDeployment.duration ? formatDuration(status.lastDeployment.duration) : ''}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">No deployments yet</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed Attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {(status?.failedAttempts || 0) > 0 ? (
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              )}
              <span className="text-xl font-semibold">{status?.failedAttempts || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Update Alert */}
      {updateInfo?.hasUpdates && (
        <Alert className="border-blue-500/30 bg-blue-500/10">
          <Rocket className="h-4 w-4" />
          <AlertTitle>Update Available</AlertTitle>
          <AlertDescription>
            New commit available: <code className="font-mono">{updateInfo.remoteCommit?.substring(0, 7)}</code>
            {updateInfo.remoteInfo?.message && (
              <span className="block mt-1 text-muted-foreground">{updateInfo.remoteInfo.message}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manual deployment controls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={checkUpdates} 
              disabled={isCheckingUpdates}
              variant="outline"
            >
              {isCheckingUpdates ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Check for Updates
            </Button>

            <Button 
              onClick={triggerDeploy} 
              disabled={isDeploying}
              className="bg-green-600 hover:bg-green-700"
            >
              {isDeploying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Pull & Deploy
            </Button>

            <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={isDeploying}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Rollback
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rollback to Previous Version</DialogTitle>
                  <DialogDescription>
                    Select a commit to rollback to
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {commits.map((commit) => (
                      <button
                        key={commit.sha}
                        onClick={() => setSelectedCommit(commit.sha)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedCommit === commit.sha 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <code className="font-mono text-sm">{commit.shortSha}</code>
                          <span className="text-xs text-muted-foreground">{commit.author}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 truncate">{commit.message}</p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowRollbackDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => triggerRollback(selectedCommit)}
                    disabled={!selectedCommit}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    Rollback
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button 
              onClick={triggerWorkflow}
              variant="outline"
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            >
              <Github className="w-4 h-4 mr-2" />
              Trigger CI/CD
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">
            <Terminal className="w-4 h-4 mr-2" />
            Live Logs
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            Deployment History
          </TabsTrigger>
          <TabsTrigger value="github">
            <Github className="w-4 h-4 mr-2" />
            GitHub Actions
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Live Logs</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 bg-gray-950 rounded-lg p-4 font-mono text-sm">
                {logs.length === 0 ? (
                  <div className="text-muted-foreground">No logs yet...</div>
                ) : (
                  logs.map((log, i) => (
                    <div 
                      key={i} 
                      className={`py-0.5 ${
                        log.level === 'error' ? 'text-red-400' :
                        log.level === 'warn' ? 'text-yellow-400' :
                        log.level === 'info' ? 'text-blue-400' :
                        'text-gray-400'
                      }`}
                    >
                      <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                      {log.message}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Deployment History</CardTitle>
              <CardDescription>Recent deployment attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {deployments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No deployments yet
                </div>
              ) : (
                <div className="space-y-4">
                  {deployments.map((deployment) => (
                    <div 
                      key={deployment.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-4">
                        {getStatusBadge(deployment.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm">
                              {deployment.newCommit?.substring(0, 7) || deployment.previousCommit?.substring(0, 7) || '---'}
                            </code>
                            <Badge variant="outline" className="text-xs">
                              {deployment.trigger}
                            </Badge>
                          </div>
                          {deployment.commitInfo?.message && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {deployment.commitInfo.message}
                            </p>
                          )}
                          {deployment.error && (
                            <p className="text-sm text-red-400 mt-1">
                              {deployment.error}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>{formatDate(deployment.startTime)}</div>
                        {deployment.duration && (
                          <div className="flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3" />
                            {formatDuration(deployment.duration)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GitHub Actions Tab */}
        <TabsContent value="github">
          <Card>
            <CardHeader>
              <CardTitle>GitHub Actions</CardTitle>
              <CardDescription>Recent workflow runs</CardDescription>
            </CardHeader>
            <CardContent>
              {githubRuns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No GitHub Actions runs found. Configure GITHUB_TOKEN in Pull Agent to enable this feature.
                </div>
              ) : (
                <div className="space-y-4">
                  {githubRuns.map((run) => (
                    <a
                      key={run.id}
                      href={run.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {getGitHubStatusBadge(run.status, run.conclusion)}
                        <div>
                          <div className="font-medium">{run.name}</div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <GitBranch className="w-3 h-3" />
                            {run.branch}
                            <span>•</span>
                            <code className="font-mono">{run.commit.substring(0, 7)}</code>
                            <span>•</span>
                            {run.actor}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {formatDate(run.createdAt)}
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Pull Agent Settings</CardTitle>
              <CardDescription>Configure connection to Pull Agent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pullAgentUrl">Pull Agent URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="pullAgentUrl"
                    value={pullAgentUrl}
                    onChange={(e) => setPullAgentUrl(e.target.value)}
                    placeholder="http://localhost:9000"
                  />
                  <Button onClick={savePullAgentUrl}>Save</Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  URL of the Pull Agent service. Default is http://localhost:9000
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium">Webhook Configuration</h4>
                <p className="text-sm text-muted-foreground">
                  Configure GitHub webhook to enable automatic deployments on push:
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Payload URL:</span>
                    <code className="ml-2">{pullAgentUrl}/webhook/github</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Content type:</span>
                    <code className="ml-2">application/json</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Events:</span>
                    <code className="ml-2">push</code>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium">Environment Variables</h4>
                <p className="text-sm text-muted-foreground">
                  Required environment variables for Pull Agent:
                </p>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
                  <div>GITHUB_REPO=owner/repo</div>
                  <div>GITHUB_BRANCH=main</div>
                  <div>GITHUB_WEBHOOK_SECRET=your-secret</div>
                  <div>GITHUB_TOKEN=ghp_xxx (optional, for Actions)</div>
                  <div>POLL_INTERVAL=300 (seconds)</div>
                  <div>SLACK_WEBHOOK=https://hooks.slack.com/...</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
