import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Bird,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Activity,
  Zap,
  Settings,
  Plus,
  RefreshCw,
  ArrowRight,
  BarChart3,
  GitBranch,
  Server,
  Loader2,
} from "lucide-react";

type DeploymentStatus = 
  | "pending"
  | "initializing"
  | "progressing"
  | "paused"
  | "promoting"
  | "promoted"
  | "rolling_back"
  | "rolled_back"
  | "failed"
  | "cancelled";

const statusConfig: Record<DeploymentStatus, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: "bg-gray-500", icon: <Clock className="h-4 w-4" />, label: "Pending" },
  initializing: { color: "bg-blue-500", icon: <Loader2 className="h-4 w-4 animate-spin" />, label: "Initializing" },
  progressing: { color: "bg-cyan-500", icon: <TrendingUp className="h-4 w-4" />, label: "Progressing" },
  paused: { color: "bg-yellow-500", icon: <Pause className="h-4 w-4" />, label: "Paused" },
  promoting: { color: "bg-purple-500", icon: <ArrowRight className="h-4 w-4" />, label: "Promoting" },
  promoted: { color: "bg-green-500", icon: <CheckCircle2 className="h-4 w-4" />, label: "Promoted" },
  rolling_back: { color: "bg-orange-500", icon: <RotateCcw className="h-4 w-4 animate-spin" />, label: "Rolling Back" },
  rolled_back: { color: "bg-orange-600", icon: <RotateCcw className="h-4 w-4" />, label: "Rolled Back" },
  failed: { color: "bg-red-500", icon: <XCircle className="h-4 w-4" />, label: "Failed" },
  cancelled: { color: "bg-gray-600", icon: <XCircle className="h-4 w-4" />, label: "Cancelled" },
};

