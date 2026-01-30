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
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Activity, Zap, RefreshCw, CheckCircle, XCircle, Clock, Brain, Shield, Settings, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function SelfHealing() {
  const [createRuleDialogOpen, setCreateRuleDialogOpen] = useState(false);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  const [triggerTarget, setTriggerTarget] = useState("");
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    conditionType: "container_status",
    actionType: "restart",
    targetType: "container" as "container" | "pod" | "deployment" | "service" | "node",
    cooldownSeconds: 300,
    maxRetries: 3,
    requiresApproval: false,
  });

  // Queries
  const { data: stats } = useQuery({
    queryKey: ["healing-stats"],
    queryFn: () => trpc.selfHealing.getStats.query(),
  });

  const { data: rules, refetch: refetchRules } = useQuery({
    queryKey: ["healing-rules"],
    queryFn: () => trpc.selfHealing.listRules.query(),
  });

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["healing-history"],
    queryFn: () => trpc.selfHealing.getHistory.query(),
  });

  const { data: patterns } = useQuery({
    queryKey: ["healing-patterns"],
    queryFn: () => trpc.selfHealing.getPatterns.query(),
  });

  const { data: effectiveness } = useQuery({
    queryKey: ["rule-effectiveness"],
    queryFn: () => trpc.selfHealing.getRuleEffectiveness.query(),
  });

  // Mutations
  const createRuleMutation = useMutation({
    mutationFn: (data: typeof newRule) => trpc.selfHealing.createRule.mutate({
      ...data,
      conditionConfig: { type: data.conditionType },
      actionConfig: { type: data.actionType },
    }),
    onSuccess: () => {
      toast.success("Healing rule created");
      setCreateRuleDialogOpen(false);
      setNewRule({
        name: "",
        description: "",
        conditionType: "container_status",
        actionType: "restart",
        targetType: "container",
        cooldownSeconds: 300,
        maxRetries: 3,
        requiresApproval: false,
      });
      refetchRules();
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: (data: { id: number; enabled: boolean }) => trpc.selfHealing.toggleRule.mutate(data),
    onSuccess: () => {
      refetchRules();
    },
  });

  const triggerHealingMutation = useMutation({
    mutationFn: (data: { ruleId: number; targetResource: string }) =>
      trpc.selfHealing.triggerHealing.mutate(data),
    onSuccess: () => {
      toast.success("Healing action triggered");
      setTriggerDialogOpen(false);
      setTriggerTarget("");
      refetchHistory();
    },
  });

  const rollbackActionMutation = useMutation({
    mutationFn: (actionId: number) => trpc.selfHealing.rollbackAction.mutate({ actionId }),
    onSuccess: () => {
      toast.success("Action rolled back");
      refetchHistory();
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "executing": return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "pending": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "rolled_back": return <RotateCcw className="h-4 w-4 text-orange-500" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "bg-green-500";
      case "failed": return "bg-red-500";
      case "executing": return "bg-blue-500";
      case "pending": return "bg-yellow-500";
      case "rolled_back": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Self-Healing Engine</h1>
            <p className="text-muted-foreground">
              Autonomous infrastructure recovery with learned patterns
            </p>
          </div>
          <Dialog open={createRuleDialogOpen} onOpenChange={setCreateRuleDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Settings className="mr-2 h-4 w-4" />
                Create Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Healing Rule</DialogTitle>
                <DialogDescription>
                  Define conditions and actions for automatic recovery
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="e.g., Restart Crashed Containers"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    placeholder="Describe when and how this rule should trigger"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Target Type</Label>
                    <Select
                      value={newRule.targetType}
                      onValueChange={(v) => setNewRule({ ...newRule, targetType: v as typeof newRule.targetType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="container">Container</SelectItem>
                        <SelectItem value="pod">Pod</SelectItem>
                        <SelectItem value="deployment">Deployment</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="node">Node</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Action Type</Label>
                    <Select
                      value={newRule.actionType}
                      onValueChange={(v) => setNewRule({ ...newRule, actionType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="restart">Restart</SelectItem>
                        <SelectItem value="scale_up">Scale Up</SelectItem>
                        <SelectItem value="scale_down">Scale Down</SelectItem>
                        <SelectItem value="rollback">Rollback</SelectItem>
                        <SelectItem value="cleanup">Cleanup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cooldown (seconds)</Label>
                    <Input
                      type="number"
                      value={newRule.cooldownSeconds}
                      onChange={(e) => setNewRule({ ...newRule, cooldownSeconds: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Max Retries</Label>
                    <Input
                      type="number"
                      value={newRule.maxRetries}
                      onChange={(e) => setNewRule({ ...newRule, maxRetries: Number(e.target.value) })}
                      min={1}
                      max={10}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newRule.requiresApproval}
                    onCheckedChange={(v) => setNewRule({ ...newRule, requiresApproval: v })}
                  />
                  <Label>Requires approval before execution</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateRuleDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => createRuleMutation.mutate(newRule)}>Create Rule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Active Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.enabledRules || 0}</div>
              <p className="text-xs text-muted-foreground">of {stats?.totalRules || 0} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                Total Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalActions || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats?.successRate || 0}%</div>
              <p className="text-xs text-muted-foreground">{stats?.successfulActions || 0} successful</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats?.pendingApprovals || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                Learned Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-500">{stats?.learnedPatterns || 0}</div>
              <p className="text-xs text-muted-foreground">{stats?.avgConfidence || 0}% avg confidence</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="rules">
          <TabsList>
            <TabsTrigger value="rules">Healing Rules</TabsTrigger>
            <TabsTrigger value="history">Action History</TabsTrigger>
            <TabsTrigger value="patterns">Learned Patterns</TabsTrigger>
            <TabsTrigger value="effectiveness">Effectiveness</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Healing Rules</CardTitle>
                <CardDescription>Configure automatic recovery actions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {rules?.map((rule) => (
                      <div key={rule.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(enabled) => toggleRuleMutation.mutate({ id: rule.id, enabled })}
                            />
                            <div>
                              <h4 className="font-medium">{rule.name}</h4>
                              <p className="text-sm text-muted-foreground">{rule.description}</p>
                              <div className="mt-2 flex gap-2 flex-wrap">
                                <Badge variant="outline">{rule.targetType}</Badge>
                                <Badge variant="secondary">{rule.actionType}</Badge>
                                <Badge variant="outline">Cooldown: {rule.cooldownSeconds}s</Badge>
                                <Badge variant="outline">Max retries: {rule.maxRetries}</Badge>
                                {rule.requiresApproval && (
                                  <Badge>Requires Approval</Badge>
                                )}
                              </div>
                              {rule.triggerCount > 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Triggered {rule.triggerCount} times • {rule.successCount} successful
                                  {rule.lastTriggeredAt && ` • Last: ${new Date(rule.lastTriggeredAt).toLocaleString()}`}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRuleId(rule.id);
                              setTriggerDialogOpen(true);
                            }}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Action History</CardTitle>
                <CardDescription>Recent healing actions and their outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {history?.map((action) => (
                      <div key={action.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {getStatusIcon(action.status)}
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{action.ruleName}</h4>
                                <Badge className={getStatusColor(action.status)}>
                                  {action.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Target: {action.targetResource}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Reason: {action.triggerReason}
                              </p>
                              {action.result && (
                                <p className="text-sm mt-1">{action.result}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {new Date(action.executedAt).toLocaleString()}
                                {action.completedAt && ` - ${new Date(action.completedAt).toLocaleString()}`}
                              </p>
                            </div>
                          </div>
                          {action.status === "success" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rollbackActionMutation.mutate(action.id)}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Rollback
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!history || history.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <p>No healing actions yet</p>
                        <p className="text-sm">Your infrastructure is running smoothly</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patterns" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Learned Patterns</CardTitle>
                <CardDescription>AI-discovered recovery patterns from past incidents</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {patterns?.map((pattern) => (
                      <div key={pattern.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Brain className="h-5 w-5 text-purple-500" />
                            <h4 className="font-medium">{pattern.patternName}</h4>
                          </div>
                          <Badge variant="secondary">
                            {pattern.confidenceScore}% confidence
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-muted-foreground">Symptom Signature:</span>
                            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(pattern.symptomSignature, null, 2)}
                            </pre>
                          </div>
                          <div className="flex gap-4">
                            <div>
                              <span className="text-sm text-muted-foreground">Successful Actions:</span>
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {pattern.successfulActions.map((a, i) => (
                                  <Badge key={i} variant="outline" className="text-green-600">{a}</Badge>
                                ))}
                              </div>
                            </div>
                            {pattern.failedActions.length > 0 && (
                              <div>
                                <span className="text-sm text-muted-foreground">Failed Actions:</span>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {pattern.failedActions.map((a, i) => (
                                    <Badge key={i} variant="outline" className="text-red-600">{a}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Occurred {pattern.occurrenceCount} times • Last: {new Date(pattern.lastOccurrence).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {(!patterns || patterns.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No patterns learned yet</p>
                        <p className="text-sm">Patterns will be discovered as healing actions are executed</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="effectiveness" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Rule Effectiveness</CardTitle>
                <CardDescription>Performance metrics for each healing rule</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {effectiveness?.map((rule) => (
                      <div key={rule.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{rule.name}</h4>
                          <Badge variant={rule.successRate >= 80 ? "default" : rule.successRate >= 50 ? "secondary" : "destructive"}>
                            {rule.successRate}% success
                          </Badge>
                        </div>
                        <Progress value={rule.successRate} className="h-2 mb-2" />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{rule.successCount} successful / {rule.triggerCount} total</span>
                          {rule.lastTriggered && (
                            <span>Last: {new Date(rule.lastTriggered).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!effectiveness || effectiveness.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No effectiveness data yet</p>
                        <p className="text-sm">Data will appear after rules are triggered</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Trigger Dialog */}
        <Dialog open={triggerDialogOpen} onOpenChange={setTriggerDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Trigger Healing Action</DialogTitle>
              <DialogDescription>
                Manually trigger a healing action for a specific resource
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Target Resource</Label>
                <Input
                  value={triggerTarget}
                  onChange={(e) => setTriggerTarget(e.target.value)}
                  placeholder="e.g., nginx-deployment or container-id"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTriggerDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (selectedRuleId && triggerTarget) {
                    triggerHealingMutation.mutate({ ruleId: selectedRuleId, targetResource: triggerTarget });
                  }
                }}
              >
                Trigger Action
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
