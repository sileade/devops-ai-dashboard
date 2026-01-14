import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Settings as SettingsIcon,
  Server,
  Database,
  Key,
  Shield,
  Cpu,
  Globe,
  Save,
  TestTube,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ConnectionStatus {
  name: string;
  status: "connected" | "disconnected" | "error";
  lastCheck: string;
}

const mockConnections: ConnectionStatus[] = [
  { name: "Docker Socket", status: "connected", lastCheck: "Just now" },
  { name: "Kubernetes API", status: "connected", lastCheck: "1 minute ago" },
  { name: "Podman Socket", status: "disconnected", lastCheck: "Never" },
  { name: "Ansible Controller", status: "connected", lastCheck: "5 minutes ago" },
  { name: "Terraform Cloud", status: "error", lastCheck: "10 minutes ago" },
];

const statusIcons = {
  connected: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  disconnected: <XCircle className="h-4 w-4 text-muted-foreground" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusColors = {
  connected: "bg-green-500/10 text-green-500 border-green-500/30",
  disconnected: "bg-secondary text-muted-foreground border-border",
  error: "bg-red-500/10 text-red-500 border-red-500/30",
};

export default function Settings() {
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Settings saved successfully");
    }, 1000);
  };

  const handleTestConnection = (name: string) => {
    setIsTesting(true);
    toast.info(`Testing connection to ${name}...`);
    setTimeout(() => {
      setIsTesting(false);
      toast.success(`Connection to ${name} successful`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure connections, integrations, and preferences
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="docker">Docker</TabsTrigger>
          <TabsTrigger value="kubernetes">Kubernetes</TabsTrigger>
          <TabsTrigger value="ai">AI Settings</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Connection Status
              </CardTitle>
              <CardDescription>
                Overview of all infrastructure connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockConnections.map((conn) => (
                  <div
                    key={conn.name}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-4">
                      {statusIcons[conn.status]}
                      <div>
                        <p className="font-medium">{conn.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Last checked: {conn.lastCheck}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={statusColors[conn.status]}>
                        {conn.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(conn.name)}
                        disabled={isTesting}
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        Test
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docker" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Docker Configuration
              </CardTitle>
              <CardDescription>
                Configure Docker and Docker Compose settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Docker Socket Path</Label>
                  <Input defaultValue="/var/run/docker.sock" />
                </div>
                <div className="space-y-2">
                  <Label>Docker Host</Label>
                  <Input defaultValue="unix:///var/run/docker.sock" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Docker Compose Files Directory</Label>
                <Input defaultValue="/opt/docker-compose" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Docker Stats Collection</Label>
                  <p className="text-sm text-muted-foreground">
                    Collect container resource usage statistics
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-remove Stopped Containers</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically clean up stopped containers
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Podman Configuration</CardTitle>
              <CardDescription>
                Configure Podman for rootless container management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Podman Socket Path</Label>
                <Input defaultValue="/run/user/1000/podman/podman.sock" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Podman Integration</Label>
                  <p className="text-sm text-muted-foreground">
                    Use Podman alongside Docker
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kubernetes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Kubernetes Configuration
              </CardTitle>
              <CardDescription>
                Configure Kubernetes cluster connections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Kubeconfig Path</Label>
                <Input defaultValue="~/.kube/config" />
              </div>
              <div className="space-y-2">
                <Label>Default Context</Label>
                <Select defaultValue="production">
                  <SelectTrigger>
                    <SelectValue placeholder="Select context" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">production-cluster</SelectItem>
                    <SelectItem value="staging">staging-cluster</SelectItem>
                    <SelectItem value="development">development-cluster</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Namespace</Label>
                <Input defaultValue="default" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Metrics Server Integration</Label>
                  <p className="text-sm text-muted-foreground">
                    Collect pod and node metrics
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                AI Assistant Configuration
              </CardTitle>
              <CardDescription>
                Configure the local AI model and analysis settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>LLM Provider</Label>
                <Select defaultValue="ollama">
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ollama">Ollama (Local)</SelectItem>
                    <SelectItem value="openai">OpenAI API</SelectItem>
                    <SelectItem value="anthropic">Anthropic API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ollama Endpoint</Label>
                <Input defaultValue="http://localhost:11434" />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Select defaultValue="mistral">
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mistral">Mistral 7B</SelectItem>
                    <SelectItem value="llama2">Llama 2 13B</SelectItem>
                    <SelectItem value="codellama">Code Llama 7B</SelectItem>
                    <SelectItem value="mixtral">Mixtral 8x7B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea
                  rows={4}
                  defaultValue="You are a DevOps AI assistant specialized in infrastructure management, troubleshooting, and automation. Provide concise, actionable recommendations."
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Auto-Analysis</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically analyze logs and metrics for anomalies
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Learning Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow AI to learn from your feedback
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base</CardTitle>
              <CardDescription>
                Configure the AI knowledge base for self-learning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Vector Database</Label>
                <Select defaultValue="chroma">
                  <SelectTrigger>
                    <SelectValue placeholder="Select database" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chroma">ChromaDB</SelectItem>
                    <SelectItem value="pinecone">Pinecone</SelectItem>
                    <SelectItem value="weaviate">Weaviate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ChromaDB Path</Label>
                <Input defaultValue="/var/lib/devops-ai/chroma" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Store Successful Solutions</Label>
                  <p className="text-sm text-muted-foreground">
                    Save successful troubleshooting solutions for future reference
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure authentication and access control
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Require 2FA for all users
                  </p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Session Timeout</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically logout after inactivity
                  </p>
                </div>
                <Select defaultValue="30">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select timeout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Audit Logging</Label>
                  <p className="text-sm text-muted-foreground">
                    Log all user actions for compliance
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Manage API keys for external integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>OpenAI API Key</Label>
                <Input type="password" placeholder="sk-..." />
              </div>
              <div className="space-y-2">
                <Label>Slack Webhook URL</Label>
                <Input type="password" placeholder="https://hooks.slack.com/..." />
              </div>
              <div className="space-y-2">
                <Label>Telegram Bot Token</Label>
                <Input type="password" placeholder="123456:ABC-DEF..." />
              </div>
              <div className="space-y-2">
                <Label>PagerDuty API Key</Label>
                <Input type="password" placeholder="..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
