import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Container,
  Server,
  Network,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";

type StatusType = "healthy" | "warning" | "error";

interface StatusCardProps {
  title: string;
  icon: React.ElementType;
  value: string | number;
  subtitle: string;
  status: StatusType;
  trend?: string;
  isLoading?: boolean;
}

function StatusCard({ title, icon: Icon, value, subtitle, status, trend, isLoading }: StatusCardProps) {
  const statusColors = {
    healthy: "bg-green-500/10 text-green-500 border-green-500/20",
    warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    error: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const statusIcons = {
    healthy: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
  };

  const StatusIcon = statusIcons[status];

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-16 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${statusColors[status]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{value}</span>
          {trend && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
              {trend}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <StatusIcon className={`h-3.5 w-3.5 ${status === "healthy" ? "text-green-500" : status === "warning" ? "text-yellow-500" : "text-red-500"}`} />
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface ResourceUsageProps {
  label: string;
  value: number;
  max: number;
  unit: string;
  icon: React.ElementType;
  isLoading?: boolean;
}

function ResourceUsage({ label, value, max, unit, icon: Icon, isLoading }: ResourceUsageProps) {
  const percentage = (value / max) * 100;
  const getColor = (pct: number) => {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{label}</span>
        </div>
        <span className="text-muted-foreground">
          {value} / {max} {unit}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor(percentage)} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export default function Home() {
  const [, setLocation] = useLocation();
  
  // Fetch real data from API
  const overview = trpc.dashboard.getOverview.useQuery();
  const activity = trpc.dashboard.getRecentActivity.useQuery();
  const resources = trpc.dashboard.getResourceUsage.useQuery();
  
  const utils = trpc.useUtils();

  const handleRefresh = () => {
    utils.dashboard.getOverview.invalidate();
    utils.dashboard.getRecentActivity.invalidate();
    utils.dashboard.getResourceUsage.invalidate();
    toast.success("Dashboard refreshed");
  };

  const isLoading = overview.isLoading || activity.isLoading || resources.isLoading;

  // Determine status based on data
  const getContainerStatus = (): StatusType => {
    if (!overview.data) return "healthy";
    const stopped = overview.data.containers.stopped;
    if (stopped > 5) return "error";
    if (stopped > 2) return "warning";
    return "healthy";
  };

  const getKubernetesStatus = (): StatusType => {
    if (!overview.data) return "healthy";
    const pending = overview.data.kubernetes.pending;
    if (pending > 5) return "error";
    if (pending > 0) return "warning";
    return "healthy";
  };

  const getAlertStatus = (): StatusType => {
    if (!overview.data) return "healthy";
    if (overview.data.alerts.critical > 0) return "error";
    if (overview.data.alerts.warnings > 0) return "warning";
    return "healthy";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Infrastructure Overview</h1>
          <p className="text-muted-foreground">
            Monitor and manage your DevOps infrastructure
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          title="Docker Containers"
          icon={Container}
          value={overview.data?.containers.total ?? 0}
          subtitle={`${overview.data?.containers.running ?? 0} running, ${overview.data?.containers.stopped ?? 0} stopped`}
          status={getContainerStatus()}
          trend={overview.data?.containers.todayChange ? `+${overview.data.containers.todayChange} today` : undefined}
          isLoading={overview.isLoading}
        />
        <StatusCard
          title="Kubernetes Pods"
          icon={Network}
          value={overview.data?.kubernetes.pods ?? 0}
          subtitle={`${overview.data?.kubernetes.running ?? 0} running, ${overview.data?.kubernetes.pending ?? 0} pending`}
          status={getKubernetesStatus()}
          isLoading={overview.isLoading}
        />
        <StatusCard
          title="Active Deployments"
          icon={Server}
          value={overview.data?.deployments.active ?? 0}
          subtitle={overview.data?.deployments.status === "healthy" ? "All healthy" : "Issues detected"}
          status={overview.data?.deployments.status === "healthy" ? "healthy" : "warning"}
          isLoading={overview.isLoading}
        />
        <StatusCard
          title="Alerts"
          icon={AlertTriangle}
          value={overview.data?.alerts.total ?? 0}
          subtitle={`${overview.data?.alerts.critical ?? 0} critical, ${overview.data?.alerts.warnings ?? 0} warnings`}
          status={getAlertStatus()}
          isLoading={overview.isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/logs")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-secondary/30">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))
              ) : (
                activity.data?.map((item) => {
                  const status: StatusType = item.type === "error" ? "error" : item.type === "restart" ? "warning" : "healthy";
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-4 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                    >
                      <div
                        className={`mt-0.5 p-1.5 rounded-full ${
                          status === "healthy"
                            ? "bg-green-500/10"
                            : status === "warning"
                            ? "bg-yellow-500/10"
                            : "bg-red-500/10"
                        }`}
                      >
                        <Activity
                          className={`h-3.5 w-3.5 ${
                            status === "healthy"
                              ? "text-green-500"
                              : status === "warning"
                              ? "text-yellow-500"
                              : "text-red-500"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTimeAgo(new Date(item.timestamp))}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          status === "healthy"
                            ? "border-green-500/30 text-green-500"
                            : status === "warning"
                            ? "border-yellow-500/30 text-yellow-500"
                            : "border-red-500/30 text-red-500"
                        }
                      >
                        {item.type}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Resource Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ResourceUsage
              label="CPU"
              value={resources.data?.cpu.used ?? 0}
              max={resources.data?.cpu.total ?? 100}
              unit={resources.data?.cpu.unit ?? "%"}
              icon={Cpu}
              isLoading={resources.isLoading}
            />
            <ResourceUsage
              label="Memory"
              value={resources.data?.memory.used ?? 0}
              max={resources.data?.memory.total ?? 32}
              unit={resources.data?.memory.unit ?? "GB"}
              icon={MemoryStick}
              isLoading={resources.isLoading}
            />
            <ResourceUsage
              label="Storage"
              value={resources.data?.storage.used ?? 0}
              max={resources.data?.storage.total ?? 500}
              unit={resources.data?.storage.unit ?? "GB"}
              icon={HardDrive}
              isLoading={resources.isLoading}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col gap-2"
                onClick={() => setLocation("/containers/docker")}
              >
                <Container className="h-5 w-5" />
                <span className="text-xs">Manage Containers</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col gap-2"
                onClick={() => setLocation("/kubernetes")}
              >
                <Network className="h-5 w-5" />
                <span className="text-xs">Kubernetes</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col gap-2"
                onClick={() => setLocation("/infrastructure/ansible")}
              >
                <Server className="h-5 w-5" />
                <span className="text-xs">Run Playbook</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex flex-col gap-2"
                onClick={() => setLocation("/logs")}
              >
                <Activity className="h-5 w-5" />
                <span className="text-xs">View Logs</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">API Server</span>
                </div>
                <Badge variant="outline" className="border-green-500/30 text-green-500">
                  Online
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">Database</span>
                </div>
                <Badge variant="outline" className="border-green-500/30 text-green-500">
                  Connected
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">AI Assistant</span>
                </div>
                <Badge variant="outline" className="border-green-500/30 text-green-500">
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span className="text-sm font-medium">WebSocket</span>
                </div>
                <Badge variant="outline" className="border-yellow-500/30 text-yellow-500">
                  Reconnecting
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
