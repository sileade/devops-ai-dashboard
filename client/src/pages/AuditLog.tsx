import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FileText,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Shield,
  Activity,
  Clock,
  User,
  Globe,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
} from "lucide-react";

export default function AuditLog() {

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Queries
  const { data: logsData, isLoading, refetch } = trpc.auditLog.getLogs.useQuery({
    page,
    limit: 20,
    search: search || undefined,
    action: actionFilter ? (actionFilter as any) : undefined,
    riskLevel: riskFilter ? (riskFilter as any) : undefined,
    status: statusFilter ? (statusFilter as any) : undefined,
  });

  const { data: stats } = trpc.auditLog.getStats.useQuery({ days: 30 });
  const { data: anomalies, isLoading: anomaliesLoading } = trpc.auditLog.detectAnomalies.useQuery({ days: 7 });

  // Mutations
  const exportLogs = trpc.auditLog.export.useMutation({
    onSuccess: (data) => {
      // Download file
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Logs exported successfully");
    },
    onError: (error) => {
      toast.error("Failed to export logs", { description: error.message });
    },
  });

  const getRiskBadge = (risk: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "outline",
      medium: "secondary",
      high: "default",
      critical: "destructive",
    };
    const colors: Record<string, string> = {
      low: "text-green-600",
      medium: "text-yellow-600",
      high: "text-orange-600",
      critical: "text-red-600",
    };
    return (
      <Badge variant={variants[risk] || "outline"} className={colors[risk]}>
        {risk}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      success: "default",
      failure: "destructive",
      partial: "secondary",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getActionIcon = (action: string) => {
    if (action.includes("login") || action.includes("logout")) return <User className="h-4 w-4" />;
    if (action.includes("deploy") || action.includes("rollback")) return <Activity className="h-4 w-4" />;
    if (action.includes("delete") || action.includes("remove")) return <AlertTriangle className="h-4 w-4" />;
    if (action.includes("secret") || action.includes("admin")) return <Shield className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-muted-foreground">
              Track and monitor all user activities in your system
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => exportLogs.mutate({ format: "json" })}
              disabled={exportLogs.isPending}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats?.totalEvents || 0}</span>
              </div>
              <p className="text-sm text-muted-foreground">Total Events (30d)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">{stats?.suspiciousEvents || 0}</span>
              </div>
              <p className="text-sm text-muted-foreground">Suspicious Events</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold">{stats?.failedEvents || 0}</span>
              </div>
              <p className="text-sm text-muted-foreground">Failed Events</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{stats?.activeUsers?.length || 0}</span>
              </div>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold">{stats?.eventsByAction?.length || 0}</span>
              </div>
              <p className="text-sm text-muted-foreground">Action Types</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="logs">
          <TabsList>
            <TabsTrigger value="logs">Event Logs</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="anomalies">AI Anomaly Detection</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="mt-4 space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search logs..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Actions</SelectItem>
                      <SelectItem value="login">Login</SelectItem>
                      <SelectItem value="logout">Logout</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                      <SelectItem value="deploy">Deploy</SelectItem>
                      <SelectItem value="rollback">Rollback</SelectItem>
                      <SelectItem value="scale">Scale</SelectItem>
                      <SelectItem value="config_change">Config Change</SelectItem>
                      <SelectItem value="secret_access">Secret Access</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Risks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Risks</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Status</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="failure">Failure</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Logs Table */}
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead>Risk</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logsData?.logs.map((log) => (
                          <TableRow
                            key={log.id}
                            className={log.isSuspicious ? "bg-red-500/5" : ""}
                          >
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {new Date(log.createdAt).toLocaleString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate max-w-[150px]">
                                  {log.userEmail || `User #${log.userId}`}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getActionIcon(log.action)}
                                <span>{log.action}</span>
                                {log.isSuspicious && (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="truncate max-w-[200px] block">
                                {log.resourceName || log.resourceType || "-"}
                              </span>
                            </TableCell>
                            <TableCell>{getRiskBadge(log.riskLevel)}</TableCell>
                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedLog(log);
                                  setShowDetailsDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, logsData?.total || 0)} of {logsData?.total || 0} entries
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => p + 1)}
                          disabled={page >= (logsData?.totalPages || 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Events by Action */}
              <Card>
                <CardHeader>
                  <CardTitle>Events by Action</CardTitle>
                  <CardDescription>Distribution of events by action type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats?.eventsByAction?.slice(0, 10).map((item) => (
                      <div key={item.action} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getActionIcon(item.action)}
                          <span className="text-sm">{item.action}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{
                                width: `${(item.count / (stats?.totalEvents || 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {item.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Events by Risk Level */}
              <Card>
                <CardHeader>
                  <CardTitle>Events by Risk Level</CardTitle>
                  <CardDescription>Distribution of events by risk level</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats?.eventsByRisk?.map((item) => (
                      <div key={item.riskLevel} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getRiskBadge(item.riskLevel)}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{
                                width: `${(item.count / (stats?.totalEvents || 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {item.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Most Active Users */}
              <Card>
                <CardHeader>
                  <CardTitle>Most Active Users</CardTitle>
                  <CardDescription>Users with the most activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats?.activeUsers?.map((user, index) => (
                      <div key={user.userId || index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                          <span className="text-sm truncate max-w-[150px]">
                            {user.userEmail || `User #${user.userId}`}
                          </span>
                        </div>
                        <Badge variant="secondary">{user.count} events</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Events Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>Events Timeline</CardTitle>
                  <CardDescription>Events over the last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-end gap-1">
                    {stats?.eventsByDay?.slice(-30).map((day, index) => (
                      <div
                        key={index}
                        className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t"
                        style={{
                          height: `${Math.max(10, (day.count / Math.max(...(stats?.eventsByDay?.map((d) => d.count) || [1]))) * 100)}%`,
                        }}
                        title={`${day.date}: ${day.count} events`}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="anomalies" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  AI Anomaly Detection
                </CardTitle>
                <CardDescription>
                  AI-powered analysis of suspicious activities and security threats
                </CardDescription>
              </CardHeader>
              <CardContent>
                {anomaliesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : anomalies ? (
                  <div className="space-y-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg text-sm">
                        {typeof anomalies.analysis === 'string' ? anomalies.analysis : JSON.stringify(anomalies.analysis, null, 2)}
                      </pre>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Generated at: {new Date(anomalies.generatedAt).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Unable to detect anomalies. Admin access required.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Log Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Event Details</DialogTitle>
              <DialogDescription>
                Detailed information about this audit log entry
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Timestamp</Label>
                    <p>{new Date(selectedLog.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">User</Label>
                    <p>{selectedLog.userEmail || `User #${selectedLog.userId}`}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Action</Label>
                    <p>{selectedLog.action}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p>{getStatusBadge(selectedLog.status)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Risk Level</Label>
                    <p>{getRiskBadge(selectedLog.riskLevel)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">IP Address</Label>
                    <p>{selectedLog.ipAddress || "-"}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{selectedLog.description}</p>
                </div>
                {selectedLog.resourceType && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Resource Type</Label>
                      <p>{selectedLog.resourceType}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Resource ID</Label>
                      <p>{selectedLog.resourceId || "-"}</p>
                    </div>
                  </div>
                )}
                {selectedLog.isSuspicious && (
                  <div className="p-4 bg-red-500/10 rounded-lg">
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-medium">Suspicious Activity Detected</span>
                    </div>
                    <p className="text-sm">{selectedLog.suspiciousReason}</p>
                  </div>
                )}
                {selectedLog.previousState && (
                  <div>
                    <Label className="text-muted-foreground">Previous State</Label>
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(selectedLog.previousState, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.newState && (
                  <div>
                    <Label className="text-muted-foreground">New State</Label>
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(selectedLog.newState, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
