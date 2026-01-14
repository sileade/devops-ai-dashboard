import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Container,
  Play,
  Square,
  RotateCcw,
  Trash2,
  MoreVertical,
  Search,
  RefreshCw,
  Terminal,
  Activity,
  Network,
  Box,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useWebSocket } from "@/hooks/useWebSocket";

const statusColors: Record<string, string> = {
  running: "bg-green-500/10 text-green-500 border-green-500/30",
  stopped: "bg-red-500/10 text-red-500 border-red-500/30",
  paused: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  restarting: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  exited: "bg-red-500/10 text-red-500 border-red-500/30",
  created: "bg-gray-500/10 text-gray-500 border-gray-500/30",
};

export default function Docker() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // WebSocket connection for real-time updates
  const { isConnected } = useWebSocket({
    onMessage: (message) => {
      if (message.type === "container_status") {
        // Refetch containers when we get updates
        containersQuery.refetch();
      }
    },
  });

  // tRPC queries
  const containersQuery = trpc.docker.listContainers.useQuery({ all: true });
  const imagesQuery = trpc.docker.listImages.useQuery();
  const networksQuery = trpc.docker.listNetworks.useQuery();
  const volumesQuery = trpc.docker.listVolumes.useQuery();

  // Container logs query (only when dialog is open)
  const logsQuery = trpc.docker.getContainerLogs.useQuery(
    { containerId: selectedContainer || "", tail: 100 },
    { enabled: showLogs && !!selectedContainer }
  );

  // Container stats query (only when dialog is open)
  const statsQuery = trpc.docker.getContainerStats.useQuery(
    { containerId: selectedContainer || "" },
    { enabled: showStats && !!selectedContainer, refetchInterval: 2000 }
  );

  // Mutations
  const startMutation = trpc.docker.startContainer.useMutation({
    onSuccess: () => {
      toast.success("Container started");
      containersQuery.refetch();
    },
    onError: (error) => toast.error(`Failed to start: ${error.message}`),
  });

  const stopMutation = trpc.docker.stopContainer.useMutation({
    onSuccess: () => {
      toast.success("Container stopped");
      containersQuery.refetch();
    },
    onError: (error) => toast.error(`Failed to stop: ${error.message}`),
  });

  const restartMutation = trpc.docker.restartContainer.useMutation({
    onSuccess: () => {
      toast.success("Container restarted");
      containersQuery.refetch();
    },
    onError: (error) => toast.error(`Failed to restart: ${error.message}`),
  });

  const containers = containersQuery.data || [];
  const images = imagesQuery.data || [];
  const networks = networksQuery.data || [];
  const volumes = volumesQuery.data || [];

  const filteredContainers = containers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.image.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const runningCount = containers.filter((c) => c.status === "running").length;
  const stoppedCount = containers.filter((c) => c.status !== "running").length;

  const handleRefresh = () => {
    containersQuery.refetch();
    imagesQuery.refetch();
    networksQuery.refetch();
    volumesQuery.refetch();
    toast.success("Refreshed");
  };

  const handleViewLogs = (containerId: string) => {
    setSelectedContainer(containerId);
    setShowLogs(true);
  };

  const handleViewStats = (containerId: string) => {
    setSelectedContainer(containerId);
    setShowStats(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Docker Management</h1>
          <p className="text-muted-foreground">
            Manage Docker containers, images, networks, and volumes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={isConnected ? "text-green-500" : "text-red-500"}>
            {isConnected ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
            {isConnected ? "Live" : "Offline"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={containersQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${containersQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Container className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{runningCount}</p>
                <p className="text-sm text-muted-foreground">Running</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <Square className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stoppedCount}</p>
                <p className="text-sm text-muted-foreground">Stopped</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Box className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{images.length}</p>
                <p className="text-sm text-muted-foreground">Images</p>
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
                <p className="text-2xl font-bold">{networks.length}</p>
                <p className="text-sm text-muted-foreground">Networks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="containers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="containers">Containers ({containers.length})</TabsTrigger>
          <TabsTrigger value="images">Images ({images.length})</TabsTrigger>
          <TabsTrigger value="networks">Networks ({networks.length})</TabsTrigger>
          <TabsTrigger value="volumes">Volumes ({volumes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="containers" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search containers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ports</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>Memory</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {containersQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading containers...
                    </TableCell>
                  </TableRow>
                ) : filteredContainers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No containers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContainers.map((container) => (
                    <TableRow key={container.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Container className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{container.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-secondary px-2 py-1 rounded">
                          {container.image}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[container.status] || statusColors.stopped}>
                          {container.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {container.ports || "-"}
                      </TableCell>
                      <TableCell className="text-sm">{container.cpu || "-"}</TableCell>
                      <TableCell className="text-sm">{container.memory || "-"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {container.status === "running" ? (
                              <DropdownMenuItem
                                onClick={() => stopMutation.mutate({ containerId: container.id })}
                                disabled={stopMutation.isPending}
                              >
                                <Square className="h-4 w-4 mr-2" />
                                Stop
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => startMutation.mutate({ containerId: container.id })}
                                disabled={startMutation.isPending}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Start
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => restartMutation.mutate({ containerId: container.id })}
                              disabled={restartMutation.isPending}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restart
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewLogs(container.id)}>
                              <Terminal className="h-4 w-4 mr-2" />
                              View Logs
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewStats(container.id)}>
                              <Activity className="h-4 w-4 mr-2" />
                              Stats
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imagesQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading images...
                    </TableCell>
                  </TableRow>
                ) : images.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No images found
                    </TableCell>
                  </TableRow>
                ) : (
                  images.map((image) => (
                    <TableRow key={image.id}>
                      <TableCell className="font-medium">{image.repository}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{image.tag}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{image.id.substring(0, 12)}</code>
                      </TableCell>
                      <TableCell>{image.size}</TableCell>
                      <TableCell className="text-muted-foreground">{image.created}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="networks" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Subnet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {networksQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading networks...
                    </TableCell>
                  </TableRow>
                ) : networks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No networks found
                    </TableCell>
                  </TableRow>
                ) : (
                  networks.map((network) => (
                    <TableRow key={network.id}>
                      <TableCell className="font-medium">{network.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{network.driver}</Badge>
                      </TableCell>
                      <TableCell>{network.scope}</TableCell>
                      <TableCell>
                        <code className="text-xs">{network.subnet || "-"}</code>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="volumes" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Mount Point</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volumesQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading volumes...
                    </TableCell>
                  </TableRow>
                ) : volumes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No volumes found
                    </TableCell>
                  </TableRow>
                ) : (
                  volumes.map((volume) => (
                    <TableRow key={volume.name}>
                      <TableCell className="font-medium">{volume.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{volume.driver}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{volume.mountpoint}</code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{volume.created}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Logs Dialog */}
      <Dialog open={showLogs} onOpenChange={setShowLogs}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Container Logs</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <pre className="text-xs font-mono bg-secondary p-4 rounded-lg whitespace-pre-wrap">
              {logsQuery.isLoading
                ? "Loading logs..."
                : logsQuery.data?.join("\n") || "No logs available"}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog open={showStats} onOpenChange={setShowStats}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Container Stats</DialogTitle>
          </DialogHeader>
          {statsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : statsQuery.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">CPU Usage</p>
                    <p className="text-2xl font-bold">{statsQuery.data.cpuPercent}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Memory Usage</p>
                    <p className="text-2xl font-bold">{statsQuery.data.memoryPercent}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Memory</p>
                    <p className="text-lg font-medium">
                      {statsQuery.data.memoryUsage} / {statsQuery.data.memoryLimit}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Network I/O</p>
                    <p className="text-sm">
                      ↓ {statsQuery.data.networkRx} / ↑ {statsQuery.data.networkTx}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No stats available</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
