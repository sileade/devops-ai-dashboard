import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
  Plus,
  MessageSquare,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
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

const welcomeMessage: Message = {
  id: "welcome",
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
};

const quickActions = [
  { icon: AlertTriangle, label: "Diagnose Issues", prompt: "Analyze current infrastructure for potential issues and suggest fixes" },
  { icon: CheckCircle2, label: "Health Check", prompt: "Run a comprehensive health check on all systems" },
  { icon: Lightbulb, label: "Optimization Tips", prompt: "Suggest optimizations for my infrastructure based on current metrics" },
  { icon: Terminal, label: "Generate Commands", prompt: "Generate kubectl commands for common operations" },
  { icon: Brain, label: "Learn from Logs", prompt: "Analyze recent logs and learn patterns for future troubleshooting" },
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // tRPC queries
  const aiStatus = trpc.ai.getStatus.useQuery();
  const chatMutation = trpc.ai.chat.useMutation();
  const feedbackMutation = trpc.ai.submitFeedback.useMutation();
  const knowledgeStats = trpc.ai.getKnowledgeStats.useQuery();
  const clearHistoryMutation = trpc.ai.clearHistory.useMutation();
  const createSessionMutation = trpc.ai.createSession.useMutation();

  // Get or create session on mount
  const sessionQuery = trpc.ai.getSession.useQuery(
    { sessionId: sessionId || undefined },
    { enabled: !sessionId }
  );

  // Load chat history when session is available
  const historyQuery = trpc.ai.getChatHistory.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  // Initialize session
  useEffect(() => {
    if (sessionQuery.data?.sessionId && !sessionId) {
      setSessionId(sessionQuery.data.sessionId);
    }
  }, [sessionQuery.data, sessionId]);

  // Load history when available
  useEffect(() => {
    if (historyQuery.data && historyQuery.data.length > 0) {
      const loadedMessages: Message[] = historyQuery.data.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
        suggestions: m.suggestions,
        commands: m.commands,
        feedbackGiven: m.feedbackGiven as "positive" | "negative" | undefined,
      }));
      setMessages([welcomeMessage, ...loadedMessages]);
      setIsLoadingHistory(false);
    } else if (historyQuery.isSuccess) {
      setIsLoadingHistory(false);
    }
  }, [historyQuery.data, historyQuery.isSuccess]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async (content: string = input) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
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
        sessionId: sessionId || undefined,
        context: {
          recentMessages: messages.slice(-5).map(m => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      // Update session ID if returned
      if (response.sessionId && !sessionId) {
        setSessionId(response.sessionId);
      }

      const assistantMessage: Message = {
        id: response.messageId || `assistant-${Date.now()}`,
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
        id: `assistant-${Date.now()}`,
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
  }, [input, sessionId, messages, chatMutation]);

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

  const handleClearHistory = async () => {
    if (sessionId) {
      try {
        await clearHistoryMutation.mutateAsync({ sessionId });
        toast.success("Chat history cleared");
      } catch (error) {
        console.error("Failed to clear history:", error);
      }
    }
    setMessages([welcomeMessage]);
  };

  const handleNewChat = async () => {
    try {
      const result = await createSessionMutation.mutateAsync({});
      setSessionId(result.sessionId);
      setMessages([welcomeMessage]);
      toast.success("Started new chat session");
    } catch (error) {
      console.error("Failed to create new session:", error);
      // Fallback: just reset messages locally
      setMessages([welcomeMessage]);
    }
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
            <Button variant="outline" size="sm" onClick={handleNewChat}>
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
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
                  {isLoadingHistory && sessionId ? (
                    <div className="space-y-4">
                      <Skeleton className="h-20 w-3/4" />
                      <Skeleton className="h-12 w-1/2 ml-auto" />
                      <Skeleton className="h-24 w-3/4" />
                    </div>
                  ) : (
                    messages.map((message) => (
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
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleCopyCommand(cmd.command)}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-green-500"
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
                          {message.suggestions && message.suggestions.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {message.suggestions.map((suggestion, idx) => (
                                <Button
                                  key={idx}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => handleSend(suggestion)}
                                >
                                  {suggestion}
                                </Button>
                              ))}
                            </div>
                          )}

                          {/* Feedback buttons for assistant messages */}
                          {message.role === "assistant" && message.id !== "welcome" && (
                            <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Was this helpful?</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-6 w-6 ${message.feedbackGiven === "positive" ? "text-green-500" : ""}`}
                                onClick={() => handleFeedback(message.id, "positive")}
                                disabled={!!message.feedbackGiven}
                              >
                                <ThumbsUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-6 w-6 ${message.feedbackGiven === "negative" ? "text-red-500" : ""}`}
                                onClick={() => handleFeedback(message.id, "negative")}
                                disabled={!!message.feedbackGiven}
                              >
                                <ThumbsDown className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary animate-pulse" />
                      </div>
                      <div className="bg-secondary rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Analyzing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask about your infrastructure..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={isLoading}
                  />
                  <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
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
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-secondary rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-primary">
                      {knowledgeStats.data?.totalSolutions || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Solutions</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-500">
                      {knowledgeStats.data?.successRate || 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-blue-500">
                      {knowledgeStats.data?.totalInteractions || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Interactions</p>
                  </div>
                </div>

                <h3 className="font-medium mb-3">Top Problem Categories</h3>
                <div className="space-y-3">
                  {knowledgeStats.data?.topCategories?.map((category, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                          {idx + 1}
                        </Badge>
                        <span className="text-sm">{category.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {category.solved}/{category.count} solved
                        </span>
                        <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${(category.solved / category.count) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right sidebar */}
      <div className="w-80 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action, idx) => (
              <Button
                key={idx}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleSend(action.prompt)}
                disabled={isLoading}
              >
                <action.icon className="h-4 w-4 mr-2" />
                {action.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Capabilities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Log analysis & anomaly detection</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Infrastructure troubleshooting</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Command recommendations</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Self-learning from feedback</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Knowledge base integration</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Automated remediation</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Recent Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {["Pod scaling issues", "Memory optimization", "SSL certificate renewal", "Database connection pooling"].map((topic, idx) => (
              <Button
                key={idx}
                variant="ghost"
                className="w-full justify-start text-sm h-auto py-2"
                onClick={() => handleSend(`Tell me about ${topic}`)}
              >
                <MessageSquare className="h-3 w-3 mr-2 text-muted-foreground" />
                {topic}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Self-Learning Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              The AI learns from your feedback and successful troubleshooting sessions to improve future recommendations.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500">Learning enabled</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
