import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Bell, BellOff, Cpu, HardDrive, Wifi, MemoryStick } from "lucide-react";
import { NotificationToggle } from "@/components/NotificationPermissionBanner";

type MetricType = "cpu" | "memory" | "disk" | "network";
type ResourceType = "container" | "pod" | "node" | "cluster";

interface ThresholdFormData {
  id?: number;
  name: string;
  metricType: MetricType;
  resourceType: ResourceType;
  resourcePattern: string;
  warningThreshold: number;
  criticalThreshold: number;
  isEnabled: boolean;
  cooldownMinutes: number;
}

const defaultFormData: ThresholdFormData = {
  name: "",
  metricType: "cpu",
  resourceType: "cluster",
  resourcePattern: "",
  warningThreshold: 80,
  criticalThreshold: 95,
  isEnabled: true,
  cooldownMinutes: 5,
};

const metricIcons: Record<MetricType, React.ReactNode> = {
  cpu: <Cpu className="h-4 w-4" />,
  memory: <MemoryStick className="h-4 w-4" />,
  disk: <HardDrive className="h-4 w-4" />,
  network: <Wifi className="h-4 w-4" />,
};

export default function AlertSettings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ThresholdFormData>(defaultFormData);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: thresholds, isLoading } = trpc.alertThresholds.list.useQuery();
  
  const upsertMutation = trpc.alertThresholds.upsert.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(formData.id ? "Порог обновлён" : "Порог создан");
        utils.alertThresholds.list.invalidate();
        setIsDialogOpen(false);
        setFormData(defaultFormData);
      } else {
        toast.error(result.error || "Ошибка сохранения");
      }
    },
    onError: () => {
      toast.error("Ошибка сохранения порога");
    },
  });

  const toggleMutation = trpc.alertThresholds.toggle.useMutation({
    onSuccess: () => {
      utils.alertThresholds.list.invalidate();
    },
  });

  const deleteMutation = trpc.alertThresholds.delete.useMutation({
    onSuccess: () => {
      toast.success("Порог удалён");
      utils.alertThresholds.list.invalidate();
      setDeleteId(null);
    },
    onError: () => {
      toast.error("Ошибка удаления");
    },
  });

  const handleEdit = (threshold: typeof thresholds extends (infer T)[] | undefined ? T : never) => {
    if (!threshold) return;
    setFormData({
      id: threshold.id,
      name: threshold.name,
      metricType: threshold.metricType as MetricType,
      resourceType: threshold.resourceType as ResourceType,
      resourcePattern: threshold.resourcePattern || "",
      warningThreshold: threshold.warningThreshold,
      criticalThreshold: threshold.criticalThreshold,
      isEnabled: threshold.isEnabled,
      cooldownMinutes: threshold.cooldownMinutes,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.criticalThreshold <= formData.warningThreshold) {
      toast.error("Критический порог должен быть больше предупреждающего");
      return;
    }
    
    upsertMutation.mutate(formData);
  };

  const handleToggle = (id: number, isEnabled: boolean) => {
    toggleMutation.mutate({ id, isEnabled: !isEnabled });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Настройки алертов</h1>
          <p className="text-muted-foreground">
            Настройте пороговые значения для автоматических уведомлений
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationToggle />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setFormData(defaultFormData)}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить порог
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {formData.id ? "Редактировать порог" : "Новый порог"}
                  </DialogTitle>
                  <DialogDescription>
                    Настройте пороговые значения для генерации алертов
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Название</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="CPU Usage - Production Pods"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Тип метрики</Label>
                      <Select
                        value={formData.metricType}
                        onValueChange={(v) => setFormData({ ...formData, metricType: v as MetricType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpu">CPU</SelectItem>
                          <SelectItem value="memory">Memory</SelectItem>
                          <SelectItem value="disk">Disk</SelectItem>
                          <SelectItem value="network">Network</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label>Тип ресурса</Label>
                      <Select
                        value={formData.resourceType}
                        onValueChange={(v) => setFormData({ ...formData, resourceType: v as ResourceType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cluster">Cluster</SelectItem>
                          <SelectItem value="node">Node</SelectItem>
                          <SelectItem value="pod">Pod</SelectItem>
                          <SelectItem value="container">Container</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="pattern">Паттерн ресурса (опционально)</Label>
                    <Input
                      id="pattern"
                      value={formData.resourcePattern}
                      onChange={(e) => setFormData({ ...formData, resourcePattern: e.target.value })}
                      placeholder="production-*, api-server"
                    />
                    <p className="text-xs text-muted-foreground">
                      Используйте * для wildcard matching
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="warning" className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        Warning (%)
                      </Label>
                      <Input
                        id="warning"
                        type="number"
                        min={0}
                        max={100}
                        value={formData.warningThreshold}
                        onChange={(e) => setFormData({ ...formData, warningThreshold: parseInt(e.target.value) || 0 })}
                        required
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="critical" className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        Critical (%)
                      </Label>
                      <Input
                        id="critical"
                        type="number"
                        min={0}
                        max={100}
                        value={formData.criticalThreshold}
                        onChange={(e) => setFormData({ ...formData, criticalThreshold: parseInt(e.target.value) || 0 })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="cooldown">Cooldown (минуты)</Label>
                    <Input
                      id="cooldown"
                      type="number"
                      min={1}
                      max={1440}
                      value={formData.cooldownMinutes}
                      onChange={(e) => setFormData({ ...formData, cooldownMinutes: parseInt(e.target.value) || 5 })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Минимальный интервал между повторными алертами
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled">Активен</Label>
                    <Switch
                      id="enabled"
                      checked={formData.isEnabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={upsertMutation.isPending}>
                    {upsertMutation.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Пороговые значения</CardTitle>
          <CardDescription>
            Управление пороговыми значениями для автоматических алертов
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !thresholds?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Нет настроенных порогов</p>
              <p className="text-sm">Добавьте первый порог для получения алертов</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Метрика</TableHead>
                  <TableHead>Ресурс</TableHead>
                  <TableHead className="text-center">Warning</TableHead>
                  <TableHead className="text-center">Critical</TableHead>
                  <TableHead className="text-center">Cooldown</TableHead>
                  <TableHead className="text-center">Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thresholds.map((threshold) => (
                  <TableRow key={threshold.id}>
                    <TableCell className="font-medium">{threshold.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {metricIcons[threshold.metricType as MetricType]}
                        <span className="capitalize">{threshold.metricType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {threshold.resourceType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                        {threshold.warningThreshold}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                        {threshold.criticalThreshold}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {threshold.cooldownMinutes}m
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={threshold.isEnabled}
                        onCheckedChange={() => handleToggle(threshold.id, threshold.isEnabled)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(threshold)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Dialog open={deleteId === threshold.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(threshold.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Удалить порог?</DialogTitle>
                              <DialogDescription>
                                Вы уверены, что хотите удалить порог "{threshold.name}"? 
                                Это действие нельзя отменить.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setDeleteId(null)}>
                                Отмена
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => deleteMutation.mutate({ id: threshold.id })}
                                disabled={deleteMutation.isPending}
                              >
                                {deleteMutation.isPending ? "Удаление..." : "Удалить"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
