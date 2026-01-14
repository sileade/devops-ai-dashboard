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
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  source: string;
}

const mockNotifications: Notification[] = [
  { id: "1", type: "error", title: "Pod CrashLoopBackOff", message: "Pod worker-queue-9e8d7c6b5-jkl78 is in CrashLoopBackOff state", timestamp: "5 minutes ago", read: false, source: "Kubernetes" },
  { id: "2", type: "warning", title: "High Memory Usage", message: "Container api-server is using 85% of allocated memory", timestamp: "15 minutes ago", read: false, source: "Docker" },
  { id: "3", type: "success", title: "Deployment Completed", message: "Deployment web-frontend successfully rolled out", timestamp: "1 hour ago", read: false, source: "Kubernetes" },
  { id: "4", type: "info", title: "Terraform Plan Ready", message: "New terraform plan available for aws-production workspace", timestamp: "2 hours ago", read: true, source: "Terraform" },
  { id: "5", type: "warning", title: "Certificate Expiring", message: "SSL certificate for api.example.com expires in 14 days", timestamp: "3 hours ago", read: true, source: "System" },
  { id: "6", type: "error", title: "Ansible Playbook Failed", message: "Playbook configure-nginx failed on 2 hosts", timestamp: "5 hours ago", read: true, source: "Ansible" },
  { id: "7", type: "success", title: "Backup Completed", message: "Database backup completed successfully", timestamp: "6 hours ago", read: true, source: "System" },
  { id: "8", type: "info", title: "New Version Available", message: "Kubernetes cluster can be upgraded to v1.28.0", timestamp: "1 day ago", read: true, source: "Kubernetes" },
];

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
  const [notifications, setNotifications] = useState(mockNotifications);
  const [settings, setSettings] = useState<NotificationSettings>({
    email: true,
    slack: true,
    telegram: false,
    inApp: true,
    criticalOnly: false,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notification deleted");
  };

  const handleClearAll = () => {
    setNotifications([]);
    toast.success("All notifications cleared");
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
