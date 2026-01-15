import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar, Clock, Play, Pause, Trash2, Plus, History, RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function ScheduledScaling() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<number | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    targetType: "deployment" as "deployment" | "container" | "service",
    targetName: "",
    namespace: "default",
    cronExpression: "0 8 * * 1-5", // Default: 8 AM weekdays
    timezone: "UTC",
    targetReplicas: 3,
  });

  const utils = trpc.useUtils();
  const { data: schedules, isLoading } = trpc.scheduledScaling.list.useQuery();
  const { data: history } = trpc.scheduledScaling.history.useQuery({ limit: 50 });
  const { data: timezones } = trpc.scheduledScaling.getTimezones.useQuery();
  
  const createMutation = trpc.scheduledScaling.create.useMutation({
    onSuccess: () => {
      toast.success("Scheduled scaling rule created");
      setIsCreateOpen(false);
      resetForm();
      utils.scheduledScaling.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleMutation = trpc.scheduledScaling.toggle.useMutation({
    onSuccess: (data) => {
      toast.success(`Schedule ${data.isEnabled ? "enabled" : "disabled"}`);
      utils.scheduledScaling.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.scheduledScaling.delete.useMutation({
    onSuccess: () => {
      toast.success("Schedule deleted");
      utils.scheduledScaling.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const executeNowMutation = trpc.scheduledScaling.executeNow.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Scaled to ${data.newReplicas} replicas`);
      } else {
        toast.error(`Scaling failed: ${data.error}`);
      }
      utils.scheduledScaling.history.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      targetType: "deployment",
      targetName: "",
      namespace: "default",
      cronExpression: "0 8 * * 1-5",
      timezone: "UTC",
      targetReplicas: 3,
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "skipped":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  // Common cron presets
  const cronPresets = [
    { label: "Every day at 8 AM", value: "0 8 * * *" },
    { label: "Weekdays at 8 AM", value: "0 8 * * 1-5" },
    { label: "Weekdays at 6 PM", value: "0 18 * * 1-5" },
    { label: "Every hour", value: "0 * * * *" },
    { label: "Every 30 minutes", value: "*/30 * * * *" },
    { label: "Weekends at 10 AM", value: "0 10 * * 0,6" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Scaling</h1>
          <p className="text-muted-foreground">
            Schedule automatic scaling for predictable workloads
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Scheduled Scaling Rule</DialogTitle>
              <DialogDescription>
                Define when and how to scale your resources automatically
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Morning scale-up"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetType">Target Type</Label>
                  <Select
                    value={formData.targetType}
                    onValueChange={(value: "deployment" | "container" | "service") =>
                      setFormData({ ...formData, targetType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deployment">Deployment</SelectItem>
                      <SelectItem value="container">Container</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetName">Target Name</Label>
                  <Input
                    id="targetName"
                    value={formData.targetName}
                    onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
                    placeholder="my-app"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="namespace">Namespace</Label>
                  <Input
                    id="namespace"
                    value={formData.namespace}
                    onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                    placeholder="default"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Scale up for morning traffic peak"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cron Expression</Label>
                  <Select
                    value={formData.cronExpression}
                    onValueChange={(value) => setFormData({ ...formData, cronExpression: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select preset or enter custom" />
                    </SelectTrigger>
                    <SelectContent>
                      {cronPresets.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={formData.cronExpression}
                    onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                    placeholder="0 8 * * 1-5"
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: minute hour day-of-month month day-of-week
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones?.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetReplicas">Target Replicas</Label>
                <Input
                  id="targetReplicas"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.targetReplicas}
                  onChange={(e) => setFormData({ ...formData, targetReplicas: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="schedules">
        <TabsList>
          <TabsTrigger value="schedules">
            <Calendar className="mr-2 h-4 w-4" />
            Schedules
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            Execution History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : schedules?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No scheduled scaling rules</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first schedule to automate scaling
                </p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {schedules?.map((schedule) => (
                <Card key={schedule.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{schedule.name}</CardTitle>
                        <Badge variant={schedule.isEnabled ? "default" : "secondary"}>
                          {schedule.isEnabled ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={schedule.isEnabled}
                          onCheckedChange={() => toggleMutation.mutate({ id: schedule.id })}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => executeNowMutation.mutate({ id: schedule.id })}
                          disabled={executeNowMutation.isPending}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm("Delete this schedule?")) {
                              deleteMutation.mutate({ id: schedule.id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {schedule.description && (
                      <CardDescription>{schedule.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Target:</span>
                        <p className="font-medium">{schedule.targetName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Schedule:</span>
                        <p className="font-mono text-xs">{schedule.cronExpression}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Replicas:</span>
                        <p className="font-medium">{schedule.targetReplicas}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Next Run:</span>
                        <p className="font-medium">
                          {schedule.nextExecutionAt
                            ? new Date(schedule.nextExecutionAt).toLocaleString()
                            : "Not scheduled"}
                        </p>
                      </div>
                    </div>
                    {schedule.lastExecutedAt && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Last executed: {new Date(schedule.lastExecutedAt).toLocaleString()}
                        {" | "}
                        Success rate: {Math.round(((schedule.executionCount - schedule.failureCount) / schedule.executionCount) * 100)}%
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>Recent scheduled scaling executions</CardDescription>
            </CardHeader>
            <CardContent>
              {history?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No execution history yet
                </p>
              ) : (
                <div className="space-y-2">
                  {history?.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(record.status)}
                        <div>
                          <p className="font-medium">
                            Schedule #{record.scheduleId}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {record.previousReplicas} → {record.targetReplicas} replicas
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p>{new Date(record.scheduledFor).toLocaleString()}</p>
                        <p className="text-muted-foreground">
                          {record.executionTimeMs}ms
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
