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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Eye,
  History,
  Terminal,
  BookOpen,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import PlaybookEditor from "@/components/PlaybookEditor";

interface Playbook {
  id: string;
  name: string;
  path: string;
  description: string;
  lastRun: string | null;
  lastStatus: "success" | "failed" | "running" | null;
  hosts: string;
  tasks: number;
  createdAt: string;
  updatedAt: string;
}

const mockPlaybooks: Playbook[] = [
  { id: "1", name: "deploy-app", path: "playbooks/deploy-app.yml", description: "Deploy application to production servers", lastRun: "2 hours ago", lastStatus: "success", hosts: "web-servers", tasks: 12, createdAt: "2024-01-10", updatedAt: "2024-01-15" },
  { id: "2", name: "update-packages", path: "playbooks/update-packages.yml", description: "Update system packages on all servers", lastRun: "1 day ago", lastStatus: "success", hosts: "all", tasks: 5, createdAt: "2024-01-05", updatedAt: "2024-01-14" },
  { id: "3", name: "configure-nginx", path: "playbooks/configure-nginx.yml", description: "Configure Nginx reverse proxy", lastRun: "3 days ago", lastStatus: "failed", hosts: "load-balancers", tasks: 8, createdAt: "2024-01-08", updatedAt: "2024-01-12" },
  { id: "4", name: "backup-databases", path: "playbooks/backup-databases.yml", description: "Backup PostgreSQL databases", lastRun: "6 hours ago", lastStatus: "success", hosts: "db-servers", tasks: 6, createdAt: "2024-01-03", updatedAt: "2024-01-15" },
  { id: "5", name: "setup-monitoring", path: "playbooks/setup-monitoring.yml", description: "Install and configure monitoring agents", lastRun: null, lastStatus: null, hosts: "all", tasks: 15, createdAt: "2024-01-12", updatedAt: "2024-01-12" },
];

interface PlaybookRun {
  id: string;
  playbook: string;
  status: "success" | "failed" | "running";
  startedAt: string;
  duration: string;
  hosts: { ok: number; changed: number; failed: number };
  output?: string;
}

const mockRuns: PlaybookRun[] = [
  { id: "run1", playbook: "deploy-app", status: "success", startedAt: "2 hours ago", duration: "3m 24s", hosts: { ok: 5, changed: 3, failed: 0 }, output: "PLAY [Deploy Application] ***\n\nTASK [Gathering Facts] ***\nok: [web1]\nok: [web2]\n\nTASK [Install dependencies] ***\nchanged: [web1]\nchanged: [web2]\n\nPLAY RECAP ***\nweb1: ok=5 changed=3 failed=0\nweb2: ok=5 changed=3 failed=0" },
  { id: "run2", playbook: "backup-databases", status: "success", startedAt: "6 hours ago", duration: "12m 45s", hosts: { ok: 2, changed: 2, failed: 0 } },
  { id: "run3", playbook: "update-packages", status: "success", startedAt: "1 day ago", duration: "8m 12s", hosts: { ok: 10, changed: 8, failed: 0 } },
  { id: "run4", playbook: "configure-nginx", status: "failed", startedAt: "3 days ago", duration: "1m 02s", hosts: { ok: 1, changed: 0, failed: 2 }, output: "PLAY [Configure Nginx] ***\n\nTASK [Gathering Facts] ***\nok: [lb1]\nfatal: [lb2]: UNREACHABLE! => {\"msg\": \"Failed to connect to the host\"}\n\nPLAY RECAP ***\nlb1: ok=1 changed=0 failed=0\nlb2: ok=0 changed=0 failed=1" },
];

interface Inventory {
  name: string;
  hosts: number;
  groups: string[];
  lastUpdated: string;
}

