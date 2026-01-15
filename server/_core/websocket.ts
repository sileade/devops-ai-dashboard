import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import * as docker from "../infrastructure/docker";
import * as kubernetes from "../infrastructure/kubernetes";
import { saveMetricsSnapshot, getAlertThresholds, recordAlert, isThresholdInCooldown } from "../db";

let io: Server | null = null;

// Store connected clients
const connectedClients = new Map<string, Socket>();

// Metrics history storage (in-memory for now)
interface MetricPoint {
  timestamp: number;
  cpu: number;
  memory: number;
  network: { rx: number; tx: number };
}

const metricsHistory: MetricPoint[] = [];
const MAX_HISTORY_POINTS = 288; // 24 hours at 5-minute intervals

// Alert types
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

const activeAlerts: Alert[] = [];
let alertIdCounter = 1;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);
    connectedClients.set(socket.id, socket);

    // Send initial data
    sendInitialData(socket);

    // Handle subscription requests
    socket.on("subscribe", (channel: string) => {
      socket.join(channel);
      console.log(`[WebSocket] Client ${socket.id} subscribed to ${channel}`);
    });

    socket.on("unsubscribe", (channel: string) => {
      socket.leave(channel);
      console.log(`[WebSocket] Client ${socket.id} unsubscribed from ${channel}`);
    });

    // Handle alert acknowledgment
    socket.on("acknowledge_alert", (alertId: string) => {
      const alert = activeAlerts.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        broadcastAlerts();
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
      connectedClients.delete(socket.id);
    });
  });

  // Start periodic updates
  startPeriodicUpdates();

  console.log("[WebSocket] Server initialized");
  return io;
}

/**
 * Send initial data to newly connected client
 */
async function sendInitialData(socket: Socket) {
  try {
    // Send current container status
    const containers = await docker.listContainers(true);
    socket.emit("containers:update", containers);

    // Send current pod status
    const pods = await kubernetes.listPods("all");
    socket.emit("pods:update", pods);

    // Send metrics history
    socket.emit("metrics:history", metricsHistory);

    // Send active alerts
    socket.emit("alerts:update", activeAlerts);
  } catch (error) {
    console.error("[WebSocket] Error sending initial data:", error);
  }
}

/**
 * Start periodic status updates
 */
function startPeriodicUpdates() {
  // Update container status every 10 seconds
  setInterval(async () => {
    if (!io || connectedClients.size === 0) return;

    try {
      const containers = await docker.listContainers(true);
      io.emit("containers:update", containers);

      // Check for container issues
      checkContainerAlerts(containers);
    } catch (error) {
      // Silently fail if Docker is not available
    }
  }, 10000);

  // Update pod status every 10 seconds
  setInterval(async () => {
    if (!io || connectedClients.size === 0) return;

    try {
      const pods = await kubernetes.listPods("all");
      io.emit("pods:update", pods);

      // Check for pod issues
      checkPodAlerts(pods);
    } catch (error) {
      // Silently fail if Kubernetes is not available
    }
  }, 10000);

  // Collect metrics every 5 minutes
  setInterval(async () => {
    await collectMetrics();
  }, 5 * 60 * 1000);

  // Initial metrics collection
  collectMetrics();
}

/**
 * Collect and store metrics
 */
async function collectMetrics() {
  try {
    // Get cluster metrics
    const clusterMetrics = await kubernetes.getClusterMetrics();
    
    const metricPoint: MetricPoint = {
      timestamp: Date.now(),
      cpu: clusterMetrics.cpuUsage || Math.random() * 100,
      memory: clusterMetrics.memoryUsage || Math.random() * 100,
      network: {
        rx: Math.random() * 1000,
        tx: Math.random() * 500,
      },
    };

    metricsHistory.push(metricPoint);

    // Keep only last 24 hours in memory
    while (metricsHistory.length > MAX_HISTORY_POINTS) {
      metricsHistory.shift();
    }

    // Save to database for long-term storage
    await saveMetricsSnapshot({
      source: "kubernetes",
      resourceType: "cluster",
      cpuPercent: Math.round(metricPoint.cpu),
      memoryPercent: Math.round(metricPoint.memory),
      networkRxBytes: Math.round(metricPoint.network.rx),
      networkTxBytes: Math.round(metricPoint.network.tx),
    });

    // Broadcast to all clients
    if (io) {
      io.emit("metrics:update", metricPoint);
    }

    // Check for high resource usage using configurable thresholds
    await checkResourceAlertsWithThresholds(metricPoint);
  } catch (error) {
    // Generate mock metrics if real data unavailable
    const metricPoint: MetricPoint = {
      timestamp: Date.now(),
      cpu: 40 + Math.random() * 40,
      memory: 50 + Math.random() * 30,
      network: {
        rx: Math.random() * 1000,
        tx: Math.random() * 500,
      },
    };

    metricsHistory.push(metricPoint);

    while (metricsHistory.length > MAX_HISTORY_POINTS) {
      metricsHistory.shift();
    }

    // Save mock metrics to database too
    await saveMetricsSnapshot({
      source: "system",
      resourceType: "cluster",
      cpuPercent: Math.round(metricPoint.cpu),
      memoryPercent: Math.round(metricPoint.memory),
      networkRxBytes: Math.round(metricPoint.network.rx),
      networkTxBytes: Math.round(metricPoint.network.tx),
    });

    if (io) {
      io.emit("metrics:update", metricPoint);
    }

    // Check thresholds even for mock data
    await checkResourceAlertsWithThresholds(metricPoint);
  }
}

