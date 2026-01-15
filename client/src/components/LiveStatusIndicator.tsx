import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";

interface LiveStatusIndicatorProps {
  connected: boolean;
  lastUpdate?: Date | null;
  className?: string;
}

export function LiveStatusIndicator({
  connected,
  lastUpdate,
  className,
}: LiveStatusIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs",
        connected ? "text-green-500" : "text-red-500",
        className
      )}
    >
      {connected ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <Wifi className="h-3 w-3" />
          <span>Live</span>
        </>
      ) : (
        <>
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <WifiOff className="h-3 w-3" />
          <span>Отключено</span>
        </>
      )}
      {lastUpdate && connected && (
        <span className="text-muted-foreground ml-1">
          · обновлено {formatTimeAgo(lastUpdate)}
        </span>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 5) return "только что";
  if (diffSecs < 60) return `${diffSecs} сек назад`;
  return `${Math.floor(diffSecs / 60)} мин назад`;
}

// Animated status dot for resource cards
interface StatusDotProps {
  status: "healthy" | "warning" | "critical" | "unknown";
  animate?: boolean;
  size?: "sm" | "md" | "lg";
}

export function StatusDot({ status, animate = true, size = "md" }: StatusDotProps) {
  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  };

  const colorClasses = {
    healthy: "bg-green-500",
    warning: "bg-yellow-500",
    critical: "bg-red-500",
    unknown: "bg-gray-500",
  };

  const pingColorClasses = {
    healthy: "bg-green-400",
    warning: "bg-yellow-400",
    critical: "bg-red-400",
    unknown: "bg-gray-400",
  };

  return (
    <span className={cn("relative flex", sizeClasses[size])}>
      {animate && status !== "unknown" && (
        <span
          className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            pingColorClasses[status]
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex rounded-full",
          sizeClasses[size],
          colorClasses[status]
        )}
      />
    </span>
  );
}

// Connection status badge
interface ConnectionBadgeProps {
  connected: boolean;
  serviceName: string;
}

export function ConnectionBadge({ connected, serviceName }: ConnectionBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        connected
          ? "bg-green-500/10 text-green-500 border border-green-500/30"
          : "bg-red-500/10 text-red-500 border border-red-500/30"
      )}
    >
      <StatusDot status={connected ? "healthy" : "critical"} size="sm" animate={connected} />
      {serviceName}
    </div>
  );
}
