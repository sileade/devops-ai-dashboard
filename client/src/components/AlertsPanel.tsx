import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  Bell,
  BellOff,
  X,
  Server,
  Cpu,
  HardDrive,
  Container,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Alert } from "@/hooks/useRealTimeUpdates";

interface AlertsPanelProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
  className?: string;
}

const alertIcons = {
  pod_crash: Layers,
  high_cpu: Cpu,
  high_memory: HardDrive,
  container_stopped: Container,
  deployment_failed: Server,
};

const alertColors = {
  critical: "bg-red-500/10 border-red-500/50 text-red-500",
  warning: "bg-yellow-500/10 border-yellow-500/50 text-yellow-500",
  info: "bg-blue-500/10 border-blue-500/50 text-blue-500",
};

const alertBadgeColors = {
  critical: "bg-red-500 text-white",
  warning: "bg-yellow-500 text-black",
  info: "bg-blue-500 text-white",
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "только что";
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  return `${diffDays} дн назад`;
}

export function AlertsPanel({ alerts, onAcknowledge, className }: AlertsPanelProps) {
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const filteredAlerts = showAcknowledged
    ? alerts
    : alerts.filter(a => !a.acknowledged);

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => a.type === "critical" && !a.acknowledged).length;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Уведомления
            </CardTitle>
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unacknowledgedCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAcknowledged(!showAcknowledged)}
            className="text-xs"
          >
            {showAcknowledged ? (
              <>
                <BellOff className="h-4 w-4 mr-1" />
                Скрыть подтверждённые
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-1" />
                Показать все
              </>
            )}
          </Button>
        </div>
        {criticalCount > 0 && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-red-500/10 rounded-lg border border-red-500/30">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-500">
              {criticalCount} критических алертов требуют внимания
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
              <Check className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">Нет активных уведомлений</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map(alert => {
                const Icon = alertIcons[alert.category] || AlertTriangle;
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-3 rounded-lg border transition-all",
                      alertColors[alert.type],
                      alert.acknowledged && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{alert.title}</span>
                            <Badge
                              className={cn("text-xs", alertBadgeColors[alert.type])}
                            >
                              {alert.type === "critical" ? "Критический" :
                               alert.type === "warning" ? "Предупреждение" : "Инфо"}
                            </Badge>
                          </div>
                          <p className="text-sm opacity-90">{alert.message}</p>
                          {alert.resource && (
                            <p className="text-xs opacity-70 mt-1">
                              Ресурс: {alert.resource}
                              {alert.namespace && ` (${alert.namespace})`}
                            </p>
                          )}
                          <p className="text-xs opacity-50 mt-1">
                            {formatTimeAgo(alert.timestamp)}
                          </p>
                        </div>
                      </div>
                      {!alert.acknowledged && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAcknowledge(alert.id)}
                          className="h-8 w-8 p-0 hover:bg-background/50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Compact alert indicator for header/sidebar
interface AlertIndicatorProps {
  alerts: Alert[];
  onClick?: () => void;
}

export function AlertIndicator({ alerts, onClick }: AlertIndicatorProps) {
  const unacknowledged = alerts.filter(a => !a.acknowledged);
  const criticalCount = unacknowledged.filter(a => a.type === "critical").length;
  const warningCount = unacknowledged.filter(a => a.type === "warning").length;

  if (unacknowledged.length === 0) {
    return (
      <Button variant="ghost" size="sm" onClick={onClick} className="relative">
        <Bell className="h-5 w-5 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="relative"
    >
      <Bell className={cn(
        "h-5 w-5",
        criticalCount > 0 ? "text-red-500" : "text-yellow-500"
      )} />
      <span className={cn(
        "absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs flex items-center justify-center",
        criticalCount > 0 ? "bg-red-500 text-white" : "bg-yellow-500 text-black"
      )}>
        {unacknowledged.length}
      </span>
    </Button>
  );
}
