/**
 * ArgoCD GitOps Integration Service
 * 
 * Provides integration with ArgoCD for GitOps workflows including
 * application sync, rollback, and status monitoring.
 */

import { z } from 'zod';

// ArgoCD Application Schemas
export const ArgoCDHealthStatusSchema = z.enum([
  'Healthy',
  'Progressing',
  'Degraded',
  'Suspended',
  'Missing',
  'Unknown',
]);

export const ArgoCDSyncStatusSchema = z.enum([
  'Synced',
  'OutOfSync',
  'Unknown',
]);

export const ArgoCDOperationPhaseSchema = z.enum([
  'Running',
  'Succeeded',
  'Failed',
  'Error',
  'Terminating',
]);

export const ArgoCDResourceSchema = z.object({
  group: z.string().optional(),
  version: z.string(),
  kind: z.string(),
  namespace: z.string().optional(),
  name: z.string(),
  status: ArgoCDSyncStatusSchema.optional(),
  health: z.object({
    status: ArgoCDHealthStatusSchema.optional(),
    message: z.string().optional(),
  }).optional(),
  hook: z.boolean().optional(),
  requiresPruning: z.boolean().optional(),
});

export const ArgoCDApplicationSchema = z.object({
  metadata: z.object({
    name: z.string(),
    namespace: z.string(),
    uid: z.string().optional(),
    creationTimestamp: z.string().optional(),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
  }),
  spec: z.object({
    project: z.string(),
    source: z.object({
      repoURL: z.string(),
      path: z.string().optional(),
      targetRevision: z.string(),
      helm: z.object({
        valueFiles: z.array(z.string()).optional(),
        values: z.string().optional(),
      }).optional(),
      kustomize: z.object({
        namePrefix: z.string().optional(),
        nameSuffix: z.string().optional(),
      }).optional(),
    }),
    destination: z.object({
      server: z.string(),
      namespace: z.string(),
    }),
    syncPolicy: z.object({
      automated: z.object({
        prune: z.boolean().optional(),
        selfHeal: z.boolean().optional(),
        allowEmpty: z.boolean().optional(),
      }).optional(),
      syncOptions: z.array(z.string()).optional(),
    }).optional(),
  }),
  status: z.object({
    sync: z.object({
      status: ArgoCDSyncStatusSchema,
      comparedTo: z.object({
        source: z.object({
          repoURL: z.string(),
          path: z.string().optional(),
          targetRevision: z.string(),
        }),
        destination: z.object({
          server: z.string(),
          namespace: z.string(),
        }),
      }).optional(),
      revision: z.string().optional(),
    }).optional(),
    health: z.object({
      status: ArgoCDHealthStatusSchema,
      message: z.string().optional(),
    }).optional(),
    operationState: z.object({
      operation: z.object({
        sync: z.object({
          revision: z.string().optional(),
          prune: z.boolean().optional(),
        }).optional(),
      }).optional(),
      phase: ArgoCDOperationPhaseSchema.optional(),
      message: z.string().optional(),
      startedAt: z.string().optional(),
      finishedAt: z.string().optional(),
    }).optional(),
    resources: z.array(ArgoCDResourceSchema).optional(),
    summary: z.object({
      images: z.array(z.string()).optional(),
    }).optional(),
    history: z.array(z.object({
      revision: z.string(),
      deployedAt: z.string(),
      id: z.number(),
      source: z.object({
        repoURL: z.string(),
        path: z.string().optional(),
        targetRevision: z.string(),
      }).optional(),
    })).optional(),
  }).optional(),
});

export type ArgoCDApplication = z.infer<typeof ArgoCDApplicationSchema>;
export type ArgoCDResource = z.infer<typeof ArgoCDResourceSchema>;
export type ArgoCDHealthStatus = z.infer<typeof ArgoCDHealthStatusSchema>;
export type ArgoCDSyncStatus = z.infer<typeof ArgoCDSyncStatusSchema>;

// ArgoCD API Client Configuration
export interface ArgoCDConfig {
  serverUrl: string;
  token: string;
  insecure?: boolean;
}

// ArgoCD API Response Types
export interface ArgoCDListResponse {
  items: ArgoCDApplication[];
  metadata: {
    resourceVersion?: string;
  };
}

export interface ArgoCDSyncResult {
  success: boolean;
  message: string;
  revision?: string;
  resources?: ArgoCDResource[];
}

export interface ArgoCDRollbackResult {
  success: boolean;
  message: string;
  targetRevision?: string;
}

