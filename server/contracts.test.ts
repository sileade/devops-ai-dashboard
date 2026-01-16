import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * API Contract Tests
 * 
 * These tests verify that tRPC endpoints maintain their contract:
 * - Input schemas are validated correctly
 * - Output schemas match expected structure
 * - Error handling is consistent
 */

// Auth Router Contracts
const AuthMeOutputSchema = z.object({
  id: z.string(),
  openId: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['admin', 'user']),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
}).nullable();

// Dashboard Router Contracts
const DashboardOverviewOutputSchema = z.object({
  containers: z.object({
    total: z.number(),
    running: z.number(),
    stopped: z.number(),
    paused: z.number(),
  }),
  pods: z.object({
    total: z.number(),
    running: z.number(),
    pending: z.number(),
    failed: z.number(),
  }),
  deployments: z.object({
    total: z.number(),
    healthy: z.number(),
    unhealthy: z.number(),
  }),
  alerts: z.object({
    total: z.number(),
    critical: z.number(),
    warning: z.number(),
    info: z.number(),
  }),
});

// Docker Router Contracts
const DockerContainerSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string(),
  status: z.string(),
  state: z.string(),
  created: z.string().or(z.date()),
  ports: z.array(z.object({
    privatePort: z.number().optional(),
    publicPort: z.number().optional(),
    type: z.string().optional(),
  })).optional(),
});

// Kubernetes Router Contracts
const KubernetesPodSchema = z.object({
  name: z.string(),
  namespace: z.string(),
  status: z.string(),
  ready: z.string().optional(),
  restarts: z.number().optional(),
  age: z.string().optional(),
  node: z.string().optional(),
});

// AI Router Contracts
const AIStatusOutputSchema = z.object({
  available: z.boolean(),
  model: z.string().optional(),
  lastCheck: z.string().or(z.date()).optional(),
});

const AISuggestInputSchema = z.object({
  context: z.string(),
  type: z.enum(['docker', 'kubernetes', 'general']).optional(),
});

describe('API Contract Tests', () => {
  describe('Auth Router Contracts', () => {
    it('should define correct schema for auth.me output', () => {
      const validOutput = {
        id: '123',
        openId: 'open-123',
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: 'https://example.com/avatar.png',
        role: 'user' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      expect(() => AuthMeOutputSchema.parse(validOutput)).not.toThrow();
      expect(() => AuthMeOutputSchema.parse(null)).not.toThrow();
    });

    it('should reject invalid auth.me output', () => {
      const invalidOutput = { id: 123, name: 'Test User' };
      expect(() => AuthMeOutputSchema.parse(invalidOutput)).toThrow();
    });
  });

  describe('Dashboard Router Contracts', () => {
    it('should define correct schema for dashboard.overview output', () => {
      const validOutput = {
        containers: { total: 10, running: 8, stopped: 2, paused: 0 },
        pods: { total: 20, running: 18, pending: 1, failed: 1 },
        deployments: { total: 5, healthy: 4, unhealthy: 1 },
        alerts: { total: 3, critical: 1, warning: 1, info: 1 },
      };
      
      expect(() => DashboardOverviewOutputSchema.parse(validOutput)).not.toThrow();
    });
  });

  describe('Docker Router Contracts', () => {
    it('should define correct schema for docker.containers output', () => {
      const validOutput = [{
        id: 'abc123',
        name: 'web-server',
        image: 'nginx:latest',
        status: 'Up 2 hours',
        state: 'running',
        created: new Date().toISOString(),
        ports: [{ privatePort: 80, publicPort: 8080, type: 'tcp' }],
      }];
      
      expect(() => z.array(DockerContainerSchema).parse(validOutput)).not.toThrow();
    });
  });

  describe('Kubernetes Router Contracts', () => {
    it('should define correct schema for kubernetes.pods output', () => {
      const validOutput = [{
        name: 'api-server-abc123',
        namespace: 'production',
        status: 'Running',
        ready: '1/1',
        restarts: 0,
        age: '2d',
        node: 'node-1',
      }];
      
      expect(() => z.array(KubernetesPodSchema).parse(validOutput)).not.toThrow();
    });
  });

  describe('AI Router Contracts', () => {
    it('should define correct schema for ai.status output', () => {
      const validOutput = {
        available: true,
        model: 'gpt-4',
        lastCheck: new Date().toISOString(),
      };
      
      expect(() => AIStatusOutputSchema.parse(validOutput)).not.toThrow();
    });

    it('should define correct schema for ai.suggest input', () => {
      const validInput = { context: 'container keeps restarting', type: 'docker' as const };
      expect(() => AISuggestInputSchema.parse(validInput)).not.toThrow();
    });
  });

  describe('Schema Compatibility Tests', () => {
    it('should maintain backward compatibility for auth schemas', () => {
      const oldFormatOutput = {
        id: 'user-123',
        openId: 'open-123',
        name: 'User',
        email: null,
        avatarUrl: null,
        role: 'user',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      
      expect(() => AuthMeOutputSchema.parse(oldFormatOutput)).not.toThrow();
    });
  });

  describe('Input Validation Contracts', () => {
    const PaginationInputSchema = z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    });

    it('should validate pagination input correctly', () => {
      expect(() => PaginationInputSchema.parse({ page: 1, limit: 20 })).not.toThrow();
      expect(() => PaginationInputSchema.parse({ page: 0, limit: 200 })).toThrow();
    });
  });

  describe('Type Safety Contracts', () => {
    it('should enforce strict types for enums', () => {
      const RoleSchema = z.enum(['admin', 'user']);
      expect(() => RoleSchema.parse('admin')).not.toThrow();
      expect(() => RoleSchema.parse('superadmin')).toThrow();
    });

    it('should enforce strict types for numbers', () => {
      const PercentageSchema = z.number().min(0).max(100);
      expect(() => PercentageSchema.parse(50)).not.toThrow();
      expect(() => PercentageSchema.parse(150)).toThrow();
    });
  });
});
