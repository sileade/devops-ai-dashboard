import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  BellRing,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  X,
  Settings,
  Volume2,
  VolumeX,
  Trash2,
} from "lucide-react";

interface Notification {
  id: string;
  type: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  source?: string;
  actionUrl?: string;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Simulate WebSocket connection for real-time notifications
  // In production, this would connect to the actual WebSocket server
  useEffect(() => {
    // Check if WebSocket URL is configured
    const wsUrl = import.meta.env.VITE_WS_URL || null;
    
    if (!wsUrl) {
      // Demo mode - add sample notifications
      const demoNotifications: Notification[] = [
        {
          id: "demo-1",
          type: "critical",
          title: "High CPU Usage Alert",
          message: "Server prod-web-01 CPU usage exceeded 90% for 5 minutes",
          timestamp: Date.now() - 5 * 60 * 1000,
          read: false,
          source: "Prometheus",
        },
        {
          id: "demo-2",
          type: "warning",
          title: "Deployment Pending Approval",
          message: "Canary deployment for api-service requires manual approval",
          timestamp: Date.now() - 15 * 60 * 1000,
          read: false,
          source: "GitOps",
        },
        {
          id: "demo-3",
          type: "info",
          title: "New Team Member",
          message: "John Doe joined the DevOps team",
          timestamp: Date.now() - 30 * 60 * 1000,
          read: true,
          source: "Teams",
        },
        {
          id: "demo-4",
          type: "success",
          title: "Deployment Completed",
          message: "Blue-green deployment for frontend-app completed successfully",
          timestamp: Date.now() - 60 * 60 * 1000,
          read: true,
          source: "Deployments",
        },
      ];
      setNotifications(demoNotifications);
      return;
    }

    // Real WebSocket connection
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
          console.log("WebSocket connected");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "notification") {
              const newNotification: Notification = {
                id: data.id || `notif-${Date.now()}`,
                type: data.level || "info",
                title: data.title,
                message: data.message,
                timestamp: data.timestamp || Date.now(),
                read: false,
                source: data.source,
                actionUrl: data.actionUrl,
              };

              setNotifications((prev) => [newNotification, ...prev]);

              // Play sound for critical/warning
              if (soundEnabled && (data.level === "critical" || data.level === "warning")) {
                playNotificationSound();
              }

              // Show toast for critical notifications
              if (data.level === "critical") {
                toast.error(data.title, {
                  description: data.message,
                });
              }
            }
          } catch (e) {
            console.error("Failed to parse WebSocket message:", e);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          console.log("WebSocket disconnected, reconnecting...");
          reconnectTimeout = setTimeout(connect, 5000);
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
        };
      } catch (e) {
        console.error("Failed to connect WebSocket:", e);
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [soundEnabled]);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const filterNotifications = (type: string) => {
    if (type === "all") return notifications;
    if (type === "unread") return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === type);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
              {wsConnected && (
                <Badge variant="outline" className="text-xs text-green-500 border-green-500">
                  Live
                </Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Mute sounds" : "Enable sounds"}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={clearAll} title="Clear all">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SheetDescription>
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "All caught up!"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <Tabs defaultValue="all">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="critical">Critical</TabsTrigger>
              <TabsTrigger value="warning">Warning</TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>

            {["all", "unread", "critical", "warning", "info"].map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-4">
                <ScrollArea className="h-[calc(100vh-250px)]">
                  <div className="space-y-2">
                    {filterNotifications(tab).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No notifications</p>
                      </div>
                    ) : (
                      filterNotifications(tab).map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 rounded-lg border transition-colors ${
                            notification.read
                              ? "bg-background"
                              : "bg-muted/50 border-primary/20"
                          }`}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex items-start gap-3">
                            {getIcon(notification.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium truncate">
                                  {notification.title}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>{formatTime(notification.timestamp)}</span>
                                {notification.source && (
                                  <>
                                    <span>•</span>
                                    <span>{notification.source}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {filterNotifications(tab).some((n) => !n.read) && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={markAllAsRead}
                    >
                      Mark all as read
                    </Button>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
