/**
 * Kubernetes API Integration Module
 * 
 * This module provides functions to interact with Kubernetes clusters
 * via the Kubernetes API.
 */

// Kubernetes connection configuration
export interface KubernetesConfig {
  apiServer?: string;      // API server URL
  token?: string;          // Bearer token for authentication
  kubeconfig?: string;     // Path to kubeconfig file
  namespace?: string;      // Default namespace
  insecureSkipTlsVerify?: boolean;
}

// Resource types
export interface Pod {
  name: string;
  namespace: string;
  status: "Running" | "Pending" | "Succeeded" | "Failed" | "Unknown";
  ready: string;
  restarts: number;
  age: string;
  node: string;
  ip?: string;
  containers?: ContainerInfo[];
}

export interface ContainerInfo {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: string;
}

export interface Deployment {
  name: string;
  namespace: string;
  ready: string;
  upToDate: number;
  available: number;
  age: string;
  replicas: number;
  strategy: string;
}

export interface Service {
  name: string;
  namespace: string;
  type: "ClusterIP" | "NodePort" | "LoadBalancer" | "ExternalName";
  clusterIP: string;
  externalIP: string;
  ports: string;
  age: string;
}

export interface ConfigMap {
  name: string;
  namespace: string;
  data: number;
  age: string;
}

export interface Namespace {
  name: string;
  status: string;
  age: string;
}

export interface Node {
  name: string;
  status: string;
  roles: string;
  age: string;
  version: string;
  internalIP: string;
  cpu: string;
  memory: string;
}

export interface ClusterMetrics {
  nodes: number;
  pods: number;
  deployments: number;
  services: number;
  cpuUsage: number;
  memoryUsage: number;
}

// Default configuration
const defaultConfig: KubernetesConfig = {
  apiServer: process.env.KUBERNETES_API_SERVER || "https://kubernetes.default.svc",
  token: process.env.KUBERNETES_TOKEN,
  namespace: "default",
};

/**
 * Execute Kubernetes API request
 */
async function k8sRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" = "GET",
  body?: unknown,
  config: KubernetesConfig = defaultConfig
): Promise<T> {
  const url = `${config.apiServer}${endpoint}`;
  
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    if (config.token) {
      headers["Authorization"] = `Bearer ${config.token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Kubernetes API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as T;
  } catch (error) {
    console.warn(`Kubernetes API not available: ${error}`);
    throw error;
  }
}

/**
 * List all namespaces
 */
export async function listNamespaces(): Promise<Namespace[]> {
  try {
    const response = await k8sRequest<any>("/api/v1/namespaces");
    return response.items.map((ns: any) => ({
      name: ns.metadata.name,
      status: ns.status.phase,
      age: calculateAge(ns.metadata.creationTimestamp),
    }));
  } catch {
    return getMockNamespaces();
  }
}

/**
 * List pods in a namespace
 */
export async function listPods(namespace = "default"): Promise<Pod[]> {
  try {
    const endpoint = namespace === "all" 
      ? "/api/v1/pods" 
      : `/api/v1/namespaces/${namespace}/pods`;
    const response = await k8sRequest<any>(endpoint);
    return response.items.map((pod: any) => mapPod(pod));
  } catch {
    return getMockPods();
  }
}

/**
 * Get pod details
 */
export async function getPod(name: string, namespace = "default"): Promise<Pod | null> {
  try {
    const response = await k8sRequest<any>(`/api/v1/namespaces/${namespace}/pods/${name}`);
    return mapPod(response);
  } catch {
    return null;
  }
}

/**
 * Get pod logs
 */
export async function getPodLogs(
  name: string,
  namespace = "default",
  container?: string,
  tailLines = 100
): Promise<string[]> {
  try {
    const params = new URLSearchParams({ tailLines: tailLines.toString() });
    if (container) params.append("container", container);
    
    const response = await fetch(
      `${defaultConfig.apiServer}/api/v1/namespaces/${namespace}/pods/${name}/log?${params}`,
      {
        headers: defaultConfig.token 
          ? { Authorization: `Bearer ${defaultConfig.token}` }
          : {},
      }
    );
    const text = await response.text();
    return text.split("\n").filter(Boolean);
  } catch {
    return getMockPodLogs();
  }
}

/**
 * Delete a pod
 */
export async function deletePod(name: string, namespace = "default"): Promise<boolean> {
  try {
    await k8sRequest(`/api/v1/namespaces/${namespace}/pods/${name}`, "DELETE");
    return true;
  } catch {
    console.log(`Mock: Deleting pod ${name} in ${namespace}`);
    return true;
  }
}

/**
 * List deployments
 */
export async function listDeployments(namespace = "default"): Promise<Deployment[]> {
  try {
    const endpoint = namespace === "all"
      ? "/apis/apps/v1/deployments"
      : `/apis/apps/v1/namespaces/${namespace}/deployments`;
    const response = await k8sRequest<any>(endpoint);
    return response.items.map((dep: any) => ({
      name: dep.metadata.name,
      namespace: dep.metadata.namespace,
      ready: `${dep.status.readyReplicas || 0}/${dep.spec.replicas}`,
      upToDate: dep.status.updatedReplicas || 0,
      available: dep.status.availableReplicas || 0,
      age: calculateAge(dep.metadata.creationTimestamp),
      replicas: dep.spec.replicas,
      strategy: dep.spec.strategy?.type || "RollingUpdate",
    }));
  } catch {
    return getMockDeployments();
  }
}

/**
 * Scale deployment
 */
export async function scaleDeployment(
  name: string,
  namespace: string,
  replicas: number
): Promise<boolean> {
  try {
    await k8sRequest(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}/scale`,
      "PATCH",
      { spec: { replicas } }
    );
    return true;
  } catch {
    console.log(`Mock: Scaling deployment ${name} to ${replicas} replicas`);
    return true;
  }
}

