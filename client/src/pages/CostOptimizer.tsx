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
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, Lightbulb, PiggyBank, BarChart3, Bot, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

export default function CostOptimizer() {
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [newBudget, setNewBudget] = useState({
    name: "",
    budgetAmount: 1000,
    period: "monthly" as "daily" | "weekly" | "monthly",
    thresholdPercent: 80,
  });

  const utils = trpc.useUtils();

  // Queries
  const { data: stats } = trpc.costOptimizer.getStats.useQuery();
  const { data: summary } = trpc.costOptimizer.getSummary.useQuery();
  const { data: recommendations } = trpc.costOptimizer.getRecommendations.useQuery();
  const { data: budgetAlerts } = trpc.costOptimizer.listBudgetAlerts.useQuery();
  const { data: forecast } = trpc.costOptimizer.getForecast.useQuery();
  const { data: idleResources } = trpc.costOptimizer.getIdleResources.useQuery();

  // Mutations
  const applyRecommendationMutation = trpc.costOptimizer.applyRecommendation.useMutation({
    onSuccess: () => {
      toast.success("Recommendation applied successfully");
      utils.costOptimizer.getRecommendations.invalidate();
      utils.costOptimizer.getStats.invalidate();
    },
  });

  const dismissRecommendationMutation = trpc.costOptimizer.dismissRecommendation.useMutation({
    onSuccess: () => {
      toast.info("Recommendation dismissed");
      utils.costOptimizer.getRecommendations.invalidate();
    },
  });

  const createBudgetMutation = trpc.costOptimizer.createBudgetAlert.useMutation({
    onSuccess: () => {
      toast.success("Budget alert created");
      setBudgetDialogOpen(false);
      setNewBudget({ name: "", budgetAmount: 1000, period: "monthly", thresholdPercent: 80 });
      utils.costOptimizer.listBudgetAlerts.invalidate();
    },
  });

  const toggleBudgetMutation = trpc.costOptimizer.toggleBudgetAlert.useMutation({
    onSuccess: () => {
      utils.costOptimizer.listBudgetAlerts.invalidate();
    },
  });

  const getInsightsMutation = trpc.costOptimizer.getInsights.useMutation({
    onSuccess: (data) => {
      toast.success("AI insights generated");
      console.log(data.insights);
    },
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "bg-green-500";
      case "medium": return "bg-yellow-500";
      case "high": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case "rightsize": return <TrendingDown className="h-4 w-4" />;
      case "terminate": return <Trash2 className="h-4 w-4" />;
      case "reserved": return <PiggyBank className="h-4 w-4" />;
      case "spot": return <Zap className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Cost Optimizer</h1>
            <p className="text-muted-foreground">
              FinOps: Real-time cost monitoring and AI-powered optimization
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => getInsightsMutation.mutate()}>
              <Bot className="mr-2 h-4 w-4" />
              AI Insights
            </Button>
            <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Set Budget Alert
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Budget Alert</DialogTitle>
                  <DialogDescription>
                    Get notified when spending exceeds your budget threshold
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newBudget.name}
                      onChange={(e) => setNewBudget({ ...newBudget, name: e.target.value })}
                      placeholder="e.g., Production Environment"
                    />
                  </div>
                  <div>
                    <Label>Budget Amount (USD)</Label>
                    <Input
                      type="number"
                      value={newBudget.budgetAmount}
                      onChange={(e) => setNewBudget({ ...newBudget, budgetAmount: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Period</Label>
                    <Select
                      value={newBudget.period}
                      onValueChange={(v) => setNewBudget({ ...newBudget, period: v as typeof newBudget.period })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Alert Threshold (%)</Label>
                    <Input
                      type="number"
                      value={newBudget.thresholdPercent}
                      onChange={(e) => setNewBudget({ ...newBudget, thresholdPercent: Number(e.target.value) })}
                      min={1}
                      max={100}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBudgetDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => createBudgetMutation.mutate(newBudget)}>Create Alert</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Monthly Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats?.totalMonthlyCost?.toFixed(2) || "0.00"}</div>
              <p className="text-xs text-muted-foreground">{stats?.resourcesTracked || 0} resources tracked</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-green-500" />
                Potential Savings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">${stats?.potentialSavings?.toFixed(2) || "0.00"}</div>
              <p className="text-xs text-muted-foreground">{stats?.savingsPercent || 0}% of total spend</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-500" />
                Applied Savings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">${stats?.appliedSavings?.toFixed(2) || "0.00"}</div>
              <p className="text-xs text-muted-foreground">From optimizations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pendingRecommendations || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.triggeredAlerts || 0} budget alerts triggered
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cost Breakdown */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By Resource Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(summary.byResourceType || {}).map(([type, cost]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{type}</span>
                      <span className="font-medium">${(cost as number).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By Environment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(summary.byEnvironment || {}).map(([env, cost]) => (
                    <div key={env} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{env}</span>
                      <span className="font-medium">${(cost as number).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {forecast?.map((f, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{f.period}</span>
                        {f.trend === "increasing" ? (
                          <TrendingUp className="h-3 w-3 text-red-500" />
                        ) : f.trend === "decreasing" ? (
                          <TrendingDown className="h-3 w-3 text-green-500" />
                        ) : null}
                      </div>
                      <span className="font-medium">${f.predictedCost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="recommendations">
          <TabsList>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="idle">Idle Resources</TabsTrigger>
            <TabsTrigger value="budgets">Budget Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Optimization Recommendations</CardTitle>
                <CardDescription>AI-generated cost optimization opportunities</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {recommendations?.filter(r => r.status === "pending").map((rec) => (
                      <div key={rec.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-accent rounded-lg">
                              {getRecommendationIcon(rec.recommendationType)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{rec.title}</h4>
                                <Badge className={getRiskColor(rec.risk)}>
                                  {rec.risk} risk
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                              <div className="mt-2 flex items-center gap-4 text-sm">
                                <span>Current: <strong>${rec.currentCost.toFixed(2)}/mo</strong></span>
                                <span className="text-green-500">
                                  Save: <strong>${rec.estimatedSavings.toFixed(2)}/mo</strong> ({rec.savingsPercent}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {rec.aiReasoning && (
                          <div className="mt-3 p-3 bg-accent/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Bot className="h-4 w-4" />
                              <span className="text-sm font-medium">AI Analysis</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{rec.aiReasoning}</p>
                          </div>
                        )}
                        <div className="mt-4 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => applyRecommendationMutation.mutate({ id: rec.id })}
                          >
                            Apply Recommendation
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => dismissRecommendationMutation.mutate({ id: rec.id })}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(!recommendations || recommendations.filter(r => r.status === "pending").length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No pending recommendations</p>
                        <p className="text-sm">Your infrastructure is well optimized</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="idle" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Idle Resources</CardTitle>
                <CardDescription>Resources with low utilization that may be candidates for termination</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {idleResources?.map((resource, i) => (
                      <div key={i} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{resource.resourceName}</h4>
                            <p className="text-sm text-muted-foreground">
                              {resource.resourceType} • {resource.resourceId}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-red-500">
                              ${resource.wastedCost?.toFixed(2)}/mo wasted
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {resource.utilizationPercent}% utilized
                            </p>
                          </div>
                        </div>
                        <Progress value={resource.utilizationPercent} className="mt-3 h-2" />
                      </div>
                    ))}
                    {(!idleResources || idleResources.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Zap className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <p>No idle resources detected</p>
                        <p className="text-sm">All resources are being utilized efficiently</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="budgets" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Budget Alerts</CardTitle>
                <CardDescription>Monitor spending against defined budgets</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {budgetAlerts?.map((alert) => {
                      const spendPercent = (alert.currentSpend / alert.budgetAmount) * 100;
                      const isOverThreshold = spendPercent >= alert.thresholdPercent;
                      
                      return (
                        <div key={alert.id} className={`p-4 border rounded-lg ${isOverThreshold ? "border-red-500/50" : ""}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={alert.enabled}
                                onCheckedChange={(enabled) => toggleBudgetMutation.mutate({ id: alert.id, enabled })}
                              />
                              <div>
                                <h4 className="font-medium">{alert.name}</h4>
                                <p className="text-sm text-muted-foreground capitalize">{alert.period} budget</p>
                              </div>
                            </div>
                            {alert.triggered && (
                              <Badge variant="destructive">Triggered</Badge>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>${alert.currentSpend.toFixed(2)} spent</span>
                              <span>${alert.budgetAmount.toFixed(2)} budget</span>
                            </div>
                            <Progress 
                              value={Math.min(spendPercent, 100)} 
                              className={`h-3 ${isOverThreshold ? "[&>div]:bg-red-500" : ""}`}
                            />
                            <p className="text-xs text-muted-foreground">
                              Alert at {alert.thresholdPercent}% • Currently at {spendPercent.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
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
