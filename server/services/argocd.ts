/**
 * ArgoCD Integration Service
 * 
 * Provides full GitOps workflow integration with ArgoCD:
 * - Application management (list, create, sync, delete)
 * - Automatic sync on git push
 * - Health monitoring and status tracking
 * - Rollback capabilities
 */

import { getDb } from '../db';
import { invokeLLM } from '../_core/llm';

// ArgoCD Configuration
interface ArgoCDConfig {
  serverUrl: string;
  token: string;
  insecure?: boolean;
}

// ArgoCD Application
interface ArgoCDApplication {
  metadata: {
    name: string;
    namespace: string;
    uid?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec: {
    project: string;
    source: {
      repoURL: string;
      path: string;
      targetRevision: string;
      helm?: {
        valueFiles?: string[];
        values?: string;
        parameters?: Array<{ name: string; value: string }>;
      };
      kustomize?: {
        images?: string[];
      };
    };
    destination: {
      server: string;
      namespace: string;
    };
    syncPolicy?: {
      automated?: {
        prune?: boolean;
        selfHeal?: boolean;
        allowEmpty?: boolean;
      };
      syncOptions?: string[];
      retry?: {
        limit?: number;
        backoff?: {
          duration?: string;
          factor?: number;
          maxDuration?: string;
        };
      };
    };
  };
  status?: {
    sync: {
      status: 'Synced' | 'OutOfSync' | 'Unknown';
      revision?: string;
      comparedTo?: {
        source: {
          repoURL: string;
          path: string;
          targetRevision: string;
        };
        destination: {
          server: string;
          namespace: string;
        };
      };
    };
    health: {
      status: 'Healthy' | 'Progressing' | 'Degraded' | 'Suspended' | 'Missing' | 'Unknown';
      message?: string;
    };
    operationState?: {
      operation: {
        sync?: {
          revision: string;
          prune?: boolean;
        };
      };
      phase: 'Running' | 'Succeeded' | 'Failed' | 'Error' | 'Terminating';
      message?: string;
      startedAt?: string;
      finishedAt?: string;
    };
    resources?: Array<{
      group: string;
      version: string;
      kind: string;
      namespace: string;
      name: string;
      status: string;
      health?: {
        status: string;
        message?: string;
      };
    }>;
    history?: Array<{
      revision: string;
      deployedAt: string;
      id: number;
      source: {
        repoURL: string;
        path: string;
        targetRevision: string;
      };
    }>;
  };
}

// Sync Result
interface SyncResult {
  success: boolean;
  application?: ArgoCDApplication;
  message?: string;
  error?: string;
}

// ArgoCD Service Class
export class ArgoCDService {
  private config: ArgoCDConfig | null = null;

  /**
   * Initialize ArgoCD service with configuration
   */
  async initialize(config: ArgoCDConfig): Promise<boolean> {
    this.config = config;
    
    try {
      // Test connection
      const response = await this.makeRequest('/api/v1/applications', 'GET');
      return response.ok;
    } catch (error) {
      console.error('Failed to initialize ArgoCD service:', error);
      return false;
    }
  }

  /**
   * Make authenticated request to ArgoCD API
   */
  private async makeRequest(
    endpoint: string,
    method: string = 'GET',
    body?: unknown
  ): Promise<Response> {
    if (!this.config) {
      throw new Error('ArgoCD service not initialized');
    }

    const url = `${this.config.serverUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }

  /**
   * List all applications
   */
  async listApplications(project?: string): Promise<ArgoCDApplication[]> {
    try {
      let endpoint = '/api/v1/applications';
      if (project) {
        endpoint += `?project=${encodeURIComponent(project)}`;
      }

      const response = await this.makeRequest(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to list applications: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error listing ArgoCD applications:', error);
      return [];
    }
  }

  /**
   * Get application details
   */
  async getApplication(name: string): Promise<ArgoCDApplication | null> {
    try {
      const response = await this.makeRequest(`/api/v1/applications/${encodeURIComponent(name)}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get application: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting ArgoCD application:', error);
      return null;
    }
  }

  /**
   * Create new application
   */
  async createApplication(app: Partial<ArgoCDApplication>): Promise<ArgoCDApplication | null> {
    try {
      const response = await this.makeRequest('/api/v1/applications', 'POST', app);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create application: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating ArgoCD application:', error);
      return null;
    }
  }

