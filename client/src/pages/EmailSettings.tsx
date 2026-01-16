import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Mail, 
  Send, 
  Settings, 
  Bell, 
  CheckCircle, 
  XCircle, 
  Clock,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";

export default function EmailSettings() {
  const [testEmail, setTestEmail] = useState("");
  const [newSubscription, setNewSubscription] = useState({
    email: "",
    alertTypes: ["critical"] as string[],
  });

  const { data: config, refetch: refetchConfig } = trpc.email.getConfig.useQuery();
  const { data: subscriptions, refetch: refetchSubscriptions } = trpc.email.getSubscriptions.useQuery();
  const { data: history } = trpc.email.getHistory.useQuery({ limit: 20 });

  const saveConfigMutation = trpc.email.saveConfig.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Email configuration saved");
        refetchConfig();
      } else {
        toast.error(result.error || "Failed to save configuration");
      }
    },
  });

  const testConnectionMutation = trpc.email.testConfig.useMutation({
    onSuccess: (result: any) => {
      if (result.success) {
        toast.success("SMTP connection successful");
      } else {
        toast.error(result.error || "Connection failed");
      }
    },
  });

  const sendTestEmailMutation = trpc.email.sendTestEmail.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Test email sent successfully");
      } else {
        toast.error(result.error || "Failed to send test email");
      }
    },
  });

  const addSubscriptionMutation = trpc.email.addSubscription.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Subscription added");
        setNewSubscription({ email: "", alertTypes: ["critical"] });
        refetchSubscriptions();
      } else {
        toast.error(result.error || "Failed to add subscription");
      }
    },
  });

  const deleteSubscriptionMutation = trpc.email.deleteSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription removed");
      refetchSubscriptions();
    },
  });

  const [formConfig, setFormConfig] = useState({
    smtpHost: config?.smtpHost || "",
    smtpPort: config?.smtpPort || 587,
    smtpUser: config?.smtpUser || "",
    smtpPassword: "",
    smtpSecure: config?.smtpSecure || false,
    fromEmail: config?.fromEmail || "",
    fromName: config?.fromName || "DevOps AI Dashboard",
    enabled: config?.isVerified || false,
  });

  // Update form when config loads
  if (config && !formConfig.smtpHost && config.smtpHost) {
    setFormConfig({
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpUser: config.smtpUser || "",
      smtpPassword: "",
      smtpSecure: config.smtpSecure,
      fromEmail: config.fromEmail,
      fromName: config.fromName || "DevOps AI Dashboard",
      enabled: config.isVerified,
    });
  }

  const handleSaveConfig = () => {
    saveConfigMutation.mutate(formConfig);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email Notifications</h1>
        <p className="text-muted-foreground mt-1">
          Configure SMTP settings and manage email subscriptions for alerts
        </p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">SMTP Configuration</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="history">Email History</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    SMTP Settings
                  </CardTitle>
                  <CardDescription>
                    Configure your SMTP server for sending email notifications
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="enabled">Enable Emails</Label>
                  <Switch
                    id="enabled"
                    checked={formConfig.enabled}
                    onCheckedChange={(checked) => setFormConfig({ ...formConfig, enabled: checked })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    placeholder="smtp.gmail.com"
                    value={formConfig.smtpHost}
                    onChange={(e) => setFormConfig({ ...formConfig, smtpHost: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    placeholder="587"
                    value={formConfig.smtpPort}
                    onChange={(e) => setFormConfig({ ...formConfig, smtpPort: parseInt(e.target.value) || 587 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">SMTP Username</Label>
                  <Input
                    id="smtpUser"
                    placeholder="your-email@gmail.com"
                    value={formConfig.smtpUser}
                    onChange={(e) => setFormConfig({ ...formConfig, smtpUser: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">SMTP Password</Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formConfig.smtpPassword}
                    onChange={(e) => setFormConfig({ ...formConfig, smtpPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fromEmail">From Email</Label>
                  <Input
                    id="fromEmail"
                    placeholder="alerts@yourdomain.com"
                    value={formConfig.fromEmail}
                    onChange={(e) => setFormConfig({ ...formConfig, fromEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fromName">From Name</Label>
                  <Input
                    id="fromName"
                    placeholder="DevOps AI Dashboard"
                    value={formConfig.fromName}
                    onChange={(e) => setFormConfig({ ...formConfig, fromName: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="smtpSecure"
                  checked={formConfig.smtpSecure}
                  onCheckedChange={(checked) => setFormConfig({ ...formConfig, smtpSecure: checked })}
                />
                <Label htmlFor="smtpSecure">Use TLS/SSL</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveConfig} disabled={saveConfigMutation.isPending}>
                  {saveConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={testConnectionMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Test Email
              </CardTitle>
              <CardDescription>
                Send a test email to verify your configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="recipient@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="max-w-sm"
                />
                <Button
                  onClick={() => sendTestEmailMutation.mutate({ toEmail: testEmail })}
                  disabled={sendTestEmailMutation.isPending || !testEmail}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Test
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Add Subscription
              </CardTitle>
              <CardDescription>
                Subscribe email addresses to receive alert notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="subEmail">Email Address</Label>
                  <Input
                    id="subEmail"
                    placeholder="user@example.com"
                    value={newSubscription.email}
                    onChange={(e) => setNewSubscription({ ...newSubscription, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Alert Types</Label>
                  <Select
                    value={newSubscription.alertTypes[0]}
                    onValueChange={(value) => setNewSubscription({ ...newSubscription, alertTypes: [value] })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical Only</SelectItem>
                      <SelectItem value="warning">Warning & Critical</SelectItem>
                      <SelectItem value="all">All Alerts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => addSubscriptionMutation.mutate(newSubscription)}
                  disabled={addSubscriptionMutation.isPending || !newSubscription.email}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptions && subscriptions.length > 0 ? (
                <div className="space-y-2">
                  {subscriptions.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{sub.email}</span>
                        <Badge variant="secondary">{sub.criticalAlerts ? 'Critical' : sub.warningAlerts ? 'Warning' : 'Info'}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSubscriptionMutation.mutate({ id: sub.id })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No subscriptions yet. Add an email address above.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Email History
              </CardTitle>
              <CardDescription>
                Recent email notifications sent by the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history && history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((email) => (
                    <div key={email.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {email.status === "sent" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium">{email.subject}</p>
                          <p className="text-sm text-muted-foreground">To: {email.toEmail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={email.status === "sent" ? "default" : "destructive"}>
                          {email.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {email.sentAt ? new Date(email.sentAt).toLocaleString() : 'Pending'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No emails sent yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