/**
 * ArgoCD API Client
 */
export class ArgoCDClient {
  private config: ArgoCDConfig;

  constructor(config: ArgoCDConfig) {
    this.config = config;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.config.serverUrl}/api/v1${path}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ArgoCD API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * List all applications
   */
  async listApplications(project?: string): Promise<ArgoCDApplication[]> {
    const params = project ? `?project=${encodeURIComponent(project)}` : '';
    const response = await this.request<ArgoCDListResponse>(
      'GET',
      `/applications${params}`
    );
    return response.items;
  }

  /**
   * Get application details
   */
  async getApplication(name: string): Promise<ArgoCDApplication> {
    return this.request<ArgoCDApplication>('GET', `/applications/${name}`);
  }

  /**
   * Sync application
   */
  async syncApplication(
    name: string,
    options?: {
      revision?: string;
      prune?: boolean;
      dryRun?: boolean;
      resources?: Array<{ group: string; kind: string; name: string }>;
    }
  ): Promise<ArgoCDSyncResult> {
    try {
      await this.request('POST', `/applications/${name}/sync`, {
        revision: options?.revision,
        prune: options?.prune ?? true,
        dryRun: options?.dryRun ?? false,
        resources: options?.resources,
      });

      return {
        success: true,
        message: `Application ${name} sync initiated`,
        revision: options?.revision,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }

  /**
   * Rollback application to previous revision
   */
  async rollbackApplication(
    name: string,
    revisionId: number
  ): Promise<ArgoCDRollbackResult> {
    try {
      await this.request('POST', `/applications/${name}/rollback`, {
        id: revisionId,
      });

      return {
        success: true,
        message: `Application ${name} rollback to revision ${revisionId} initiated`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Rollback failed',
      };
    }
  }

  /**
   * Refresh application (fetch latest from Git)
   */
  async refreshApplication(name: string): Promise<ArgoCDApplication> {
    return this.request<ArgoCDApplication>(
      'GET',
      `/applications/${name}?refresh=normal`
    );
  }

  /**
   * Delete application
   */
  async deleteApplication(
    name: string,
    cascade?: boolean
  ): Promise<{ success: boolean; message: string }> {
    try {
      const params = cascade !== undefined ? `?cascade=${cascade}` : '';
      await this.request('DELETE', `/applications/${name}${params}`);
      return {
        success: true,
        message: `Application ${name} deleted`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Delete failed',
      };
    }
  }

  /**
   * Get application resource tree
   */
  async getResourceTree(name: string): Promise<{
    nodes: Array<{
      resourceRef: ArgoCDResource;
      parentRefs?: Array<{ group: string; kind: string; name: string }>;
      health?: { status: string; message?: string };
    }>;
  }> {
    return this.request('GET', `/applications/${name}/resource-tree`);
  }

  /**
   * Get application logs
   */
  async getLogs(
    name: string,
    options: {
      namespace: string;
      podName: string;
      container?: string;
      tailLines?: number;
    }
  ): Promise<string> {
    const params = new URLSearchParams({
      namespace: options.namespace,
      podName: options.podName,
      ...(options.container && { container: options.container }),
      ...(options.tailLines && { tailLines: options.tailLines.toString() }),
    });

    const response = await fetch(
      `${this.config.serverUrl}/api/v1/applications/${name}/logs?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
        },
      }
    );

    return response.text();
  }
}

/**
 * Get health status color
 */
export function getHealthStatusColor(status: ArgoCDHealthStatus): string {
  const colors: Record<ArgoCDHealthStatus, string> = {
    Healthy: '#10B981',
    Progressing: '#3B82F6',
    Degraded: '#EF4444',
    Suspended: '#F59E0B',
    Missing: '#6B7280',
    Unknown: '#6B7280',
  };
  return colors[status];
}

/**
 * Get sync status color
 */
export function getSyncStatusColor(status: ArgoCDSyncStatus): string {
  const colors: Record<ArgoCDSyncStatus, string> = {
    Synced: '#10B981',
    OutOfSync: '#F59E0B',
    Unknown: '#6B7280',
  };
  return colors[status];
}

/**
 * Mock ArgoCD applications for demo/testing
 */
export function getMockArgoCDApplications(): ArgoCDApplication[] {
  return [
    {
      metadata: {
        name: 'frontend-app',
        namespace: 'argocd',
        uid: 'app-1',
        creationTimestamp: '2024-01-10T10:00:00Z',
        labels: { team: 'frontend', env: 'production' },
      },
      spec: {
        project: 'default',
        source: {
          repoURL: 'https://github.com/org/frontend-app',
          path: 'k8s/overlays/production',
          targetRevision: 'main',
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'frontend',
        },
        syncPolicy: {
          automated: { prune: true, selfHeal: true },
          syncOptions: ['CreateNamespace=true'],
        },
      },
      status: {
        sync: {
          status: 'Synced',
          revision: 'abc123def456',
        },
        health: {
          status: 'Healthy',
        },
        resources: [
          { version: 'v1', kind: 'Deployment', name: 'frontend', namespace: 'frontend', status: 'Synced', health: { status: 'Healthy' } },
          { version: 'v1', kind: 'Service', name: 'frontend-svc', namespace: 'frontend', status: 'Synced', health: { status: 'Healthy' } },
          { version: 'v1', kind: 'ConfigMap', name: 'frontend-config', namespace: 'frontend', status: 'Synced' },
        ],
        history: [
          { revision: 'abc123def456', deployedAt: '2024-01-15T14:30:00Z', id: 3 },
          { revision: '789ghi012jkl', deployedAt: '2024-01-14T10:00:00Z', id: 2 },
          { revision: 'mno345pqr678', deployedAt: '2024-01-12T16:45:00Z', id: 1 },
        ],
      },
    },
    {
      metadata: {
        name: 'backend-api',
        namespace: 'argocd',
        uid: 'app-2',
        creationTimestamp: '2024-01-08T09:00:00Z',
        labels: { team: 'backend', env: 'production' },
      },
      spec: {
        project: 'default',
        source: {
          repoURL: 'https://github.com/org/backend-api',
          path: 'charts/api',
          targetRevision: 'v2.1.0',
          helm: {
            valueFiles: ['values-prod.yaml'],
          },
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'backend',
        },
        syncPolicy: {
          automated: { prune: true, selfHeal: true },
        },
      },
      status: {
        sync: {
          status: 'OutOfSync',
          revision: 'def456ghi789',
        },
        health: {
          status: 'Progressing',
          message: 'Waiting for rollout to finish',
        },
        operationState: {
          operation: { sync: { revision: 'new-commit-hash' } },
          phase: 'Running',
          message: 'Syncing resources',
          startedAt: '2024-01-16T08:00:00Z',
        },
        resources: [
          { version: 'v1', kind: 'Deployment', name: 'api', namespace: 'backend', status: 'OutOfSync', health: { status: 'Progressing' } },
          { version: 'v1', kind: 'Service', name: 'api-svc', namespace: 'backend', status: 'Synced', health: { status: 'Healthy' } },
          { version: 'v1', kind: 'Secret', name: 'api-secrets', namespace: 'backend', status: 'Synced' },
        ],
        history: [
          { revision: 'def456ghi789', deployedAt: '2024-01-15T12:00:00Z', id: 5 },
          { revision: 'stu901vwx234', deployedAt: '2024-01-13T08:30:00Z', id: 4 },
        ],
      },
    },
    {
      metadata: {
        name: 'database-operator',
        namespace: 'argocd',
        uid: 'app-3',
        creationTimestamp: '2024-01-05T11:00:00Z',
        labels: { team: 'platform', env: 'production' },
      },
      spec: {
        project: 'infrastructure',
        source: {
          repoURL: 'https://github.com/org/infra-manifests',
          path: 'operators/postgres',
          targetRevision: 'main',
        },
        destination: {
          server: 'https://kubernetes.default.svc',
          namespace: 'operators',
        },
      },
      status: {
        sync: {
          status: 'Synced',
          revision: 'xyz789abc012',
        },
        health: {
          status: 'Degraded',
          message: 'Pod postgres-operator-0 is in CrashLoopBackOff',
        },
        resources: [
          { version: 'v1', kind: 'Deployment', name: 'postgres-operator', namespace: 'operators', status: 'Synced', health: { status: 'Degraded', message: 'CrashLoopBackOff' } },
          { version: 'v1', kind: 'ServiceAccount', name: 'postgres-operator', namespace: 'operators', status: 'Synced' },
        ],
        history: [
          { revision: 'xyz789abc012', deployedAt: '2024-01-14T16:00:00Z', id: 2 },
        ],
      },
    },
  ];
}

export default {
  ArgoCDClient,
  getHealthStatusColor,
  getSyncStatusColor,
  getMockArgoCDApplications,
};
