import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Streamdown } from "streamdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: `Hello! I'm your DevOps AI Assistant. I can help you with:

- **Infrastructure Analysis**: Analyze your Docker, Kubernetes, and Terraform configurations
- **Troubleshooting**: Diagnose issues with containers, pods, and deployments
- **Command Recommendations**: Suggest kubectl, docker, and terraform commands
- **Best Practices**: Provide recommendations for security and performance

How can I help you today?`,
    timestamp: new Date(),
    suggestions: [
      "Analyze my Kubernetes cluster health",
      "Why is my pod in CrashLoopBackOff?",
      "Recommend security improvements",
    ],
  },
];

const quickActions = [
  { icon: AlertTriangle, label: "Diagnose Issues", prompt: "Analyze current infrastructure for potential issues" },
  { icon: CheckCircle2, label: "Health Check", prompt: "Run a comprehensive health check on all systems" },
  { icon: Lightbulb, label: "Optimization Tips", prompt: "Suggest optimizations for my infrastructure" },
  { icon: Terminal, label: "Generate Commands", prompt: "Generate kubectl commands for common operations" },
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

    // Simulate AI response
    setTimeout(() => {
      const responses: Record<string, string> = {
        default: `I've analyzed your request: "${content.trim()}"

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
      };

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responses.default,
        timestamp: new Date(),
        suggestions: [
          "Show me the pod logs",
          "Scale the api-server",
          "Check memory usage",
        ],
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
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
              Intelligent infrastructure analysis and recommendations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              <Cpu className="h-3 w-3 mr-1" />
              Local LLM Active
            </Badge>
            <Button variant="outline" size="sm" onClick={handleClearHistory}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

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
                Security best practices
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Performance optimization
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
              {["Pod scaling issues", "Memory optimization", "SSL certificate renewal"].map(
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
      </div>
    </div>
  );
}
