import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MetricPoint {
  timestamp: number;
  cpu: number;
  memory: number;
  network: { rx: number; tx: number };
}

interface MetricsChartProps {
  data: MetricPoint[];
  className?: string;
}

type TimeRange = "1h" | "6h" | "12h" | "24h";

const timeRanges: { value: TimeRange; label: string; hours: number }[] = [
  { value: "1h", label: "1 час", hours: 1 },
  { value: "6h", label: "6 часов", hours: 6 },
  { value: "12h", label: "12 часов", hours: 12 },
  { value: "24h", label: "24 часа", hours: 24 },
];

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTooltipTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MetricsChart({ data, className }: MetricsChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [activeChart, setActiveChart] = useState<"cpu" | "memory" | "network">("cpu");

  const filteredData = useMemo(() => {
    const hours = timeRanges.find(r => r.value === timeRange)?.hours || 24;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return data
      .filter(d => d.timestamp >= cutoff)
      .map(d => ({
        ...d,
        time: formatTime(d.timestamp),
        fullTime: formatTooltipTime(d.timestamp),
      }));
  }, [data, timeRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover text-popover-foreground border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm text-muted-foreground mb-2">
            {payload[0]?.payload?.fullTime}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}
              {entry.name === "CPU" || entry.name === "Memory" ? "%" : " MB/s"}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Метрики ресурсов</CardTitle>
          <div className="flex gap-1">
            {timeRanges.map(range => (
              <Button
                key={range.value}
                variant={timeRange === range.value ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange(range.value)}
                className="text-xs px-2 py-1 h-7"
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            variant={activeChart === "cpu" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveChart("cpu")}
            className="text-xs"
          >
            CPU
          </Button>
          <Button
            variant={activeChart === "memory" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveChart("memory")}
            className="text-xs"
          >
            Memory
          </Button>
          <Button
            variant={activeChart === "network" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveChart("network")}
            className="text-xs"
          >
            Network
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filteredData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Нет данных за выбранный период
          </div>
        ) : (
          <div className="h-[300px]">
            {activeChart === "cpu" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    name="CPU"
                    stroke="#3b82f6"
                    fill="url(#cpuGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {activeChart === "memory" && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="memory"
                    name="Memory"
                    stroke="#10b981"
                    fill="url(#memoryGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {activeChart === "network" && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={v => `${v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="network.rx"
                    name="RX"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="network.tx"
                    name="TX"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Mini chart for dashboard cards
interface MiniChartProps {
  data: number[];
  color?: string;
  height?: number;
}

export function MiniChart({ data, color = "#3b82f6", height = 40 }: MiniChartProps) {
  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`miniGradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fill={`url(#miniGradient-${color})`}
          strokeWidth={1.5}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
