import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle, Clock, Play, FileText, Bot, Shield, Activity, Zap } from "lucide-react";
import { toast } from "sonner";

export default function IncidentCommander() {
  const [selectedIncident, setSelectedIncident] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newIncident, setNewIncident] = useState({
    title: "",
    description: "",
    severity: "medium" as "critical" | "high" | "medium" | "low",
    affectedResources: "",
  });

  // Queries
  const { data: incidents, refetch: refetchIncidents } = useQuery({
    queryKey: ["incidents"],
    queryFn: () => trpc.incidentCommander.list.query(),
  });

  const { data: stats } = useQuery({
    queryKey: ["incident-stats"],
    queryFn: () => trpc.incidentCommander.getStats.query(),
  });

  const { data: runbooks } = useQuery({
    queryKey: ["runbooks"],
    queryFn: () => trpc.incidentCommander.listRunbooks.query(),
  });

  const { data: selectedIncidentData } = useQuery({
    queryKey: ["incident", selectedIncident],
    queryFn: () => selectedIncident ? trpc.incidentCommander.get.query({ id: selectedIncident }) : null,
    enabled: !!selectedIncident,
  });

  // Mutations
  const createIncidentMutation = useMutation({
    mutationFn: (data: typeof newIncident) => trpc.incidentCommander.create.mutate({
      ...data,
      affectedResources: data.affectedResources.split(",").map(r => r.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      toast.success("Incident created and AI analysis started");
      setCreateDialogOpen(false);
      setNewIncident({ title: "", description: "", severity: "medium", affectedResources: "" });
      refetchIncidents();
    },
  });

  const acknowledgeIncidentMutation = useMutation({
    mutationFn: (id: number) => trpc.incidentCommander.acknowledge.mutate({ id }),
    onSuccess: () => {
      toast.success("Incident acknowledged");
      refetchIncidents();
    },
  });

  const generatePostMortemMutation = useMutation({
    mutationFn: (id: number) => trpc.incidentCommander.generatePostMortem.mutate({ id }),
    onSuccess: (data) => {
      toast.success("Post-mortem generated");
      // Could open a modal to show the post-mortem
      console.log(data.postMortem);
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "detected": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "investigating": return <Activity className="h-4 w-4 text-yellow-500" />;
      case "mitigating": return <Zap className="h-4 w-4 text-blue-500" />;
      case "resolved": return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Incident Commander</h1>
            <p className="text-muted-foreground">
              Autonomous incident detection, diagnosis, and remediation
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Report Incident
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report New Incident</DialogTitle>
                <DialogDescription>
                  Create a new incident. AI will automatically analyze and suggest remediation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newIncident.title}
                    onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                    placeholder="Brief description of the incident"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newIncident.description}
                    onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                    placeholder="Detailed description of what happened"
                  />
                </div>
                <div>
                  <Label>Severity</Label>
                  <Select
                    value={newIncident.severity}
                    onValueChange={(v) => setNewIncident({ ...newIncident, severity: v as typeof newIncident.severity })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Affected Resources (comma-separated)</Label>
                  <Input
                    value={newIncident.affectedResources}
                    onChange={(e) => setNewIncident({ ...newIncident, affectedResources: e.target.value })}
                    placeholder="api-server, database, cache"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => createIncidentMutation.mutate(newIncident)}>
                  Create Incident
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats?.byStatus?.detected || 0) + (stats?.byStatus?.investigating || 0) + (stats?.byStatus?.mitigating || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.byStatus?.detected || 0} detected, {stats?.byStatus?.investigating || 0} investigating
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Critical</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats?.bySeverity?.critical || 0}</div>
              <p className="text-xs text-muted-foreground">Requires immediate attention</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.avgResolutionTime || 0} min</div>
              <p className="text-xs text-muted-foreground">Based on resolved incidents</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Runbooks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.runbooksCount || 0}</div>
              <p className="text-xs text-muted-foreground">Automated remediation playbooks</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Incidents List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Incidents</CardTitle>
              <CardDescription>Active and recent incidents</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {incidents?.map((incident) => (
                    <div
                      key={incident.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedIncident === incident.id ? "border-primary bg-accent" : "hover:bg-accent/50"
                      }`}
                      onClick={() => setSelectedIncident(incident.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(incident.status)}
                          <div>
                            <h4 className="font-medium">{incident.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {new Date(incident.detectedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge className={getSeverityColor(incident.severity)}>
                          {incident.severity}
                        </Badge>
                      </div>
                      {incident.affectedResources.length > 0 && (
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {incident.affectedResources.slice(0, 3).map((r, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{r}</Badge>
                          ))}
                          {incident.affectedResources.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{incident.affectedResources.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!incidents || incidents.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No incidents detected</p>
                      <p className="text-sm">Your infrastructure is healthy</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Incident Details / Runbooks */}
          <Card>
            <Tabs defaultValue="details">
              <CardHeader>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="runbooks">Runbooks</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="details" className="mt-0">
                  {selectedIncidentData ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold">{selectedIncidentData.title}</h3>
                        <p className="text-sm text-muted-foreground">{selectedIncidentData.description}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Badge className={getSeverityColor(selectedIncidentData.severity)}>
                          {selectedIncidentData.severity}
                        </Badge>
                        <Badge variant="outline">{selectedIncidentData.status}</Badge>
                      </div>

                      {selectedIncidentData.aiAnalysis && (
                        <div className="p-3 bg-accent rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="h-4 w-4" />
                            <span className="font-medium text-sm">AI Analysis</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{selectedIncidentData.aiAnalysis}</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Actions Timeline</h4>
                        {selectedIncidentData.actions.map((action, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <div className={`w-2 h-2 rounded-full mt-1.5 ${
                              action.status === "completed" ? "bg-green-500" :
                              action.status === "failed" ? "bg-red-500" : "bg-yellow-500"
                            }`} />
                            <div>
                              <p>{action.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {action.executedBy} • {new Date(action.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-4">
                        {selectedIncidentData.status === "detected" && (
                          <Button
                            size="sm"
                            onClick={() => acknowledgeIncidentMutation.mutate(selectedIncidentData.id)}
                          >
                            Acknowledge
                          </Button>
                        )}
                        {selectedIncidentData.status === "resolved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generatePostMortemMutation.mutate(selectedIncidentData.id)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Generate Post-Mortem
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Select an incident to view details</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="runbooks" className="mt-0">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {runbooks?.map((runbook) => (
                        <div key={runbook.id} className="p-3 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-sm">{runbook.name}</h4>
                              <p className="text-xs text-muted-foreground">{runbook.description}</p>
                            </div>
                            <Button size="sm" variant="ghost">
                              <Play className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-2 flex gap-1">
                            <Badge variant="outline" className="text-xs">
                              {runbook.steps.length} steps
                            </Badge>
                            {runbook.autoExecute && (
                              <Badge variant="secondary" className="text-xs">Auto</Badge>
                            )}
                            {runbook.requiresApproval && (
                              <Badge variant="secondary" className="text-xs">Approval</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
