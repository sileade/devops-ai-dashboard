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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Box,
  Play,
  Square,
  RotateCcw,
  Trash2,
  MoreVertical,
  Search,
  RefreshCw,
  Terminal,
  Layers,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PodmanContainer {
  id: string;
  name: string;
  image: string;
  status: "running" | "stopped" | "paused";
  pod: string | null;
  ports: string;
  created: string;
}

const mockContainers: PodmanContainer[] = [
  { id: "abc123", name: "web-server", image: "nginx:alpine", status: "running", pod: "web-pod", ports: "8080:80", created: "1 day ago" },
  { id: "def456", name: "app-backend", image: "node:18-alpine", status: "running", pod: "web-pod", ports: "3000:3000", created: "1 day ago" },
  { id: "ghi789", name: "db-postgres", image: "postgres:15", status: "running", pod: "data-pod", ports: "5432:5432", created: "3 days ago" },
  { id: "jkl012", name: "cache-redis", image: "redis:7", status: "stopped", pod: null, ports: "-", created: "1 week ago" },
];

interface PodmanPod {
  id: string;
  name: string;
  status: "Running" | "Stopped" | "Degraded";
  containers: number;
  created: string;
}

const mockPods: PodmanPod[] = [
  { id: "pod1", name: "web-pod", status: "Running", containers: 2, created: "1 day ago" },
  { id: "pod2", name: "data-pod", status: "Running", containers: 1, created: "3 days ago" },
  { id: "pod3", name: "monitoring-pod", status: "Stopped", containers: 3, created: "1 week ago" },
];

const statusColors = {
  running: "bg-green-500/10 text-green-500 border-green-500/30",
  stopped: "bg-red-500/10 text-red-500 border-red-500/30",
  paused: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  Running: "bg-green-500/10 text-green-500 border-green-500/30",
  Stopped: "bg-red-500/10 text-red-500 border-red-500/30",
  Degraded: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
};

export default function Podman() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredContainers = mockContainers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.image.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Podman data refreshed");
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Podman Management</h1>
          <p className="text-muted-foreground">
            Rootless container management with Podman
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
            <Shield className="h-3 w-3 mr-1" />
            Rootless Mode
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Box className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {mockContainers.filter((c) => c.status === "running").length}
                </p>
                <p className="text-sm text-muted-foreground">Running Containers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Layers className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mockPods.length}</p>
                <p className="text-sm text-muted-foreground">Pods</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Shield className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">Rootless</p>
                <p className="text-sm text-muted-foreground">Security Mode</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="containers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="pods">Pods</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
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
                  <TableHead>Pod</TableHead>
                  <TableHead>Ports</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContainers.map((container) => (
                  <TableRow key={container.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{container.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-secondary px-2 py-1 rounded">
                        {container.image}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[container.status]}>
                        {container.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {container.pod ? (
                        <Badge variant="secondary">{container.pod}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {container.ports}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {container.created}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {container.status === "running" ? (
                            <DropdownMenuItem>
                              <Square className="h-4 w-4 mr-2" />
                              Stop
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem>
                              <Play className="h-4 w-4 mr-2" />
                              Start
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restart
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Terminal className="h-4 w-4 mr-2" />
                            View Logs
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
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

        <TabsContent value="pods" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pod Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Containers</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockPods.map((pod) => (
                  <TableRow key={pod.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{pod.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[pod.status]}>
                        {pod.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{pod.containers} containers</TableCell>
                    <TableCell className="text-muted-foreground">{pod.created}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Start</DropdownMenuItem>
                          <DropdownMenuItem>Stop</DropdownMenuItem>
                          <DropdownMenuItem>Restart</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Podman Images</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Image management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
