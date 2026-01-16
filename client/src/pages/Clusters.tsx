import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Server, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Cloud,
  Globe,
  Cpu,
  MemoryStick,
  Box,
  Network,
  Star,
  StarOff,
  Play,
  BarChart3,
} from "lucide-react";

export default function Clusters() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedClusterIds, setSelectedClusterIds] = useState<number[]>([]);
  const [newCluster, setNewCluster] = useState({
    name: "",
    displayName: "",
    description: "",
    apiServerUrl: "",
    authType: "token" as const,
    bearerToken: "",
    provider: "on-premise" as const,
    region: "",
    isDefault: false,
  });

  const { data: clusters, refetch: refetchClusters, isLoading } = trpc.clusters.list.useQuery();
  const { data: allHealth } = trpc.clusters.getAllHealth.useQuery();
  const { data: defaultCluster } = trpc.clusters.getDefault.useQuery();

  const addClusterMutation = trpc.clusters.add.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Cluster added successfully");
        setIsAddDialogOpen(false);
        resetNewCluster();
        refetchClusters();
      } else {
        toast.error(result.error || "Failed to add cluster");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteClusterMutation = trpc.clusters.delete.useMutation({
    onSuccess: () => {
      toast.success("Cluster deleted");
      refetchClusters();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const testConnectionMutation = trpc.clusters.testConnection.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Connection successful! Kubernetes ${result.version}`);
      } else {
        toast.error(result.error || "Connection failed");
      }
      refetchClusters();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const switchContextMutation = trpc.clusters.switchContext.useMutation({
    onSuccess: () => {
      toast.success("Switched to cluster");
      refetchClusters();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const compareMetricsMutation = trpc.clusters.compareMetrics.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Comparison completed");
      } else {
        toast.error(result.error || "Comparison failed");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetNewCluster = () => {
    setNewCluster({
      name: "",
      displayName: "",
      description: "",
      apiServerUrl: "",
      authType: "token",
      bearerToken: "",
      provider: "on-premise",
      region: "",
      isDefault: false,
    });
  };

  const handleAddCluster = () => {
    if (!newCluster.name || !newCluster.apiServerUrl) {
      toast.error("Name and API Server URL are required");
      return;
    }
    addClusterMutation.mutate(newCluster);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "error":
      case "unhealthy":
      case "disconnected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "aws":
        return <Cloud className="h-4 w-4 text-orange-500" />;
      case "gcp":
        return <Cloud className="h-4 w-4 text-blue-500" />;
      case "azure":
        return <Cloud className="h-4 w-4 text-blue-600" />;
      case "digitalocean":
        return <Cloud className="h-4 w-4 text-blue-400" />;
      default:
        return <Server className="h-4 w-4 text-gray-500" />;
    }
  };

  const toggleClusterSelection = (id: number) => {
    setSelectedClusterIds(prev => 
      prev.includes(id) 
        ? prev.filter(cid => cid !== id)
        : [...prev, id]
    );
  };

  const handleCompare = () => {
    if (selectedClusterIds.length < 2) {
      toast.error("Select at least 2 clusters to compare");
      return;
    }
    compareMetricsMutation.mutate({ clusterIds: selectedClusterIds });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Multi-Cluster Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor multiple Kubernetes clusters from a single interface
          </p>
        </div>
        <div className="flex gap-2">
          {selectedClusterIds.length >= 2 && (
            <Button 
              variant="outline" 
              onClick={handleCompare}
              disabled={compareMetricsMutation.isPending}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Compare Selected ({selectedClusterIds.length})
            </Button>
          )}
          <Button onClick={() => refetchClusters()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Cluster
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Kubernetes Cluster</DialogTitle>
                <DialogDescription>
                  Connect a new Kubernetes cluster to the dashboard
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Cluster Name *</Label>
                    <Input
                      id="name"
                      placeholder="production-cluster"
                      value={newCluster.name}
                      onChange={(e) => setNewCluster({ ...newCluster, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder="Production Cluster"
                      value={newCluster.displayName}
                      onChange={(e) => setNewCluster({ ...newCluster, displayName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiServerUrl">API Server URL *</Label>
                  <Input
                    id="apiServerUrl"
                    placeholder="https://kubernetes.example.com:6443"
                    value={newCluster.apiServerUrl}
                    onChange={(e) => setNewCluster({ ...newCluster, apiServerUrl: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="authType">Authentication Type</Label>
                    <Select
                      value={newCluster.authType}
                      onValueChange={(value: any) => setNewCluster({ ...newCluster, authType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="token">Bearer Token</SelectItem>
                        <SelectItem value="kubeconfig">Kubeconfig</SelectItem>
                        <SelectItem value="certificate">Client Certificate</SelectItem>
                        <SelectItem value="oidc">OIDC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider">Cloud Provider</Label>
                    <Select
                      value={newCluster.provider}
                      onValueChange={(value: any) => setNewCluster({ ...newCluster, provider: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aws">AWS (EKS)</SelectItem>
                        <SelectItem value="gcp">Google Cloud (GKE)</SelectItem>
                        <SelectItem value="azure">Azure (AKS)</SelectItem>
                        <SelectItem value="digitalocean">DigitalOcean</SelectItem>
                        <SelectItem value="linode">Linode</SelectItem>
                        <SelectItem value="on-premise">On-Premise</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newCluster.authType === "token" && (
                  <div className="space-y-2">
                    <Label htmlFor="bearerToken">Bearer Token</Label>
                    <Input
                      id="bearerToken"
                      type="password"
                      placeholder="Enter service account token"
                      value={newCluster.bearerToken}
                      onChange={(e) => setNewCluster({ ...newCluster, bearerToken: e.target.value })}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      placeholder="us-east-1"
                      value={newCluster.region}
                      onChange={(e) => setNewCluster({ ...newCluster, region: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      placeholder="Main production cluster"
                      value={newCluster.description}
                      onChange={(e) => setNewCluster({ ...newCluster, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCluster} disabled={addClusterMutation.isPending}>
                  {addClusterMutation.isPending ? "Adding..." : "Add Cluster"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Current Context */}
      {defaultCluster && (
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <CardTitle className="text-lg">Current Context</CardTitle>
              </div>
              <Badge variant="outline" className="bg-primary/10">Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {getProviderIcon(defaultCluster.provider || "other")}
                <div>
                  <p className="font-medium">{defaultCluster.displayName || defaultCluster.name}</p>
                  <p className="text-sm text-muted-foreground">{defaultCluster.apiServerUrl}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(defaultCluster.status)}
                <span className="text-sm capitalize">{defaultCluster.status}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clusters Overview */}
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Cluster List</TabsTrigger>
          <TabsTrigger value="health">Health Overview</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : clusters && clusters.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clusters.map((cluster) => (
                <Card 
                  key={cluster.id} 
                  className={`relative ${selectedClusterIds.includes(cluster.id) ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedClusterIds.includes(cluster.id)}
                          onChange={() => toggleClusterSelection(cluster.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        {getProviderIcon(cluster.provider || "other")}
                        <CardTitle className="text-lg">
                          {cluster.displayName || cluster.name}
                        </CardTitle>
                      </div>
                      {cluster.isDefault && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                    <CardDescription className="truncate">
                      {cluster.apiServerUrl}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(cluster.status)}
                        <span className="capitalize">{cluster.status}</span>
                      </div>
                      {cluster.kubernetesVersion && (
                        <Badge variant="secondary">v{cluster.kubernetesVersion}</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {cluster.region && (
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          <span>{cluster.region}</span>
                        </div>
                      )}
                      {cluster.nodeCount !== null && (
                        <div className="flex items-center gap-1">
                          <Server className="h-3 w-3 text-muted-foreground" />
                          <span>{cluster.nodeCount} nodes</span>
                        </div>
                      )}
                      {cluster.podCount !== null && (
                        <div className="flex items-center gap-1">
                          <Box className="h-3 w-3 text-muted-foreground" />
                          <span>{cluster.podCount} pods</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      {!cluster.isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => switchContextMutation.mutate({ id: cluster.id })}
                          disabled={switchContextMutation.isPending}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Use
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testConnectionMutation.mutate({ id: cluster.id })}
                        disabled={testConnectionMutation.isPending}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this cluster?")) {
                            deleteClusterMutation.mutate({ id: cluster.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Server className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Clusters Connected</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add your first Kubernetes cluster to start managing your infrastructure
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Cluster
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          {allHealth && allHealth.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {allHealth.map((health) => (
                <Card key={health.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{health.displayName || health.name}</CardTitle>
                      <Badge 
                        variant={
                          health.status === "healthy" ? "default" :
                          health.status === "degraded" ? "secondary" : "destructive"
                        }
                      >
                        {health.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <Cpu className="h-4 w-4" /> CPU
                          </span>
                          <span>{health.cpuUsage.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${health.cpuUsage > 80 ? 'bg-red-500' : health.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${health.cpuUsage}%` }}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <MemoryStick className="h-4 w-4" /> Memory
                          </span>
                          <span>{health.memoryUsage.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${health.memoryUsage > 80 ? 'bg-red-500' : health.memoryUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${health.memoryUsage}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span>Nodes</span>
                        <span className="font-medium">{health.readyNodes}/{health.nodeCount}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span>Pods</span>
                        <span className="font-medium">{health.runningPods}/{health.podCount}</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Last checked: {new Date(health.lastChecked).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Network className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Health Data Available</h3>
                <p className="text-muted-foreground text-center">
                  Add clusters and enable them to see health metrics
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          {compareMetricsMutation.data?.success && compareMetricsMutation.data.data ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cluster Comparison</CardTitle>
                  <CardDescription>
                    Comparing {compareMetricsMutation.data.data.length} clusters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Metric</th>
                          {compareMetricsMutation.data.data.map((cluster: any) => (
                            <th key={cluster.id} className="text-left p-2">
                              {cluster.displayName || cluster.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2 font-medium">CPU Usage</td>
                          {compareMetricsMutation.data.data.map((cluster: any) => (
                            <td key={cluster.id} className="p-2">
                              {cluster.metrics.cpu.percent.toFixed(1)}%
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 font-medium">Memory Usage</td>
                          {compareMetricsMutation.data.data.map((cluster: any) => (
                            <td key={cluster.id} className="p-2">
                              {cluster.metrics.memory.percent.toFixed(1)}%
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 font-medium">Total Nodes</td>
                          {compareMetricsMutation.data.data.map((cluster: any) => (
                            <td key={cluster.id} className="p-2">
                              {cluster.metrics.nodes.total}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 font-medium">Ready Nodes</td>
                          {compareMetricsMutation.data.data.map((cluster: any) => (
                            <td key={cluster.id} className="p-2">
                              {cluster.metrics.nodes.ready}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 font-medium">Total Pods</td>
                          {compareMetricsMutation.data.data.map((cluster: any) => (
                            <td key={cluster.id} className="p-2">
                              {cluster.metrics.pods.total}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b">
                          <td className="p-2 font-medium">Running Pods</td>
                          {compareMetricsMutation.data.data.map((cluster: any) => (
                            <td key={cluster.id} className="p-2">
                              {cluster.metrics.pods.running}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-2 font-medium">Failed Pods</td>
                          {compareMetricsMutation.data.data.map((cluster: any) => (
                            <td key={cluster.id} className="p-2">
                              <span className={cluster.metrics.pods.failed > 0 ? "text-red-500" : ""}>
                                {cluster.metrics.pods.failed}
                              </span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Comparison Data</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Select at least 2 clusters from the list and click "Compare Selected"
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
