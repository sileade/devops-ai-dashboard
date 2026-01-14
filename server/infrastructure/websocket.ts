/**
 * WebSocket Module for Real-time Updates
 * 
 * This module provides WebSocket functionality for streaming
 * real-time updates to the dashboard.
 */

import { Server as HttpServer } from "http";
import { WebSocket, WebSocketServer } from "ws";

// Types
export interface WSMessage {
  type: "container_status" | "pod_status" | "logs" | "metrics" | "notification" | "alert";
  payload: unknown;
  timestamp: number;
}

export interface WSClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
}

// Store connected clients
const clients = new Map<string, WSClient>();

// WebSocket server instance
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initWebSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ 
    server,
    path: "/ws",
  });

  wss.on("connection", (ws: WebSocket) => {
    const clientId = generateClientId();
    const client: WSClient = {
      id: clientId,
      ws,
      subscriptions: new Set(["all"]),
    };
    
    clients.set(clientId, client);
    console.log(`WebSocket client connected: ${clientId}`);

    // Send welcome message
    sendToClient(client, {
      type: "notification",
      payload: { message: "Connected to DevOps AI Dashboard" },
      timestamp: Date.now(),
    });

    // Handle incoming messages
    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(client, message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      clients.delete(clientId);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });

    // Handle errors
    ws.on("error", (error: Error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      clients.delete(clientId);
    });
  });

  // Start background updates
  startBackgroundUpdates();

  console.log("WebSocket server initialized on /ws");
  return wss;
}

/**
 * Handle messages from clients
 */
function handleClientMessage(client: WSClient, message: any): void {
  switch (message.action) {
    case "subscribe":
      if (message.channel) {
        client.subscriptions.add(message.channel);
        console.log(`Client ${client.id} subscribed to ${message.channel}`);
      }
      break;
    
    case "unsubscribe":
      if (message.channel) {
        client.subscriptions.delete(message.channel);
        console.log(`Client ${client.id} unsubscribed from ${message.channel}`);
      }
      break;
    
    case "ping":
      sendToClient(client, {
        type: "notification",
        payload: { message: "pong" },
        timestamp: Date.now(),
      });
      break;
    
    default:
      console.log(`Unknown action from client ${client.id}:`, message.action);
  }
}

/**
 * Send message to a specific client
 */
function sendToClient(client: WSClient, message: WSMessage): void {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast message to all clients subscribed to a channel
 */
export function broadcast(channel: string, message: WSMessage): void {
  clients.forEach((client) => {
    if (client.subscriptions.has(channel) || client.subscriptions.has("all")) {
      sendToClient(client, message);
    }
  });
}

/**
 * Broadcast container status update
 */
export function broadcastContainerStatus(containers: unknown[]): void {
  broadcast("containers", {
    type: "container_status",
    payload: containers,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast pod status update
 */
export function broadcastPodStatus(pods: unknown[]): void {
  broadcast("pods", {
    type: "pod_status",
    payload: pods,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast log entries
 */
export function broadcastLogs(source: string, logs: string[]): void {
  broadcast("logs", {
    type: "logs",
    payload: { source, logs },
    timestamp: Date.now(),
  });
}

/**
 * Broadcast metrics update
 */
export function broadcastMetrics(metrics: unknown): void {
  broadcast("metrics", {
    type: "metrics",
    payload: metrics,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast alert/notification
 */
export function broadcastAlert(alert: {
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  resource?: string;
}): void {
  broadcast("all", {
    type: "alert",
    payload: alert,
    timestamp: Date.now(),
  });
}

/**
 * Get connected client count
 */
export function getClientCount(): number {
  return clients.size;
}

/**
 * Start background update loops
 */
function startBackgroundUpdates(): void {
  // Container status updates every 5 seconds
  setInterval(() => {
    if (clients.size > 0) {
      broadcastContainerStatus(getMockContainerUpdates());
    }
  }, 5000);

  // Metrics updates every 10 seconds
  setInterval(() => {
    if (clients.size > 0) {
      broadcastMetrics(getMockMetricsUpdate());
    }
  }, 10000);

  // Simulated log streaming every 2 seconds
  setInterval(() => {
    if (clients.size > 0) {
      broadcastLogs("system", getMockLogEntry());
    }
  }, 2000);
}

// Helper functions
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function getMockContainerUpdates(): unknown[] {
  return [
    { id: "abc123", name: "nginx-proxy", status: "running", cpu: `${(Math.random() * 2).toFixed(1)}%`, memory: `${Math.floor(30 + Math.random() * 10)}MB` },
    { id: "def456", name: "postgres-db", status: "running", cpu: `${(Math.random() * 5).toFixed(1)}%`, memory: `${Math.floor(250 + Math.random() * 20)}MB` },
    { id: "ghi789", name: "redis-cache", status: "running", cpu: `${(Math.random() * 1).toFixed(1)}%`, memory: `${Math.floor(20 + Math.random() * 10)}MB` },
    { id: "jkl012", name: "api-server", status: "running", cpu: `${(Math.random() * 10).toFixed(1)}%`, memory: `${Math.floor(500 + Math.random() * 50)}MB` },
  ];
}

function getMockMetricsUpdate(): unknown {
  return {
    cpu: {
      usage: 45 + Math.random() * 20,
      cores: 8,
    },
    memory: {
      used: 8.5 + Math.random() * 2,
      total: 16,
      percent: 53 + Math.random() * 10,
    },
    network: {
      rx: Math.floor(Math.random() * 1000000),
      tx: Math.floor(Math.random() * 500000),
    },
    containers: {
      running: 5,
      stopped: 1,
      total: 6,
    },
  };
}

function getMockLogEntry(): string[] {
  const levels = ["INFO", "DEBUG", "WARN"];
  const messages = [
    "Health check passed",
    "Request processed successfully",
    "Cache hit for key user:123",
    "Database query completed in 45ms",
    "Connection pool: 5/10 active",
    "Scheduled task completed",
    "Memory usage within limits",
  ];
  
  const level = levels[Math.floor(Math.random() * levels.length)];
  const message = messages[Math.floor(Math.random() * messages.length)];
  
  return [`[${new Date().toISOString()}] ${level}: ${message}`];
}
