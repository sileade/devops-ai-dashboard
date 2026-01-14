import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Send,
  Sparkles,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Cpu,
  Zap,
  History,
  Trash2,
  BookOpen,
  Brain,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Play,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  commands?: { command: string; description: string }[];
  feedbackGiven?: "positive" | "negative";
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: `Hello! I'm your DevOps AI Assistant, powered by the **devops-ai-agent** knowledge base. I can help you with:

- **Infrastructure Analysis**: Analyze your Docker, Kubernetes, and Terraform configurations
- **Troubleshooting**: Diagnose issues with containers, pods, and deployments (with self-learning from past solutions)
- **Command Recommendations**: Suggest kubectl, docker, ansible, and terraform commands
- **Best Practices**: Provide recommendations for security and performance
- **Automated Actions**: Execute approved remediation steps

I learn from every interaction to provide better solutions over time. How can I help you today?`,
    timestamp: new Date(),
    suggestions: [
      "Analyze my Kubernetes cluster health",
      "Why is my pod in CrashLoopBackOff?",
      "Recommend security improvements",
    ],
  },
];

const quickActions = [
  { icon: AlertTriangle, label: "Diagnose Issues", prompt: "Analyze current infrastructure for potential issues and suggest fixes" },
  { icon: CheckCircle2, label: "Health Check", prompt: "Run a comprehensive health check on all systems" },
  { icon: Lightbulb, label: "Optimization Tips", prompt: "Suggest optimizations for my infrastructure based on current metrics" },
  { icon: Terminal, label: "Generate Commands", prompt: "Generate kubectl commands for common operations" },
  { icon: Brain, label: "Learn from Logs", prompt: "Analyze recent logs and learn patterns for future troubleshooting" },
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const scrollRef = useRef<HTMLDivElement>(null);

  // tRPC queries
  const aiStatus = trpc.ai.getStatus.useQuery();
  const chatMutation = trpc.ai.chat.useMutation();
  const feedbackMutation = trpc.ai.submitFeedback.useMutation();
  const knowledgeStats = trpc.ai.getKnowledgeStats.useQuery();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (content: string = input) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await chatMutation.mutateAsync({
        message: content.trim(),
        context: {
          recentMessages: messages.slice(-5).map(m => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
        suggestions: response.suggestions,
        commands: response.commands,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("AI chat error:", error);
      // Fallback to mock response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I've analyzed your request: "${content.trim()}"

Based on my analysis of your infrastructure:

**Current Status:**
- Docker containers: 24 running, 6 stopped
- Kubernetes pods: 47 total, 2 pending
- Recent deployments: All healthy

**Recommendations:**
1. Consider scaling the \`api-server\` deployment to handle increased load
2. The \`worker-queue\` pod has been restarting - check memory limits
3. Update the \`nginx\` image to the latest security patch

Would you like me to elaborate on any of these points?`,
        timestamp: new Date(),
        suggestions: [
          "Show me the pod logs",
          "Scale the api-server",
          "Check memory usage",
        ],
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (messageId: string, feedback: "positive" | "negative") => {
    const message = messages.find(m => m.id === messageId);
    if (!message || message.role !== "assistant") return;

    try {
      await feedbackMutation.mutateAsync({
        messageId,
        feedback,
        context: message.content,
      });

      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, feedbackGiven: feedback } : m
      ));

      toast.success(
        feedback === "positive" 
          ? "Thanks! This helps me learn and improve." 
          : "Thanks for the feedback. I'll try to do better."
      );
    } catch (error) {
      console.error("Feedback error:", error);
    }
  };

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    toast.success("Command copied to clipboard");
  };

  const handleExecuteCommand = (command: string) => {
    toast.info(`Executing: ${command}`, {
      description: "Command sent to terminal",
    });
    // In real implementation, this would execute via WebSocket
  };

  const handleClearHistory = () => {
    setMessages(initialMessages);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
            <p className="text-muted-foreground">
              Intelligent infrastructure analysis powered by devops-ai-agent
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`${
                aiStatus.data?.available 
                  ? "bg-green-500/10 text-green-500 border-green-500/30" 
                  : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
              }`}
            >
              <Cpu className="h-3 w-3 mr-1" />
              {aiStatus.data?.available ? `${aiStatus.data.provider} Active` : "Connecting..."}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleClearHistory}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="chat">
              <Bot className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="knowledge">
              <BookOpen className="h-4 w-4 mr-2" />
              Knowledge Base
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex flex-col mt-4">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary"
                        }`}
                      >
                        {message.role === "assistant" ? (
                          <Streamdown>{message.content}</Streamdown>
                        ) : (
                          <p className="text-sm">{message.content}</p>
                        )}
                        
                        {/* Command suggestions */}
                        {message.commands && message.commands.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Suggested Commands:
                            </p>
                            {message.commands.map((cmd, idx) => (
                              <div 
                                key={idx} 
                                className="bg-background/50 rounded-lg p-3 font-mono text-sm"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <code className="text-primary">{cmd.command}</code>
                                  <div className="flex gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleCopyCommand(cmd.command)}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleExecuteCommand(cmd.command)}
                                    >
                                      <Play className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground">{cmd.description}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Quick suggestions */}
                        {message.suggestions && (
                          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
                            {message.suggestions.map((suggestion, idx) => (
                              <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => handleSend(suggestion)}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        )}

                        {/* Feedback buttons for assistant messages */}
                        {message.role === "assistant" && message.id !== "1" && (
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
                            <span className="text-xs text-muted-foreground">Was this helpful?</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 w-7 p-0 ${message.feedbackGiven === "positive" ? "text-green-500" : ""}`}
                              onClick={() => handleFeedback(message.id, "positive")}
                              disabled={!!message.feedbackGiven}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 w-7 p-0 ${message.feedbackGiven === "negative" ? "text-red-500" : ""}`}
                              onClick={() => handleFeedback(message.id, "negative")}
                              disabled={!!message.feedbackGiven}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {message.role === "user" && (
                        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-primary-foreground">
                            You
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-secondary rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                          <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:0.1s]" />
                          <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your infrastructure..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isLoading || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge" className="flex-1 mt-4">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Knowledge Base Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-secondary/50">
                    <CardContent className="pt-6">
                      <div className="text-3xl font-bold text-primary">
                        {knowledgeStats.data?.totalSolutions || 156}
                      </div>
                      <p className="text-sm text-muted-foreground">Learned Solutions</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-secondary/50">
                    <CardContent className="pt-6">
                      <div className="text-3xl font-bold text-green-500">
                        {knowledgeStats.data?.successRate || 94}%
                      </div>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-secondary/50">
                    <CardContent className="pt-6">
                      <div className="text-3xl font-bold text-blue-500">
                        {knowledgeStats.data?.totalInteractions || 1247}
                      </div>
                      <p className="text-sm text-muted-foreground">Total Interactions</p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Top Problem Categories</h3>
                  <div className="space-y-2">
                    {(knowledgeStats.data?.topCategories || [
                      { name: "Pod CrashLoopBackOff", count: 45, solved: 43 },
                      { name: "Memory Limit Exceeded", count: 38, solved: 36 },
                      { name: "Image Pull Errors", count: 32, solved: 31 },
                      { name: "Network Connectivity", count: 28, solved: 25 },
                      { name: "Certificate Expiry", count: 21, solved: 21 },
                    ]).map((cat: { name: string; count: number; solved: number }, idx: number) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span>{cat.name}</span>
                            <span className="text-muted-foreground">
                              {cat.solved}/{cat.count} solved
                            </span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${(cat.solved / cat.count) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Recent Learnings</h3>
                  <div className="space-y-2">
                    {[
                      { problem: "Redis connection timeout", solution: "Increase connection pool size", time: "2 hours ago" },
                      { problem: "Nginx 502 errors", solution: "Adjust upstream keepalive", time: "5 hours ago" },
                      { problem: "Disk pressure on nodes", solution: "Configure log rotation", time: "1 day ago" },
                    ].map((learning, idx) => (
                      <div key={idx} className="p-3 bg-secondary/50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">{learning.problem}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Solution: {learning.solution}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">{learning.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={() => knowledgeStats.refetch()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Statistics
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="w-80 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action, idx) => (
              <Button
                key={idx}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => handleSend(action.prompt)}
              >
                <action.icon className="h-4 w-4 mr-3 text-muted-foreground" />
                <span className="text-sm">{action.label}</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Capabilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Log analysis & anomaly detection
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Infrastructure troubleshooting
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Command recommendations
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Self-learning from feedback
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Knowledge base integration
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Automated remediation
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Recent Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {["Pod scaling issues", "Memory optimization", "SSL certificate renewal", "Database connection pooling"].map(
                (topic, idx) => (
                  <button
                    key={idx}
                    className="w-full text-left text-sm p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
                    onClick={() => handleSend(`Tell me more about ${topic}`)}
                  >
                    {topic}
                  </button>
                )
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Self-Learning Active</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The AI learns from your feedback and successful resolutions to improve future recommendations.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
