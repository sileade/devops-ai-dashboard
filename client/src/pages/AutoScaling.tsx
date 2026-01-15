import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Scale,
  Plus,
  Settings,
  History,
  Brain,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Trash2,
  Edit,
  Play,
  Pause,
  RefreshCw,
  Zap,
  Target,
  Activity,
} from "lucide-react";

export default function AutoScaling() {
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<number | null>(null);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    resourceType: "deployment" as "deployment" | "container" | "pod" | "service",
    resourcePattern: "",
    namespace: "",
    metricType: "cpu" as "cpu" | "memory" | "requests" | "custom",
    scaleUpThreshold: 80,
    scaleDownThreshold: 30,
    minReplicas: 1,
    maxReplicas: 10,
    cooldownSeconds: 300,
    scaleUpStep: 1,
    scaleDownStep: 1,
    requiresApproval: false,
    aiAssisted: true,
  });

  // Queries
  const rulesQuery = trpc.autoscaling.getRules.useQuery();
  const historyQuery = trpc.autoscaling.getHistory.useQuery({ limit: 50 });
  const summaryQuery = trpc.autoscaling.getSummary.useQuery();
  const pendingQuery = trpc.autoscaling.getPendingApprovals.useQuery();

  // Mutations
  const createRuleMutation = trpc.autoscaling.createRule.useMutation({
    onSuccess: () => {
      toast.success("Правило создано", { description: "Правило автоскейлинга успешно создано" });
      setIsCreateDialogOpen(false);
      resetForm();
      rulesQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (error) => {
      toast.error("Ошибка", { description: error.message });
    },
  });

  const updateRuleMutation = trpc.autoscaling.updateRule.useMutation({
    onSuccess: () => {
      toast.success("Правило обновлено");
      setEditingRule(null);
      rulesQuery.refetch();
    },
  });

  const deleteRuleMutation = trpc.autoscaling.deleteRule.useMutation({
    onSuccess: () => {
      toast.success("Правило удалено");
      rulesQuery.refetch();
      summaryQuery.refetch();
    },
  });

  const toggleRuleMutation = trpc.autoscaling.toggleRule.useMutation({
    onSuccess: () => {
      rulesQuery.refetch();
      summaryQuery.refetch();
    },
  });

  const handleApprovalMutation = trpc.autoscaling.handleApproval.useMutation({
    onSuccess: (_, variables) => {
      toast.success(variables.approved ? "Действие одобрено" : "Действие отклонено");
      pendingQuery.refetch();
      historyQuery.refetch();
    },
  });

  const resetForm = () => {
    setNewRule({
      name: "",
      description: "",
      resourceType: "deployment",
      resourcePattern: "",
      namespace: "",
      metricType: "cpu",
      scaleUpThreshold: 80,
      scaleDownThreshold: 30,
      minReplicas: 1,
      maxReplicas: 10,
      cooldownSeconds: 300,
      scaleUpStep: 1,
      scaleDownStep: 1,
      requiresApproval: false,
      aiAssisted: true,
    });
  };

  const handleCreateRule = () => {
    createRuleMutation.mutate(newRule);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Выполнено</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Ошибка</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Ожидание</Badge>;
      case "executing":
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Выполняется</Badge>;
      case "cancelled":
        return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" />Отменено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "scale_up":
        return <Badge className="bg-green-500"><TrendingUp className="w-3 h-3 mr-1" />Scale Up</Badge>;
      case "scale_down":
        return <Badge className="bg-orange-500"><TrendingDown className="w-3 h-3 mr-1" />Scale Down</Badge>;
      case "pending_approval":
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" />Ожидает одобрения</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Scale className="w-8 h-8" />
            AI Auto-Scaling
          </h1>
          <p className="text-muted-foreground mt-1">
            Интеллектуальное автоматическое масштабирование ресурсов с AI-анализом
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Создать правило
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Создать правило автоскейлинга</DialogTitle>
              <DialogDescription>
                Настройте параметры автоматического масштабирования с AI-анализом
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название</Label>
                  <Input
                    id="name"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="Production API Scaling"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resourceType">Тип ресурса</Label>
                  <Select
                    value={newRule.resourceType}
                    onValueChange={(value: "deployment" | "container" | "pod" | "service") =>
                      setNewRule({ ...newRule, resourceType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deployment">Deployment</SelectItem>
                      <SelectItem value="container">Container</SelectItem>
                      <SelectItem value="pod">Pod</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resourcePattern">Паттерн ресурса</Label>
                  <Input
                    id="resourcePattern"
                    value={newRule.resourcePattern}
                    onChange={(e) => setNewRule({ ...newRule, resourcePattern: e.target.value })}
                    placeholder="api-server-*"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="namespace">Namespace</Label>
                  <Input
                    id="namespace"
                    value={newRule.namespace}
                    onChange={(e) => setNewRule({ ...newRule, namespace: e.target.value })}
                    placeholder="production"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  placeholder="Автоматическое масштабирование API серверов на основе CPU"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metricType">Тип метрики</Label>
                  <Select
                    value={newRule.metricType}
                    onValueChange={(value: "cpu" | "memory" | "requests" | "custom") =>
                      setNewRule({ ...newRule, metricType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpu">CPU</SelectItem>
                      <SelectItem value="memory">Memory</SelectItem>
                      <SelectItem value="requests">Requests</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cooldown">Cooldown (сек)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    value={newRule.cooldownSeconds}
                    onChange={(e) => setNewRule({ ...newRule, cooldownSeconds: parseInt(e.target.value) || 300 })}
                    min={60}
                    max={3600}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scaleUpThreshold">Порог Scale Up (%)</Label>
                  <Input
                    id="scaleUpThreshold"
                    type="number"
                    value={newRule.scaleUpThreshold}
                    onChange={(e) => setNewRule({ ...newRule, scaleUpThreshold: parseInt(e.target.value) || 80 })}
                    min={1}
                    max={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scaleDownThreshold">Порог Scale Down (%)</Label>
                  <Input
                    id="scaleDownThreshold"
                    type="number"
                    value={newRule.scaleDownThreshold}
                    onChange={(e) => setNewRule({ ...newRule, scaleDownThreshold: parseInt(e.target.value) || 30 })}
                    min={0}
                    max={99}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minReplicas">Min реплик</Label>
                  <Input
                    id="minReplicas"
                    type="number"
                    value={newRule.minReplicas}
                    onChange={(e) => setNewRule({ ...newRule, minReplicas: parseInt(e.target.value) || 1 })}
                    min={0}
                    max={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxReplicas">Max реплик</Label>
                  <Input
                    id="maxReplicas"
                    type="number"
                    value={newRule.maxReplicas}
                    onChange={(e) => setNewRule({ ...newRule, maxReplicas: parseInt(e.target.value) || 10 })}
                    min={1}
                    max={1000}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scaleUpStep">Шаг Up</Label>
                  <Input
                    id="scaleUpStep"
                    type="number"
                    value={newRule.scaleUpStep}
                    onChange={(e) => setNewRule({ ...newRule, scaleUpStep: parseInt(e.target.value) || 1 })}
                    min={1}
                    max={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scaleDownStep">Шаг Down</Label>
                  <Input
                    id="scaleDownStep"
                    type="number"
                    value={newRule.scaleDownStep}
                    onChange={(e) => setNewRule({ ...newRule, scaleDownStep: parseInt(e.target.value) || 1 })}
                    min={1}
                    max={10}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border rounded-lg p-4">
                <div className="space-y-0.5">
                  <Label>AI-анализ</Label>
                  <p className="text-sm text-muted-foreground">
                    Использовать AI для анализа паттернов и предсказания нагрузки
                  </p>
                </div>
                <Switch
                  checked={newRule.aiAssisted}
                  onCheckedChange={(checked) => setNewRule({ ...newRule, aiAssisted: checked })}
                />
              </div>

              <div className="flex items-center justify-between border rounded-lg p-4">
                <div className="space-y-0.5">
                  <Label>Требует одобрения</Label>
                  <p className="text-sm text-muted-foreground">
                    Ожидать ручного подтверждения перед масштабированием
                  </p>
                </div>
                <Switch
                  checked={newRule.requiresApproval}
                  onCheckedChange={(checked) => setNewRule({ ...newRule, requiresApproval: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreateRule} disabled={createRuleMutation.isPending}>
                {createRuleMutation.isPending ? "Создание..." : "Создать правило"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные правила</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.enabledRules || 0}</div>
            <p className="text-xs text-muted-foreground">
              из {summary?.totalRules || 0} всего
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Действия за 24ч</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.last24h?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">↑{summary?.last24h?.scaleUp || 0}</span>
              {" / "}
              <span className="text-orange-500">↓{summary?.last24h?.scaleDown || 0}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Успешность</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.allTime?.successRate || 100}%</div>
            <p className="text-xs text-muted-foreground">
              {summary?.allTime?.successful || 0} успешных из {summary?.allTime?.total || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ожидают одобрения</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.pendingApprovals || 0}</div>
            <p className="text-xs text-muted-foreground">
              требуют внимания
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      {pendingQuery.data && pendingQuery.data.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="w-5 h-5" />
              Ожидают одобрения
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Действие</TableHead>
                  <TableHead>Реплики</TableHead>
                  <TableHead>Триггер</TableHead>
                  <TableHead>AI Confidence</TableHead>
                  <TableHead>Время</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingQuery.data.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>{getActionBadge(action.action)}</TableCell>
                    <TableCell>
                      {action.previousReplicas} → {action.newReplicas}
                    </TableCell>
                    <TableCell>
                      {action.triggerMetric}: {action.triggerValue}% (порог: {action.thresholdValue}%)
                    </TableCell>
                    <TableCell>
                      {action.aiConfidence ? (
                        <Badge variant={action.aiConfidence > 80 ? "default" : "secondary"}>
                          {action.aiConfidence}%
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{new Date(action.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprovalMutation.mutate({ actionId: action.id, approved: true })}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Одобрить
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleApprovalMutation.mutate({ actionId: action.id, approved: false })}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Отклонить
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Правила
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            История
          </TabsTrigger>
          <TabsTrigger value="predictions" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Предсказания
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Правила автоскейлинга</CardTitle>
              <CardDescription>
                Управление правилами автоматического масштабирования ресурсов
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rulesQuery.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
              ) : rulesQuery.data?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет правил автоскейлинга. Создайте первое правило.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Ресурс</TableHead>
                      <TableHead>Метрика</TableHead>
                      <TableHead>Пороги</TableHead>
                      <TableHead>Реплики</TableHead>
                      <TableHead>AI</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rulesQuery.data?.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rule.name}</div>
                            {rule.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {rule.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <Badge variant="outline">{rule.resourceType}</Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              {rule.resourcePattern}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge>{rule.metricType.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="text-green-500">↑{rule.scaleUpThreshold}%</span>
                            {" / "}
                            <span className="text-orange-500">↓{rule.scaleDownThreshold}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rule.minReplicas} - {rule.maxReplicas}
                        </TableCell>
                        <TableCell>
                          {rule.aiAssisted ? (
                            <Brain className="w-4 h-4 text-purple-500" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rule.isEnabled}
                            onCheckedChange={(checked) =>
                              toggleRuleMutation.mutate({ id: rule.id, enabled: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingRule(rule.id)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => deleteRuleMutation.mutate({ id: rule.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>История масштабирования</CardTitle>
              <CardDescription>
                Журнал всех действий автоскейлинга
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
              ) : historyQuery.data?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  История пуста
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Время</TableHead>
                      <TableHead>Действие</TableHead>
                      <TableHead>Реплики</TableHead>
                      <TableHead>Триггер</TableHead>
                      <TableHead>AI Confidence</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Время выполнения</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyQuery.data?.map((action) => (
                      <TableRow key={action.id}>
                        <TableCell>
                          {new Date(action.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>{getActionBadge(action.action)}</TableCell>
                        <TableCell>
                          {action.previousReplicas} → {action.newReplicas}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {action.triggerMetric}: {action.triggerValue}%
                            <div className="text-xs text-muted-foreground">
                              порог: {action.thresholdValue}%
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {action.aiConfidence ? (
                            <div className="flex items-center gap-1">
                              <Brain className="w-3 h-3 text-purple-500" />
                              {action.aiConfidence}%
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(action.status)}</TableCell>
                        <TableCell>
                          {action.executionTimeMs ? `${action.executionTimeMs}ms` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" />
                AI Предсказания нагрузки
              </CardTitle>
              <CardDescription>
                Прогнозы на основе анализа паттернов использования ресурсов
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="w-16 h-16 mx-auto mb-4 text-purple-500/30" />
                <p>AI-предсказания появятся после накопления достаточного количества данных</p>
                <p className="text-sm mt-2">Минимум 24 часа метрик для точных прогнозов</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
