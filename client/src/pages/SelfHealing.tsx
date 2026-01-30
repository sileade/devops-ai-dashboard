import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Activity, Bot, Brain, CheckCircle, Clock, Play, RefreshCw, Settings, Shield, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";

export default function SelfHealing() {
  const [createRuleDialogOpen, setCreateRuleDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    conditionType: "metric_threshold",
    actionType: "restart",
    targetType: "pod" as "container" | "pod" | "deployment" | "service" | "node",
    cooldownSeconds: 300,
    maxRetries: 3,
    requiresApproval: false,
  });

  const utils = trpc.useUtils();

  // Queries
  const { data: stats } = trpc.selfHealing.getStats.useQuery();
  const { data: rules } = trpc.selfHealing.listRules.useQuery();
  const { data: actions } = trpc.selfHealing.getHistory.useQuery();
  const { data: patterns } = trpc.selfHealing.getPatterns.useQuery();
  const { data: effectiveness } = trpc.selfHealing.getRuleEffectiveness.useQuery();

  // Mutations
  const createRuleMutation = trpc.selfHealing.createRule.useMutation({
    onSuccess: () => {
      toast.success("Healing rule created");
      setCreateRuleDialogOpen(false);
      setNewRule({
        name: "",
        description: "",
        conditionType: "metric_threshold",
        actionType: "restart",
        targetType: "pod",
        cooldownSeconds: 300,
        maxRetries: 3,
        requiresApproval: false,
      });
      utils.selfHealing.listRules.invalidate();
      utils.selfHealing.getStats.invalidate();
    },
  });

  const toggleRuleMutation = trpc.selfHealing.toggleRule.useMutation({
    onSuccess: () => {
      utils.selfHealing.listRules.invalidate();
      utils.selfHealing.getStats.invalidate();
    },
  });

  const triggerHealingMutation = trpc.selfHealing.triggerHealing.useMutation({
    onSuccess: () => {
      toast.success("Healing action triggered");
      utils.selfHealing.getHistory.invalidate();
      utils.selfHealing.getStats.invalidate();
    },
  });

  const approveActionMutation = trpc.selfHealing.approveAction.useMutation({
    onSuccess: () => {
      toast.success("Action approved and executed");
      utils.selfHealing.getHistory.invalidate();
      utils.selfHealing.getStats.invalidate();
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "executing": return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "pending": return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case "restart": return <RefreshCw className="h-4 w-4" />;
      case "scale_up": return <Zap className="h-4 w-4" />;
      case "scale_down": return <Activity className="h-4 w-4" />;
      case "rollback": return <RefreshCw className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const handleCreateRule = () => {
    createRuleMutation.mutate({
      ...newRule,
      conditionConfig: {},
      actionConfig: {},
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Self-Healing Engine</h1>
            <p className="text-muted-foreground">
              Autonomous infrastructure recovery with machine learning
            </p>
          </div>
          <Dialog open={createRuleDialogOpen} onOpenChange={setCreateRuleDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Settings className="mr-2 h-4 w-4" />
                Create Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Healing Rule</DialogTitle>
                <DialogDescription>
                  Define conditions and actions for automatic infrastructure healing
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Rule Name</Label>
                  <Input
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="e.g., Auto-restart on OOM"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    placeholder="What this rule does"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Condition Type</Label>
                    <Select
                      value={newRule.conditionType}
                      onValueChange={(v) => setNewRule({ ...newRule, conditionType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric_threshold">Metric Threshold</SelectItem>
                        <SelectItem value="error_rate">Error Rate</SelectItem>
                        <SelectItem value="health_check">Health Check</SelectItem>
                        <SelectItem value="event">Event-based</SelectItem>
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
                        <SelectItem value="drain">Drain Node</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                  <Label>Require manual approval before execution</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateRuleDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateRule}>Create Rule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalRules || 0}</div>
              <p className="text-xs text-muted-foreground">{stats?.enabledRules || 0} enabled</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/50">
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
              <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalActions || 0}</div>
              <p className="text-xs text-red-500">{stats?.failedActions || 0} failed</p>
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
            <TabsTrigger value="actions">Recent Actions</TabsTrigger>
            <TabsTrigger value="patterns">Learned Patterns</TabsTrigger>
            <TabsTrigger value="effectiveness">Effectiveness</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Healing Rules</CardTitle>
                <CardDescription>Automated recovery rules for your infrastructure</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {rules?.map((rule) => (
                      <div key={rule.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(enabled) => toggleRuleMutation.mutate({ id: rule.id, enabled })}
                            />
                            <div>
                              <h4 className="font-medium">{rule.name}</h4>
                              <p className="text-sm text-muted-foreground">{rule.description}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => triggerHealingMutation.mutate({ ruleId: rule.id, targetResource: "manual-test" })}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Test
                          </Button>
                        </div>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <Badge variant="outline">{rule.conditionType}</Badge>
                          <Badge variant="secondary">{rule.actionType}</Badge>
                          <Badge variant="outline">{rule.targetType}</Badge>
                          {rule.requiresApproval && (
                            <Badge variant="destructive">Requires Approval</Badge>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Triggered {rule.triggerCount}x • Success: {rule.successCount}x • 
                          Cooldown: {rule.cooldownSeconds}s • Max retries: {rule.maxRetries}
                        </div>
                      </div>
                    ))}
                    {(!rules || rules.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No healing rules configured</p>
                        <p className="text-sm">Create a rule to enable self-healing</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Healing Actions</CardTitle>
                <CardDescription>History of automated recovery actions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {actions?.map((action) => (
                      <div key={action.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            {getStatusIcon(action.status)}
                            <div>
                              <div className="flex items-center gap-2">
                                {getActionTypeIcon(action.actionTaken)}
                                <h4 className="font-medium capitalize">{action.actionTaken}</h4>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Target: {action.targetResource}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(action.triggeredAt).toLocaleString()}
                                {action.completedAt && ` • Duration: ${Math.round((new Date(action.completedAt).getTime() - new Date(action.triggeredAt).getTime()) / 1000)}s`}
                              </p>
                            </div>
                          </div>
                          <Badge variant={
                            action.status === "success" ? "default" :
                            action.status === "failed" ? "destructive" :
                            action.status === "pending" ? "secondary" : "outline"
                          }>
                            {action.status}
                          </Badge>
                        </div>
                        {action.reason && (
                          <p className="mt-2 text-sm bg-accent p-2 rounded">{action.reason}</p>
                        )}
                        {action.status === "pending" && (
                          <div className="mt-3">
                            <Button
                              size="sm"
                              onClick={() => approveActionMutation.mutate({ actionId: action.id })}
                            >
                              Approve & Execute
                            </Button>
                          </div>
                        )}
                        {action.status === "failed" && action.errorMessage && (
                          <p className="mt-2 text-sm text-red-500">{action.errorMessage}</p>
                        )}
                      </div>
                    ))}
                    {(!actions || actions.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No healing actions yet</p>
                        <p className="text-sm">Actions will appear here when rules are triggered</p>
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
                <CardDescription>AI-discovered patterns from healing history</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {patterns?.map((pattern) => (
                      <div key={pattern.id} className="p-4 border rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                            <Brain className="h-5 w-5 text-purple-500" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">{pattern.name}</h4>
                              <Badge variant={pattern.confidenceScore >= 80 ? "default" : pattern.confidenceScore >= 50 ? "secondary" : "outline"}>
                                {pattern.confidenceScore}% confidence
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{pattern.description}</p>
                            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Occurrences:</span>
                                <span className="ml-2 font-medium">{pattern.occurrenceCount}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Last seen:</span>
                                <span className="ml-2">{new Date(pattern.lastOccurrence).toLocaleDateString()}</span>
                              </div>
                            </div>
                            {pattern.successfulActions.length > 0 && (
                              <div className="mt-2">
                                <span className="text-sm text-muted-foreground">Successful actions: </span>
                                {pattern.successfulActions.map((a, i) => (
                                  <Badge key={i} variant="outline" className="ml-1 text-green-600">{a}</Badge>
                                ))}
                              </div>
                            )}
                            {pattern.failedActions.length > 0 && (
                              <div className="mt-1">
                                <span className="text-sm text-muted-foreground">Failed actions: </span>
                                {pattern.failedActions.map((a, i) => (
                                  <Badge key={i} variant="outline" className="ml-1 text-red-600">{a}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!patterns || patterns.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No patterns learned yet</p>
                        <p className="text-sm">The system will learn from healing actions over time</p>
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
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${rule.successRate >= 80 ? "text-green-500" : rule.successRate >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                              {rule.successRate}%
                            </div>
                            <p className="text-xs text-muted-foreground">success rate</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Triggers:</span>
                            <span className="ml-2 font-medium">{rule.triggerCount}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Successes:</span>
                            <span className="ml-2 font-medium text-green-500">{rule.successCount}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Last triggered:</span>
                            <span className="ml-2">{rule.lastTriggered ? new Date(rule.lastTriggered).toLocaleDateString() : "Never"}</span>
                          </div>
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
      </div>
    </DashboardLayout>
  );
}
