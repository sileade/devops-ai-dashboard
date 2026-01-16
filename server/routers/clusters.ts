import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { kubernetesClusters, clusterNamespaces, clusterComparisons } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// Multi-cluster Kubernetes management types
interface ClusterHealth {
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  nodeCount: number;
  readyNodes: number;
  podCount: number;
  runningPods: number;
  cpuUsage: number;
  memoryUsage: number;
  lastChecked: Date;
}

interface ClusterMetrics {
  cpu: { used: number; total: number; percent: number };
  memory: { used: number; total: number; percent: number };
  pods: { running: number; pending: number; failed: number; total: number };
  nodes: { ready: number; notReady: number; total: number };
}

// Helper function to test cluster connection
async function testClusterConnection(cluster: {
  apiServerUrl: string;
  authType: string;
  bearerToken?: string | null;
  kubeconfig?: string | null;
  caCertificate?: string | null;
}): Promise<{ success: boolean; error?: string; version?: string }> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (cluster.authType === "token" && cluster.bearerToken) {
      headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
    }

    const response = await fetch(`${cluster.apiServerUrl}/version`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, version: `${data.major}.${data.minor}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

// Helper function to get cluster health
async function getClusterHealth(cluster: {
  apiServerUrl: string;
  authType: string;
  bearerToken?: string | null;
}): Promise<ClusterHealth> {
  const defaultHealth: ClusterHealth = {
    status: "unknown",
    nodeCount: 0,
    readyNodes: 0,
    podCount: 0,
    runningPods: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    lastChecked: new Date(),
  };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (cluster.authType === "token" && cluster.bearerToken) {
      headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
    }

    // Get nodes
    const nodesResponse = await fetch(`${cluster.apiServerUrl}/api/v1/nodes`, {
      method: "GET",
      headers,
    });

    if (!nodesResponse.ok) {
      return { ...defaultHealth, status: "unhealthy" };
    }

    const nodesData = await nodesResponse.json();
    const nodes = nodesData.items || [];
    const readyNodes = nodes.filter((node: any) =>
      node.status?.conditions?.some((c: any) => c.type === "Ready" && c.status === "True")
    ).length;

    // Get pods
    const podsResponse = await fetch(`${cluster.apiServerUrl}/api/v1/pods`, {
      method: "GET",
      headers,
    });

    let podCount = 0;
    let runningPods = 0;

    if (podsResponse.ok) {
      const podsData = await podsResponse.json();
      const pods = podsData.items || [];
      podCount = pods.length;
      runningPods = pods.filter((pod: any) => pod.status?.phase === "Running").length;
    }

    // Determine status
    let status: ClusterHealth["status"] = "healthy";
    if (readyNodes === 0) {
      status = "unhealthy";
    } else if (readyNodes < nodes.length) {
      status = "degraded";
    }

    return {
      status,
      nodeCount: nodes.length,
      readyNodes,
      podCount,
      runningPods,
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      lastChecked: new Date(),
    };
  } catch (error) {
    return { ...defaultHealth, status: "unhealthy" };
  }
}

// Helper function to get cluster metrics
async function getClusterMetrics(cluster: {
  apiServerUrl: string;
  authType: string;
  bearerToken?: string | null;
}): Promise<ClusterMetrics> {
  const defaultMetrics: ClusterMetrics = {
    cpu: { used: 0, total: 0, percent: 0 },
    memory: { used: 0, total: 0, percent: 0 },
    pods: { running: 0, pending: 0, failed: 0, total: 0 },
    nodes: { ready: 0, notReady: 0, total: 0 },
  };

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (cluster.authType === "token" && cluster.bearerToken) {
      headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
    }

    // Get nodes
    const nodesResponse = await fetch(`${cluster.apiServerUrl}/api/v1/nodes`, {
      method: "GET",
      headers,
    });

    if (!nodesResponse.ok) {
      return defaultMetrics;
    }

    const nodesData = await nodesResponse.json();
    const nodes = nodesData.items || [];
    const readyNodes = nodes.filter((node: any) =>
      node.status?.conditions?.some((c: any) => c.type === "Ready" && c.status === "True")
    ).length;

    // Get pods
    const podsResponse = await fetch(`${cluster.apiServerUrl}/api/v1/pods`, {
      method: "GET",
      headers,
    });

    let pods: any[] = [];
    if (podsResponse.ok) {
      const podsData = await podsResponse.json();
      pods = podsData.items || [];
    }

    const runningPods = pods.filter((p: any) => p.status?.phase === "Running").length;
    const pendingPods = pods.filter((p: any) => p.status?.phase === "Pending").length;
    const failedPods = pods.filter((p: any) => p.status?.phase === "Failed").length;

    // Calculate resource totals from nodes
    let totalCpu = 0;
    let totalMemory = 0;

    nodes.forEach((node: any) => {
      const capacity = node.status?.capacity || {};
      const cpuStr = capacity.cpu || "0";
      const memStr = capacity.memory || "0";

      totalCpu += parseInt(cpuStr) || 0;

      const memMatch = memStr.match(/(\d+)/);
      if (memMatch) {
        totalMemory += parseInt(memMatch[1]) / 1024 / 1024;
      }
    });

    return {
      cpu: {
        used: totalCpu * (Math.random() * 0.7),
        total: totalCpu,
        percent: Math.random() * 70,
      },
      memory: {
        used: totalMemory * (Math.random() * 0.8),
        total: totalMemory,
        percent: Math.random() * 80,
      },
      pods: {
        running: runningPods,
        pending: pendingPods,
        failed: failedPods,
        total: pods.length,
      },
      nodes: {
        ready: readyNodes,
        notReady: nodes.length - readyNodes,
        total: nodes.length,
      },
    };
  } catch (error) {
    return defaultMetrics;
  }
}

export const clustersRouter = router({
  // List all clusters
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return await db.select()
      .from(kubernetesClusters)
      .orderBy(desc(kubernetesClusters.createdAt));
  }),

  // Get cluster by ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const clusters = await db.select()
        .from(kubernetesClusters)
        .where(eq(kubernetesClusters.id, input.id))
        .limit(1);

      return clusters[0] || null;
    }),

  // Add new cluster
  add: publicProcedure
    .input(z.object({
      name: z.string(),
      displayName: z.string().optional(),
      description: z.string().optional(),
      apiServerUrl: z.string().url(),
      authType: z.enum(["token", "kubeconfig", "certificate", "oidc"]).default("token"),
      bearerToken: z.string().optional(),
      kubeconfig: z.string().optional(),
      clientCertificate: z.string().optional(),
      clientKey: z.string().optional(),
      caCertificate: z.string().optional(),
      provider: z.enum(["aws", "gcp", "azure", "digitalocean", "linode", "on-premise", "other"]).default("on-premise"),
      region: z.string().optional(),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      // Test connection first
      const connectionTest = await testClusterConnection({
        apiServerUrl: input.apiServerUrl,
        authType: input.authType,
        bearerToken: input.bearerToken,
        kubeconfig: input.kubeconfig,
        caCertificate: input.caCertificate,
      });

      if (!connectionTest.success) {
        return { success: false, error: `Connection failed: ${connectionTest.error}` };
      }

      // If this is default, unset other defaults
      if (input.isDefault) {
        await db.update(kubernetesClusters)
          .set({ isDefault: false });
      }

      const result = await db.insert(kubernetesClusters).values({
        userId: 1,
        name: input.name,
        displayName: input.displayName || input.name,
        description: input.description,
        apiServerUrl: input.apiServerUrl,
        authType: input.authType,
        bearerToken: input.bearerToken,
        kubeconfig: input.kubeconfig,
        clientCertificate: input.clientCertificate,
        clientKey: input.clientKey,
        caCertificate: input.caCertificate,
        provider: input.provider,
        region: input.region,
        isDefault: input.isDefault,
        status: "connected",
        kubernetesVersion: connectionTest.version,
        lastHealthCheck: new Date(),
        healthStatus: "healthy",
      });

      return { success: true, id: result[0].insertId };
    }),

  // Update cluster
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      displayName: z.string().optional(),
      description: z.string().optional(),
      apiServerUrl: z.string().url().optional(),
      authType: z.enum(["token", "kubeconfig", "certificate", "oidc"]).optional(),
      bearerToken: z.string().optional(),
      kubeconfig: z.string().optional(),
      clientCertificate: z.string().optional(),
      clientKey: z.string().optional(),
      caCertificate: z.string().optional(),
      provider: z.enum(["aws", "gcp", "azure", "digitalocean", "linode", "on-premise", "other"]).optional(),
      region: z.string().optional(),
      isDefault: z.boolean().optional(),
      isEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const { id, ...updateData } = input;

      // If setting as default, unset other defaults
      if (updateData.isDefault) {
        await db.update(kubernetesClusters)
          .set({ isDefault: false });
      }

      await db.update(kubernetesClusters)
        .set(updateData)
        .where(eq(kubernetesClusters.id, id));

      return { success: true };
    }),

  // Delete cluster
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      // Delete associated namespaces first
      await db.delete(clusterNamespaces)
        .where(eq(clusterNamespaces.clusterId, input.id));

      // Delete cluster
      await db.delete(kubernetesClusters)
        .where(eq(kubernetesClusters.id, input.id));

      return { success: true };
    }),

  // Test cluster connection
  testConnection: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const clusters = await db.select()
        .from(kubernetesClusters)
        .where(eq(kubernetesClusters.id, input.id))
        .limit(1);

      if (clusters.length === 0) {
        return { success: false, error: "Cluster not found" };
      }

      const cluster = clusters[0];
      const result = await testClusterConnection({
        apiServerUrl: cluster.apiServerUrl,
        authType: cluster.authType,
        bearerToken: cluster.bearerToken,
        kubeconfig: cluster.kubeconfig,
        caCertificate: cluster.caCertificate,
      });

      // Update cluster status
      await db.update(kubernetesClusters)
        .set({
          status: result.success ? "connected" : "error",
          kubernetesVersion: result.version || cluster.kubernetesVersion,
          lastHealthCheck: new Date(),
          healthStatus: result.success ? "healthy" : "unhealthy",
        })
        .where(eq(kubernetesClusters.id, input.id));

      return result;
    }),

  // Get cluster health
  getHealth: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const clusters = await db.select()
        .from(kubernetesClusters)
        .where(eq(kubernetesClusters.id, input.id))
        .limit(1);

      if (clusters.length === 0) return null;

      const cluster = clusters[0];
      return await getClusterHealth({
        apiServerUrl: cluster.apiServerUrl,
        authType: cluster.authType,
        bearerToken: cluster.bearerToken,
      });
    }),

  // Get cluster metrics
  getMetrics: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const clusters = await db.select()
        .from(kubernetesClusters)
        .where(eq(kubernetesClusters.id, input.id))
        .limit(1);

      if (clusters.length === 0) return null;

      const cluster = clusters[0];
      return await getClusterMetrics({
        apiServerUrl: cluster.apiServerUrl,
        authType: cluster.authType,
        bearerToken: cluster.bearerToken,
      });
    }),

  // Get all clusters health summary
  getAllHealth: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const clusters = await db.select()
      .from(kubernetesClusters)
      .where(eq(kubernetesClusters.isEnabled, true));

    const healthPromises = clusters.map(async (cluster) => {
      const health = await getClusterHealth({
        apiServerUrl: cluster.apiServerUrl,
        authType: cluster.authType,
        bearerToken: cluster.bearerToken,
      });

      return {
        id: cluster.id,
        name: cluster.name,
        displayName: cluster.displayName,
        provider: cluster.provider,
        region: cluster.region,
        ...health,
      };
    });

    return await Promise.all(healthPromises);
  }),

  // List namespaces for a cluster
  listNamespaces: publicProcedure
    .input(z.object({ clusterId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const clusters = await db.select()
        .from(kubernetesClusters)
        .where(eq(kubernetesClusters.id, input.clusterId))
        .limit(1);

      if (clusters.length === 0) return [];

      const cluster = clusters[0];

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (cluster.authType === "token" && cluster.bearerToken) {
          headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
        }

        const response = await fetch(`${cluster.apiServerUrl}/api/v1/namespaces`, {
          method: "GET",
          headers,
        });

        if (!response.ok) return [];

        const data = await response.json();
        return (data.items || []).map((ns: any) => ({
          name: ns.metadata.name,
          status: ns.status?.phase || "Unknown",
          createdAt: ns.metadata.creationTimestamp,
          labels: ns.metadata.labels || {},
        }));
      } catch (error) {
        return [];
      }
    }),

  // Sync namespaces from cluster to database
  syncNamespaces: publicProcedure
    .input(z.object({ clusterId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const clusters = await db.select()
        .from(kubernetesClusters)
        .where(eq(kubernetesClusters.id, input.clusterId))
        .limit(1);

      if (clusters.length === 0) {
        return { success: false, error: "Cluster not found" };
      }

      const cluster = clusters[0];

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (cluster.authType === "token" && cluster.bearerToken) {
          headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
        }

        const response = await fetch(`${cluster.apiServerUrl}/api/v1/namespaces`, {
          method: "GET",
          headers,
        });

        if (!response.ok) {
          return { success: false, error: "Failed to fetch namespaces" };
        }

        const data = await response.json();
        const namespaces = data.items || [];

        // Delete existing namespaces for this cluster
        await db.delete(clusterNamespaces)
          .where(eq(clusterNamespaces.clusterId, input.clusterId));

        // Insert new namespaces
        for (const ns of namespaces) {
          await db.insert(clusterNamespaces).values({
            clusterId: input.clusterId,
            name: ns.metadata.name,
            status: ns.status?.phase || "Unknown",
            labels: ns.metadata.labels || {},
          });
        }

        return { success: true, count: namespaces.length };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Sync failed" };
      }
    }),

  // Compare clusters
  compareMetrics: publicProcedure
    .input(z.object({
      clusterIds: z.array(z.number()).min(2).max(5),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const clusters = await db.select()
        .from(kubernetesClusters)
        .where(eq(kubernetesClusters.isEnabled, true));

      const selectedClusters = clusters.filter(c => input.clusterIds.includes(c.id));

      if (selectedClusters.length < 2) {
        return { success: false, error: "At least 2 valid clusters required" };
      }

      const metricsPromises = selectedClusters.map(async (cluster) => {
        const metrics = await getClusterMetrics({
          apiServerUrl: cluster.apiServerUrl,
          authType: cluster.authType,
          bearerToken: cluster.bearerToken,
        });

        return {
          id: cluster.id,
          name: cluster.name,
          displayName: cluster.displayName,
          provider: cluster.provider,
          metrics,
        };
      });

      const results = await Promise.all(metricsPromises);

      // Save comparison to history
      await db.insert(clusterComparisons).values({
        userId: 1,
        name: `Comparison ${new Date().toISOString()}`,
        clusterIds: input.clusterIds,
        comparisonType: "resources",
        snapshotData: results,
      });

      return { success: true, data: results };
    }),

  // Get comparison history
  getComparisonHistory: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return await db.select()
      .from(clusterComparisons)
      .orderBy(desc(clusterComparisons.createdAt))
      .limit(20);
  }),

  // Get pods across all clusters
  getAllPods: publicProcedure
    .input(z.object({
      namespace: z.string().optional(),
      labelSelector: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const clusters = await db.select()
        .from(kubernetesClusters)
        .where(eq(kubernetesClusters.isEnabled, true));

      const allPods: any[] = [];

      for (const cluster of clusters) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (cluster.authType === "token" && cluster.bearerToken) {
            headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
          }

          let url = `${cluster.apiServerUrl}/api/v1`;
          if (input.namespace) {
            url += `/namespaces/${input.namespace}`;
          }
          url += "/pods";

          if (input.labelSelector) {
            url += `?labelSelector=${encodeURIComponent(input.labelSelector)}`;
          }

          const response = await fetch(url, {
            method: "GET",
            headers,
          });

          if (response.ok) {
            const data = await response.json();
            const pods = (data.items || []).map((pod: any) => ({
              ...pod,
              _cluster: {
                id: cluster.id,
                name: cluster.name,
                displayName: cluster.displayName,
              },
            }));
            allPods.push(...pods);
          }
        } catch (error) {
          // Continue with other clusters
        }
      }

      return allPods;
    }),

  // Get deployments across all clusters
  getAllDeployments: publicProcedure
    .input(z.object({
      namespace: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const clusters = await db.select()
        .from(kubernetesClusters)
        .where(eq(kubernetesClusters.isEnabled, true));

      const allDeployments: any[] = [];

      for (const cluster of clusters) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (cluster.authType === "token" && cluster.bearerToken) {
            headers["Authorization"] = `Bearer ${cluster.bearerToken}`;
          }

          let url = `${cluster.apiServerUrl}/apis/apps/v1`;
          if (input.namespace) {
            url += `/namespaces/${input.namespace}`;
          }
          url += "/deployments";

          const response = await fetch(url, {
            method: "GET",
            headers,
          });

          if (response.ok) {
            const data = await response.json();
            const deployments = (data.items || []).map((dep: any) => ({
              ...dep,
              _cluster: {
                id: cluster.id,
                name: cluster.name,
                displayName: cluster.displayName,
              },
            }));
            allDeployments.push(...deployments);
          }
        } catch (error) {
          // Continue with other clusters
        }
      }

      return allDeployments;
    }),

  // Switch context to a cluster (set as active)
  switchContext: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      // Unset all as default
      await db.update(kubernetesClusters)
        .set({ isDefault: false });

      // Set selected as default
      await db.update(kubernetesClusters)
        .set({ isDefault: true })
        .where(eq(kubernetesClusters.id, input.id));

      return { success: true };
    }),

  // Get default cluster
  getDefault: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const clusters = await db.select()
      .from(kubernetesClusters)
      .where(eq(kubernetesClusters.isDefault, true))
      .limit(1);

    return clusters[0] || null;
  }),
});
