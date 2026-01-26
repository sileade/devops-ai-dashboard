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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Layers,
  Play,
  Search,
  RefreshCw,
  FileCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  GitBranch,
  Cloud,
  Database,
  Network,
  Server,
  Lock,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import TerraformBuilder from "@/components/TerraformBuilder";

interface Workspace {
  id: string;
  name: string;
  environment: "production" | "staging" | "development";
  provider: string;
  resources: number;
  lastApply: string;
  status: "applied" | "pending" | "error";
}

const mockWorkspaces: Workspace[] = [
  { id: "1", name: "aws-production", environment: "production", provider: "AWS", resources: 47, lastApply: "2 hours ago", status: "applied" },
  { id: "2", name: "aws-staging", environment: "staging", provider: "AWS", resources: 23, lastApply: "1 day ago", status: "applied" },
  { id: "3", name: "gcp-analytics", environment: "production", provider: "GCP", resources: 12, lastApply: "3 days ago", status: "pending" },
  { id: "4", name: "azure-backup", environment: "production", provider: "Azure", resources: 8, lastApply: "1 week ago", status: "error" },
];

interface TerraformResource {
  type: string;
  name: string;
  provider: string;
  status: "created" | "updated" | "destroyed" | "unchanged";
  module: string;
}

const mockResources: TerraformResource[] = [
  { type: "aws_instance", name: "web_server", provider: "aws", status: "unchanged", module: "root" },
  { type: "aws_instance", name: "api_server", provider: "aws", status: "updated", module: "root" },
  { type: "aws_rds_instance", name: "main_db", provider: "aws", status: "unchanged", module: "database" },
  { type: "aws_s3_bucket", name: "assets", provider: "aws", status: "unchanged", module: "storage" },
  { type: "aws_vpc", name: "main", provider: "aws", status: "unchanged", module: "network" },
  { type: "aws_security_group", name: "web_sg", provider: "aws", status: "created", module: "network" },
  { type: "aws_lb", name: "main_lb", provider: "aws", status: "unchanged", module: "network" },
];

interface Variable {
  name: string;
  value: string;
  sensitive: boolean;
  source: "default" | "tfvars" | "env" | "cli";
}

const mockVariables: Variable[] = [
  { name: "aws_region", value: "us-east-1", sensitive: false, source: "tfvars" },
  { name: "instance_type", value: "t3.medium", sensitive: false, source: "tfvars" },
  { name: "db_password", value: "********", sensitive: true, source: "env" },
  { name: "environment", value: "production", sensitive: false, source: "tfvars" },
  { name: "api_key", value: "********", sensitive: true, source: "env" },
];

const statusColors = {
  applied: "bg-green-500/10 text-green-500 border-green-500/30",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  error: "bg-red-500/10 text-red-500 border-red-500/30",
  created: "bg-green-500/10 text-green-500 border-green-500/30",
  updated: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  destroyed: "bg-red-500/10 text-red-500 border-red-500/30",
  unchanged: "bg-secondary text-muted-foreground border-border",
};

const statusIcons = {
  applied: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  pending: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
};

const resourceIcons: Record<string, React.ElementType> = {
  aws_instance: Server,
  aws_rds_instance: Database,
  aws_s3_bucket: Cloud,
  aws_vpc: Network,
  aws_security_group: Lock,
  aws_lb: Network,
};

export default function Terraform() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    mockWorkspaces[0]
  );
  const [showBuilder, setShowBuilder] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Terraform state refreshed");
    }, 1000);
  };

  const handlePlan = () => {
    toast.success("Running terraform plan...");
  };

  const handleApply = () => {
    toast.success("Running terraform apply...");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Terraform IaC</h1>
          <p className="text-muted-foreground">
            Manage infrastructure as code with Terraform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePlan}>
            <Eye className="h-4 w-4 mr-2" />
            Plan
          </Button>
          <Button size="sm" onClick={handleApply}>
            <Play className="h-4 w-4 mr-2" />
            Apply
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowBuilder(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Config
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Layers className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mockWorkspaces.length}</p>
                <p className="text-sm text-muted-foreground">Workspaces</p>
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
                <p className="text-2xl font-bold">
                  {mockWorkspaces.reduce((acc, w) => acc + w.resources, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Resources</p>
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
                  {mockWorkspaces.filter((w) => w.status === "applied").length}
                </p>
                <p className="text-sm text-muted-foreground">Applied</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {mockWorkspaces.filter((w) => w.status === "pending").length}
                </p>
                <p className="text-sm text-muted-foreground">Pending Changes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Workspaces</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="p-2 space-y-1">
                {mockWorkspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => setSelectedWorkspace(workspace)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedWorkspace?.id === workspace.id
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{workspace.name}</span>
                      </div>
                      {statusIcons[workspace.status]}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {workspace.provider}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {workspace.resources} resources
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          {selectedWorkspace && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{selectedWorkspace.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Last applied: {selectedWorkspace.lastApply}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusColors[selectedWorkspace.status]}>
                      {selectedWorkspace.status}
                    </Badge>
                    <Badge variant="secondary">{selectedWorkspace.environment}</Badge>
                  </div>
                </CardHeader>
              </Card>

              <Tabs defaultValue="resources" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="resources">Resources</TabsTrigger>
                  <TabsTrigger value="variables">Variables</TabsTrigger>
                  <TabsTrigger value="state">State</TabsTrigger>
                </TabsList>

                <TabsContent value="resources" className="space-y-4">
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
                  </div>

                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Resource</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Module</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockResources.map((resource, idx) => {
                          const Icon = resourceIcons[resource.type] || FileCode;
                          return (
                            <TableRow key={idx}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{resource.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="text-xs bg-secondary px-2 py-1 rounded">
                                  {resource.type}
                                </code>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {resource.module}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusColors[resource.status]}>
                                  {resource.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>

                <TabsContent value="variables" className="space-y-4">
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Variable</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Sensitive</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockVariables.map((variable, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <span className="font-mono text-sm">{variable.name}</span>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-secondary px-2 py-1 rounded">
                                {variable.value}
                              </code>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{variable.source}</Badge>
                            </TableCell>
                            <TableCell>
                              {variable.sensitive ? (
                                <Lock className="h-4 w-4 text-yellow-500" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>

                <TabsContent value="state" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Terraform State</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-secondary/50 rounded-lg p-4 font-mono text-sm">
                        <pre className="text-muted-foreground">
{`{
  "version": 4,
  "terraform_version": "1.6.0",
  "serial": 42,
  "lineage": "abc123-def456-ghi789",
  "outputs": {},
  "resources": [...]
}`}
                        </pre>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View Full State
                        </Button>
                        <Button variant="outline" size="sm">
                          Download State
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* Terraform Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-5xl h-[90vh] p-0">
          <TerraformBuilder
            onComplete={(hcl) => {
              console.log("Generated HCL:", hcl);
              toast.success("Terraform configuration created! Copy the HCL to use it.");
              setShowBuilder(false);
            }}
            onCancel={() => setShowBuilder(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
