import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ScrollText,
  Search,
  RefreshCw,
  Download,
  Filter,
  AlertTriangle,
  AlertCircle,
  Info,
  Bug,
  Sparkles,
  Pause,
  Play,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
  metadata?: Record<string, string>;
}

const generateMockLogs = (): LogEntry[] => {
  const sources = ["api-server", "web-frontend", "worker-queue", "nginx-proxy", "postgres-db"];
  const levels: LogEntry["level"][] = ["info", "warn", "error", "debug"];
  const messages = {
    info: [
      "Request processed successfully",
      "Connection established",
      "Cache hit for key",
      "Health check passed",
      "Metrics exported",
    ],
    warn: [
      "High memory usage detected",
      "Slow query execution (>1s)",
      "Rate limit approaching",
      "Certificate expires in 30 days",
      "Deprecated API version used",
    ],
    error: [
      "Connection refused to database",
      "Out of memory exception",
      "Request timeout after 30s",
      "Authentication failed",
      "File not found",
    ],
    debug: [
      "Entering function processRequest",
      "Variable state: initialized",
      "Cache miss, fetching from source",
      "Query execution plan generated",
      "Garbage collection triggered",
    ],
  };

  const logs: LogEntry[] = [];
  const now = new Date();

  for (let i = 0; i < 100; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const message = messages[level][Math.floor(Math.random() * messages[level].length)];
    const timestamp = new Date(now.getTime() - i * 1000 * Math.random() * 60);

    logs.push({
      id: `log-${i}`,
      timestamp: timestamp.toISOString(),
      level,
      source,
      message,
      metadata: Math.random() > 0.7 ? { requestId: `req-${Math.random().toString(36).slice(2, 10)}` } : undefined,
    });
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

const levelIcons = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warn: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  debug: <Bug className="h-4 w-4 text-purple-500" />,
};

const levelColors = {
  info: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  warn: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  error: "bg-red-500/10 text-red-500 border-red-500/30",
  debug: "bg-purple-500/10 text-purple-500 border-purple-500/30",
};

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [isStreaming, setIsStreaming] = useState(true);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs(generateMockLogs());
  }, []);

  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      const newLog: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: ["info", "warn", "error", "debug"][Math.floor(Math.random() * 4)] as LogEntry["level"],
        source: ["api-server", "web-frontend", "worker-queue"][Math.floor(Math.random() * 3)],
        message: "New log entry generated",
      };
      setLogs((prev) => [newLog, ...prev.slice(0, 99)]);
    }, 3000);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLevel === "all" || log.level === selectedLevel;
    const matchesSource = selectedSource === "all" || log.source === selectedSource;
    return matchesSearch && matchesLevel && matchesSource;
  });

  const sources = Array.from(new Set(logs.map((l) => l.source)));

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Log Viewer</h1>
          <p className="text-muted-foreground">
            Real-time logs with AI-powered analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isStreaming ? "default" : "outline"}
            size="sm"
            onClick={() => setIsStreaming(!isStreaming)}
          >
            {isStreaming ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume
              </>
            )}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Info className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {logs.filter((l) => l.level === "info").length}
                </p>
                <p className="text-sm text-muted-foreground">Info</p>
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
                  {logs.filter((l) => l.level === "warn").length}
                </p>
                <p className="text-sm text-muted-foreground">Warnings</p>
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
                  {logs.filter((l) => l.level === "error").length}
                </p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Bug className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {logs.filter((l) => l.level === "debug").length}
                </p>
                <p className="text-sm text-muted-foreground">Debug</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedLevel} onValueChange={setSelectedLevel}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedSource} onValueChange={setSelectedSource}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((source) => (
              <SelectItem key={source} value={source}>
                {source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="ai-analysis"
            checked={showAIAnalysis}
            onCheckedChange={setShowAIAnalysis}
          />
          <Label htmlFor="ai-analysis" className="flex items-center gap-2 cursor-pointer">
            <Sparkles className="h-4 w-4" />
            AI Analysis
          </Label>
        </div>
      </div>

      {showAIAnalysis && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Log Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Pattern Detected:</strong> Increased error rate in{" "}
                <code className="bg-secondary px-1 rounded">api-server</code> over the last 5 minutes.
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Recommendation:</strong> Check database connection pool settings.
                Multiple "Connection refused" errors suggest connection exhaustion.
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Anomaly:</strong> Unusual spike in debug logs from{" "}
                <code className="bg-secondary px-1 rounded">worker-queue</code> - possible verbose logging enabled.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <ScrollArea className="h-[500px]" ref={scrollRef}>
          <div className="p-4 space-y-1 font-mono text-sm">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-3 p-2 rounded hover:bg-secondary/50 transition-colors ${
                  log.level === "error" ? "bg-red-500/5" : ""
                }`}
              >
                <span className="text-muted-foreground shrink-0 w-20">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className="shrink-0">{levelIcons[log.level]}</span>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs ${levelColors[log.level]}`}
                >
                  {log.level.toUpperCase()}
                </Badge>
                <span className="text-muted-foreground shrink-0 w-28 truncate">
                  [{log.source}]
                </span>
                <span className="flex-1 break-all">{log.message}</span>
                {log.metadata && (
                  <span className="text-muted-foreground text-xs shrink-0">
                    {Object.entries(log.metadata).map(([k, v]) => `${k}=${v}`).join(" ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
