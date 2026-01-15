import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, BellOff, X } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

interface NotificationPermissionBannerProps {
  className?: string;
}

export function NotificationPermissionBanner({ className }: NotificationPermissionBannerProps) {
  const { permission, isSupported, isEnabled, requestPermission, toggleEnabled } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if not supported, already granted, or dismissed
  if (!isSupported || permission === 'granted' || dismissed) {
    return null;
  }

  // Don't show if denied (user explicitly rejected)
  if (permission === 'denied') {
    return null;
  }

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      setDismissed(true);
    }
  };

  return (
    <Card className={cn("bg-primary/5 border-primary/20", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Включить push-уведомления?</p>
              <p className="text-xs text-muted-foreground">
                Получайте мгновенные уведомления о критических событиях инфраструктуры
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDismissed(true)}
            >
              Позже
            </Button>
            <Button
              size="sm"
              onClick={handleEnable}
            >
              Включить
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface NotificationToggleProps {
  className?: string;
}

export function NotificationToggle({ className }: NotificationToggleProps) {
  const { permission, isSupported, isEnabled, requestPermission, toggleEnabled } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
        <BellOff className="h-4 w-4" />
        <span className="text-sm">Уведомления не поддерживаются</span>
      </div>
    );
  }

  const handleClick = async () => {
    if (permission === 'default') {
      await requestPermission();
    } else if (permission === 'granted') {
      toggleEnabled();
    }
  };

  return (
    <Button
      variant={isEnabled ? "default" : "outline"}
      size="sm"
      onClick={handleClick}
      className={className}
    >
      {isEnabled ? (
        <>
          <Bell className="h-4 w-4 mr-2" />
          Уведомления включены
        </>
      ) : permission === 'denied' ? (
        <>
          <BellOff className="h-4 w-4 mr-2" />
          Уведомления заблокированы
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4 mr-2" />
          Включить уведомления
        </>
      )}
    </Button>
  );
}
