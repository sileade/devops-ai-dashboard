import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc';
import { 
  GitBranch, 
  RefreshCw, 
  Play, 
  RotateCcw, 
  Settings, 
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Trash2,
  Eye,
  Bot,
  Server,
  Database
} from 'lucide-react';
import { toast } from 'sonner';

interface ArgoCDApplication {
  metadata: {
    name: string;
    namespace: string;
    uid?: string;
    creationTimestamp?: string;
  };
  spec: {
    project: string;
    source: {
      repoURL: string;
      path: string;
      targetRevision: string;
    };
    destination: {
      server: string;
      namespace: string;
    };
    syncPolicy?: {
      automated?: {
        prune?: boolean;
        selfHeal?: boolean;
      };
    };
  };
  status?: {
    sync: {
      status: 'Synced' | 'OutOfSync' | 'Unknown';
      revision?: string;
    };
    health: {
      status: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
      message?: string;
    };
    operationState?: {
      phase: string;
      message?: string;
    };
    history?: Array<{
      revision: string;
      deployedAt: string;
      id: number;
    }>;
  };
}

export default function ArgoCD() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [selectedApp, setSelectedApp] = useState<ArgoCDApplication | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // New application form state
  const [newApp, setNewApp] = useState({
    name: '',
    project: 'default',
    repoURL: '',
    path: '',
    targetRevision: 'HEAD',
    destinationServer: 'https://kubernetes.default.svc',
    destinationNamespace: '',
    autoSync: false,
    selfHeal: false,
    prune: false,
  });

  // Mock data for demo
  const [applications] = useState<ArgoCDApplication[]>([
    {
      metadata: { name: 'api-server', namespace: 'argocd' },
      spec: {
        project: 'default',
        source: { repoURL: 'https://github.com/example/api-server', path: 'k8s', targetRevision: 'main' },
        destination: { server: 'https://kubernetes.default.svc', namespace: 'production' },
        syncPolicy: { automated: { prune: true, selfHeal: true } },
      },
      status: {
        sync: { status: 'Synced', revision: 'abc123' },
        health: { status: 'Healthy' },
        history: [
          { revision: 'abc123', deployedAt: new Date().toISOString(), id: 3 },
          { revision: 'def456', deployedAt: new Date(Date.now() - 86400000).toISOString(), id: 2 },
        ],
      },
    },
    {
      metadata: { name: 'web-frontend', namespace: 'argocd' },
      spec: {
        project: 'default',
        source: { repoURL: 'https://github.com/example/web-frontend', path: 'deploy', targetRevision: 'main' },
        destination: { server: 'https://kubernetes.default.svc', namespace: 'production' },
      },
      status: {
        sync: { status: 'OutOfSync', revision: 'xyz789' },
        health: { status: 'Progressing' },
        operationState: { phase: 'Running', message: 'Syncing...' },
      },
    },
    {
      metadata: { name: 'worker-service', namespace: 'argocd' },
      spec: {
        project: 'default',
        source: { repoURL: 'https://github.com/example/worker', path: 'manifests', targetRevision: 'v2.0.0' },
        destination: { server: 'https://kubernetes.default.svc', namespace: 'production' },
      },
      status: {
        sync: { status: 'Synced', revision: 'tag-v2.0.0' },
        health: { status: 'Degraded', message: '1/3 pods unhealthy' },
      },
    },
  ]);

  const handleConnect = async () => {
    if (!serverUrl || !token) {
      toast.error('Please enter server URL and token');
      return;
    }
    // In production, this would call trpc.argocd.initialize
    setIsConfigured(true);
    toast.success('Connected to ArgoCD');
  };

  const handleSync = (appName: string) => {
    toast.info(`Syncing ${appName}...`);
    // In production: trpc.argocd.syncApplication.mutate({ name: appName })
  };

  const handleRollback = (appName: string, id: number) => {
    toast.info(`Rolling back ${appName} to revision ${id}...`);
    // In production: trpc.argocd.rollbackApplication.mutate({ name: appName, id })
  };

  const handleRefresh = (appName: string) => {
    toast.info(`Refreshing ${appName}...`);
    // In production: trpc.argocd.refreshApplication.mutate({ name: appName, hard: false })
  };

  const handleCreateApp = () => {
    toast.success(`Application ${newApp.name} created`);
    setShowCreateDialog(false);
    setNewApp({
      name: '',
      project: 'default',
      repoURL: '',
      path: '',
      targetRevision: 'HEAD',
      destinationServer: 'https://kubernetes.default.svc',
      destinationNamespace: '',
      autoSync: false,
      selfHeal: false,
      prune: false,
    });
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'Synced':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Synced</Badge>;
      case 'OutOfSync':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertTriangle className="w-3 h-3 mr-1" />Out of Sync</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30"><Clock className="w-3 h-3 mr-1" />Unknown</Badge>;
    }
  };

  const getHealthStatusBadge = (status: string) => {
    switch (status) {
      case 'Healthy':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Healthy</Badge>;
      case 'Progressing':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Progressing</Badge>;
      case 'Degraded':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Degraded</Badge>;
      case 'Suspended':
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30"><Clock className="w-3 h-3 mr-1" />Suspended</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Unknown</Badge>;
    }
  };

  if (!isConfigured) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-6 h-6 text-orange-400" />
                Connect to ArgoCD
              </CardTitle>
              <CardDescription>
                Configure your ArgoCD server connection for GitOps workflow management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serverUrl">ArgoCD Server URL</Label>
                <Input
                  id="serverUrl"
                  placeholder="https://argocd.example.com"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="bg-slate-900/50 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token">API Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Enter your ArgoCD API token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="bg-slate-900/50 border-slate-600"
                />
                <p className="text-xs text-slate-400">
                  Generate a token from ArgoCD Settings → Accounts → your-account → Generate New
                </p>
              </div>
              <Button onClick={handleConnect} className="w-full bg-orange-600 hover:bg-orange-700">
                Connect to ArgoCD
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <GitBranch className="w-7 h-7 text-orange-400" />
              ArgoCD GitOps
            </h1>
            <p className="text-slate-400 mt-1">Manage your GitOps deployments with ArgoCD</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New Application
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Application</DialogTitle>
                  <DialogDescription>
                    Create a new ArgoCD application for GitOps deployment
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Application Name</Label>
                      <Input
                        value={newApp.name}
                        onChange={(e) => setNewApp({ ...newApp, name: e.target.value })}
                        placeholder="my-app"
                        className="bg-slate-900/50 border-slate-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Project</Label>
                      <Input
                        value={newApp.project}
                        onChange={(e) => setNewApp({ ...newApp, project: e.target.value })}
                        placeholder="default"
                        className="bg-slate-900/50 border-slate-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Repository URL</Label>
                    <Input
                      value={newApp.repoURL}
                      onChange={(e) => setNewApp({ ...newApp, repoURL: e.target.value })}
                      placeholder="https://github.com/org/repo"
                      className="bg-slate-900/50 border-slate-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Path</Label>
                      <Input
                        value={newApp.path}
                        onChange={(e) => setNewApp({ ...newApp, path: e.target.value })}
                        placeholder="k8s/manifests"
                        className="bg-slate-900/50 border-slate-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Revision</Label>
                      <Input
                        value={newApp.targetRevision}
                        onChange={(e) => setNewApp({ ...newApp, targetRevision: e.target.value })}
                        placeholder="HEAD or tag"
                        className="bg-slate-900/50 border-slate-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Destination Namespace</Label>
                    <Input
                      value={newApp.destinationNamespace}
                      onChange={(e) => setNewApp({ ...newApp, destinationNamespace: e.target.value })}
                      placeholder="production"
                      className="bg-slate-900/50 border-slate-600"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={newApp.autoSync}
                        onCheckedChange={(checked) => setNewApp({ ...newApp, autoSync: checked })}
                      />
                      <Label>Auto Sync</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={newApp.selfHeal}
                        onCheckedChange={(checked) => setNewApp({ ...newApp, selfHeal: checked })}
                      />
                      <Label>Self Heal</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={newApp.prune}
                        onCheckedChange={(checked) => setNewApp({ ...newApp, prune: checked })}
                      />
                      <Label>Prune</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateApp} className="bg-orange-600 hover:bg-orange-700">
                    Create Application
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => setShowSettingsDialog(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Apps</p>
                  <p className="text-2xl font-bold text-white">{applications.length}</p>
                </div>
                <Server className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Synced</p>
                  <p className="text-2xl font-bold text-green-400">
                    {applications.filter(a => a.status?.sync.status === 'Synced').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Out of Sync</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {applications.filter(a => a.status?.sync.status === 'OutOfSync').length}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Degraded</p>
                  <p className="text-2xl font-bold text-red-400">
                    {applications.filter(a => a.status?.health.status === 'Degraded').length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Applications Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {applications.map((app) => (
            <Card key={app.metadata.name} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white">{app.metadata.name}</CardTitle>
                  <div className="flex gap-1">
                    {getSyncStatusBadge(app.status?.sync.status || 'Unknown')}
                    {getHealthStatusBadge(app.status?.health.status || 'Unknown')}
                  </div>
                </div>
                <CardDescription className="text-xs truncate">
                  {app.spec.source.repoURL}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-slate-400">Path</p>
                    <p className="text-white truncate">{app.spec.source.path}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Revision</p>
                    <p className="text-white truncate">{app.spec.source.targetRevision}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Namespace</p>
                    <p className="text-white">{app.spec.destination.namespace}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Auto Sync</p>
                    <p className="text-white">{app.spec.syncPolicy?.automated ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>

                {app.status?.operationState && (
                  <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20">
                    <p className="text-xs text-blue-400">
                      {app.status.operationState.phase}: {app.status.operationState.message}
                    </p>
                  </div>
                )}

                {app.status?.health.message && (
                  <div className="p-2 bg-red-500/10 rounded border border-red-500/20">
                    <p className="text-xs text-red-400">{app.status.health.message}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleSync(app.metadata.name)}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Sync
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleRefresh(app.metadata.name)}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedApp(app)}
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Application Details Dialog */}
        <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-orange-400" />
                {selectedApp?.metadata.name}
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-slate-900/50">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="ai">AI Analysis</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-slate-900/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Source</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p><span className="text-slate-400">Repository:</span> {selectedApp?.spec.source.repoURL}</p>
                      <p><span className="text-slate-400">Path:</span> {selectedApp?.spec.source.path}</p>
                      <p><span className="text-slate-400">Revision:</span> {selectedApp?.spec.source.targetRevision}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-900/50 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Destination</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p><span className="text-slate-400">Server:</span> {selectedApp?.spec.destination.server}</p>
                      <p><span className="text-slate-400">Namespace:</span> {selectedApp?.spec.destination.namespace}</p>
                      <p><span className="text-slate-400">Project:</span> {selectedApp?.spec.project}</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="history">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {selectedApp?.status?.history?.map((h) => (
                      <div key={h.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded border border-slate-700">
                        <div>
                          <p className="text-sm text-white font-mono">{h.revision}</p>
                          <p className="text-xs text-slate-400">{new Date(h.deployedAt).toLocaleString()}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRollback(selectedApp.metadata.name, h.id)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Rollback
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="resources">
                <div className="p-4 bg-slate-900/50 rounded border border-slate-700">
                  <p className="text-slate-400 text-sm">Resource tree will be displayed here when connected to ArgoCD</p>
                </div>
              </TabsContent>
              <TabsContent value="ai">
                <Card className="bg-slate-900/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bot className="w-4 h-4 text-purple-400" />
                      AI Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-300">
                      AI analysis will provide recommendations for this application based on its current state,
                      sync status, health metrics, and deployment history.
                    </p>
                    <Button className="mt-4 bg-purple-600 hover:bg-purple-700">
                      Generate Analysis
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle>ArgoCD Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Server URL</Label>
                <Input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="bg-slate-900/50 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label>API Token</Label>
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="bg-slate-900/50 border-slate-600"
                />
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  setIsConfigured(false);
                  setShowSettingsDialog(false);
                }}
              >
                Disconnect
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