  /**
   * Update application
   */
  async updateApplication(name: string, app: Partial<ArgoCDApplication>): Promise<ArgoCDApplication | null> {
    try {
      const response = await this.makeRequest(
        `/api/v1/applications/${encodeURIComponent(name)}`,
        'PUT',
        app
      );
      if (!response.ok) {
        throw new Error(`Failed to update application: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating ArgoCD application:', error);
      return null;
    }
  }

  /**
   * Delete application
   */
  async deleteApplication(name: string, cascade: boolean = true): Promise<boolean> {
    try {
      const endpoint = `/api/v1/applications/${encodeURIComponent(name)}?cascade=${cascade}`;
      const response = await this.makeRequest(endpoint, 'DELETE');
      return response.ok;
    } catch (error) {
      console.error('Error deleting ArgoCD application:', error);
      return false;
    }
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
      resources?: Array<{ group: string; kind: string; name: string; namespace: string }>;
    }
  ): Promise<SyncResult> {
    try {
      const syncRequest = {
        revision: options?.revision,
        prune: options?.prune ?? false,
        dryRun: options?.dryRun ?? false,
        resources: options?.resources,
      };

      const response = await this.makeRequest(
        `/api/v1/applications/${encodeURIComponent(name)}/sync`,
        'POST',
        syncRequest
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Sync failed: ${errorText}`,
        };
      }

      const application = await response.json();
      return {
        success: true,
        application,
        message: `Application ${name} sync initiated`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Rollback application to previous revision
   */
  async rollbackApplication(name: string, id: number): Promise<SyncResult> {
    try {
      const response = await this.makeRequest(
        `/api/v1/applications/${encodeURIComponent(name)}/rollback`,
        'POST',
        { id }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Rollback failed: ${errorText}`,
        };
      }

      const application = await response.json();
      return {
        success: true,
        application,
        message: `Application ${name} rolled back to revision ${id}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get application resource tree
   */
  async getResourceTree(name: string): Promise<unknown> {
    try {
      const response = await this.makeRequest(
        `/api/v1/applications/${encodeURIComponent(name)}/resource-tree`
      );
      if (!response.ok) {
        throw new Error(`Failed to get resource tree: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting resource tree:', error);
      return null;
    }
  }

  /**
   * Get application manifests
   */
  async getManifests(name: string, revision?: string): Promise<unknown> {
    try {
      let endpoint = `/api/v1/applications/${encodeURIComponent(name)}/manifests`;
      if (revision) {
        endpoint += `?revision=${encodeURIComponent(revision)}`;
      }

      const response = await this.makeRequest(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to get manifests: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting manifests:', error);
      return null;
    }
  }

  /**
   * Get application logs
   */
  async getLogs(
    name: string,
    options?: {
      namespace?: string;
      podName?: string;
      container?: string;
      sinceSeconds?: number;
      tailLines?: number;
    }
  ): Promise<string[]> {
    try {
      const params = new URLSearchParams();
      if (options?.namespace) params.append('namespace', options.namespace);
      if (options?.podName) params.append('podName', options.podName);
      if (options?.container) params.append('container', options.container);
      if (options?.sinceSeconds) params.append('sinceSeconds', options.sinceSeconds.toString());
      if (options?.tailLines) params.append('tailLines', options.tailLines.toString());

      const endpoint = `/api/v1/applications/${encodeURIComponent(name)}/logs?${params.toString()}`;
      const response = await this.makeRequest(endpoint);
      
      if (!response.ok) {
        throw new Error(`Failed to get logs: ${response.statusText}`);
      }

      const text = await response.text();
      return text.split('\n').filter(line => line.trim());
    } catch (error) {
      console.error('Error getting logs:', error);
      return [];
    }
  }

  /**
   * Get application events
   */
  async getEvents(name: string): Promise<unknown[]> {
    try {
      const response = await this.makeRequest(
        `/api/v1/applications/${encodeURIComponent(name)}/events`
      );
      if (!response.ok) {
        throw new Error(`Failed to get events: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error getting events:', error);
      return [];
    }
  }

  /**
   * Terminate running operation
   */
  async terminateOperation(name: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        `/api/v1/applications/${encodeURIComponent(name)}/operation`,
        'DELETE'
      );
      return response.ok;
    } catch (error) {
      console.error('Error terminating operation:', error);
      return false;
    }
  }

  /**
   * Refresh application (hard refresh)
   */
  async refreshApplication(name: string, hard: boolean = false): Promise<ArgoCDApplication | null> {
    try {
      const params = hard ? '?refresh=hard' : '?refresh=normal';
      const response = await this.makeRequest(
        `/api/v1/applications/${encodeURIComponent(name)}${params}`,
        'GET'
      );
      
      if (!response.ok) {
        throw new Error(`Failed to refresh application: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error refreshing application:', error);
      return null;
    }
  }

  /**
   * List projects
   */
  async listProjects(): Promise<unknown[]> {
    try {
      const response = await this.makeRequest('/api/v1/projects');
      if (!response.ok) {
        throw new Error(`Failed to list projects: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error listing projects:', error);
      return [];
    }
  }

  /**
   * List repositories
   */
  async listRepositories(): Promise<unknown[]> {
    try {
      const response = await this.makeRequest('/api/v1/repositories');
      if (!response.ok) {
        throw new Error(`Failed to list repositories: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error listing repositories:', error);
      return [];
    }
  }

  /**
   * Add repository
   */
  async addRepository(repo: {
    repo: string;
    username?: string;
    password?: string;
    sshPrivateKey?: string;
    type?: string;
    name?: string;
  }): Promise<unknown> {
    try {
      const response = await this.makeRequest('/api/v1/repositories', 'POST', repo);
      if (!response.ok) {
        throw new Error(`Failed to add repository: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding repository:', error);
      return null;
    }
  }

  /**
   * Get cluster info
   */
  async listClusters(): Promise<unknown[]> {
    try {
      const response = await this.makeRequest('/api/v1/clusters');
      if (!response.ok) {
        throw new Error(`Failed to list clusters: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error listing clusters:', error);
      return [];
    }
  }

  /**
   * Get AI analysis for application health
   */
  async getAIAnalysis(app: ArgoCDApplication): Promise<string> {
    try {
      const prompt = `Analyze this ArgoCD application status and provide recommendations:

Application: ${app.metadata.name}
Project: ${app.spec.project}
Repository: ${app.spec.source.repoURL}
Path: ${app.spec.source.path}
Target Revision: ${app.spec.source.targetRevision}

Sync Status: ${app.status?.sync?.status || 'Unknown'}
Health Status: ${app.status?.health?.status || 'Unknown'}
Health Message: ${app.status?.health?.message || 'None'}

${app.status?.operationState ? `
Operation Phase: ${app.status.operationState.phase}
Operation Message: ${app.status.operationState.message || 'None'}
` : ''}

${app.status?.resources ? `
Resources (${app.status.resources.length}):
${app.status.resources.slice(0, 10).map(r => 
  `- ${r.kind}/${r.name}: ${r.status} (${r.health?.status || 'Unknown'})`
).join('\n')}
` : ''}

Provide:
1. Current status assessment
2. Any issues detected
3. Recommended actions
4. Best practices suggestions`;

      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'You are a DevOps expert specializing in ArgoCD and GitOps workflows. Provide concise, actionable analysis.' },
          { role: 'user', content: prompt }
        ]
      });

      const content = response.choices[0]?.message?.content;
      return typeof content === 'string' ? content : 'Unable to generate analysis';
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return 'AI analysis unavailable';
    }
  }

  /**
   * Setup webhook for automatic sync
   */
  async setupWebhook(repoURL: string, webhookSecret: string): Promise<{ url: string; secret: string }> {
    // This would typically be configured in ArgoCD server settings
    // Here we return the webhook URL that should be configured in GitHub/GitLab
    const webhookUrl = `${this.config?.serverUrl}/api/webhook`;
    
    return {
      url: webhookUrl,
      secret: webhookSecret,
    };
  }

  /**
   * Get sync history for application
   */
  async getSyncHistory(name: string): Promise<Array<{
    revision: string;
    deployedAt: string;
    id: number;
    source: {
      repoURL: string;
      path: string;
      targetRevision: string;
    };
  }>> {
    const app = await this.getApplication(name);
    return app?.status?.history || [];
  }

  /**
   * Compare application with target revision
   */
  async compareRevisions(name: string, targetRevision: string): Promise<unknown> {
    try {
      const response = await this.makeRequest(
        `/api/v1/applications/${encodeURIComponent(name)}/compare?revision=${encodeURIComponent(targetRevision)}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to compare revisions: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error comparing revisions:', error);
      return null;
    }
  }
}

// Singleton instance
export const argoCDService = new ArgoCDService();

// Export types
export type { ArgoCDConfig, ArgoCDApplication, SyncResult };
