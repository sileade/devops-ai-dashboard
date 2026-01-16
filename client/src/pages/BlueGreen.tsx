import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc';
import { 
  Layers, 
  ArrowLeftRight, 
  RotateCcw, 
  Play,
  Pause,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Server,
  Activity,
  Zap,
  Bot,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';

interface BlueGreenDeployment {
  id: number;
  applicationName: string;
  blue: {
    name: 'blue';
    version: string;
    status: 'active' | 'inactive' | 'deploying' | 'failed';
    replicas: number;
    healthyReplicas: number;
    lastDeployedAt?: string;
  };
  green: {
    name: 'green';
    version: string;
    status: 'active' | 'inactive' | 'deploying' | 'failed';
    replicas: number;
    healthyReplicas: number;
    lastDeployedAt?: string;
  };
  activeEnvironment: 'blue' | 'green';
  status: 'stable' | 'deploying' | 'switching' | 'rolling_back' | 'failed';
  trafficSplit?: {
    blue: number;
    green: number;
  };
}

export default function BlueGreen() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<BlueGreenDeployment | null>(null);
  const [gradualSwitch, setGradualSwitch] = useState(false);
  const [trafficPercentage, setTrafficPercentage] = useState([50]);

  // New deployment form
  const [newDeployment, setNewDeployment] = useState({
    applicationName: '',
    initialImage: '',
    initialVersion: '',
    replicas: 3,
  });

  // Deploy form
  const [deployForm, setDeployForm] = useState({
    image: '',
    version: '',
    replicas: 3,
  });

  // Mock data
  const [deployments] = useState<BlueGreenDeployment[]>([
    {
      id: 1,
      applicationName: 'api-server',
      blue: {
        name: 'blue',
        version: 'v2.1.0',
        status: 'active',
        replicas: 3,
        healthyReplicas: 3,
        lastDeployedAt: new Date().toISOString(),
      },
      green: {
        name: 'green',
        version: 'v2.0.0',
        status: 'inactive',
        replicas: 3,
        healthyReplicas: 3,
        lastDeployedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      activeEnvironment: 'blue',
      status: 'stable',
    },
    {
      id: 2,
      applicationName: 'web-frontend',
      blue: {
        name: 'blue',
        version: 'v1.5.0',
        status: 'inactive',
        replicas: 2,
        healthyReplicas: 2,
        lastDeployedAt: new Date(Date.now() - 172800000).toISOString(),
      },
      green: {
        name: 'green',
        version: 'v1.6.0',
        status: 'active',
        replicas: 2,
        healthyReplicas: 2,
        lastDeployedAt: new Date().toISOString(),
      },
      activeEnvironment: 'green',
      status: 'stable',
    },
    {
      id: 3,
      applicationName: 'worker-service',
      blue: {
        name: 'blue',
        version: 'v3.0.0',
        status: 'deploying',
        replicas: 4,
        healthyReplicas: 2,
        lastDeployedAt: new Date().toISOString(),
      },
      green: {
        name: 'green',
        version: 'v2.9.0',
        status: 'active',
        replicas: 4,
        healthyReplicas: 4,
        lastDeployedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      activeEnvironment: 'green',
      status: 'deploying',
      trafficSplit: { blue: 0, green: 100 },
    },
  ]);

  const handleCreateDeployment = () => {
    toast.success(`Blue-Green deployment created for ${newDeployment.applicationName}`);
    setShowCreateDialog(false);
    setNewDeployment({
      applicationName: '',
      initialImage: '',
      initialVersion: '',
      replicas: 3,
    });
  };

  const handleDeploy = () => {
    toast.info(`Deploying ${deployForm.version} to inactive environment...`);
    setShowDeployDialog(false);
  };

  const handleSwitch = () => {
    if (gradualSwitch) {
      toast.info(`Gradually switching traffic (${trafficPercentage[0]}% steps)...`);
    } else {
      toast.info('Instantly switching traffic...');
    }
    setShowSwitchDialog(false);
  };

  const handleRollback = (deployment: BlueGreenDeployment) => {
    toast.info(`Rolling back ${deployment.applicationName}...`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30"><Clock className="w-3 h-3 mr-1" />Standby</Badge>;
      case 'deploying':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Activity className="w-3 h-3 mr-1 animate-pulse" />Deploying</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Unknown</Badge>;
    }
  };

  const getDeploymentStatusBadge = (status: string) => {
    switch (status) {
      case 'stable':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Stable</Badge>;
      case 'deploying':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Deploying</Badge>;
      case 'switching':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Switching</Badge>;
      case 'rolling_back':
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Rolling Back</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Layers className="w-7 h-7 text-cyan-400" />
              Blue-Green Deployments
            </h1>
            <p className="text-slate-400 mt-1">Zero-downtime deployments with instant traffic switching</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-cyan-600 hover:bg-cyan-700">
                <Plus className="w-4 h-4 mr-2" />
                New Deployment
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle>Create Blue-Green Deployment</DialogTitle>
                <DialogDescription>
                  Set up a new blue-green deployment configuration
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Application Name</Label>
                  <Input
                    value={newDeployment.applicationName}
                    onChange={(e) => setNewDeployment({ ...newDeployment, applicationName: e.target.value })}
                    placeholder="my-app"
                    className="bg-slate-900/50 border-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Initial Image</Label>
                  <Input
                    value={newDeployment.initialImage}
                    onChange={(e) => setNewDeployment({ ...newDeployment, initialImage: e.target.value })}
                    placeholder="registry/image:tag"
                    className="bg-slate-900/50 border-slate-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Version</Label>
                    <Input
                      value={newDeployment.initialVersion}
                      onChange={(e) => setNewDeployment({ ...newDeployment, initialVersion: e.target.value })}
                      placeholder="v1.0.0"
                      className="bg-slate-900/50 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Replicas</Label>
                    <Input
                      type="number"
                      value={newDeployment.replicas}
                      onChange={(e) => setNewDeployment({ ...newDeployment, replicas: parseInt(e.target.value) })}
                      min={1}
                      className="bg-slate-900/50 border-slate-600"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateDeployment} className="bg-cyan-600 hover:bg-cyan-700">
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Deployments</p>
                  <p className="text-2xl font-bold text-white">{deployments.length}</p>
                </div>
                <Layers className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Stable</p>
                  <p className="text-2xl font-bold text-green-400">
                    {deployments.filter(d => d.status === 'stable').length}
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
                  <p className="text-sm text-slate-400">In Progress</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {deployments.filter(d => d.status === 'deploying' || d.status === 'switching').length}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Failed</p>
                  <p className="text-2xl font-bold text-red-400">
                    {deployments.filter(d => d.status === 'failed').length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deployments */}
        <div className="space-y-4">
          {deployments.map((deployment) => (
            <Card key={deployment.id} className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg text-white">{deployment.applicationName}</CardTitle>
                    {getDeploymentStatusBadge(deployment.status)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedDeployment(deployment);
                        setShowDeployDialog(true);
                      }}
                      disabled={deployment.status !== 'stable'}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Deploy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedDeployment(deployment);
                        setShowSwitchDialog(true);
                      }}
                      disabled={deployment.status !== 'stable'}
                    >
                      <ArrowLeftRight className="w-3 h-3 mr-1" />
                      Switch
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRollback(deployment)}
                      disabled={deployment.status !== 'stable'}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Rollback
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {/* Blue Environment */}
                  <div className={`p-4 rounded-lg border ${deployment.activeEnvironment === 'blue' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900/50 border-slate-700'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="font-medium text-white">Blue</span>
                      </div>
                      {getStatusBadge(deployment.blue.status)}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Version</span>
                        <span className="text-white font-mono">{deployment.blue.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Replicas</span>
                        <span className="text-white">{deployment.blue.healthyReplicas}/{deployment.blue.replicas}</span>
                      </div>
                      {deployment.blue.lastDeployedAt && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Deployed</span>
                          <span className="text-white text-xs">
                            {new Date(deployment.blue.lastDeployedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {deployment.blue.status === 'deploying' && (
                        <Progress value={50} className="h-1 mt-2" />
                      )}
                    </div>
                  </div>

                  {/* Green Environment */}
                  <div className={`p-4 rounded-lg border ${deployment.activeEnvironment === 'green' ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-900/50 border-slate-700'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="font-medium text-white">Green</span>
                      </div>
                      {getStatusBadge(deployment.green.status)}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Version</span>
                        <span className="text-white font-mono">{deployment.green.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Replicas</span>
                        <span className="text-white">{deployment.green.healthyReplicas}/{deployment.green.replicas}</span>
                      </div>
                      {deployment.green.lastDeployedAt && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Deployed</span>
                          <span className="text-white text-xs">
                            {new Date(deployment.green.lastDeployedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {deployment.green.status === 'deploying' && (
                        <Progress value={50} className="h-1 mt-2" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Traffic Split Indicator */}
                {deployment.trafficSplit && (
                  <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Traffic Split</span>
                      <span className="text-sm text-white">
                        Blue: {deployment.trafficSplit.blue}% | Green: {deployment.trafficSplit.green}%
                      </span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 transition-all"
                        style={{ width: `${deployment.trafficSplit.blue}%` }}
                      />
                      <div
                        className="bg-green-500 transition-all"
                        style={{ width: `${deployment.trafficSplit.green}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Deploy Dialog */}
        <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle>Deploy New Version</DialogTitle>
              <DialogDescription>
                Deploy to {selectedDeployment?.activeEnvironment === 'blue' ? 'green' : 'blue'} environment
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Image</Label>
                <Input
                  value={deployForm.image}
                  onChange={(e) => setDeployForm({ ...deployForm, image: e.target.value })}
                  placeholder="registry/image:tag"
                  className="bg-slate-900/50 border-slate-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Version</Label>
                  <Input
                    value={deployForm.version}
                    onChange={(e) => setDeployForm({ ...deployForm, version: e.target.value })}
                    placeholder="v2.0.0"
                    className="bg-slate-900/50 border-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Replicas</Label>
                  <Input
                    type="number"
                    value={deployForm.replicas}
                    onChange={(e) => setDeployForm({ ...deployForm, replicas: parseInt(e.target.value) })}
                    min={1}
                    className="bg-slate-900/50 border-slate-600"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeployDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleDeploy} className="bg-cyan-600 hover:bg-cyan-700">
                Deploy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Switch Dialog */}
        <Dialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle>Switch Traffic</DialogTitle>
              <DialogDescription>
                Switch traffic from {selectedDeployment?.activeEnvironment} to {selectedDeployment?.activeEnvironment === 'blue' ? 'green' : 'blue'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <Label>Gradual Switch</Label>
                <Switch
                  checked={gradualSwitch}
                  onCheckedChange={setGradualSwitch}
                />
              </div>
              
              {gradualSwitch && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Traffic Step Size: {trafficPercentage[0]}%</Label>
                    <Slider
                      value={trafficPercentage}
                      onValueChange={setTrafficPercentage}
                      min={10}
                      max={50}
                      step={10}
                      className="w-full"
                    />
                  </div>
                  <p className="text-sm text-slate-400">
                    Traffic will be shifted in {trafficPercentage[0]}% increments with health checks between each step.
                  </p>
                </div>
              )}

              {!gradualSwitch && (
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Zap className="w-4 h-4" />
                    <span className="font-medium">Instant Switch</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1">
                    All traffic will be immediately redirected to the new environment.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch defaultChecked />
                <Label>Auto-rollback on failure</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSwitchDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSwitch} className="bg-cyan-600 hover:bg-cyan-700">
                <ArrowLeftRight className="w-4 h-4 mr-2" />
                Switch Traffic
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h3 className="font-medium text-white">Instant Rollback</h3>
              </div>
              <p className="text-sm text-slate-400">
                Switch back to the previous version instantly without any downtime
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <h3 className="font-medium text-white">Health Monitoring</h3>
              </div>
              <p className="text-sm text-slate-400">
                Automatic health checks during deployment with auto-rollback on failure
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Bot className="w-5 h-5 text-purple-400" />
                <h3 className="font-medium text-white">AI Recommendations</h3>
              </div>
              <p className="text-sm text-slate-400">
                Get AI-powered insights and recommendations for your deployments
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
