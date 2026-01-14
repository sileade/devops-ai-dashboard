import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Network,
  Server,
  Database,
  Globe,
  Box,
  Cloud,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TopologyNode {
  id: string;
  type: "service" | "database" | "cache" | "queue" | "gateway" | "external";
  name: string;
  status: "healthy" | "warning" | "error";
  connections: string[];
  metadata: {
    replicas?: number;
    cpu?: string;
    memory?: string;
    version?: string;
  };
}

const mockNodes: TopologyNode[] = [
  {
    id: "gateway",
    type: "gateway",
    name: "API Gateway",
    status: "healthy",
    connections: ["api-server", "web-frontend"],
    metadata: { replicas: 2, cpu: "15%", memory: "256MB" },
  },
  {
    id: "web-frontend",
    type: "service",
    name: "Web Frontend",
    status: "healthy",
    connections: ["api-server"],
    metadata: { replicas: 5, cpu: "8%", memory: "512MB", version: "v2.3.1" },
  },
  {
    id: "api-server",
    type: "service",
    name: "API Server",
    status: "healthy",
    connections: ["postgres", "redis", "worker-queue"],
    metadata: { replicas: 3, cpu: "45%", memory: "1.2GB", version: "v2.3.1" },
  },
  {
    id: "worker-queue",
    type: "queue",
    name: "Worker Queue",
    status: "warning",
    connections: ["postgres", "redis", "external-api"],
    metadata: { replicas: 2, cpu: "78%", memory: "2GB" },
  },
  {
    id: "postgres",
    type: "database",
    name: "PostgreSQL",
    status: "healthy",
    connections: [],
    metadata: { cpu: "25%", memory: "4GB", version: "15.2" },
  },
  {
    id: "redis",
    type: "cache",
    name: "Redis Cache",
    status: "healthy",
    connections: [],
    metadata: { cpu: "5%", memory: "1GB", version: "7.0" },
  },
  {
    id: "external-api",
    type: "external",
    name: "External API",
    status: "healthy",
    connections: [],
    metadata: {},
  },
];

const nodeIcons = {
  service: Server,
  database: Database,
  cache: Database,
  queue: Box,
  gateway: Globe,
  external: Cloud,
};

const nodeColors = {
  service: "bg-blue-500/20 border-blue-500/50 text-blue-400",
  database: "bg-purple-500/20 border-purple-500/50 text-purple-400",
  cache: "bg-orange-500/20 border-orange-500/50 text-orange-400",
  queue: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400",
  gateway: "bg-green-500/20 border-green-500/50 text-green-400",
  external: "bg-gray-500/20 border-gray-500/50 text-gray-400",
};

const statusColors = {
  healthy: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
};

export default function Topology() {
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [viewMode, setViewMode] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Topology refreshed");
    }, 1000);
  };

  const handleNodeClick = (node: TopologyNode) => {
    setSelectedNode(node);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Infrastructure Topology</h1>
          <p className="text-muted-foreground">
            Visualize service dependencies and relationships
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card className="h-[600px] relative overflow-hidden">
            <CardContent className="p-0 h-full">
              {/* Topology Visualization */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-secondary/50 via-background to-background">
                {/* Grid pattern */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                      linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
                    `,
                    backgroundSize: "40px 40px",
                  }}
                />

                {/* Connection lines (simplified visual) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Gateway to API Server */}
                  <line x1="200" y1="100" x2="400" y2="200" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="5,5" />
                  {/* Gateway to Web Frontend */}
                  <line x1="200" y1="100" x2="200" y2="200" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="5,5" />
                  {/* Web Frontend to API Server */}
                  <line x1="200" y1="250" x2="400" y2="200" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="5,5" />
                  {/* API Server to PostgreSQL */}
                  <line x1="400" y1="250" x2="300" y2="400" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="5,5" />
                  {/* API Server to Redis */}
                  <line x1="400" y1="250" x2="500" y2="400" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="5,5" />
                  {/* API Server to Worker Queue */}
                  <line x1="450" y1="200" x2="600" y2="200" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="5,5" />
                  {/* Worker Queue to External API */}
                  <line x1="650" y1="250" x2="750" y2="350" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="5,5" />
                </svg>

                {/* Nodes */}
                {mockNodes.map((node, idx) => {
                  const Icon = nodeIcons[node.type];
                  const positions: Record<string, { x: number; y: number }> = {
                    gateway: { x: 150, y: 60 },
                    "web-frontend": { x: 120, y: 200 },
                    "api-server": { x: 350, y: 160 },
                    "worker-queue": { x: 580, y: 160 },
                    postgres: { x: 250, y: 360 },
                    redis: { x: 450, y: 360 },
                    "external-api": { x: 700, y: 300 },
                  };
                  const pos = positions[node.id] || { x: 100 + idx * 120, y: 100 };

                  return (
                    <button
                      key={node.id}
                      onClick={() => handleNodeClick(node)}
                      className={`absolute p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                        nodeColors[node.type]
                      } ${selectedNode?.id === node.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                      style={{ left: pos.x, top: pos.y }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Icon className="h-6 w-6" />
                          <div
                            className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${
                              statusColors[node.status]
                            }`}
                          />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-sm text-foreground">{node.name}</p>
                          {node.metadata.replicas && (
                            <p className="text-xs text-muted-foreground">
                              {node.metadata.replicas} replicas
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4" />
                Legend
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(nodeColors).map(([type, color]) => {
                const Icon = nodeIcons[type as keyof typeof nodeIcons];
                return (
                  <div key={type} className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm capitalize">{type}</span>
                  </div>
                );
              })}
              <div className="border-t pt-3 mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                {Object.entries(statusColors).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${color}`} />
                    <span className="text-sm capitalize">{status}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedNode && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Node Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = nodeIcons[selectedNode.type];
                    return (
                      <div className={`p-3 rounded-lg border ${nodeColors[selectedNode.type]}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    );
                  })()}
                  <div>
                    <p className="font-medium">{selectedNode.name}</p>
                    <Badge variant="outline" className="text-xs capitalize">
                      {selectedNode.type}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant="outline"
                      className={
                        selectedNode.status === "healthy"
                          ? "bg-green-500/10 text-green-500"
                          : selectedNode.status === "warning"
                          ? "bg-yellow-500/10 text-yellow-500"
                          : "bg-red-500/10 text-red-500"
                      }
                    >
                      {selectedNode.status}
                    </Badge>
                  </div>
                  {selectedNode.metadata.replicas && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Replicas</span>
                      <span>{selectedNode.metadata.replicas}</span>
                    </div>
                  )}
                  {selectedNode.metadata.cpu && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPU</span>
                      <span>{selectedNode.metadata.cpu}</span>
                    </div>
                  )}
                  {selectedNode.metadata.memory && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Memory</span>
                      <span>{selectedNode.metadata.memory}</span>
                    </div>
                  )}
                  {selectedNode.metadata.version && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version</span>
                      <span>{selectedNode.metadata.version}</span>
                    </div>
                  )}
                </div>

                {selectedNode.connections.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Connections
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.connections.map((conn) => (
                        <Badge key={conn} variant="secondary" className="text-xs">
                          {conn}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Services</span>
                <span className="font-medium">{mockNodes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Healthy</span>
                <span className="font-medium text-green-500">
                  {mockNodes.filter((n) => n.status === "healthy").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Warnings</span>
                <span className="font-medium text-yellow-500">
                  {mockNodes.filter((n) => n.status === "warning").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Errors</span>
                <span className="font-medium text-red-500">
                  {mockNodes.filter((n) => n.status === "error").length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