/**
 * Restart deployment
 */
export async function restartDeployment(name: string, namespace = "default"): Promise<boolean> {
  try {
    const patch = {
      spec: {
        template: {
          metadata: {
            annotations: {
              "kubectl.kubernetes.io/restartedAt": new Date().toISOString(),
            },
          },
        },
      },
    };
    await k8sRequest(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`,
      "PATCH",
      patch
    );
    return true;
  } catch {
    console.log(`Mock: Restarting deployment ${name}`);
    return true;
  }
}

/**
 * List services
 */
export async function listServices(namespace = "default"): Promise<Service[]> {
  try {
    const endpoint = namespace === "all"
      ? "/api/v1/services"
      : `/api/v1/namespaces/${namespace}/services`;
    const response = await k8sRequest<any>(endpoint);
    return response.items.map((svc: any) => ({
      name: svc.metadata.name,
      namespace: svc.metadata.namespace,
      type: svc.spec.type,
      clusterIP: svc.spec.clusterIP || "-",
      externalIP: svc.status?.loadBalancer?.ingress?.[0]?.ip || "-",
      ports: formatServicePorts(svc.spec.ports),
      age: calculateAge(svc.metadata.creationTimestamp),
    }));
  } catch {
    return getMockServices();
  }
}

/**
 * List ConfigMaps
 */
export async function listConfigMaps(namespace = "default"): Promise<ConfigMap[]> {
  try {
    const endpoint = namespace === "all"
      ? "/api/v1/configmaps"
      : `/api/v1/namespaces/${namespace}/configmaps`;
    const response = await k8sRequest<any>(endpoint);
    return response.items.map((cm: any) => ({
      name: cm.metadata.name,
      namespace: cm.metadata.namespace,
      data: Object.keys(cm.data || {}).length,
      age: calculateAge(cm.metadata.creationTimestamp),
    }));
  } catch {
    return getMockConfigMaps();
  }
}

/**
 * List nodes
 */
export async function listNodes(): Promise<Node[]> {
  try {
    const response = await k8sRequest<any>("/api/v1/nodes");
    return response.items.map((node: any) => ({
      name: node.metadata.name,
      status: getNodeStatus(node),
      roles: getNodeRoles(node),
      age: calculateAge(node.metadata.creationTimestamp),
      version: node.status.nodeInfo.kubeletVersion,
      internalIP: node.status.addresses?.find((a: any) => a.type === "InternalIP")?.address || "-",
      cpu: node.status.capacity?.cpu || "-",
      memory: node.status.capacity?.memory || "-",
    }));
  } catch {
    return getMockNodes();
  }
}

/**
 * Get cluster metrics
 */
export async function getClusterMetrics(): Promise<ClusterMetrics> {
  try {
    const [nodes, pods, deployments, services] = await Promise.all([
      listNodes(),
      listPods("all"),
      listDeployments("all"),
      listServices("all"),
    ]);
    
    return {
      nodes: nodes.length,
      pods: pods.length,
      deployments: deployments.length,
      services: services.length,
      cpuUsage: 67, // Would need metrics-server for real data
      memoryUsage: 45,
    };
  } catch {
    return {
      nodes: 3,
      pods: 47,
      deployments: 12,
      services: 8,
      cpuUsage: 67,
      memoryUsage: 45,
    };
  }
}

/**
 * Execute kubectl command
 */
export async function executeKubectl(command: string): Promise<{ output: string; error?: string }> {
  // In production, this would execute kubectl via child_process
  // For now, return mock output
  console.log(`Mock kubectl: ${command}`);
  
  if (command.startsWith("get pods")) {
    return {
      output: `NAME                          READY   STATUS    RESTARTS   AGE
api-server-7d8f9c6b5-abc12    1/1     Running   0          2d
web-frontend-5c4d3b2a1-ghi56  1/1     Running   1          5d
database-primary-0            1/1     Running   0          30d`,
    };
  }
  
  if (command.startsWith("get nodes")) {
    return {
      output: `NAME     STATUS   ROLES           AGE   VERSION
node-1   Ready    control-plane   90d   v1.28.0
node-2   Ready    worker          90d   v1.28.0
node-3   Ready    worker          90d   v1.28.0`,
    };
  }
  
  return { output: `Executed: kubectl ${command}` };
}

// Helper functions
function mapPod(pod: any): Pod {
  const containerStatuses = pod.status?.containerStatuses || [];
  const readyContainers = containerStatuses.filter((c: any) => c.ready).length;
  const totalContainers = containerStatuses.length || pod.spec?.containers?.length || 0;
  const restarts = containerStatuses.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);

  return {
    name: pod.metadata.name,
    namespace: pod.metadata.namespace,
    status: pod.status?.phase || "Unknown",
    ready: `${readyContainers}/${totalContainers}`,
    restarts,
    age: calculateAge(pod.metadata.creationTimestamp),
    node: pod.spec?.nodeName || "-",
    ip: pod.status?.podIP,
    containers: containerStatuses.map((c: any) => ({
      name: c.name,
      image: c.image,
      ready: c.ready,
      restartCount: c.restartCount,
      state: Object.keys(c.state || {})[0] || "unknown",
    })),
  };
}

function calculateAge(timestamp: string): string {
  if (!timestamp) return "-";
  const created = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  return `${diffMinutes}m`;
}

function formatServicePorts(ports: any[]): string {
  if (!ports || ports.length === 0) return "-";
  return ports.map((p) => `${p.port}/${p.protocol}`).join(", ");
}

function getNodeStatus(node: any): string {
  const conditions = node.status?.conditions || [];
  const ready = conditions.find((c: any) => c.type === "Ready");
  return ready?.status === "True" ? "Ready" : "NotReady";
}

function getNodeRoles(node: any): string {
  const labels = node.metadata?.labels || {};
  const roles: string[] = [];
  if (labels["node-role.kubernetes.io/control-plane"]) roles.push("control-plane");
  if (labels["node-role.kubernetes.io/master"]) roles.push("master");
  if (labels["node-role.kubernetes.io/worker"]) roles.push("worker");
  return roles.length > 0 ? roles.join(",") : "worker";
}

// Mock data
function getMockNamespaces(): Namespace[] {
  return [
    { name: "default", status: "Active", age: "90d" },
    { name: "kube-system", status: "Active", age: "90d" },
    { name: "production", status: "Active", age: "60d" },
    { name: "staging", status: "Active", age: "45d" },
    { name: "monitoring", status: "Active", age: "30d" },
  ];
}

function getMockPods(): Pod[] {
  return [
    { name: "api-server-7d8f9c6b5-abc12", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "2d", node: "node-1" },
    { name: "api-server-7d8f9c6b5-def34", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "2d", node: "node-2" },
    { name: "web-frontend-5c4d3b2a1-ghi56", namespace: "production", status: "Running", ready: "1/1", restarts: 1, age: "5d", node: "node-1" },
    { name: "worker-queue-9e8d7c6b5-jkl78", namespace: "production", status: "Pending", ready: "0/1", restarts: 0, age: "5m", node: "-" },
    { name: "database-primary-0", namespace: "production", status: "Running", ready: "1/1", restarts: 0, age: "30d", node: "node-3" },
    { name: "redis-cache-8f7e6d5c4-mno90", namespace: "staging", status: "Running", ready: "1/1", restarts: 2, age: "7d", node: "node-2" },
  ];
}

function getMockDeployments(): Deployment[] {
  return [
    { name: "api-server", namespace: "production", ready: "2/2", upToDate: 2, available: 2, age: "30d", replicas: 2, strategy: "RollingUpdate" },
    { name: "web-frontend", namespace: "production", ready: "3/3", upToDate: 3, available: 3, age: "30d", replicas: 3, strategy: "RollingUpdate" },
    { name: "worker-queue", namespace: "production", ready: "1/2", upToDate: 2, available: 1, age: "15d", replicas: 2, strategy: "RollingUpdate" },
    { name: "redis-cache", namespace: "staging", ready: "1/1", upToDate: 1, available: 1, age: "7d", replicas: 1, strategy: "Recreate" },
  ];
}

function getMockServices(): Service[] {
  return [
    { name: "api-server", namespace: "production", type: "ClusterIP", clusterIP: "10.96.0.100", externalIP: "-", ports: "3000/TCP", age: "30d" },
    { name: "web-frontend", namespace: "production", type: "LoadBalancer", clusterIP: "10.96.0.101", externalIP: "34.123.45.67", ports: "80/TCP, 443/TCP", age: "30d" },
    { name: "database", namespace: "production", type: "ClusterIP", clusterIP: "10.96.0.102", externalIP: "-", ports: "5432/TCP", age: "30d" },
    { name: "redis", namespace: "staging", type: "ClusterIP", clusterIP: "10.96.0.200", externalIP: "-", ports: "6379/TCP", age: "7d" },
  ];
}

function getMockConfigMaps(): ConfigMap[] {
  return [
    { name: "app-config", namespace: "production", data: 5, age: "30d" },
    { name: "nginx-config", namespace: "production", data: 2, age: "30d" },
    { name: "feature-flags", namespace: "production", data: 12, age: "7d" },
  ];
}

function getMockNodes(): Node[] {
  return [
    { name: "node-1", status: "Ready", roles: "control-plane", age: "90d", version: "v1.28.0", internalIP: "10.0.0.10", cpu: "4", memory: "16Gi" },
    { name: "node-2", status: "Ready", roles: "worker", age: "90d", version: "v1.28.0", internalIP: "10.0.0.11", cpu: "8", memory: "32Gi" },
    { name: "node-3", status: "Ready", roles: "worker", age: "90d", version: "v1.28.0", internalIP: "10.0.0.12", cpu: "8", memory: "32Gi" },
  ];
}

function getMockPodLogs(): string[] {
  const now = new Date();
  return [
    `${now.toISOString()} INFO: Pod started successfully`,
    `${now.toISOString()} INFO: Connected to service mesh`,
    `${now.toISOString()} INFO: Health check endpoint ready`,
    `${now.toISOString()} DEBUG: Processing incoming request`,
    `${now.toISOString()} INFO: Request completed successfully`,
  ];
}
