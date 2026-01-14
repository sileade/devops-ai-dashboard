import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { useState } from "react";

type StatusType = "healthy" | "warning" | "error";

interface StatusCardProps {
  title: string;
  icon: React.ElementType;
  value: string | number;
  subtitle: string;
  status: StatusType;
  trend?: string;
}

function StatusCard({ title, icon: Icon, value, subtitle, status, trend }: StatusCardProps) {
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
}

function ResourceUsage({ label, value, max, unit, icon: Icon }: ResourceUsageProps) {
  const percentage = (value / max) * 100;
  const getColor = (pct: number) => {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

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

interface RecentActivityItem {
  id: string;
  type: "deploy" | "scale" | "restart" | "error";
  message: string;
  timestamp: string;
  status: StatusType;
}

const mockActivities: RecentActivityItem[] = [
  { id: "1", type: "deploy", message: "Deployed api-server v2.3.1 to production", timestamp: "2 min ago", status: "healthy" },
  { id: "2", type: "scale", message: "Scaled web-frontend from 3 to 5 replicas", timestamp: "15 min ago", status: "healthy" },
  { id: "3", type: "error", message: "Pod crash loop detected in worker-queue", timestamp: "32 min ago", status: "error" },
  { id: "4", type: "restart", message: "Restarted database-primary container", timestamp: "1 hour ago", status: "warning" },
  { id: "5", type: "deploy", message: "Terraform apply completed for staging", timestamp: "2 hours ago", status: "healthy" },
];

export default function Home() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
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
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          title="Docker Containers"
          icon={Container}
          value={24}
          subtitle="18 running, 6 stopped"
          status="healthy"
          trend="+3 today"
        />
        <StatusCard
          title="Kubernetes Pods"
          icon={Network}
          value={47}
          subtitle="45 running, 2 pending"
          status="warning"
        />
        <StatusCard
          title="Active Deployments"
          icon={Server}
          value={12}
          subtitle="All healthy"
          status="healthy"
        />
        <StatusCard
          title="Alerts"
          icon={AlertTriangle}
          value={3}
          subtitle="1 critical, 2 warnings"
          status="error"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div
                    className={`mt-0.5 p-1.5 rounded-full ${
                      activity.status === "healthy"
                        ? "bg-green-500/10"
                        : activity.status === "warning"
                        ? "bg-yellow-500/10"
                        : "bg-red-500/10"
                    }`}
                  >
                    <Activity
                      className={`h-3.5 w-3.5 ${
                        activity.status === "healthy"
                          ? "text-green-500"
                          : activity.status === "warning"
                          ? "text-yellow-500"
                          : "text-red-500"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.timestamp}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      activity.status === "healthy"
                        ? "border-green-500/30 text-green-500"
                        : activity.status === "warning"
                        ? "border-yellow-500/30 text-yellow-500"
                        : "border-red-500/30 text-red-500"
                    }
                  >
                    {activity.type}
                  </Badge>
                </div>
              ))}
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
              value={67}
              max={100}
              unit="%"
              icon={Cpu}
            />
            <ResourceUsage
              label="Memory"
              value={12.4}
              max={32}
              unit="GB"
              icon={MemoryStick}
            />
            <ResourceUsage
              label="Storage"
              value={234}
              max={500}
              unit="GB"
              icon={HardDrive}
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
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                <Container className="h-5 w-5" />
                <span className="text-xs">Deploy Container</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                <Network className="h-5 w-5" />
                <span className="text-xs">Scale Deployment</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                <Server className="h-5 w-5" />
                <span className="text-xs">Run Playbook</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                <Activity className="h-5 w-5" />
                <span className="text-xs">View Logs</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Connected Infrastructure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "Production Docker Host", type: "Docker", status: "connected" as const },
                { name: "Staging K8s Cluster", type: "Kubernetes", status: "connected" as const },
                { name: "Dev Podman Instance", type: "Podman", status: "disconnected" as const },
                { name: "AWS Terraform State", type: "Terraform", status: "connected" as const },
              ].map((infra, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        infra.status === "connected" ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">{infra.name}</p>
                      <p className="text-xs text-muted-foreground">{infra.type}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {infra.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
