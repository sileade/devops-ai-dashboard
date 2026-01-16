// Prometheus/Grafana Integration Service

interface PrometheusQueryResult {
  status: "success" | "error";
  data: {
    resultType: "matrix" | "vector" | "scalar" | "string";
    result: Array<{
      metric: Record<string, string>;
      values?: Array<[number, string]>;
      value?: [number, string];
    }>;
  };
  error?: string;
  errorType?: string;
}

interface PrometheusConfig {
  url: string;
  username?: string;
  password?: string;
}

interface GrafanaConfig {
  url: string;
  apiKey: string;
}

let prometheusConfig: PrometheusConfig | null = null;
let grafanaConfig: GrafanaConfig | null = null;

export function configurePrometheus(config: PrometheusConfig) {
  prometheusConfig = config;
}

export function configureGrafana(config: GrafanaConfig) {
  grafanaConfig = config;
}

// Test Prometheus connection
export async function testPrometheusConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
  if (!prometheusConfig) {
    return { success: false, error: "Prometheus not configured" };
  }

  try {
    const headers: Record<string, string> = {};
    if (prometheusConfig.username && prometheusConfig.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${prometheusConfig.username}:${prometheusConfig.password}`).toString("base64")}`;
    }

    const response = await fetch(`${prometheusConfig.url}/api/v1/status/buildinfo`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return { 
      success: true, 
      version: data.data?.version || "unknown" 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Connection failed" 
    };
  }
}

// Execute PromQL query
export async function queryPrometheus(
  query: string,
  time?: Date
): Promise<{ success: boolean; data?: PrometheusQueryResult["data"]; error?: string }> {
  if (!prometheusConfig) {
    return { success: false, error: "Prometheus not configured" };
  }

  try {
    const headers: Record<string, string> = {};
    if (prometheusConfig.username && prometheusConfig.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${prometheusConfig.username}:${prometheusConfig.password}`).toString("base64")}`;
    }

    const params = new URLSearchParams({ query });
    if (time) {
      params.append("time", (time.getTime() / 1000).toString());
    }

    const response = await fetch(`${prometheusConfig.url}/api/v1/query?${params}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const result: PrometheusQueryResult = await response.json();
    
    if (result.status === "error") {
      return { success: false, error: result.error || "Query failed" };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Query failed" 
    };
  }
}

// Execute PromQL range query
export async function queryPrometheusRange(
  query: string,
  start: Date,
  end: Date,
  step: string = "15s"
): Promise<{ success: boolean; data?: PrometheusQueryResult["data"]; error?: string }> {
  if (!prometheusConfig) {
    return { success: false, error: "Prometheus not configured" };
  }

  try {
    const headers: Record<string, string> = {};
    if (prometheusConfig.username && prometheusConfig.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${prometheusConfig.username}:${prometheusConfig.password}`).toString("base64")}`;
    }

    const params = new URLSearchParams({
      query,
      start: (start.getTime() / 1000).toString(),
      end: (end.getTime() / 1000).toString(),
      step,
    });

    const response = await fetch(`${prometheusConfig.url}/api/v1/query_range?${params}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const result: PrometheusQueryResult = await response.json();
    
    if (result.status === "error") {
      return { success: false, error: result.error || "Query failed" };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Query failed" 
    };
  }
}

// Get available metrics
export async function getPrometheusMetrics(): Promise<{ success: boolean; metrics?: string[]; error?: string }> {
  if (!prometheusConfig) {
    return { success: false, error: "Prometheus not configured" };
  }

  try {
    const headers: Record<string, string> = {};
    if (prometheusConfig.username && prometheusConfig.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${prometheusConfig.username}:${prometheusConfig.password}`).toString("base64")}`;
    }

    const response = await fetch(`${prometheusConfig.url}/api/v1/label/__name__/values`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const result = await response.json();
    return { success: true, metrics: result.data || [] };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get metrics" 
    };
  }
}

// Test Grafana connection
export async function testGrafanaConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
  if (!grafanaConfig) {
    return { success: false, error: "Grafana not configured" };
  }

  try {
    const response = await fetch(`${grafanaConfig.url}/api/health`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${grafanaConfig.apiKey}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return { 
      success: true, 
      version: data.version || "unknown" 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Connection failed" 
    };
  }
}

