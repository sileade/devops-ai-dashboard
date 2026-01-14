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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileCode,
  Play,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FolderOpen,
  Server,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Playbook {
  id: string;
  name: string;
  path: string;
  description: string;
  lastRun: string | null;
  lastStatus: "success" | "failed" | "running" | null;
  hosts: string;
}

const mockPlaybooks: Playbook[] = [
  { id: "1", name: "deploy-app", path: "playbooks/deploy-app.yml", description: "Deploy application to production servers", lastRun: "2 hours ago", lastStatus: "success", hosts: "web-servers" },
  { id: "2", name: "update-packages", path: "playbooks/update-packages.yml", description: "Update system packages on all servers", lastRun: "1 day ago", lastStatus: "success", hosts: "all" },
  { id: "3", name: "configure-nginx", path: "playbooks/configure-nginx.yml", description: "Configure Nginx reverse proxy", lastRun: "3 days ago", lastStatus: "failed", hosts: "load-balancers" },
  { id: "4", name: "backup-databases", path: "playbooks/backup-databases.yml", description: "Backup PostgreSQL databases", lastRun: "6 hours ago", lastStatus: "success", hosts: "db-servers" },
  { id: "5", name: "setup-monitoring", path: "playbooks/setup-monitoring.yml", description: "Install and configure monitoring agents", lastRun: null, lastStatus: null, hosts: "all" },
];

interface PlaybookRun {
  id: string;
  playbook: string;
  status: "success" | "failed" | "running";
  startedAt: string;
  duration: string;
  hosts: { ok: number; changed: number; failed: number };
}

const mockRuns: PlaybookRun[] = [
  { id: "run1", playbook: "deploy-app", status: "success", startedAt: "2 hours ago", duration: "3m 24s", hosts: { ok: 5, changed: 3, failed: 0 } },
  { id: "run2", playbook: "backup-databases", status: "success", startedAt: "6 hours ago", duration: "12m 45s", hosts: { ok: 2, changed: 2, failed: 0 } },
  { id: "run3", playbook: "update-packages", status: "success", startedAt: "1 day ago", duration: "8m 12s", hosts: { ok: 10, changed: 8, failed: 0 } },
  { id: "run4", playbook: "configure-nginx", status: "failed", startedAt: "3 days ago", duration: "1m 02s", hosts: { ok: 1, changed: 0, failed: 2 } },
];

interface Inventory {
  name: string;
  hosts: number;
  groups: string[];
}

const mockInventory: Inventory[] = [
  { name: "web-servers", hosts: 5, groups: ["production", "web"] },
  { name: "db-servers", hosts: 2, groups: ["production", "database"] },
  { name: "load-balancers", hosts: 3, groups: ["production", "lb"] },
  { name: "staging", hosts: 4, groups: ["staging"] },
];

const statusIcons = {
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  running: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
};

const statusColors = {
  success: "bg-green-500/10 text-green-500 border-green-500/30",
  failed: "bg-red-500/10 text-red-500 border-red-500/30",
  running: "bg-blue-500/10 text-blue-500 border-blue-500/30",
};

export default function Ansible() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);

  const filteredPlaybooks = mockPlaybooks.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Ansible data refreshed");
    }, 1000);
  };

  const handleRunPlaybook = (playbook: Playbook) => {
    toast.success(`Running playbook: ${playbook.name}`);
    setSelectedPlaybook(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ansible Automation</h1>
          <p className="text-muted-foreground">
            Execute playbooks and manage infrastructure configuration
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
              <div className="p-3 rounded-lg bg-blue-500/10">
                <FileCode className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mockPlaybooks.length}</p>
                <p className="text-sm text-muted-foreground">Playbooks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {mockRuns.filter((r) => r.status === "success").length}
                </p>
                <p className="text-sm text-muted-foreground">Successful Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {mockRuns.filter((r) => r.status === "failed").length}
                </p>
                <p className="text-sm text-muted-foreground">Failed Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Server className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {mockInventory.reduce((acc, i) => acc + i.hosts, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Managed Hosts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="playbooks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="playbooks" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search playbooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPlaybooks.map((playbook) => (
              <Card key={playbook.id} className="group hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <FileCode className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">
                          {playbook.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {playbook.path}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {playbook.description}
                  </p>
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="secondary">{playbook.hosts}</Badge>
                    {playbook.lastStatus && (
                      <div className="flex items-center gap-2">
                        {statusIcons[playbook.lastStatus]}
                        <span className="text-xs text-muted-foreground">
                          {playbook.lastRun}
                        </span>
                      </div>
                    )}
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        className="w-full"
                        onClick={() => setSelectedPlaybook(playbook)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Run Playbook
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Run Playbook: {playbook.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Target Hosts</Label>
                          <Input defaultValue={playbook.hosts} />
                        </div>
                        <div className="space-y-2">
                          <Label>Extra Variables (YAML)</Label>
                          <Textarea
                            placeholder="key: value"
                            className="font-mono text-sm"
                            rows={4}
                          />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button variant="outline">Cancel</Button>
                          <Button onClick={() => handleRunPlaybook(playbook)}>
                            <Play className="h-4 w-4 mr-2" />
                            Execute
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Playbook</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{run.playbook}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcons[run.status]}
                        <Badge variant="outline" className={statusColors[run.status]}>
                          {run.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {run.startedAt}
                      </div>
                    </TableCell>
                    <TableCell>{run.duration}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-500">ok: {run.hosts.ok}</span>
                        <span className="text-yellow-500">changed: {run.hosts.changed}</span>
                        <span className="text-red-500">failed: {run.hosts.failed}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group Name</TableHead>
                  <TableHead>Hosts</TableHead>
                  <TableHead>Parent Groups</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockInventory.map((inv) => (
                  <TableRow key={inv.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{inv.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{inv.hosts} hosts</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {inv.groups.map((g) => (
                          <Badge key={g} variant="secondary" className="text-xs">
                            {g}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
