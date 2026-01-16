/**
 * ArgoCD Router
 * 
 * tRPC procedures for ArgoCD GitOps integration
 */

import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { argoCDService } from '../services/argocd';

export const argoCDRouter = router({
  // Initialize ArgoCD connection
  initialize: protectedProcedure
    .input(z.object({
      serverUrl: z.string().url(),
      token: z.string().min(1),
      insecure: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const success = await argoCDService.initialize(input);
      return { success };
    }),

  // List all applications
  listApplications: protectedProcedure
    .input(z.object({
      project: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const applications = await argoCDService.listApplications(input?.project);
      return { applications };
    }),

  // Get application details
  getApplication: protectedProcedure
    .input(z.object({
      name: z.string(),
    }))
    .query(async ({ input }) => {
      const application = await argoCDService.getApplication(input.name);
      return { application };
    }),

  // Create application
  createApplication: protectedProcedure
    .input(z.object({
      name: z.string(),
      project: z.string().default('default'),
      repoURL: z.string().url(),
      path: z.string(),
      targetRevision: z.string().default('HEAD'),
      destinationServer: z.string().default('https://kubernetes.default.svc'),
      destinationNamespace: z.string(),
      autoSync: z.boolean().default(false),
      selfHeal: z.boolean().default(false),
      prune: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const app = {
        metadata: {
          name: input.name,
          namespace: 'argocd',
        },
        spec: {
          project: input.project,
          source: {
            repoURL: input.repoURL,
            path: input.path,
            targetRevision: input.targetRevision,
          },
          destination: {
            server: input.destinationServer,
            namespace: input.destinationNamespace,
          },
          syncPolicy: input.autoSync ? {
            automated: {
              prune: input.prune,
              selfHeal: input.selfHeal,
            },
          } : undefined,
        },
      };

      const application = await argoCDService.createApplication(app);
      return { success: !!application, application };
    }),

  // Update application
  updateApplication: protectedProcedure
    .input(z.object({
      name: z.string(),
      repoURL: z.string().url().optional(),
      path: z.string().optional(),
      targetRevision: z.string().optional(),
      destinationNamespace: z.string().optional(),
      autoSync: z.boolean().optional(),
      selfHeal: z.boolean().optional(),
      prune: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const existing = await argoCDService.getApplication(input.name);
      if (!existing) {
        return { success: false, error: 'Application not found' };
      }

      const updates: Record<string, unknown> = {};
      
      if (input.repoURL || input.path || input.targetRevision) {
        updates.spec = {
          ...existing.spec,
          source: {
            ...existing.spec.source,
            ...(input.repoURL && { repoURL: input.repoURL }),
            ...(input.path && { path: input.path }),
            ...(input.targetRevision && { targetRevision: input.targetRevision }),
          },
        };
      }

      if (input.destinationNamespace) {
        updates.spec = {
          ...(updates.spec || existing.spec),
          destination: {
            ...existing.spec.destination,
            namespace: input.destinationNamespace,
          },
        };
      }

      if (input.autoSync !== undefined) {
        const spec = updates.spec || existing.spec;
        updates.spec = {
          ...spec,
          syncPolicy: input.autoSync ? {
            automated: {
              prune: input.prune ?? existing.spec.syncPolicy?.automated?.prune ?? false,
              selfHeal: input.selfHeal ?? existing.spec.syncPolicy?.automated?.selfHeal ?? false,
            },
          } : undefined,
        };
      }

      const application = await argoCDService.updateApplication(input.name, {
        ...existing,
        ...updates,
      });
      
      return { success: !!application, application };
    }),

  // Delete application
  deleteApplication: protectedProcedure
    .input(z.object({
      name: z.string(),
      cascade: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const success = await argoCDService.deleteApplication(input.name, input.cascade);
      return { success };
    }),

  // Sync application
  syncApplication: protectedProcedure
    .input(z.object({
      name: z.string(),
      revision: z.string().optional(),
      prune: z.boolean().optional(),
      dryRun: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await argoCDService.syncApplication(input.name, {
        revision: input.revision,
        prune: input.prune,
        dryRun: input.dryRun,
      });
      return result;
    }),

  // Rollback application
  rollbackApplication: protectedProcedure
    .input(z.object({
      name: z.string(),
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      const result = await argoCDService.rollbackApplication(input.name, input.id);
      return result;
    }),

  // Refresh application
  refreshApplication: protectedProcedure
    .input(z.object({
      name: z.string(),
      hard: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const application = await argoCDService.refreshApplication(input.name, input.hard);
      return { success: !!application, application };
    }),

  // Terminate operation
  terminateOperation: protectedProcedure
    .input(z.object({
      name: z.string(),
    }))
    .mutation(async ({ input }) => {
      const success = await argoCDService.terminateOperation(input.name);
      return { success };
    }),

  // Get resource tree
  getResourceTree: protectedProcedure
    .input(z.object({
      name: z.string(),
    }))
    .query(async ({ input }) => {
      const tree = await argoCDService.getResourceTree(input.name);
      return { tree };
    }),

  // Get manifests
  getManifests: protectedProcedure
    .input(z.object({
      name: z.string(),
      revision: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const manifests = await argoCDService.getManifests(input.name, input.revision);
      return { manifests };
    }),

  // Get logs
  getLogs: protectedProcedure
    .input(z.object({
      name: z.string(),
      namespace: z.string().optional(),
      podName: z.string().optional(),
      container: z.string().optional(),
      sinceSeconds: z.number().optional(),
      tailLines: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const logs = await argoCDService.getLogs(input.name, {
        namespace: input.namespace,
        podName: input.podName,
        container: input.container,
        sinceSeconds: input.sinceSeconds,
        tailLines: input.tailLines,
      });
      return { logs };
    }),

  // Get events
  getEvents: protectedProcedure
    .input(z.object({
      name: z.string(),
    }))
    .query(async ({ input }) => {
      const events = await argoCDService.getEvents(input.name);
      return { events };
    }),

  // Get sync history
  getSyncHistory: protectedProcedure
    .input(z.object({
      name: z.string(),
    }))
    .query(async ({ input }) => {
      const history = await argoCDService.getSyncHistory(input.name);
      return { history };
    }),

  // List projects
  listProjects: protectedProcedure
    .query(async () => {
      const projects = await argoCDService.listProjects();
      return { projects };
    }),

  // List repositories
  listRepositories: protectedProcedure
    .query(async () => {
      const repositories = await argoCDService.listRepositories();
      return { repositories };
    }),

  // Add repository
  addRepository: protectedProcedure
    .input(z.object({
      repo: z.string().url(),
      username: z.string().optional(),
      password: z.string().optional(),
      sshPrivateKey: z.string().optional(),
      type: z.enum(['git', 'helm']).optional(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const repository = await argoCDService.addRepository(input);
      return { success: !!repository, repository };
    }),

  // List clusters
  listClusters: protectedProcedure
    .query(async () => {
      const clusters = await argoCDService.listClusters();
      return { clusters };
    }),

  // Get AI analysis
  getAIAnalysis: protectedProcedure
    .input(z.object({
      name: z.string(),
    }))
    .query(async ({ input }) => {
      const application = await argoCDService.getApplication(input.name);
      if (!application) {
        return { analysis: 'Application not found' };
      }
      const analysis = await argoCDService.getAIAnalysis(application);
      return { analysis };
    }),

  // Compare revisions
  compareRevisions: protectedProcedure
    .input(z.object({
      name: z.string(),
      targetRevision: z.string(),
    }))
    .query(async ({ input }) => {
      const comparison = await argoCDService.compareRevisions(input.name, input.targetRevision);
      return { comparison };
    }),
});