// Get Grafana dashboards
export async function getGrafanaDashboards(): Promise<{ 
  success: boolean; 
  dashboards?: Array<{ uid: string; title: string; url: string; tags: string[] }>; 
  error?: string 
}> {
  if (!grafanaConfig) {
    return { success: false, error: "Grafana not configured" };
  }

  try {
    const response = await fetch(`${grafanaConfig.url}/api/search?type=dash-db`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${grafanaConfig.apiKey}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    const dashboards = data.map((d: { uid: string; title: string; url: string; tags: string[] }) => ({
      uid: d.uid,
      title: d.title,
      url: `${grafanaConfig!.url}${d.url}`,
      tags: d.tags || [],
    }));

    return { success: true, dashboards };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to get dashboards" 
    };
  }
}

// Get dashboard embed URL
export function getGrafanaEmbedUrl(dashboardUid: string, panelId?: number, from?: string, to?: string): string | null {
  if (!grafanaConfig) return null;

  let url = `${grafanaConfig.url}/d-solo/${dashboardUid}`;
  const params = new URLSearchParams();
  
  if (panelId) params.append("panelId", panelId.toString());
  if (from) params.append("from", from);
  if (to) params.append("to", to);
  params.append("theme", "dark");

  return `${url}?${params}`;
}

// Common Prometheus queries for DevOps metrics
export const commonQueries = {
  // CPU metrics
  cpuUsage: 'sum(rate(container_cpu_usage_seconds_total[5m])) by (pod) * 100',
  cpuUsageByNode: 'sum(rate(node_cpu_seconds_total{mode!="idle"}[5m])) by (instance) * 100',
  
  // Memory metrics
  memoryUsage: 'sum(container_memory_usage_bytes) by (pod) / sum(container_spec_memory_limit_bytes) by (pod) * 100',
  memoryUsageByNode: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
  
  // Network metrics
  networkReceive: 'sum(rate(container_network_receive_bytes_total[5m])) by (pod)',
  networkTransmit: 'sum(rate(container_network_transmit_bytes_total[5m])) by (pod)',
  
  // Kubernetes metrics
  podRestarts: 'sum(kube_pod_container_status_restarts_total) by (pod)',
  podStatus: 'kube_pod_status_phase',
  deploymentReplicas: 'kube_deployment_status_replicas',
  deploymentAvailable: 'kube_deployment_status_replicas_available',
  
  // Container metrics
  containerRunning: 'sum(kube_pod_container_status_running)',
  containerWaiting: 'sum(kube_pod_container_status_waiting)',
  containerTerminated: 'sum(kube_pod_container_status_terminated)',
  
  // Disk metrics
  diskUsage: '(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100',
  
  // HTTP metrics (if using service mesh or ingress)
  httpRequestRate: 'sum(rate(http_requests_total[5m])) by (service)',
  httpErrorRate: 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100',
  httpLatency: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))',
};

// Parse Prometheus response to simple format
export function parsePrometheusResult(data: PrometheusQueryResult["data"]): Array<{
  labels: Record<string, string>;
  value: number;
  timestamp: number;
}> {
  if (!data || !data.result) return [];

  return data.result.map(item => {
    if (item.value) {
      return {
        labels: item.metric,
        timestamp: item.value[0] * 1000,
        value: parseFloat(item.value[1]),
      };
    }
    if (item.values && item.values.length > 0) {
      const lastValue = item.values[item.values.length - 1];
      return {
        labels: item.metric,
        timestamp: lastValue[0] * 1000,
        value: parseFloat(lastValue[1]),
      };
    }
    return {
      labels: item.metric,
      timestamp: Date.now(),
      value: 0,
    };
  });
}

// Parse range query to time series format
export function parsePrometheusRangeResult(data: PrometheusQueryResult["data"]): Array<{
  labels: Record<string, string>;
  values: Array<{ timestamp: number; value: number }>;
}> {
  if (!data || !data.result) return [];

  return data.result.map(item => ({
    labels: item.metric,
    values: (item.values || []).map(([ts, val]) => ({
      timestamp: ts * 1000,
      value: parseFloat(val),
    })),
  }));
}
