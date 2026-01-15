import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { usePushNotifications } from "./usePushNotifications";

// Types for real-time data
export interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  created: string;
}

export interface Pod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  node: string;
  ip?: string;
}

export interface MetricPoint {
  timestamp: number;
  cpu: number;
  memory: number;
  network: { rx: number; tx: number };
}

export interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  category: "pod_crash" | "high_cpu" | "high_memory" | "container_stopped" | "deployment_failed";
  title: string;
  message: string;
  resource?: string;
  namespace?: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface RealTimeState {
  connected: boolean;
  containers: Container[];
  pods: Pod[];
  metricsHistory: MetricPoint[];
  alerts: Alert[];
  lastUpdate: Date | null;
}

/**
 * Hook for real-time updates via WebSocket
 */
export function useRealTimeUpdates() {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<RealTimeState>({
    connected: false,
    containers: [],
    pods: [],
    metricsHistory: [],
    alerts: [],
    lastUpdate: null,
  });

  // Connect to WebSocket server
  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[WebSocket] Connected");
      setState(prev => ({ ...prev, connected: true }));
    });

    socket.on("disconnect", () => {
      console.log("[WebSocket] Disconnected");
      setState(prev => ({ ...prev, connected: false }));
    });

    // Container updates
    socket.on("containers:update", (containers: Container[]) => {
      setState(prev => ({
        ...prev,
        containers,
        lastUpdate: new Date(),
      }));
    });

    // Pod updates
    socket.on("pods:update", (pods: Pod[]) => {
      setState(prev => ({
        ...prev,
        pods,
        lastUpdate: new Date(),
      }));
    });

    // Metrics history
    socket.on("metrics:history", (history: MetricPoint[]) => {
      setState(prev => ({
        ...prev,
        metricsHistory: history,
      }));
    });

    // Single metric update
    socket.on("metrics:update", (metric: MetricPoint) => {
      setState(prev => ({
        ...prev,
        metricsHistory: [...prev.metricsHistory.slice(-287), metric],
        lastUpdate: new Date(),
      }));
    });

    // Alerts update
    socket.on("alerts:update", (alerts: Alert[]) => {
      // Convert timestamp strings to Date objects
      const parsedAlerts = alerts.map(a => ({
        ...a,
        timestamp: new Date(a.timestamp),
      }));
      setState(prev => ({
        ...prev,
        alerts: parsedAlerts,
      }));
    });

    // New alert - trigger push notification
    socket.on("alert:new", (alert: Alert) => {
      const parsedAlert = {
        ...alert,
        timestamp: new Date(alert.timestamp),
      };
      setState(prev => ({
        ...prev,
        alerts: [parsedAlert, ...prev.alerts],
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Acknowledge an alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("acknowledge_alert", alertId);
    }
  }, []);

  // Subscribe to a channel
  const subscribe = useCallback((channel: string) => {
    if (socketRef.current) {
      socketRef.current.emit("subscribe", channel);
    }
  }, []);

  // Unsubscribe from a channel
  const unsubscribe = useCallback((channel: string) => {
    if (socketRef.current) {
      socketRef.current.emit("unsubscribe", channel);
    }
  }, []);

  return {
    ...state,
    acknowledgeAlert,
    subscribe,
    unsubscribe,
  };
}

/**
 * Hook for metrics with time range filtering
 */
export function useMetrics(hours: number = 24) {
  const { metricsHistory, connected } = useRealTimeUpdates();
  const [filteredMetrics, setFilteredMetrics] = useState<MetricPoint[]>([]);

  useEffect(() => {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const filtered = metricsHistory.filter(m => m.timestamp >= cutoff);
    setFilteredMetrics(filtered);
  }, [metricsHistory, hours]);

  return {
    metrics: filteredMetrics,
    connected,
  };
}

/**
 * Hook for alerts with filtering
 */
export function useAlerts(showAcknowledged: boolean = false) {
  const { alerts, acknowledgeAlert, connected } = useRealTimeUpdates();
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);

  useEffect(() => {
    const filtered = showAcknowledged
      ? alerts
      : alerts.filter(a => !a.acknowledged);
    setFilteredAlerts(filtered);
    setUnacknowledgedCount(alerts.filter(a => !a.acknowledged).length);
  }, [alerts, showAcknowledged]);

  return {
    alerts: filteredAlerts,
    unacknowledgedCount,
    acknowledgeAlert,
    connected,
  };
}
