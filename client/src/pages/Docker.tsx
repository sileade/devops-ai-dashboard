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
  HardDrive,
  Network,
  Box,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: "running" | "stopped" | "paused" | "restarting";
  ports: string;
  created: string;
  cpu: string;
  memory: string;
}

const mockContainers: DockerContainer[] = [
  { id: "abc123", name: "nginx-proxy", image: "nginx:latest", status: "running", ports: "80:80, 443:443", created: "2 days ago", cpu: "0.5%", memory: "32MB" },
  { id: "def456", name: "postgres-db", image: "postgres:15", status: "running", ports: "5432:5432", created: "5 days ago", cpu: "2.1%", memory: "256MB" },
  { id: "ghi789", name: "redis-cache", image: "redis:7-alpine", status: "running", ports: "6379:6379", created: "1 week ago", cpu: "0.2%", memory: "24MB" },
  { id: "jkl012", name: "api-server", image: "myapp/api:v2.3.1", status: "running", ports: "3000:3000", created: "1 hour ago", cpu: "5.4%", memory: "512MB" },
  { id: "mno345", name: "worker-queue", image: "myapp/worker:v2.3.1", status: "stopped", ports: "-", created: "3 days ago", cpu: "0%", memory: "0MB" },
  { id: "pqr678", name: "monitoring", image: "prom/prometheus:latest", status: "running", ports: "9090:9090", created: "1 week ago", cpu: "1.2%", memory: "128MB" },
];

interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

const mockImages: DockerImage[] = [
  { id: "sha256:abc", repository: "nginx", tag: "latest", size: "142MB", created: "2 weeks ago" },
  { id: "sha256:def", repository: "postgres", tag: "15", size: "379MB", created: "1 month ago" },
  { id: "sha256:ghi", repository: "redis", tag: "7-alpine", size: "32MB", created: "3 weeks ago" },
  { id: "sha256:jkl", repository: "myapp/api", tag: "v2.3.1", size: "256MB", created: "1 hour ago" },
  { id: "sha256:mno", repository: "myapp/worker", tag: "v2.3.1", size: "198MB", created: "1 hour ago" },
];

const statusColors = {
  running: "bg-green-500/10 text-green-500 border-green-500/30",
  stopped: "bg-red-500/10 text-red-500 border-red-500/30",
  paused: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  restarting: "bg-blue-500/10 text-blue-500 border-blue-500/30",
};

export default function Docker() {
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
      toast.success("Container list refreshed");
    }, 1000);
  };

  const handleContainerAction = (action: string, name: string) => {
    toast.success(`${action} container: ${name}`);
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
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Container className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {mockContainers.filter((c) => c.status === "running").length}
                </p>
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
                <p className="text-2xl font-bold">
                  {mockContainers.filter((c) => c.status === "stopped").length}
                </p>
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
                <p className="text-2xl font-bold">{mockImages.length}</p>
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
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Networks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="containers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="networks">Networks</TabsTrigger>
          <TabsTrigger value="volumes">Volumes</TabsTrigger>
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
                {filteredContainers.map((container) => (
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
                      <Badge variant="outline" className={statusColors[container.status]}>
                        {container.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {container.ports}
                    </TableCell>
                    <TableCell className="text-sm">{container.cpu}</TableCell>
                    <TableCell className="text-sm">{container.memory}</TableCell>
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
                              onClick={() => handleContainerAction("Stop", container.name)}
                            >
                              <Square className="h-4 w-4 mr-2" />
                              Stop
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleContainerAction("Start", container.name)}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Start
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleContainerAction("Restart", container.name)}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restart
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toast.info("Opening logs...")}
                          >
                            <Terminal className="h-4 w-4 mr-2" />
                            View Logs
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => toast.info("Opening stats...")}
                          >
                            <Activity className="h-4 w-4 mr-2" />
                            Stats
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleContainerAction("Remove", container.name)}
                          >
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

        <TabsContent value="images" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Image ID</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockImages.map((image) => (
                  <TableRow key={image.id}>
                    <TableCell className="font-medium">{image.repository}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{image.tag}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">
                        {image.id.slice(0, 12)}
                      </code>
                    </TableCell>
                    <TableCell>{image.size}</TableCell>
                    <TableCell className="text-muted-foreground">{image.created}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Run Container</DropdownMenuItem>
                          <DropdownMenuItem>Pull Latest</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
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

        <TabsContent value="networks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Docker Networks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Network management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volumes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Docker Volumes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Volume management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
