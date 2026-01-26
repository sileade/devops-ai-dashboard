import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Network,
  Server,
  Box,
  MoreVertical,
  Search,
  RefreshCw,
  Terminal,
  Trash2,
  Scale,
  FileCode,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DeploymentWizard from "@/components/DeploymentWizard";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface K8sPod {
  name: string;
  namespace: string;
  status: "Running" | "Pending" | "Failed" | "Succeeded";
  ready: string;
  restarts: number;
  age: string;
  node: string;
}

const mockPods: K8sPod[] = [
  { name: "api-server-7d8f9c6b5-abc12", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "2d", node: "node-1" },
  { name: "api-server-7d8f9c6b5-def34", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "2d", node: "node-2" },
  { name: "web-frontend-5c4d3b2a1-ghi56", namespace: "production", status: "Running", ready: "1/1", restarts: 1, age: "5d", node: "node-1" },
  { name: "worker-queue-9e8d7c6b5-jkl78", namespace: "production", status: "Pending", ready: "0/1", restarts: 0, age: "5m", node: "-" },
  { name: "database-primary-0", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "30d", node: "node-3" },
  { name: "redis-cache-8f7e6d5c4-mno90", namespace: "staging", status: "Running", ready: "1/1", restarts: 2, age: "7d", node: "node-2" },
];

interface K8sDeployment {
  name: string;
  namespace: string;
  ready: string;
  upToDate: number;
  available: number;
  age: string;
}

const mockDeployments: K8sDeployment[] = [
  { name: "api-server", namespace: "production", ready: "3/3", upToDate: 3, available: 3, age: "30d" },
  { name: "web-frontend", namespace: "production", ready: "5/5", upToDate: 5, available: 5, age: "30d" },
  { name: "worker-queue", namespace: "production", ready: "2/3", upToDate: 3, available: 2, age: "14d" },
  { name: "redis-cache", namespace: "staging", ready: "1/1", upToDate: 1, available: 1, age: "7d" },
];

interface K8sService {
  name: string;
  namespace: string;
  type: "ClusterIP" | "NodePort" | "LoadBalancer";
  clusterIP: string;
  externalIP: string;
  ports: string;
  age: string;
}

const mockServices: K8sService[] = [
  { name: "api-server", namespace: "production", type: "LoadBalancer", clusterIP: "10.0.0.1", externalIP: "34.123.45.67", ports: "80:30080/TCP", age: "30d" },
  { name: "web-frontend", namespace: "production", type: "LoadBalancer", clusterIP: "10.0.0.2", externalIP: "34.123.45.68", ports: "443:30443/TCP", age: "30d" },
  { name: "database-primary", namespace: "production", type: "ClusterIP", clusterIP: "10.0.0.3", externalIP: "-", ports: "5432/TCP", age: "30d" },
  { name: "redis-cache", namespace: "staging", type: "ClusterIP", clusterIP: "10.0.0.4", externalIP: "-", ports: "6379/TCP", age: "7d" },
];

const namespaces = ["all", "production", "staging", "development", "kube-system"];

const statusIcons = {
  Running: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  Pending: <Clock className="h-4 w-4 text-yellow-500" />,
  Failed: <AlertCircle className="h-4 w-4 text-red-500" />,
  Succeeded: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
};

const statusColors = {
  Running: "bg-green-500/10 text-green-500 border-green-500/30",
  Pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  Failed: "bg-red-500/10 text-red-500 border-red-500/30",
  Succeeded: "bg-blue-500/10 text-blue-500 border-blue-500/30",
};

export default function Kubernetes() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNamespace, setSelectedNamespace] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const filteredPods = mockPods.filter(
    (pod) =>
      (selectedNamespace === "all" || pod.namespace === selectedNamespace) &&
      pod.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDeployments = mockDeployments.filter(
    (d) =>
      (selectedNamespace === "all" || d.namespace === selectedNamespace) &&
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredServices = mockServices.filter(
    (s) =>
      (selectedNamespace === "all" || s.namespace === selectedNamespace) &&
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Kubernetes resources refreshed");
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kubernetes Cluster</h1>
          <p className="text-muted-foreground">
            Manage pods, deployments, services, and more
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("Opening kubectl terminal...")}>
            <Terminal className="h-4 w-4 mr-2" />
            kubectl
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowWizard(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Deployment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Box className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {mockPods.filter((p) => p.status === "Running").length}
                </p>
                <p className="text-sm text-muted-foreground">Running Pods</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Server className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mockDeployments.length}</p>
                <p className="text-sm text-muted-foreground">Deployments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Network className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mockServices.length}</p>
                <p className="text-sm text-muted-foreground">Services</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Activity className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Nodes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Namespace" />
          </SelectTrigger>
          <SelectContent>
            {namespaces.map((ns) => (
              <SelectItem key={ns} value={ns}>
                {ns === "all" ? "All Namespaces" : ns}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="pods" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pods">Pods</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="configmaps">ConfigMaps</TabsTrigger>
        </TabsList>

        <TabsContent value="pods" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ready</TableHead>
                  <TableHead>Restarts</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Node</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPods.map((pod) => (
                  <TableRow key={pod.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium font-mono text-sm">{pod.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{pod.namespace}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcons[pod.status]}
                        <Badge variant="outline" className={statusColors[pod.status]}>
                          {pod.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{pod.ready}</TableCell>
                    <TableCell>{pod.restarts}</TableCell>
                    <TableCell>{pod.age}</TableCell>
                    <TableCell className="text-muted-foreground">{pod.node}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Terminal className="h-4 w-4 mr-2" />
                            View Logs
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileCode className="h-4 w-4 mr-2" />
                            Describe
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Terminal className="h-4 w-4 mr-2" />
                            Exec Shell
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Ready</TableHead>
                  <TableHead>Up-to-date</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeployments.map((deployment) => (
                  <TableRow key={deployment.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{deployment.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{deployment.namespace}</Badge>
                    </TableCell>
                    <TableCell>{deployment.ready}</TableCell>
                    <TableCell>{deployment.upToDate}</TableCell>
                    <TableCell>{deployment.available}</TableCell>
                    <TableCell>{deployment.age}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Scale className="h-4 w-4 mr-2" />
                            Scale
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <FileCode className="h-4 w-4 mr-2" />
                            Edit YAML
                          </DropdownMenuItem>
                          <DropdownMenuItem>Restart</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Cluster IP</TableHead>
                  <TableHead>External IP</TableHead>
                  <TableHead>Ports</TableHead>
                  <TableHead>Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.map((service) => (
                  <TableRow key={service.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Network className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{service.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{service.namespace}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{service.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{service.clusterIP}</TableCell>
                    <TableCell className="font-mono text-sm">{service.externalIP}</TableCell>
                    <TableCell className="text-sm">{service.ports}</TableCell>
                    <TableCell>{service.age}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="configmaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ConfigMaps</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">ConfigMap management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Deployment Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-4xl h-[85vh] p-0">
          <DeploymentWizard
            onComplete={(config, yaml) => {
              console.log("Deployment config:", config);
              console.log("YAML:", yaml);
              toast.success("Deployment configuration created! Copy the YAML to apply it.");
              setShowWizard(false);
            }}
            onCancel={() => setShowWizard(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