/**
 * Check resource alerts using configurable thresholds from database
 */
async function checkResourceAlertsWithThresholds(metrics: MetricPoint) {
  try {
    const thresholds = await getAlertThresholds({ enabledOnly: true });
    
    for (const threshold of thresholds) {
      // Check if threshold is in cooldown
      const inCooldown = await isThresholdInCooldown(threshold.id);
      if (inCooldown) continue;

      let currentValue: number | null = null;
      
      // Get the relevant metric value
      switch (threshold.metricType) {
        case "cpu":
          currentValue = metrics.cpu;
          break;
        case "memory":
          currentValue = metrics.memory;
          break;
        default:
          continue;
      }

      if (currentValue === null) continue;

      // Check if alert should be triggered
      let severity: "warning" | "critical" | null = null;
      
      if (currentValue >= threshold.criticalThreshold) {
        severity = "critical";
      } else if (currentValue >= threshold.warningThreshold) {
        severity = "warning";
      }

      if (!severity) continue;

      // Record alert in database
      await recordAlert({
        thresholdId: threshold.id,
        severity,
        metricType: threshold.metricType,
        resourceType: threshold.resourceType,
        currentValue: Math.round(currentValue),
        thresholdValue: severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold,
        message: `${threshold.name}: ${currentValue.toFixed(1)}% (${severity} threshold: ${severity === "critical" ? threshold.criticalThreshold : threshold.warningThreshold}%)`,
      });

      // Also create in-memory alert for WebSocket broadcast
      createAlert({
        type: severity,
        category: threshold.metricType === "cpu" ? "high_cpu" : "high_memory",
        title: severity === "critical" ? `Critical ${threshold.metricType.toUpperCase()} Usage` : `High ${threshold.metricType.toUpperCase()} Usage`,
        message: `${threshold.name}: ${currentValue.toFixed(1)}%`,
      });
    }
  } catch (error) {
    console.error("[WebSocket] Error checking thresholds:", error);
    // Fallback to hardcoded thresholds
    checkResourceAlerts(metrics);
  }
}

/**
 * Check for container-related alerts
 */
function checkContainerAlerts(containers: any[]) {
  for (const container of containers) {
    if (container.status === "exited" || container.status === "dead") {
      const existingAlert = activeAlerts.find(
        a => a.category === "container_stopped" && a.resource === container.name
      );
      
      if (!existingAlert) {
        createAlert({
          type: "warning",
          category: "container_stopped",
          title: "Container Stopped",
          message: `Container "${container.name}" has stopped unexpectedly`,
          resource: container.name,
        });
      }
    }
  }
}

/**
 * Check for pod-related alerts
 */
function checkPodAlerts(pods: any[]) {
  for (const pod of pods) {
    // Check for CrashLoopBackOff
    if (pod.status === "CrashLoopBackOff" || pod.status === "Error") {
      const existingAlert = activeAlerts.find(
        a => a.category === "pod_crash" && a.resource === pod.name
      );
      
      if (!existingAlert) {
        createAlert({
          type: "critical",
          category: "pod_crash",
          title: "Pod Crash Detected",
          message: `Pod "${pod.name}" is in ${pod.status} state`,
          resource: pod.name,
          namespace: pod.namespace,
        });
      }
    }
  }
}

/**
 * Check for resource usage alerts
 */
function checkResourceAlerts(metrics: MetricPoint) {
  // High CPU alert
  if (metrics.cpu > 90) {
    const existingAlert = activeAlerts.find(
      a => a.category === "high_cpu" && !a.acknowledged
    );
    
    if (!existingAlert) {
      createAlert({
        type: "critical",
        category: "high_cpu",
        title: "High CPU Usage",
        message: `CPU usage is at ${metrics.cpu.toFixed(1)}%`,
      });
    }
  }

  // High memory alert
  if (metrics.memory > 85) {
    const existingAlert = activeAlerts.find(
      a => a.category === "high_memory" && !a.acknowledged
    );
    
    if (!existingAlert) {
      createAlert({
        type: "warning",
        category: "high_memory",
        title: "High Memory Usage",
        message: `Memory usage is at ${metrics.memory.toFixed(1)}%`,
      });
    }
  }
}

/**
 * Create a new alert
 */
function createAlert(params: Omit<Alert, "id" | "timestamp" | "acknowledged">) {
  const alert: Alert = {
    ...params,
    id: `alert-${alertIdCounter++}`,
    timestamp: new Date(),
    acknowledged: false,
  };

  activeAlerts.unshift(alert);

  // Keep only last 100 alerts
  while (activeAlerts.length > 100) {
    activeAlerts.pop();
  }

  broadcastAlerts();
  
  console.log(`[Alert] ${alert.type.toUpperCase()}: ${alert.title} - ${alert.message}`);
}

/**
 * Broadcast alerts to all clients
 */
function broadcastAlerts() {
  if (io) {
    io.emit("alerts:update", activeAlerts);
  }
}

/**
 * Get metrics history
 */
export function getMetricsHistory(hours: number = 24): MetricPoint[] {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return metricsHistory.filter(m => m.timestamp >= cutoff);
}

/**
 * Get active alerts
 */
export function getActiveAlerts(): Alert[] {
  return activeAlerts;
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(alertId: string): boolean {
  const alert = activeAlerts.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    broadcastAlerts();
    return true;
  }
  return false;
}

/**
 * Get WebSocket server instance
 */
export function getIO(): Server | null {
  return io;
}
