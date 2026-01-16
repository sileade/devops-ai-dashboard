import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { prometheusConfig, prometheusMetrics, grafanaDashboards } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import {
  configurePrometheus,
  configureGrafana,
  testPrometheusConnection,
  testGrafanaConnection,
  queryPrometheus,
  queryPrometheusRange,
  getPrometheusMetrics,
  getGrafanaDashboards,
  getGrafanaEmbedUrl,
  commonQueries,
  parsePrometheusResult,
  parsePrometheusRangeResult,
} from "../services/prometheus";

export const prometheusRouter = router({
  // Get Prometheus configuration
  getConfig: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0) return null;

    const config = configs[0];
    return {
      ...config,
      prometheusPassword: config.prometheusPassword ? "********" : null,
      grafanaApiKey: config.grafanaApiKey ? "********" : null,
    };
  }),

  // Save Prometheus configuration
  saveConfig: publicProcedure
    .input(z.object({
      name: z.string().default("Default"),
      prometheusUrl: z.string().url(),
      prometheusUsername: z.string().optional(),
      prometheusPassword: z.string().optional(),
      grafanaUrl: z.string().url().optional(),
      grafanaApiKey: z.string().optional(),
      scrapeInterval: z.number().default(15),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const existing = await db.select().from(prometheusConfig).limit(1);

      const data = {
        name: input.name,
        prometheusUrl: input.prometheusUrl,
        prometheusUsername: input.prometheusUsername,
        prometheusPassword: input.prometheusPassword,
        grafanaUrl: input.grafanaUrl,
        grafanaApiKey: input.grafanaApiKey,
        scrapeInterval: input.scrapeInterval,
        isEnabled: true,
      };

      if (existing.length > 0) {
        await db.update(prometheusConfig)
          .set(data)
          .where(eq(prometheusConfig.id, existing[0].id));
        return { success: true, id: existing[0].id };
      } else {
        const result = await db.insert(prometheusConfig).values({
          userId: 1,
          ...data,
        });
        return { success: true, id: result[0].insertId };
      }
    }),

  // Test Prometheus connection
  testPrometheus: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };

    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0) {
      return { success: false, error: "Prometheus not configured" };
    }

    const config = configs[0];
    configurePrometheus({
      url: config.prometheusUrl,
      username: config.prometheusUsername || undefined,
      password: config.prometheusPassword || undefined,
    });

    const result = await testPrometheusConnection();

    if (result.success) {
      await db.update(prometheusConfig)
        .set({ lastScrapeAt: new Date(), lastScrapeStatus: "success" })
        .where(eq(prometheusConfig.id, config.id));
    } else {
      await db.update(prometheusConfig)
        .set({ lastScrapeAt: new Date(), lastScrapeStatus: "failed" })
        .where(eq(prometheusConfig.id, config.id));
    }

    return result;
  }),

  // Test Grafana connection
  testGrafana: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };

    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].grafanaUrl || !configs[0].grafanaApiKey) {
      return { success: false, error: "Grafana not configured" };
    }

    const config = configs[0];
    configureGrafana({
      url: config.grafanaUrl!,
      apiKey: config.grafanaApiKey!,
    });

    return await testGrafanaConnection();
  }),

  // Execute PromQL query
  query: publicProcedure
    .input(z.object({
      query: z.string(),
      time: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const configs = await db.select().from(prometheusConfig).limit(1);
      if (configs.length === 0 || !configs[0].isEnabled) {
        return { success: false, error: "Prometheus not configured or disabled" };
      }

      const config = configs[0];
      configurePrometheus({
        url: config.prometheusUrl,
        username: config.prometheusUsername || undefined,
        password: config.prometheusPassword || undefined,
      });

      const time = input.time ? new Date(input.time) : undefined;
      const result = await queryPrometheus(input.query, time);

      if (result.success && result.data) {
        return {
          success: true,
          data: parsePrometheusResult(result.data),
          raw: result.data,
        };
      }

      return result;
    }),

  // Execute PromQL range query
  queryRange: publicProcedure
    .input(z.object({
      query: z.string(),
      start: z.string(),
      end: z.string(),
      step: z.string().default("15s"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const configs = await db.select().from(prometheusConfig).limit(1);
      if (configs.length === 0 || !configs[0].isEnabled) {
        return { success: false, error: "Prometheus not configured or disabled" };
      }

      const config = configs[0];
      configurePrometheus({
        url: config.prometheusUrl,
        username: config.prometheusUsername || undefined,
        password: config.prometheusPassword || undefined,
      });

      const result = await queryPrometheusRange(
        input.query,
        new Date(input.start),
        new Date(input.end),
        input.step
      );

      if (result.success && result.data) {
        return {
          success: true,
          data: parsePrometheusRangeResult(result.data),
          raw: result.data,
        };
      }

      return result;
    }),

  // Get available metrics
  getMetrics: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };

    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].isEnabled) {
      return { success: false, error: "Prometheus not configured or disabled" };
    }

    const config = configs[0];
    configurePrometheus({
      url: config.prometheusUrl,
      username: config.prometheusUsername || undefined,
      password: config.prometheusPassword || undefined,
    });

    return await getPrometheusMetrics();
  }),

  // Get common queries
  getCommonQueries: publicProcedure.query(() => {
    return commonQueries;
  }),

  // Save custom metric query
  saveMetricQuery: publicProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      query: z.string(),
      unit: z.string().optional(),
      aggregation: z.enum(["avg", "sum", "min", "max", "count", "rate"]).default("avg"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const configs = await db.select().from(prometheusConfig).limit(1);
      if (configs.length === 0) {
        return { success: false, error: "Prometheus not configured" };
      }

      const result = await db.insert(prometheusMetrics).values({
        configId: configs[0].id,
        name: input.name,
        description: input.description,
        query: input.query,
        unit: input.unit,
        aggregation: input.aggregation,
      });

      return { success: true, id: result[0].insertId };
    }),

  // Get saved metric queries
  getSavedQueries: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return await db.select()
      .from(prometheusMetrics)
      .orderBy(desc(prometheusMetrics.createdAt));
  }),

  // Delete saved metric query
  deleteMetricQuery: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      await db.delete(prometheusMetrics).where(eq(prometheusMetrics.id, input.id));
      return { success: true };
    }),

  // Get Grafana dashboards
  getDashboards: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };

    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].grafanaUrl || !configs[0].grafanaApiKey) {
      return { success: false, error: "Grafana not configured" };
    }

    const config = configs[0];
    configureGrafana({
      url: config.grafanaUrl!,
      apiKey: config.grafanaApiKey!,
    });

    return await getGrafanaDashboards();
  }),

  // Save Grafana dashboard reference
  saveDashboard: publicProcedure
    .input(z.object({
      uid: z.string(),
      name: z.string(),
      category: z.enum(["overview", "containers", "kubernetes", "custom"]).default("custom"),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const configs = await db.select().from(prometheusConfig).limit(1);
      if (configs.length === 0 || !configs[0].grafanaUrl) {
        return { success: false, error: "Grafana not configured" };
      }

      const embedUrl = getGrafanaEmbedUrl(input.uid);

      const result = await db.insert(grafanaDashboards).values({
        configId: configs[0].id,
        uid: input.uid,
        name: input.name,
        embedUrl,
        category: input.category,
        isDefault: input.isDefault,
      });

      return { success: true, id: result[0].insertId };
    }),

  // Get saved Grafana dashboards
  getSavedDashboards: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    return await db.select()
      .from(grafanaDashboards)
      .orderBy(desc(grafanaDashboards.createdAt));
  }),

  // Delete saved dashboard
  deleteDashboard: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      await db.delete(grafanaDashboards).where(eq(grafanaDashboards.id, input.id));
      return { success: true };
    }),

  // Get dashboard embed URL
  getEmbedUrl: publicProcedure
    .input(z.object({
      dashboardUid: z.string(),
      panelId: z.number().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      const configs = await db.select().from(prometheusConfig).limit(1);
      if (configs.length === 0 || !configs[0].grafanaUrl || !configs[0].grafanaApiKey) {
        return { success: false, error: "Grafana not configured" };
      }

      configureGrafana({
        url: configs[0].grafanaUrl!,
        apiKey: configs[0].grafanaApiKey!,
      });

      const url = getGrafanaEmbedUrl(
        input.dashboardUid,
        input.panelId,
        input.from,
        input.to
      );

      return { success: true, url };
    }),

  // Quick metrics for dashboard
  getQuickMetrics: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };

    const configs = await db.select().from(prometheusConfig).limit(1);
    if (configs.length === 0 || !configs[0].isEnabled) {
      return { success: false, error: "Prometheus not configured or disabled" };
    }

    const config = configs[0];
    configurePrometheus({
      url: config.prometheusUrl,
      username: config.prometheusUsername || undefined,
      password: config.prometheusPassword || undefined,
    });

    // Execute multiple queries in parallel
    const [cpuResult, memoryResult, podResult, containerResult] = await Promise.all([
      queryPrometheus(commonQueries.cpuUsageByNode),
      queryPrometheus(commonQueries.memoryUsageByNode),
      queryPrometheus(commonQueries.podStatus),
      queryPrometheus(commonQueries.containerRunning),
    ]);

    return {
      success: true,
      metrics: {
        cpu: cpuResult.success ? parsePrometheusResult(cpuResult.data!) : [],
        memory: memoryResult.success ? parsePrometheusResult(memoryResult.data!) : [],
        pods: podResult.success ? parsePrometheusResult(podResult.data!) : [],
        containers: containerResult.success ? parsePrometheusResult(containerResult.data!) : [],
      },
    };
  }),
});
