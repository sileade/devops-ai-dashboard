import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { FlaskConical, Play, Pause, Square, Trophy, Plus, BarChart3, Settings2, CheckCircle } from "lucide-react";

export default function ABTesting() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    targetType: "deployment" as "deployment" | "container" | "service",
    targetName: "",
    namespace: "default",
    variantAName: "Control",
    variantAScaleUpThreshold: 80,
    variantAScaleDownThreshold: 30,
    variantACooldown: 300,
    variantAMinReplicas: 1,
    variantAMaxReplicas: 10,
    variantBName: "Treatment",
    variantBScaleUpThreshold: 70,
    variantBScaleDownThreshold: 40,
    variantBCooldown: 180,
    variantBMinReplicas: 1,
    variantBMaxReplicas: 10,
    trafficSplitPercent: 50,
    durationHours: 24,
  });

  const utils = trpc.useUtils();
  const { data: experiments, isLoading } = trpc.abTesting.list.useQuery();
  
  const createMutation = trpc.abTesting.create.useMutation({
    onSuccess: () => {
      toast.success("A/B test experiment created");
      setIsCreateOpen(false);
      utils.abTesting.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const startMutation = trpc.abTesting.start.useMutation({
    onSuccess: () => {
      toast.success("Experiment started");
      utils.abTesting.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const pauseMutation = trpc.abTesting.pause.useMutation({
    onSuccess: () => {
      toast.success("Experiment paused");
      utils.abTesting.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const completeMutation = trpc.abTesting.complete.useMutation({
    onSuccess: (data) => {
      toast.success(`Experiment completed. Winner: Variant ${data.winner}`);
      utils.abTesting.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.abTesting.delete.useMutation({
    onSuccess: () => {
      toast.success("Experiment deleted");
      utils.abTesting.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      running: "default",
      paused: "outline",
      completed: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getWinnerBadge = (winner: string | null) => {
    if (!winner) return null;
    if (winner === "inconclusive") {
      return <Badge variant="outline">Inconclusive</Badge>;
    }
    return (
      <Badge className="bg-green-500">
        <Trophy className="h-3 w-3 mr-1" />
        Variant {winner} Wins
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground">
            Optimize autoscaling rules through controlled experiments
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Experiment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create A/B Test Experiment</DialogTitle>
              <DialogDescription>
                Compare two autoscaling configurations to find the optimal settings
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Experiment Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Threshold optimization test"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={formData.durationHours}
                    onChange={(e) => setFormData({ ...formData, durationHours: parseInt(e.target.value) || 24 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Testing lower thresholds for faster response..."
                />
              </div>

              {/* Target */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Target Type</Label>
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
                <div className="space-y-2">
                  <Label>Target Name</Label>
                  <Input
                    value={formData.targetName}
                    onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
                    placeholder="my-app"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Namespace</Label>
                  <Input
                    value={formData.namespace}
                    onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                    placeholder="default"
                  />
                </div>
              </div>

              {/* Variants */}
              <div className="grid grid-cols-2 gap-6">
                {/* Variant A */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      Variant A (Control)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={formData.variantAName}
                        onChange={(e) => setFormData({ ...formData, variantAName: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Scale Up %</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={formData.variantAScaleUpThreshold}
                          onChange={(e) => setFormData({ ...formData, variantAScaleUpThreshold: parseInt(e.target.value) || 80 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Scale Down %</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={formData.variantAScaleDownThreshold}
                          onChange={(e) => setFormData({ ...formData, variantAScaleDownThreshold: parseInt(e.target.value) || 30 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cooldown (seconds)</Label>
                      <Input
                        type="number"
                        min={60}
                        max={3600}
                        value={formData.variantACooldown}
                        onChange={(e) => setFormData({ ...formData, variantACooldown: parseInt(e.target.value) || 300 })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Min Replicas</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={formData.variantAMinReplicas}
                          onChange={(e) => setFormData({ ...formData, variantAMinReplicas: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Replicas</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={formData.variantAMaxReplicas}
                          onChange={(e) => setFormData({ ...formData, variantAMaxReplicas: parseInt(e.target.value) || 10 })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Variant B */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      Variant B (Treatment)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={formData.variantBName}
                        onChange={(e) => setFormData({ ...formData, variantBName: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Scale Up %</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={formData.variantBScaleUpThreshold}
                          onChange={(e) => setFormData({ ...formData, variantBScaleUpThreshold: parseInt(e.target.value) || 70 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Scale Down %</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={formData.variantBScaleDownThreshold}
                          onChange={(e) => setFormData({ ...formData, variantBScaleDownThreshold: parseInt(e.target.value) || 40 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cooldown (seconds)</Label>
                      <Input
                        type="number"
                        min={60}
                        max={3600}
                        value={formData.variantBCooldown}
                        onChange={(e) => setFormData({ ...formData, variantBCooldown: parseInt(e.target.value) || 180 })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Min Replicas</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={formData.variantBMinReplicas}
                          onChange={(e) => setFormData({ ...formData, variantBMinReplicas: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Replicas</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={formData.variantBMaxReplicas}
                          onChange={(e) => setFormData({ ...formData, variantBMaxReplicas: parseInt(e.target.value) || 10 })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Traffic Split */}
              <div className="space-y-2">
                <Label>Traffic Split</Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-blue-500 font-medium">A: {formData.trafficSplitPercent}%</span>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={formData.trafficSplitPercent}
                    onChange={(e) => setFormData({ ...formData, trafficSplitPercent: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm text-purple-500 font-medium">B: {100 - formData.trafficSplitPercent}%</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Experiment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Experiments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <FlaskConical className="h-8 w-8 animate-pulse text-muted-foreground" />
        </div>
      ) : experiments?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No experiments yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first A/B test to optimize autoscaling
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Experiment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {experiments?.map((exp) => (
            <Card key={exp.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle>{exp.name}</CardTitle>
                    {getStatusBadge(exp.status)}
                    {exp.winnerVariant && getWinnerBadge(exp.winnerVariant)}
                  </div>
                  <div className="flex items-center gap-2">
                    {exp.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => startMutation.mutate({ id: exp.id })}
                        disabled={startMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    )}
                    {exp.status === "running" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pauseMutation.mutate({ id: exp.id })}
                          disabled={pauseMutation.isPending}
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          Pause
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => completeMutation.mutate({ id: exp.id })}
                          disabled={completeMutation.isPending}
                        >
                          <Square className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                      </>
                    )}
                    {exp.status === "paused" && (
                      <Button
                        size="sm"
                        onClick={() => startMutation.mutate({ id: exp.id })}
                        disabled={startMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Resume
                      </Button>
                    )}
                    {(exp.status === "draft" || exp.status === "completed" || exp.status === "cancelled") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Delete this experiment?")) {
                            deleteMutation.mutate({ id: exp.id });
                          }
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
                {exp.description && (
                  <CardDescription>{exp.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  {/* Variant A */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="font-medium">{exp.variantAName}</span>
                      <span className="text-muted-foreground text-sm">({exp.trafficSplitPercent}%)</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Scale: {exp.variantAScaleDownThreshold}% - {exp.variantAScaleUpThreshold}% |
                      Cooldown: {exp.variantACooldown}s |
                      Replicas: {exp.variantAMinReplicas}-{exp.variantAMaxReplicas}
                    </div>
                  </div>

                  {/* Variant B */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="font-medium">{exp.variantBName}</span>
                      <span className="text-muted-foreground text-sm">({100 - exp.trafficSplitPercent}%)</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Scale: {exp.variantBScaleDownThreshold}% - {exp.variantBScaleUpThreshold}% |
                      Cooldown: {exp.variantBCooldown}s |
                      Replicas: {exp.variantBMinReplicas}-{exp.variantBMaxReplicas}
                    </div>
                  </div>
                </div>

                {exp.winnerReason && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm">{exp.winnerReason}</p>
                    {exp.winnerConfidence && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Confidence: {exp.winnerConfidence}%
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 text-xs text-muted-foreground">
                  Target: {exp.targetName} ({exp.targetType}) |
                  Duration: {exp.durationHours}h |
                  Created: {new Date(exp.createdAt).toLocaleDateString()}
                  {exp.startedAt && ` | Started: ${new Date(exp.startedAt).toLocaleDateString()}`}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
