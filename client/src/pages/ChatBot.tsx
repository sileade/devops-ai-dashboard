import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';
import { 
  MessageSquare, 
  Slack, 
  Settings, 
  Send,
  Bot,
  Terminal,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  Zap,
  Shield,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface Command {
  name: string;
  description: string;
  usage: string;
  examples: string[];
}

export default function ChatBot() {
  const [slackConfigured, setSlackConfigured] = useState(false);
  const [discordConfigured, setDiscordConfigured] = useState(false);
  
  // Slack config
  const [slackToken, setSlackToken] = useState('');
  const [slackSigningSecret, setSlackSigningSecret] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  
  // Discord config
  const [discordToken, setDiscordToken] = useState('');
  const [discordAppId, setDiscordAppId] = useState('');
  const [discordPublicKey, setDiscordPublicKey] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');

  // Test command
  const [testCommand, setTestCommand] = useState('/status');
  const [testResult, setTestResult] = useState<string | null>(null);

  const commands: Command[] = [
    {
      name: 'deploy',
      description: 'Deploy an application to specified environment',
      usage: '/deploy <app-name> [--env=production] [--version=latest]',
      examples: ['/deploy api-server', '/deploy web-frontend --env=staging', '/deploy backend --version=v2.0.0'],
    },
    {
      name: 'rollback',
      description: 'Rollback to a previous version',
      usage: '/rollback <app-name> [revision]',
      examples: ['/rollback api-server', '/rollback web-frontend abc123'],
    },
    {
      name: 'status',
      description: 'Check application or infrastructure status',
      usage: '/status [app-name]',
      examples: ['/status', '/status api-server'],
    },
    {
      name: 'scale',
      description: 'Scale application replicas',
      usage: '/scale <app-name> <replicas>',
      examples: ['/scale api-server 5', '/scale worker 3'],
    },
    {
      name: 'restart',
      description: 'Restart an application',
      usage: '/restart <app-name>',
      examples: ['/restart api-server'],
    },
    {
      name: 'logs',
      description: 'View application logs',
      usage: '/logs <app-name> [lines]',
      examples: ['/logs api-server', '/logs api-server 100'],
    },
    {
      name: 'ai',
      description: 'Ask AI for DevOps help',
      usage: '/ai <question>',
      examples: ['/ai how do I debug a crashing pod?', '/ai what causes high memory usage?'],
    },
  ];

  const handleConnectSlack = () => {
    if (!slackToken || !slackSigningSecret) {
      toast.error('Please enter Slack token and signing secret');
      return;
    }
    setSlackConfigured(true);
    toast.success('Slack bot connected');
  };

  const handleConnectDiscord = () => {
    if (!discordToken || !discordAppId || !discordPublicKey) {
      toast.error('Please enter Discord credentials');
      return;
    }
    setDiscordConfigured(true);
    toast.success('Discord bot connected');
  };

  const handleTestCommand = () => {
    // Simulate command execution
    const [cmd, ...args] = testCommand.split(' ');
    const commandName = cmd.replace('/', '');
    
    let result = '';
    switch (commandName) {
      case 'status':
        result = `📊 *Infrastructure Status*

🟢 Docker Containers: 5 running, 1 stopped
🟢 Kubernetes Pods: 12 running, 2 pending
📦 Active Deployments: 4 applications
⚠️ Alerts: 2 warnings

Last updated: just now`;
        break;
      case 'deploy':
        result = `🚀 *Deploy Confirmation*

App: \`${args[0] || 'api-server'}\`
Environment: \`production\`
Version: \`latest\`

[✅ Deploy] [❌ Cancel]`;
        break;
      case 'help':
        result = `📖 *Available Commands*

• /deploy - Deploy application
• /rollback - Rollback to previous version
• /status - Show status
• /scale - Scale application
• /restart - Restart application
• /logs - View logs
• /ai - Ask AI for help`;
        break;
      default:
        result = `Command \`${commandName}\` executed successfully`;
    }
    
    setTestResult(result);
    toast.success('Command executed');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-7 h-7 text-purple-400" />
              Chat Bot Integration
            </h1>
            <p className="text-slate-400 mt-1">Manage deployments via Slack and Discord commands</p>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#4A154B] rounded-lg">
                    <Slack className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Slack</p>
                    <p className="text-sm text-slate-400">
                      {slackConfigured ? 'Connected' : 'Not configured'}
                    </p>
                  </div>
                </div>
                {slackConfigured ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                    <XCircle className="w-3 h-3 mr-1" />
                    Inactive
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#5865F2] rounded-lg">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Discord</p>
                    <p className="text-sm text-slate-400">
                      {discordConfigured ? 'Connected' : 'Not configured'}
                    </p>
                  </div>
                </div>
                {discordConfigured ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                    <XCircle className="w-3 h-3 mr-1" />
                    Inactive
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="commands" className="w-full">
          <TabsList className="bg-slate-800/50 border-slate-700">
            <TabsTrigger value="commands">Commands</TabsTrigger>
            <TabsTrigger value="slack">Slack Setup</TabsTrigger>
            <TabsTrigger value="discord">Discord Setup</TabsTrigger>
            <TabsTrigger value="test">Test Console</TabsTrigger>
          </TabsList>

          {/* Commands Tab */}
          <TabsContent value="commands" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-purple-400" />
                  Available Slash Commands
                </CardTitle>
                <CardDescription>
                  Use these commands in Slack or Discord to manage your infrastructure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {commands.map((cmd) => (
                    <div key={cmd.name} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-mono text-lg text-purple-400">/{cmd.name}</h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(cmd.usage)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-slate-300 mb-2">{cmd.description}</p>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400">Usage:</p>
                        <code className="text-xs bg-slate-800 px-2 py-1 rounded text-green-400">
                          {cmd.usage}
                        </code>
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-slate-400">Examples:</p>
                        {cmd.examples.map((ex, i) => (
                          <code key={i} className="block text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
                            {ex}
                          </code>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Slack Setup Tab */}
          <TabsContent value="slack" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Slack className="w-5 h-5" />
                  Slack Bot Configuration
                </CardTitle>
                <CardDescription>
                  Configure your Slack bot for deployment commands
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Bot Token</Label>
                  <Input
                    type="password"
                    placeholder="xoxb-..."
                    value={slackToken}
                    onChange={(e) => setSlackToken(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 font-mono"
                  />
                  <p className="text-xs text-slate-400">
                    Get this from Slack App → OAuth & Permissions → Bot User OAuth Token
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Signing Secret</Label>
                  <Input
                    type="password"
                    placeholder="Enter signing secret"
                    value={slackSigningSecret}
                    onChange={(e) => setSlackSigningSecret(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 font-mono"
                  />
                  <p className="text-xs text-slate-400">
                    Get this from Slack App → Basic Information → App Credentials
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Webhook URL (Optional)</Label>
                  <Input
                    placeholder="https://hooks.slack.com/services/..."
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 font-mono"
                  />
                  <p className="text-xs text-slate-400">
                    For sending notifications to a specific channel
                  </p>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h4 className="font-medium text-white mb-2">Setup Instructions</h4>
                  <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
                    <li>Create a new Slack App at <a href="https://api.slack.com/apps" target="_blank" className="text-purple-400 hover:underline">api.slack.com/apps</a></li>
                    <li>Enable Slash Commands and add commands (e.g., /deploy, /status)</li>
                    <li>Set Request URL to: <code className="bg-slate-800 px-1 rounded">https://your-domain.com/api/slack/commands</code></li>
                    <li>Enable Interactivity and set URL to: <code className="bg-slate-800 px-1 rounded">https://your-domain.com/api/slack/interactions</code></li>
                    <li>Install the app to your workspace</li>
                  </ol>
                </div>

                <Button
                  onClick={handleConnectSlack}
                  className="w-full bg-[#4A154B] hover:bg-[#611f69]"
                  disabled={slackConfigured}
                >
                  {slackConfigured ? 'Connected' : 'Connect Slack Bot'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Discord Setup Tab */}
          <TabsContent value="discord" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#5865F2]" />
                  Discord Bot Configuration
                </CardTitle>
                <CardDescription>
                  Configure your Discord bot for deployment commands
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Bot Token</Label>
                  <Input
                    type="password"
                    placeholder="Enter bot token"
                    value={discordToken}
                    onChange={(e) => setDiscordToken(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Application ID</Label>
                  <Input
                    placeholder="Enter application ID"
                    value={discordAppId}
                    onChange={(e) => setDiscordAppId(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Public Key</Label>
                  <Input
                    placeholder="Enter public key"
                    value={discordPublicKey}
                    onChange={(e) => setDiscordPublicKey(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Webhook URL (Optional)</Label>
                  <Input
                    placeholder="https://discord.com/api/webhooks/..."
                    value={discordWebhookUrl}
                    onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 font-mono"
                  />
                </div>

                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h4 className="font-medium text-white mb-2">Setup Instructions</h4>
                  <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
                    <li>Create a new application at <a href="https://discord.com/developers/applications" target="_blank" className="text-purple-400 hover:underline">Discord Developer Portal</a></li>
                    <li>Create a bot user and copy the token</li>
                    <li>Set Interactions Endpoint URL to: <code className="bg-slate-800 px-1 rounded">https://your-domain.com/api/discord/interactions</code></li>
                    <li>Register slash commands using the Discord API</li>
                    <li>Invite the bot to your server with appropriate permissions</li>
                  </ol>
                </div>

                <Button
                  onClick={handleConnectDiscord}
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4]"
                  disabled={discordConfigured}
                >
                  {discordConfigured ? 'Connected' : 'Connect Discord Bot'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Test Console Tab */}
          <TabsContent value="test" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-green-400" />
                  Command Test Console
                </CardTitle>
                <CardDescription>
                  Test commands before deploying to Slack/Discord
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="/status"
                    value={testCommand}
                    onChange={(e) => setTestCommand(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && handleTestCommand()}
                  />
                  <Button onClick={handleTestCommand} className="bg-green-600 hover:bg-green-700">
                    <Send className="w-4 h-4 mr-2" />
                    Execute
                  </Button>
                </div>

                {testResult && (
                  <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">Response</span>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(testResult)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                      {testResult}
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {['/status', '/deploy api', '/help', '/ai how to scale?'].map((cmd) => (
                    <Button
                      key={cmd}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTestCommand(cmd);
                        handleTestCommand();
                      }}
                      className="font-mono text-xs"
                    >
                      {cmd}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    <h3 className="font-medium text-white">Instant Actions</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Execute deployments, rollbacks, and scaling directly from chat
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    <h3 className="font-medium text-white">Confirmation Buttons</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Interactive buttons for safe confirmation of critical actions
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Bot className="w-5 h-5 text-purple-400" />
                    <h3 className="font-medium text-white">AI Assistant</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Ask AI for help with DevOps questions and troubleshooting
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
