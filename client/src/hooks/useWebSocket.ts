import { useCallback, useEffect, useRef, useState } from "react";

export interface WSMessage {
  type: "container_status" | "pod_status" | "logs" | "metrics" | "notification" | "alert";
  payload: unknown;
  timestamp: number;
}

export interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        onDisconnect?.();

        // Auto-reconnect
        if (autoReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting to reconnect...");
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        onError?.(error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
    }
  }, [onMessage, onConnect, onDisconnect, onError, autoReconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const subscribe = useCallback((channel: string) => {
    send({ action: "subscribe", channel });
  }, [send]);

  const unsubscribe = useCallback((channel: string) => {
    send({ action: "unsubscribe", channel });
  }, [send]);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}

// Hook for specific message types
export function useContainerUpdates(
  onUpdate?: (containers: unknown[]) => void
) {
  const [containers, setContainers] = useState<unknown[]>([]);

  useWebSocket({
    onMessage: (message) => {
      if (message.type === "container_status") {
        const payload = message.payload as unknown[];
        setContainers(payload);
        onUpdate?.(payload);
      }
    },
  });

  return containers;
}

export function useMetricsUpdates(
  onUpdate?: (metrics: unknown) => void
) {
  const [metrics, setMetrics] = useState<unknown>(null);

  useWebSocket({
    onMessage: (message) => {
      if (message.type === "metrics") {
        setMetrics(message.payload);
        onUpdate?.(message.payload);
      }
    },
  });

  return metrics;
}

export function useLogStream(
  onLog?: (source: string, logs: string[]) => void
) {
  const [logs, setLogs] = useState<Array<{ source: string; log: string; timestamp: number }>>([]);

  useWebSocket({
    onMessage: (message) => {
      if (message.type === "logs") {
        const payload = message.payload as { source: string; logs: string[] };
        const newLogs = payload.logs.map((log) => ({
          source: payload.source,
          log,
          timestamp: message.timestamp,
        }));
        setLogs((prev) => [...prev.slice(-100), ...newLogs]); // Keep last 100 logs
        onLog?.(payload.source, payload.logs);
      }
    },
  });

  return logs;
}

export function useAlerts(
  onAlert?: (alert: { severity: string; title: string; message: string }) => void
) {
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    severity: string;
    title: string;
    message: string;
    timestamp: number;
  }>>([]);

  useWebSocket({
    onMessage: (message) => {
      if (message.type === "alert") {
        const payload = message.payload as { severity: string; title: string; message: string };
        const alert = {
          id: `alert_${message.timestamp}`,
          ...payload,
          timestamp: message.timestamp,
        };
        setAlerts((prev) => [alert, ...prev.slice(0, 49)]); // Keep last 50 alerts
        onAlert?.(payload);
      }
    },
  });

  return alerts;
}
