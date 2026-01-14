import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Folder,
  Settings,
  MoreVertical,
  Search,
  GitBranch,
  Container,
  Network,
  Server,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { toast } from "sonner";

interface Application {
  id: string;
  name: string;
  slug: string;
  description: string;
  environment: "development" | "staging" | "production";
  color: string;
  containers: number;
  pods: number;
  deployments: number;
  lastActivity: string;
}

const mockApplications: Application[] = [
  {
    id: "1",
    name: "E-Commerce Platform",
    slug: "ecommerce",
    description: "Main e-commerce application with microservices",
    environment: "production",
    color: "#22C55E",
    containers: 12,
    pods: 24,
    deployments: 5,
    lastActivity: "2 min ago",
  },
  {
    id: "2",
    name: "Analytics Dashboard",
    slug: "analytics",
    description: "Real-time analytics and reporting system",
    environment: "staging",
    color: "#3B82F6",
    containers: 6,
    pods: 12,
    deployments: 3,
    lastActivity: "15 min ago",
  },
  {
    id: "3",
    name: "API Gateway",
    slug: "api-gateway",
    description: "Central API gateway and authentication service",
    environment: "production",
    color: "#A855F7",
    containers: 4,
    pods: 8,
    deployments: 2,
    lastActivity: "1 hour ago",
  },
  {
    id: "4",
    name: "Dev Sandbox",
    slug: "dev-sandbox",
    description: "Development and testing environment",
    environment: "development",
    color: "#F59E0B",
    containers: 8,
    pods: 0,
    deployments: 1,
    lastActivity: "3 hours ago",
  },
];

const environmentColors = {
  development: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  staging: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  production: "bg-green-500/10 text-green-500 border-green-500/30",
};

export default function Applications() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredApps = mockApplications.filter(
    (app) =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateApp = () => {
    toast.success("Application created successfully");
    setIsCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground">
            Manage your application contexts and environments
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Application
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Application</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Application Name</Label>
                <Input id="name" placeholder="My Application" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" placeholder="my-application" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select defaultValue="development">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the application..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateApp}>Create Application</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Environments</SelectItem>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredApps.map((app) => (
          <Card
            key={app.id}
            className="group hover:border-primary/50 transition-colors cursor-pointer"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${app.color}20` }}
                  >
                    <Folder className="h-5 w-5" style={{ color: app.color }} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {app.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <GitBranch className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono">
                        {app.slug}
                      </span>
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {app.description}
              </p>
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={environmentColors[app.environment]}
                >
                  {app.environment}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {app.lastActivity}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/50">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                    <Container className="h-3.5 w-3.5" />
                    <span className="text-sm font-medium text-foreground">
                      {app.containers}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">Containers</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                    <Network className="h-3.5 w-3.5" />
                    <span className="text-sm font-medium text-foreground">
                      {app.pods}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">Pods</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                    <Server className="h-3.5 w-3.5" />
                    <span className="text-sm font-medium text-foreground">
                      {app.deployments}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">Deploys</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