export default function CanaryDeployments() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    namespace: "default",
    targetDeployment: "",
    canaryImage: "",
    canaryVersion: "",
    stableImage: "",
    stableVersion: "",
    trafficSplitType: "percentage" as "percentage" | "header" | "cookie",
    initialCanaryPercent: 10,
    targetCanaryPercent: 100,
    incrementPercent: 10,
    incrementIntervalMinutes: 5,
    errorRateThreshold: 5,
    latencyThresholdMs: 1000,
    successRateThreshold: 95,
    minHealthyPods: 1,
    autoRollbackEnabled: true,
    rollbackOnErrorRate: true,
    rollbackOnLatency: true,
    rollbackOnPodFailure: true,
    requireManualApproval: false,
    gitCommit: "",
    gitBranch: "",
  });
  
  // Queries
  const { data: deployments, refetch: refetchDeployments } = trpc.canary.list.useQuery({});
  const { data: selectedDeploymentData, refetch: refetchSelected } = trpc.canary.get.useQuery(
    { id: selectedDeployment! },
    { enabled: !!selectedDeployment }
  );
  const { data: deploymentSteps } = trpc.canary.getSteps.useQuery(
    { deploymentId: selectedDeployment! },
    { enabled: !!selectedDeployment }
  );
  const { data: deploymentMetrics } = trpc.canary.getMetrics.useQuery(
    { deploymentId: selectedDeployment!, limit: 20 },
    { enabled: !!selectedDeployment }
  );
  const { data: rollbackHistory } = trpc.canary.getRollbackHistory.useQuery(
    { deploymentId: selectedDeployment! },
    { enabled: !!selectedDeployment }
  );
  const { data: analysis } = trpc.canary.analyze.useQuery(
    { deploymentId: selectedDeployment! },
    { enabled: !!selectedDeployment && selectedDeploymentData?.status === "progressing" }
  );
  
  // Mutations
  const createMutation = trpc.canary.create.useMutation({
    onSuccess: () => {
      toast.success("Canary deployment created");
      setIsCreateOpen(false);
      refetchDeployments();
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to create deployment: ${error.message}`);
    },
  });
  
  const startMutation = trpc.canary.start.useMutation({
    onSuccess: () => {
      toast.success("Deployment started");
      refetchDeployments();
      refetchSelected();
    },
    onError: (error) => {
      toast.error(`Failed to start deployment: ${error.message}`);
    },
  });
  
  const pauseMutation = trpc.canary.pause.useMutation({
    onSuccess: () => {
      toast.success("Deployment paused");
      refetchDeployments();
      refetchSelected();
    },
  });
  
  const resumeMutation = trpc.canary.resume.useMutation({
    onSuccess: () => {
      toast.success("Deployment resumed");
      refetchDeployments();
      refetchSelected();
    },
  });
  
  const promoteMutation = trpc.canary.promote.useMutation({
    onSuccess: () => {
      toast.success("Canary promoted to stable");
      refetchDeployments();
      refetchSelected();
    },
  });
  
  const cancelMutation = trpc.canary.cancel.useMutation({
    onSuccess: () => {
      toast.success("Deployment cancelled");
      refetchDeployments();
      refetchSelected();
    },
  });
  
  const rollbackMutation = trpc.canary.rollback.useMutation({
    onSuccess: () => {
      toast.success("Rollback initiated");
      refetchDeployments();
      refetchSelected();
    },
  });
  
  const progressMutation = trpc.canary.progress.useMutation({
    onSuccess: (result) => {
      if (result.analysis.shouldRollback) {
        toast.error("Auto-rollback triggered due to health issues");
      } else if (result.analysis.shouldPromote) {
        toast.success("Step completed, progressing to next");
      }
      refetchDeployments();
      refetchSelected();
    },
  });
  
  const resetForm = () => {
    setFormData({
      name: "",
      namespace: "default",
      targetDeployment: "",
      canaryImage: "",
      canaryVersion: "",
      stableImage: "",
      stableVersion: "",
      trafficSplitType: "percentage",
      initialCanaryPercent: 10,
      targetCanaryPercent: 100,
      incrementPercent: 10,
      incrementIntervalMinutes: 5,
      errorRateThreshold: 5,
      latencyThresholdMs: 1000,
      successRateThreshold: 95,
      minHealthyPods: 1,
      autoRollbackEnabled: true,
      rollbackOnErrorRate: true,
      rollbackOnLatency: true,
      rollbackOnPodFailure: true,
      requireManualApproval: false,
      gitCommit: "",
      gitBranch: "",
    });
  };
  
  const handleCreate = () => {
    createMutation.mutate(formData);
  };
  
  const activeDeployments = deployments?.filter(d => 
    ["pending", "initializing", "progressing", "paused", "promoting", "rolling_back"].includes(d.status)
  ) || [];
  
  const completedDeployments = deployments?.filter(d => 
    ["promoted", "rolled_back", "failed", "cancelled"].includes(d.status)
  ) || [];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bird className="h-8 w-8 text-cyan-500" />
            Canary Deployments
          </h1>
          <p className="text-muted-foreground mt-1">
            Progressive rollouts with automatic health monitoring and rollback
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchDeployments()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Canary
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Canary Deployment</DialogTitle>
                <DialogDescription>
                  Configure a new canary deployment with progressive traffic shifting
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Deployment Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="my-app-canary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="namespace">Namespace</Label>
                      <Input
                        id="namespace"
                        value={formData.namespace}
                        onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                        placeholder="default"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetDeployment">Target Deployment</Label>
                    <Input
                      id="targetDeployment"
                      value={formData.targetDeployment}
                      onChange={(e) => setFormData({ ...formData, targetDeployment: e.target.value })}
                      placeholder="my-app"
                    />
                  </div>
                </div>
                
                {/* Images */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Container Images</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="canaryImage">Canary Image</Label>
                      <Input
                        id="canaryImage"
                        value={formData.canaryImage}
                        onChange={(e) => setFormData({ ...formData, canaryImage: e.target.value })}
                        placeholder="myregistry/my-app:v2.0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="canaryVersion">Canary Version</Label>
                      <Input
                        id="canaryVersion"
                        value={formData.canaryVersion}
                        onChange={(e) => setFormData({ ...formData, canaryVersion: e.target.value })}
                        placeholder="v2.0.0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stableImage">Stable Image (current)</Label>
                      <Input
                        id="stableImage"
                        value={formData.stableImage}
                        onChange={(e) => setFormData({ ...formData, stableImage: e.target.value })}
                        placeholder="myregistry/my-app:v1.9.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stableVersion">Stable Version</Label>
                      <Input
                        id="stableVersion"
                        value={formData.stableVersion}
                        onChange={(e) => setFormData({ ...formData, stableVersion: e.target.value })}
                        placeholder="v1.9.0"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Traffic Configuration */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Traffic Configuration</h4>
                  <div className="space-y-2">
                    <Label>Traffic Split Type</Label>
                    <Select
                      value={formData.trafficSplitType}
                      onValueChange={(v) => setFormData({ ...formData, trafficSplitType: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage-based</SelectItem>
                        <SelectItem value="header">Header-based</SelectItem>
                        <SelectItem value="cookie">Cookie-based</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Initial Canary Traffic: {formData.initialCanaryPercent}%</Label>
                    <Slider
                      value={[formData.initialCanaryPercent]}
                      onValueChange={([v]) => setFormData({ ...formData, initialCanaryPercent: v })}
                      min={1}
                      max={50}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Increment Per Step: {formData.incrementPercent}%</Label>
                    <Slider
                      value={[formData.incrementPercent]}
                      onValueChange={([v]) => setFormData({ ...formData, incrementPercent: v })}
                      min={5}
                      max={50}
                      step={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="incrementInterval">Increment Interval (minutes)</Label>
                    <Input
                      id="incrementInterval"
                      type="number"
                      value={formData.incrementIntervalMinutes}
                      onChange={(e) => setFormData({ ...formData, incrementIntervalMinutes: parseInt(e.target.value) || 5 })}
                      min={1}
                    />
                  </div>
                </div>
                
                {/* Health Thresholds */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Health Thresholds</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="errorRate">Max Error Rate (%)</Label>
                      <Input
                        id="errorRate"
                        type="number"
                        value={formData.errorRateThreshold}
                        onChange={(e) => setFormData({ ...formData, errorRateThreshold: parseInt(e.target.value) || 5 })}
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="latency">Max Latency (ms)</Label>
                      <Input
                        id="latency"
                        type="number"
                        value={formData.latencyThresholdMs}
                        onChange={(e) => setFormData({ ...formData, latencyThresholdMs: parseInt(e.target.value) || 1000 })}
                        min={0}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="successRate">Min Success Rate (%)</Label>
                      <Input
                        id="successRate"
                        type="number"
                        value={formData.successRateThreshold}
                        onChange={(e) => setFormData({ ...formData, successRateThreshold: parseInt(e.target.value) || 95 })}
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minPods">Min Healthy Pods</Label>
                      <Input
                        id="minPods"
                        type="number"
                        value={formData.minHealthyPods}
                        onChange={(e) => setFormData({ ...formData, minHealthyPods: parseInt(e.target.value) || 1 })}
                        min={1}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Rollback Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Rollback Settings</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="autoRollback">Auto-rollback enabled</Label>
                      <Switch
                        id="autoRollback"
                        checked={formData.autoRollbackEnabled}
                        onCheckedChange={(v) => setFormData({ ...formData, autoRollbackEnabled: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="rollbackError">Rollback on error rate</Label>
                      <Switch
                        id="rollbackError"
                        checked={formData.rollbackOnErrorRate}
                        onCheckedChange={(v) => setFormData({ ...formData, rollbackOnErrorRate: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="rollbackLatency">Rollback on latency</Label>
                      <Switch
                        id="rollbackLatency"
                        checked={formData.rollbackOnLatency}
                        onCheckedChange={(v) => setFormData({ ...formData, rollbackOnLatency: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="rollbackPod">Rollback on pod failure</Label>
                      <Switch
                        id="rollbackPod"
                        checked={formData.rollbackOnPodFailure}
                        onCheckedChange={(v) => setFormData({ ...formData, rollbackOnPodFailure: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="manualApproval">Require manual approval</Label>
                      <Switch
                        id="manualApproval"
                        checked={formData.requireManualApproval}
                        onCheckedChange={(v) => setFormData({ ...formData, requireManualApproval: v })}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Git Info */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Git Information (optional)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="gitCommit">Commit SHA</Label>
                      <Input
                        id="gitCommit"
                        value={formData.gitCommit}
                        onChange={(e) => setFormData({ ...formData, gitCommit: e.target.value })}
                        placeholder="abc123..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gitBranch">Branch</Label>
                      <Input
                        id="gitBranch"
                        value={formData.gitBranch}
                        onChange={(e) => setFormData({ ...formData, gitBranch: e.target.value })}
                        placeholder="main"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Deployment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deployments List */}
        <div className="lg:col-span-1 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="active" className="flex-1">
                Active ({activeDeployments.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex-1">
                History ({completedDeployments.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="space-y-3 mt-4">
              {activeDeployments.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No active deployments
                  </CardContent>
                </Card>
              ) : (
                activeDeployments.map((deployment) => (
                  <Card
                    key={deployment.id}
                    className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                      selectedDeployment === deployment.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedDeployment(deployment.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{deployment.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {deployment.targetDeployment}
                          </div>
                        </div>
                        <Badge className={`${statusConfig[deployment.status as DeploymentStatus].color} text-white`}>
                          {statusConfig[deployment.status as DeploymentStatus].icon}
                          <span className="ml-1">{statusConfig[deployment.status as DeploymentStatus].label}</span>
                        </Badge>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Traffic: {deployment.currentCanaryPercent}%</span>
                          <span>Target: {deployment.targetCanaryPercent}%</span>
                        </div>
                        <Progress value={deployment.currentCanaryPercent} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
            
            <TabsContent value="completed" className="space-y-3 mt-4">
              {completedDeployments.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No completed deployments
                  </CardContent>
                </Card>
              ) : (
                completedDeployments.slice(0, 10).map((deployment) => (
                  <Card
                    key={deployment.id}
                    className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                      selectedDeployment === deployment.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedDeployment(deployment.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{deployment.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {deployment.completedAt
                              ? new Date(deployment.completedAt).toLocaleString()
                              : "N/A"}
                          </div>
                        </div>
                        <Badge className={`${statusConfig[deployment.status as DeploymentStatus].color} text-white`}>
                          {statusConfig[deployment.status as DeploymentStatus].icon}
                          <span className="ml-1">{statusConfig[deployment.status as DeploymentStatus].label}</span>
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Deployment Details */}
        <div className="lg:col-span-2">
          {selectedDeploymentData ? (
            <div className="space-y-4">
              {/* Header Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        {selectedDeploymentData.name}
                      </CardTitle>
                      <CardDescription>
                        {selectedDeploymentData.namespace}/{selectedDeploymentData.targetDeployment}
                      </CardDescription>
                    </div>
                    <Badge className={`${statusConfig[selectedDeploymentData.status as DeploymentStatus].color} text-white`}>
                      {statusConfig[selectedDeploymentData.status as DeploymentStatus].icon}
                      <span className="ml-1">{statusConfig[selectedDeploymentData.status as DeploymentStatus].label}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Canary Traffic</span>
                      <span className="font-medium">{selectedDeploymentData.currentCanaryPercent}% / {selectedDeploymentData.targetCanaryPercent}%</span>
                    </div>
                    <Progress value={(selectedDeploymentData.currentCanaryPercent / selectedDeploymentData.targetCanaryPercent) * 100} className="h-3" />
                  </div>
                  
                  {/* Version Info */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-sm text-muted-foreground">Stable Version</div>
                      <div className="font-mono text-sm">{selectedDeploymentData.stableVersion || "N/A"}</div>
                    </div>
                    <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                      <div className="text-sm text-cyan-400">Canary Version</div>
                      <div className="font-mono text-sm">{selectedDeploymentData.canaryVersion || "N/A"}</div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {selectedDeploymentData.status === "pending" && (
                      <Button onClick={() => startMutation.mutate({ id: selectedDeploymentData.id })}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Deployment
                      </Button>
                    )}
                    {selectedDeploymentData.status === "progressing" && (
                      <>
                        <Button onClick={() => progressMutation.mutate({ id: selectedDeploymentData.id })}>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Progress
                        </Button>
                        <Button variant="outline" onClick={() => pauseMutation.mutate({ id: selectedDeploymentData.id })}>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                        <Button variant="outline" onClick={() => promoteMutation.mutate({ id: selectedDeploymentData.id })}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Promote Now
                        </Button>
                      </>
                    )}
                    {selectedDeploymentData.status === "paused" && (
                      <Button onClick={() => resumeMutation.mutate({ id: selectedDeploymentData.id })}>
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </Button>
                    )}
                    {["pending", "initializing", "progressing", "paused"].includes(selectedDeploymentData.status) && (
                      <>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Rollback
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Rollback Deployment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will immediately rollback to the stable version and stop the canary deployment.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => rollbackMutation.mutate({
                                  deploymentId: selectedDeploymentData.id,
                                  reason: "Manual rollback requested",
                                })}
                              >
                                Rollback
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline">
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Deployment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will cancel the deployment without rolling back.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Running</AlertDialogCancel>
                              <AlertDialogAction onClick={() => cancelMutation.mutate({ id: selectedDeploymentData.id })}>
                                Cancel Deployment
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Analysis Card */}
              {analysis && selectedDeploymentData.status === "progressing" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Health Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">{analysis.metrics.canaryErrorRate.toFixed(2)}%</div>
                        <div className="text-sm text-muted-foreground">Error Rate</div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">{analysis.metrics.canaryAvgLatency.toFixed(0)}ms</div>
                        <div className="text-sm text-muted-foreground">Avg Latency</div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">{analysis.metrics.canaryHealthyPods}/{analysis.metrics.canaryTotalPods}</div>
                        <div className="text-sm text-muted-foreground">Healthy Pods</div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <Badge className={`${
                          analysis.analysisResult === "healthy" ? "bg-green-500" :
                          analysis.analysisResult === "degraded" ? "bg-yellow-500" :
                          analysis.analysisResult === "unhealthy" ? "bg-red-500" :
                          "bg-gray-500"
                        } text-white`}>
                          {analysis.analysisResult.toUpperCase()}
                        </Badge>
                        <div className="text-sm text-muted-foreground mt-1">Status</div>
                      </div>
                    </div>
                    
                    {analysis.reasons.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Analysis Notes:</div>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {analysis.reasons.map((reason, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {analysis.aiRecommendation && (
                      <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                        <div className="text-sm font-medium text-cyan-400 mb-1">AI Recommendation</div>
                        <div className="text-sm">{analysis.aiRecommendation}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* Steps Card */}
              {deploymentSteps && deploymentSteps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Deployment Steps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {deploymentSteps.map((step) => (
                        <div
                          key={step.id}
                          className={`flex items-center gap-4 p-3 rounded-lg ${
                            step.status === "running" ? "bg-cyan-500/10 border border-cyan-500/20" :
                            step.status === "completed" ? "bg-green-500/10" :
                            step.status === "failed" ? "bg-red-500/10" :
                            "bg-muted"
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {step.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                            {step.status === "running" && <Loader2 className="h-5 w-5 text-cyan-500 animate-spin" />}
                            {step.status === "failed" && <XCircle className="h-5 w-5 text-red-500" />}
                            {step.status === "pending" && <Clock className="h-5 w-5 text-muted-foreground" />}
                            {step.status === "skipped" && <XCircle className="h-5 w-5 text-gray-500" />}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">Step {step.stepNumber}: {step.targetPercent}% Traffic</div>
                            {step.status === "completed" && step.successRate && (
                              <div className="text-sm text-muted-foreground">
                                Success rate: {(step.successRate / 100).toFixed(2)}%
                              </div>
                            )}
                          </div>
                          <Badge variant="outline">{step.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Rollback History */}
              {rollbackHistory && rollbackHistory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RotateCcw className="h-5 w-5" />
                      Rollback History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {rollbackHistory.map((rollback) => (
                        <div key={rollback.id} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium capitalize">{rollback.trigger.replace(/_/g, " ")}</div>
                              <div className="text-sm text-muted-foreground">{rollback.reason}</div>
                            </div>
                            <Badge variant={rollback.status === "completed" ? "default" : "destructive"}>
                              {rollback.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            {new Date(rollback.initiatedAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Bird className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Deployment</h3>
                <p className="text-muted-foreground">
                  Choose a deployment from the list to view details and manage the rollout
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
