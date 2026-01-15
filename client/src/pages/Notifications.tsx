import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Trash2,
  Check,
  Settings,
  Mail,
  MessageSquare,
  Smartphone,
  Wifi,
  WifiOff,
  Cpu,
  HardDrive,
  Container,
  Layers,
  Server,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useRealTimeUpdates, type Alert } from "@/hooks/useRealTimeUpdates";
import { LiveStatusIndicator } from "@/components/LiveStatusIndicator";
import { trpc } from "@/lib/trpc";

// Alert category icons
const alertCategoryIcons = {
  pod_crash: Layers,
  high_cpu: Cpu,
  high_memory: HardDrive,
  container_stopped: Container,
  deployment_failed: Server,
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface NotificationSettings {
  email: boolean;
  slack: boolean;
  telegram: boolean;
  inApp: boolean;
  criticalOnly: boolean;
}

const typeIcons = {
  info: <Info className="h-5 w-5 text-blue-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" />,
  success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
};

const typeColors = {
  info: "border-l-blue-500",
  warning: "border-l-yellow-500",
  error: "border-l-red-500",
  success: "border-l-green-500",
};

export default function Notifications() {
  const { alerts, acknowledgeAlert, connected, lastUpdate } = useRealTimeUpdates();
  const [settings, setSettings] = useState<NotificationSettings>({
    email: true,
    slack: true,
    telegram: false,
    inApp: true,
    criticalOnly: false,
  });

  const acknowledgeAllMutation = trpc.notifications.acknowledgeAll.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.acknowledged} notifications acknowledged`);
    },
  });

  // Convert real-time alerts to notification format for display
  const notifications = useMemo(() => {
    return alerts.map(alert => ({
      id: alert.id,
      type: alert.type === "critical" ? "error" as const : 
            alert.type === "warning" ? "warning" as const : "info" as const,
      title: alert.title,
      message: alert.message,
      timestamp: formatTimeAgo(alert.timestamp),
      read: alert.acknowledged,
      source: alert.category.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()),
      category: alert.category,
      resource: alert.resource,
      namespace: alert.namespace,
    }));
  }, [alerts]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    acknowledgeAlert(id);
    toast.success("Notification acknowledged");
  };

  const handleMarkAllAsRead = () => {
    acknowledgeAllMutation.mutate();
  };

  const handleDelete = (id: string) => {
    acknowledgeAlert(id);
    toast.success("Notification acknowledged");
  };

  const handleClearAll = () => {
    acknowledgeAllMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Manage alerts and notification preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              <Check className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleClearAll}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{notifications.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <BellOff className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unreadCount}</p>
                <p className="text-sm text-muted-foreground">Unread</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {notifications.filter((n) => n.type === "error").length}
                </p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {notifications.filter((n) => n.type === "warning").length}
                </p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-2">
                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-4 p-4 rounded-lg border-l-4 ${
                        typeColors[notification.type]
                      } ${
                        notification.read ? "bg-secondary/30" : "bg-secondary"
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {typeIcons[notification.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{notification.title}</h4>
                          {!notification.read && (
                            <Badge variant="default" className="text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{notification.timestamp}</span>
                          <Badge variant="outline" className="text-xs">
                            {notification.source}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleMarkAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="unread" className="space-y-4">
          <Card>
            <ScrollArea className="h-[500px]">
              <div className="p-4 space-y-2">
                {notifications.filter((n) => !n.read).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>All caught up!</p>
                  </div>
                ) : (
                  notifications
                    .filter((n) => !n.read)
                    .map((notification) => (
                      <div
                        key={notification.id}
                        className={`flex items-start gap-4 p-4 rounded-lg border-l-4 bg-secondary ${
                          typeColors[notification.type]
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {typeIcons[notification.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium">{notification.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{notification.timestamp}</span>
                            <Badge variant="outline" className="text-xs">
                              {notification.source}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleMarkAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Notification Channels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive alerts via email
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.email}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, email: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label>Slack Integration</Label>
                    <p className="text-sm text-muted-foreground">
                      Send alerts to Slack channel
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.slack}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, slack: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label>Telegram Bot</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive alerts via Telegram
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.telegram}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, telegram: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label>In-App Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Show notifications in dashboard
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.inApp}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, inApp: checked }))
                  }
                />
              </div>
              <div className="border-t pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label>Critical Alerts Only</Label>
                      <p className="text-sm text-muted-foreground">
                        Only notify for errors and critical warnings
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.criticalOnly}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, criticalOnly: checked }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
