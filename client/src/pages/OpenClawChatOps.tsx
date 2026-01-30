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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, 
  Settings, 
  Bell, 
  Send, 
  Plug, 
  PlugZap, 
  Bot, 
  Terminal,
  Slack,
  Hash,
  Phone,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Zap
} from "lucide-react";
import { toast } from "sonner";

// Channel type icons
const channelIcons: Record<string, React.ReactNode> = {
  telegram: <Send className="h-4 w-4" />,
  slack: <Slack className="h-4 w-4" />,
  discord: <Hash className="h-4 w-4" />,
  whatsapp: <Phone className="h-4 w-4" />,
  teams: <MessageSquare className="h-4 w-4" />,
  matrix: <Hash className="h-4 w-4" />,
  signal: <Phone className="h-4 w-4" />,
};

export default function OpenClawChatOps() {
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [addChannelDialogOpen, setAddChannelDialogOpen] = useState(false);
  const [addSubscriptionDialogOpen, setAddSubscriptionDialogOpen] = useState(false);
  const [sendMessageDialogOpen, setSendMessageDialogOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [messageContent, setMessageContent] = useState("");
  
  const [newChannel, setNewChannel] = useState({
    type: "telegram" as "whatsapp" | "telegram" | "discord" | "slack" | "teams" | "matrix" | "signal",
    name: "",
    config: {} as Record<string, string>,
  });
  
  const [newSubscription, setNewSubscription] = useState({
    channelId: "",
    alertTypes: [] as string[],
    severity: [] as ("critical" | "high" | "medium" | "low")[],
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
  });

  const [gatewayConfig, setGatewayConfig] = useState({
    gatewayUrl: "",
    gatewayToken: "",
    enabled: false,
  });

  const utils = trpc.useUtils();

  // Queries
  const { data: stats } = trpc.openclaw.getStats.useQuery();
  const { data: config } = trpc.openclaw.getConfig.useQuery();
  const { data: channels } = trpc.openclaw.listChannels.useQuery();
  const { data: messages } = trpc.openclaw.getMessages.useQuery();
  const { data: commands } = trpc.openclaw.getCommands.useQuery();
  const { data: subscriptions } = trpc.openclaw.listSubscriptions.useQuery();

  // Mutations
  const updateConfigMutation = trpc.openclaw.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration updated");
      setConfigDialogOpen(false);
      utils.openclaw.getConfig.invalidate();
      utils.openclaw.getStats.invalidate();
    },
  });

  const testConnectionMutation = trpc.openclaw.testConnection.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Connected! Gateway v${data.version}, uptime: ${data.uptime}`);
      } else {
        toast.error(data.message);
      }
    },
  });

  const addChannelMutation = trpc.openclaw.addChannel.useMutation({
    onSuccess: () => {
      toast.success("Channel added");
      setAddChannelDialogOpen(false);
      setNewChannel({ type: "telegram", name: "", config: {} });
      utils.openclaw.listChannels.invalidate();
      utils.openclaw.getStats.invalidate();
    },
  });

  const toggleChannelMutation = trpc.openclaw.toggleChannel.useMutation({
    onSuccess: (data) => {
      toast.success(`Channel ${data.status === "connected" ? "connected" : "disconnected"}`);
      utils.openclaw.listChannels.invalidate();
      utils.openclaw.getStats.invalidate();
    },
  });

  const deleteChannelMutation = trpc.openclaw.deleteChannel.useMutation({
    onSuccess: () => {
      toast.success("Channel deleted");
      utils.openclaw.listChannels.invalidate();
      utils.openclaw.getStats.invalidate();
    },
  });

  const sendMessageMutation = trpc.openclaw.sendMessage.useMutation({
    onSuccess: () => {
      toast.success("Message sent");
      setSendMessageDialogOpen(false);
      setMessageContent("");
      utils.openclaw.getMessages.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createSubscriptionMutation = trpc.openclaw.createSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription created");
      setAddSubscriptionDialogOpen(false);
      setNewSubscription({
        channelId: "",
        alertTypes: [],
        severity: [],
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
      });
      utils.openclaw.listSubscriptions.invalidate();
    },
  });

  const updateSubscriptionMutation = trpc.openclaw.updateSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription updated");
      utils.openclaw.listSubscriptions.invalidate();
    },
  });

  const deleteSubscriptionMutation = trpc.openclaw.deleteSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription deleted");
      utils.openclaw.listSubscriptions.invalidate();
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
      case "disconnected":
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Disconnected</Badge>;
      case "error":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const alertTypeOptions = ["incident", "security", "cost", "deployment", "scaling", "self-healing"];
  const severityOptions: ("critical" | "high" | "medium" | "low")[] = ["critical", "high", "medium", "low"];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Bot className="h-8 w-8 text-purple-500" />
              OpenClaw ChatOps
            </h1>
            <p className="text-muted-foreground">
              Manage your infrastructure through WhatsApp, Telegram, Slack, and more
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => testConnectionMutation.mutate()}>
              <RefreshCw className={`mr-2 h-4 w-4 ${testConnectionMutation.isPending ? "animate-spin" : ""}`} />
              Test Connection
            </Button>
            <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  if (config) {
                    setGatewayConfig({
                      gatewayUrl: config.gatewayUrl,
                      gatewayToken: "",
                      enabled: config.enabled,
                    });
                  }
                }}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configure
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>OpenClaw Gateway Configuration</DialogTitle>
                  <DialogDescription>
                    Connect to your OpenClaw Gateway for ChatOps functionality
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Gateway URL</Label>
                    <Input
                      value={gatewayConfig.gatewayUrl}
                      onChange={(e) => setGatewayConfig({ ...gatewayConfig, gatewayUrl: e.target.value })}
                      placeholder="http://localhost:18789"
                    />
                  </div>
                  <div>
                    <Label>Gateway Token</Label>
                    <Input
                      type="password"
                      value={gatewayConfig.gatewayToken}
                      onChange={(e) => setGatewayConfig({ ...gatewayConfig, gatewayToken: e.target.value })}
                      placeholder="Enter token to update"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty to keep existing token
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={gatewayConfig.enabled}
                      onCheckedChange={(v) => setGatewayConfig({ ...gatewayConfig, enabled: v })}
                    />
                    <Label>Enable OpenClaw Integration</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => updateConfigMutation.mutate({
                    gatewayUrl: gatewayConfig.gatewayUrl || undefined,
                    gatewayToken: gatewayConfig.gatewayToken || undefined,
                    enabled: gatewayConfig.enabled,
                  })}>
                    Save Configuration
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Plug className="h-4 w-4" />
                Gateway Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats?.gatewayConnected ? "text-green-500" : "text-gray-400"}`}>
                {stats?.gatewayConnected ? "Connected" : "Disconnected"}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.enabled ? "Integration enabled" : "Integration disabled"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <PlugZap className="h-4 w-4 text-blue-500" />
                Channels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.connectedChannels || 0}/{stats?.totalChannels || 0}</div>
              <p className="text-xs text-muted-foreground">Connected channels</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4 text-yellow-500" />
                Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeSubscriptions || 0}</div>
              <p className="text-xs text-muted-foreground">Active alert subscriptions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalMessages || 0}</div>
              <p className="text-xs text-muted-foreground">
                ↓{stats?.inboundMessages || 0} ↑{stats?.outboundMessages || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Terminal className="h-4 w-4 text-green-500" />
                Commands
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.availableCommands || 0}</div>
              <p className="text-xs text-muted-foreground">Available commands</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="channels">
          <TabsList>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="subscriptions">Alert Subscriptions</TabsTrigger>
            <TabsTrigger value="commands">Commands</TabsTrigger>
            <TabsTrigger value="messages">Message History</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Communication Channels</CardTitle>
                    <CardDescription>Configure messaging platforms for ChatOps</CardDescription>
                  </div>
                  <Dialog open={addChannelDialogOpen} onOpenChange={setAddChannelDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plug className="mr-2 h-4 w-4" />
                        Add Channel
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Communication Channel</DialogTitle>
                        <DialogDescription>
                          Connect a new messaging platform for ChatOps
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Channel Type</Label>
                          <Select
                            value={newChannel.type}
                            onValueChange={(v) => setNewChannel({ ...newChannel, type: v as typeof newChannel.type, config: {} })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="telegram">Telegram</SelectItem>
                              <SelectItem value="slack">Slack</SelectItem>
                              <SelectItem value="discord">Discord</SelectItem>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              <SelectItem value="teams">Microsoft Teams</SelectItem>
                              <SelectItem value="matrix">Matrix</SelectItem>
                              <SelectItem value="signal">Signal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Channel Name</Label>
                          <Input
                            value={newChannel.name}
                            onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                            placeholder="e.g., DevOps Alerts"
                          />
                        </div>
                        {newChannel.type === "telegram" && (
                          <>
                            <div>
                              <Label>Bot Token</Label>
                              <Input
                                value={newChannel.config.botToken || ""}
                                onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, botToken: e.target.value } })}
                                placeholder="123456789:ABCdefGHI..."
                              />
                            </div>
                            <div>
                              <Label>Chat ID</Label>
                              <Input
                                value={newChannel.config.chatId || ""}
                                onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, chatId: e.target.value } })}
                                placeholder="-1001234567890"
                              />
                            </div>
                          </>
                        )}
                        {newChannel.type === "slack" && (
                          <>
                            <div>
                              <Label>Webhook URL</Label>
                              <Input
                                value={newChannel.config.webhookUrl || ""}
                                onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, webhookUrl: e.target.value } })}
                                placeholder="https://hooks.slack.com/services/..."
                              />
                            </div>
                            <div>
                              <Label>Channel</Label>
                              <Input
                                value={newChannel.config.channel || ""}
                                onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, channel: e.target.value } })}
                                placeholder="#devops-alerts"
                              />
                            </div>
                          </>
                        )}
                        {newChannel.type === "discord" && (
                          <>
                            <div>
                              <Label>Bot Token</Label>
                              <Input
                                value={newChannel.config.botToken || ""}
                                onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, botToken: e.target.value } })}
                                placeholder="Discord bot token"
                              />
                            </div>
                            <div>
                              <Label>Channel ID</Label>
                              <Input
                                value={newChannel.config.channelId || ""}
                                onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, channelId: e.target.value } })}
                                placeholder="987654321"
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddChannelDialogOpen(false)}>Cancel</Button>
                        <Button onClick={() => addChannelMutation.mutate(newChannel)}>Add Channel</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {channels?.map((channel) => (
                      <div key={channel.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent rounded-lg">
                              {channelIcons[channel.type] || <MessageSquare className="h-4 w-4" />}
                            </div>
                            <div>
                              <h4 className="font-medium">{channel.name}</h4>
                              <p className="text-sm text-muted-foreground capitalize">{channel.type}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(channel.status)}
                            <Button
                              size="sm"
                              variant={channel.status === "connected" ? "outline" : "default"}
                              onClick={() => toggleChannelMutation.mutate({ 
                                id: channel.id, 
                                connect: channel.status !== "connected" 
                              })}
                            >
                              {channel.status === "connected" ? "Disconnect" : "Connect"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedChannelId(channel.id);
                                setSendMessageDialogOpen(true);
                              }}
                              disabled={channel.status !== "connected"}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteChannelMutation.mutate({ id: channel.id })}
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                        {channel.lastConnected && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Last connected: {new Date(channel.lastConnected).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                    {(!channels || channels.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Plug className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No channels configured</p>
                        <p className="text-sm">Add a channel to start using ChatOps</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Alert Subscriptions</CardTitle>
                    <CardDescription>Configure which alerts are sent to which channels</CardDescription>
                  </div>
                  <Dialog open={addSubscriptionDialogOpen} onOpenChange={setAddSubscriptionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Bell className="mr-2 h-4 w-4" />
                        Add Subscription
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Alert Subscription</DialogTitle>
                        <DialogDescription>
                          Choose which alerts to send to a channel
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Channel</Label>
                          <Select
                            value={newSubscription.channelId}
                            onValueChange={(v) => setNewSubscription({ ...newSubscription, channelId: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select channel" />
                            </SelectTrigger>
                            <SelectContent>
                              {channels?.map((ch) => (
                                <SelectItem key={ch.id} value={ch.id}>{ch.name} ({ch.type})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Alert Types</Label>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {alertTypeOptions.map((type) => (
                              <div key={type} className="flex items-center gap-2">
                                <Checkbox
                                  checked={newSubscription.alertTypes.includes(type)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setNewSubscription({ ...newSubscription, alertTypes: [...newSubscription.alertTypes, type] });
                                    } else {
                                      setNewSubscription({ ...newSubscription, alertTypes: newSubscription.alertTypes.filter(t => t !== type) });
                                    }
                                  }}
                                />
                                <Label className="capitalize">{type}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label>Severity Levels</Label>
                          <div className="flex gap-4 mt-2">
                            {severityOptions.map((sev) => (
                              <div key={sev} className="flex items-center gap-2">
                                <Checkbox
                                  checked={newSubscription.severity.includes(sev)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setNewSubscription({ ...newSubscription, severity: [...newSubscription.severity, sev] });
                                    } else {
                                      setNewSubscription({ ...newSubscription, severity: newSubscription.severity.filter(s => s !== sev) });
                                    }
                                  }}
                                />
                                <Label className="capitalize">{sev}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={newSubscription.quietHoursEnabled}
                            onCheckedChange={(v) => setNewSubscription({ ...newSubscription, quietHoursEnabled: v })}
                          />
                          <Label>Enable Quiet Hours</Label>
                        </div>
                        {newSubscription.quietHoursEnabled && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Start</Label>
                              <Input
                                type="time"
                                value={newSubscription.quietHoursStart}
                                onChange={(e) => setNewSubscription({ ...newSubscription, quietHoursStart: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>End</Label>
                              <Input
                                type="time"
                                value={newSubscription.quietHoursEnd}
                                onChange={(e) => setNewSubscription({ ...newSubscription, quietHoursEnd: e.target.value })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddSubscriptionDialogOpen(false)}>Cancel</Button>
                        <Button onClick={() => createSubscriptionMutation.mutate({
                          channelId: newSubscription.channelId,
                          alertTypes: newSubscription.alertTypes,
                          severity: newSubscription.severity,
                          quietHours: newSubscription.quietHoursEnabled ? {
                            start: newSubscription.quietHoursStart,
                            end: newSubscription.quietHoursEnd,
                          } : undefined,
                        })}>
                          Create Subscription
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {subscriptions?.map((sub) => {
                      const channel = channels?.find(c => c.id === sub.channelId);
                      return (
                        <div key={sub.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={sub.enabled}
                                onCheckedChange={(enabled) => updateSubscriptionMutation.mutate({ id: sub.id, enabled })}
                              />
                              <div>
                                <h4 className="font-medium">{channel?.name || sub.channelId}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {sub.alertTypes.join(", ")}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteSubscriptionMutation.mutate({ id: sub.id })}
                            >
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                          <div className="mt-2 flex gap-2 flex-wrap">
                            {sub.severity.map((sev) => (
                              <Badge key={sev} variant="outline" className="capitalize">{sev}</Badge>
                            ))}
                            {sub.quietHours && (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Quiet: {sub.quietHours.start}-{sub.quietHours.end}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {(!subscriptions || subscriptions.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No alert subscriptions</p>
                        <p className="text-sm">Create a subscription to receive alerts via chat</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commands" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Available ChatOps Commands</CardTitle>
                <CardDescription>Commands you can use in connected messaging channels</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {commands?.map((cmd) => (
                      <div key={cmd.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <code className="text-lg font-mono bg-accent px-2 py-1 rounded">{cmd.command}</code>
                            <p className="text-sm text-muted-foreground mt-2">{cmd.description}</p>
                          </div>
                          {cmd.requiresApproval && (
                            <Badge variant="destructive">Requires Approval</Badge>
                          )}
                        </div>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <Badge variant="outline" className="capitalize">{cmd.category}</Badge>
                          {cmd.allowedChannels.map((ch) => (
                            <Badge key={ch} variant="secondary" className="capitalize">{ch}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Message History</CardTitle>
                <CardDescription>Recent messages sent and received via ChatOps</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {messages?.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`p-4 border rounded-lg ${msg.direction === "inbound" ? "border-blue-500/50 bg-blue-50/5" : "border-green-500/50 bg-green-50/5"}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {msg.direction === "inbound" ? (
                              <Badge variant="outline" className="text-blue-500">↓ Inbound</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-500">↑ Outbound</Badge>
                            )}
                            <Badge variant="secondary" className="capitalize">{msg.channelType}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">{msg.from}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="font-medium">{msg.to}</span>
                        </div>
                        <p className="mt-2 text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))}
                    {(!messages || messages.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No messages yet</p>
                        <p className="text-sm">Messages will appear here when channels are active</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Send Message Dialog */}
        <Dialog open={sendMessageDialogOpen} onOpenChange={setSendMessageDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Message</DialogTitle>
              <DialogDescription>
                Send a message to the selected channel
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Message</Label>
                <Textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Enter your message..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendMessageDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => sendMessageMutation.mutate({
                channelId: selectedChannelId,
                content: messageContent,
              })}>
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