const mockInventory: Inventory[] = [
  { name: "web-servers", hosts: 5, groups: ["production", "web"], lastUpdated: "1 day ago" },
  { name: "db-servers", hosts: 2, groups: ["production", "database"], lastUpdated: "2 days ago" },
  { name: "load-balancers", hosts: 3, groups: ["production", "lb"], lastUpdated: "1 week ago" },
  { name: "staging", hosts: 4, groups: ["staging"], lastUpdated: "3 days ago" },
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
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [showEditorDialog, setShowEditorDialog] = useState(false);
  const [showOutputDialog, setShowOutputDialog] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PlaybookRun | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [runVariables, setRunVariables] = useState("");

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Playbooks refreshed");
    }, 1000);
  };

  const handleRunPlaybook = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setShowRunDialog(true);
  };

  const executePlaybook = () => {
    toast.success(`Running playbook: ${selectedPlaybook?.name}`);
    setShowRunDialog(false);
    // Simulate execution
    setTimeout(() => {
      toast.success(`Playbook ${selectedPlaybook?.name} completed successfully`);
    }, 3000);
  };

  const handleEditPlaybook = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setIsCreatingNew(false);
    setShowEditorDialog(true);
  };

  const handleCreatePlaybook = () => {
    setSelectedPlaybook(null);
    setIsCreatingNew(true);
    setShowEditorDialog(true);
  };

  const handleViewOutput = (run: PlaybookRun) => {
    setSelectedRun(run);
    setShowOutputDialog(true);
  };

  const handleSavePlaybook = (data: any, yaml: string) => {
    console.log("Saving playbook:", data, yaml);
    toast.success(isCreatingNew ? "Playbook created" : "Playbook saved");
    setShowEditorDialog(false);
  };

  const handleRunFromEditor = (data: any) => {
    console.log("Running playbook:", data);
    toast.success("Playbook execution started");
  };

  const filteredPlaybooks = mockPlaybooks.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ansible Automation</h1>
          <p className="text-muted-foreground">
            Create, edit, and run Ansible playbooks with visual editor
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleCreatePlaybook}>
            <Plus className="h-4 w-4 mr-2" />
            New Playbook
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Playbooks</p>
                <p className="text-2xl font-bold">{mockPlaybooks.length}</p>
              </div>
              <FileCode className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful Runs</p>
                <p className="text-2xl font-bold text-green-500">
                  {mockRuns.filter((r) => r.status === "success").length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed Runs</p>
                <p className="text-2xl font-bold text-red-500">
                  {mockRuns.filter((r) => r.status === "failed").length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inventory Groups</p>
                <p className="text-2xl font-bold">{mockInventory.length}</p>
              </div>
              <Server className="h-8 w-8 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="playbooks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="playbooks" className="flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger value="runs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Run History
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* Playbooks Tab */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlaybooks.map((playbook) => (
              <Card key={playbook.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-5 w-5 text-blue-500" />
                      <CardTitle className="text-base">{playbook.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditPlaybook(playbook)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View YAML
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-500">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="text-xs">{playbook.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Hosts:</span>
                    <Badge variant="outline">{playbook.hosts}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tasks:</span>
                    <span>{playbook.tasks}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Run:</span>
                    <div className="flex items-center gap-1">
                      {playbook.lastStatus && statusIcons[playbook.lastStatus]}
                      <span>{playbook.lastRun || "Never"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleRunPlaybook(playbook)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Run
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleEditPlaybook(playbook)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Run History Tab */}
        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Executions</CardTitle>
              <CardDescription>View playbook execution history and outputs</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Playbook</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Results</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">{run.playbook}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[run.status]}>
                          <span className="flex items-center gap-1">
                            {statusIcons[run.status]}
                            {run.status}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>{run.startedAt}</TableCell>
                      <TableCell>{run.duration}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-500">ok: {run.hosts.ok}</span>
                          <span className="text-yellow-500">changed: {run.hosts.changed}</span>
                          <span className="text-red-500">failed: {run.hosts.failed}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewOutput(run)}
                        >
                          <Terminal className="h-4 w-4 mr-1" />
                          Output
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="flex items-center justify-between">
            <div />
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Host Group
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockInventory.map((inv) => (
              <Card key={inv.name}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-purple-500" />
                    <CardTitle className="text-base">{inv.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Hosts:</span>
                    <Badge>{inv.hosts}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Groups:</span>
                    <div className="flex gap-1">
                      {inv.groups.map((g) => (
                        <Badge key={g} variant="outline" className="text-xs">
                          {g}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground pt-2">
                    Updated {inv.lastUpdated}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Playbook Templates
              </CardTitle>
              <CardDescription>
                Start with a pre-built template for common automation tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: "Web Server Setup", desc: "Install and configure Nginx/Apache", icon: "🌐" },
                  { name: "Database Backup", desc: "Automated PostgreSQL/MySQL backup", icon: "💾" },
                  { name: "Docker Deployment", desc: "Deploy containers with Docker", icon: "🐳" },
                  { name: "Security Hardening", desc: "Apply security best practices", icon: "🔒" },
                  { name: "Monitoring Setup", desc: "Install Prometheus & Grafana", icon: "📊" },
                  { name: "CI/CD Pipeline", desc: "Setup Jenkins/GitLab CI", icon: "🚀" },
                ].map((template) => (
                  <Card
                    key={template.name}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={handleCreatePlaybook}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{template.icon}</span>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-xs text-muted-foreground">{template.desc}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Run Playbook Dialog */}
      <Dialog open={showRunDialog} onOpenChange={setShowRunDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Playbook: {selectedPlaybook?.name}</DialogTitle>
            <DialogDescription>
              Configure execution options before running
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Hosts</Label>
              <Input defaultValue={selectedPlaybook?.hosts} />
            </div>
            <div className="space-y-2">
              <Label>Extra Variables (YAML)</Label>
              <Textarea
                placeholder="key: value"
                value={runVariables}
                onChange={(e) => setRunVariables(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="check-mode" className="rounded" />
              <Label htmlFor="check-mode" className="text-sm">
                Check mode (dry run)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="verbose" className="rounded" />
              <Label htmlFor="verbose" className="text-sm">
                Verbose output
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRunDialog(false)}>
              Cancel
            </Button>
            <Button onClick={executePlaybook} className="bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4 mr-2" />
              Run Playbook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Playbook Editor Dialog */}
      <Dialog open={showEditorDialog} onOpenChange={setShowEditorDialog}>
        <DialogContent className="max-w-6xl h-[90vh] p-0">
          <PlaybookEditor
            onSave={handleSavePlaybook}
            onRun={handleRunFromEditor}
          />
        </DialogContent>
      </Dialog>

      {/* Output Dialog */}
      <Dialog open={showOutputDialog} onOpenChange={setShowOutputDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Execution Output: {selectedRun?.playbook}</DialogTitle>
            <DialogDescription>
              {selectedRun?.status === "success" ? (
                <Badge className="bg-green-500/10 text-green-500">Completed Successfully</Badge>
              ) : (
                <Badge className="bg-red-500/10 text-red-500">Failed</Badge>
              )}
              <span className="ml-2 text-xs">Duration: {selectedRun?.duration}</span>
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96 rounded border border-border bg-black/90 p-4">
            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
              {selectedRun?.output || "No output available"}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOutputDialog(false)}>
              Close
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
