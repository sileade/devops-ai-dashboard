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
  onError?: (error: string) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enabled?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    // Don't connect if disabled or already connecting
    if (!enabled || isConnectingRef.current) {
      return;
    }

    // Don't reconnect if max attempts reached
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log("Max WebSocket reconnect attempts reached, stopping");
      setConnectionError("Unable to establish WebSocket connection after multiple attempts");
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore close errors
      }
      wsRef.current = null;
    }

    isConnectingRef.current = true;

    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log("WebSocket connection timeout");
          ws.close();
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("WebSocket connected");
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);
        } catch (error) {
          console.warn("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log("WebSocket disconnected", event.code, event.reason);
        setIsConnected(false);
        isConnectingRef.current = false;
        onDisconnect?.();

        // Auto-reconnect with exponential backoff
        if (autoReconnect && enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        // WebSocket error events don't contain useful information
        // The actual error will be handled by onclose
        console.warn("WebSocket connection error - server may not support WebSocket");
        isConnectingRef.current = false;
        
        // Only call onError callback with a meaningful message
        const errorMessage = "WebSocket connection failed - real-time updates unavailable";
        setConnectionError(errorMessage);
        onError?.(errorMessage);
      };

      wsRef.current = ws;
    } catch (error) {
      console.warn("Failed to create WebSocket:", error);
      isConnectingRef.current = false;
      const errorMessage = error instanceof Error ? error.message : "Failed to create WebSocket";
      setConnectionError(errorMessage);
      onError?.(errorMessage);
    }
  }, [onMessage, onConnect, onDisconnect, onError, autoReconnect, reconnectInterval, maxReconnectAttempts, enabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore close errors
      }
      wsRef.current = null;
    }
    
    setIsConnected(false);
    isConnectingRef.current = false;
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  const subscribe = useCallback((channel: string) => {
    return send({ action: "subscribe", channel });
  }, [send]);

  const unsubscribe = useCallback((channel: string) => {
    return send({ action: "unsubscribe", channel });
  }, [send]);

  const resetReconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setConnectionError(null);
  }, []);

  useEffect(() => {
    if (enabled) {
      // Delay initial connection to avoid race conditions
      const initTimeout = setTimeout(() => {
        connect();
      }, 100);
      
      return () => {
        clearTimeout(initTimeout);
        disconnect();
      };
    } else {
      disconnect();
    }
  }, [enabled]); // Only depend on enabled, not connect/disconnect to avoid loops

  return {
    isConnected,
    lastMessage,
    connectionError,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
    resetReconnect,
  };
}

// Hook for specific message types with graceful degradation
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
    // Disable auto-reconnect for secondary hooks to avoid multiple connections
    maxReconnectAttempts: 3,
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
    maxReconnectAttempts: 3,
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
    maxReconnectAttempts: 3,
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
    maxReconnectAttempts: 3,
  });

  return alerts;
}
