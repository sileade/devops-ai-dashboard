import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { emailConfig, emailSubscriptions, emailHistory } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { 
  configureEmail, 
  testEmailConnection, 
  sendEmail, 
  createAlertEmailTemplate,
  createABTestResultEmailTemplate,
  createScalingEventEmailTemplate
} from "../services/email";
import crypto from "crypto";

export const emailRouter = router({
  // Get email configuration
  getConfig: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    
    const configs = await db.select().from(emailConfig).limit(1);
    if (configs.length === 0) return null;
    
    const config = configs[0];
    return {
      ...config,
      smtpPassword: config.smtpPassword ? "********" : null,
    };
  }),

  // Save email configuration
  saveConfig: publicProcedure
    .input(z.object({
      smtpHost: z.string().min(1),
      smtpPort: z.number().min(1).max(65535),
      smtpSecure: z.boolean(),
      smtpUser: z.string().min(1),
      smtpPassword: z.string().min(1),
      fromEmail: z.string().email(),
      fromName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };
      
      const existing = await db.select().from(emailConfig).limit(1);
      
      if (existing.length > 0) {
        await db.update(emailConfig)
          .set({
            smtpHost: input.smtpHost,
            smtpPort: input.smtpPort,
            smtpSecure: input.smtpSecure,
            smtpUser: input.smtpUser,
            smtpPassword: input.smtpPassword,
            fromEmail: input.fromEmail,
            fromName: input.fromName || "DevOps AI Dashboard",
            isVerified: false,
          })
          .where(eq(emailConfig.id, existing[0].id));
        
        return { success: true, id: existing[0].id };
      } else {
        const result = await db.insert(emailConfig).values({
          userId: 1,
          smtpHost: input.smtpHost,
          smtpPort: input.smtpPort,
          smtpSecure: input.smtpSecure,
          smtpUser: input.smtpUser,
          smtpPassword: input.smtpPassword,
          fromEmail: input.fromEmail,
          fromName: input.fromName || "DevOps AI Dashboard",
        });
        
        return { success: true, id: result[0].insertId };
      }
    }),

  // Test email configuration
  testConfig: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not available" };
    
    const configs = await db.select().from(emailConfig).limit(1);
    if (configs.length === 0) {
      return { success: false, error: "Email not configured" };
    }

    const config = configs[0];
    configureEmail({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
      from: `${config.fromName} <${config.fromEmail}>`,
    });

    const result = await testEmailConnection();
    
    if (result.success) {
      await db.update(emailConfig)
        .set({ isVerified: true, lastTestedAt: new Date() })
        .where(eq(emailConfig.id, config.id));
    }

    return result;
  }),

  // Send test email
  sendTestEmail: publicProcedure
    .input(z.object({
      toEmail: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };
      
      const configs = await db.select().from(emailConfig).limit(1);
      if (configs.length === 0) {
        return { success: false, error: "Email not configured" };
      }

      const config = configs[0];
      configureEmail({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword,
        },
        from: `${config.fromName} <${config.fromEmail}>`,
      });

      const template = createAlertEmailTemplate({
        type: "info",
        title: "Test Email",
        message: "This is a test email from DevOps AI Dashboard to verify your email configuration is working correctly.",
        resource: "Email System",
        value: 100,
        threshold: 100,
        timestamp: new Date(),
      });

      const result = await sendEmail(input.toEmail, template);

      await db.insert(emailHistory).values({
        toEmail: input.toEmail,
        subject: template.subject,
        templateType: "custom",
        status: result.success ? "sent" : "failed",
        messageId: result.messageId,
        errorMessage: result.error,
        sentAt: result.success ? new Date() : null,
      });

      return result;
    }),

  // Get subscriptions
  getSubscriptions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(emailSubscriptions).orderBy(desc(emailSubscriptions.createdAt));
  }),

  // Add subscription
  addSubscription: publicProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      criticalAlerts: z.boolean().default(true),
      warningAlerts: z.boolean().default(true),
      infoAlerts: z.boolean().default(false),
      scalingEvents: z.boolean().default(true),
      abTestResults: z.boolean().default(true),
      dailyDigest: z.boolean().default(false),
      weeklyReport: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };
      
      const unsubscribeToken = crypto.randomBytes(32).toString("hex");
      
      const result = await db.insert(emailSubscriptions).values({
        userId: 1,
        email: input.email,
        name: input.name,
        criticalAlerts: input.criticalAlerts,
        warningAlerts: input.warningAlerts,
        infoAlerts: input.infoAlerts,
        scalingEvents: input.scalingEvents,
        abTestResults: input.abTestResults,
        dailyDigest: input.dailyDigest,
        weeklyReport: input.weeklyReport,
        unsubscribeToken,
      });

      return { success: true, id: result[0].insertId };
    }),

  // Update subscription
  updateSubscription: publicProcedure
    .input(z.object({
      id: z.number(),
      email: z.string().email().optional(),
      name: z.string().optional(),
      criticalAlerts: z.boolean().optional(),
      warningAlerts: z.boolean().optional(),
      infoAlerts: z.boolean().optional(),
      scalingEvents: z.boolean().optional(),
      abTestResults: z.boolean().optional(),
      dailyDigest: z.boolean().optional(),
      weeklyReport: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };
      
      const { id, ...updates } = input;
      await db.update(emailSubscriptions)
        .set(updates)
        .where(eq(emailSubscriptions.id, id));
      return { success: true };
    }),

  // Delete subscription
  deleteSubscription: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };
      
      await db.delete(emailSubscriptions).where(eq(emailSubscriptions.id, input.id));
      return { success: true };
    }),

  // Get email history
  getHistory: publicProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      return await db.select()
        .from(emailHistory)
        .orderBy(desc(emailHistory.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // Send alert notification to all subscribers
  sendAlertNotification: publicProcedure
    .input(z.object({
      type: z.enum(["critical", "warning", "info"]),
      title: z.string(),
      message: z.string(),
      resource: z.string(),
      value: z.number(),
      threshold: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };
      
      const subscribers = await db.select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.isActive, true));

      type Subscriber = typeof subscribers[0];
      const filteredSubscribers = subscribers.filter((sub: Subscriber) => {
        if (input.type === "critical") return sub.criticalAlerts;
        if (input.type === "warning") return sub.warningAlerts;
        return sub.infoAlerts;
      });

      if (filteredSubscribers.length === 0) {
        return { success: true, sent: 0, message: "No subscribers for this alert type" };
      }

      const configs = await db.select().from(emailConfig).limit(1);
      if (configs.length === 0 || !configs[0].isVerified) {
        return { success: false, error: "Email not configured or not verified" };
      }

      const config = configs[0];
      configureEmail({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword,
        },
        from: `${config.fromName} <${config.fromEmail}>`,
      });

      const template = createAlertEmailTemplate({
        ...input,
        timestamp: new Date(),
      });

      let sent = 0;
      for (const subscriber of filteredSubscribers) {
        const result = await sendEmail(subscriber.email, template);
        
        await db.insert(emailHistory).values({
          subscriptionId: subscriber.id,
          toEmail: subscriber.email,
          subject: template.subject,
          templateType: "alert",
          status: result.success ? "sent" : "failed",
          messageId: result.messageId,
          errorMessage: result.error,
          sentAt: result.success ? new Date() : null,
        });

        if (result.success) sent++;
      }

      return { success: true, sent, total: filteredSubscribers.length };
    }),

  // Send A/B test result notification
  sendABTestNotification: publicProcedure
    .input(z.object({
      name: z.string(),
      winner: z.enum(["A", "B", "none"]),
      variantA: z.object({
        name: z.string(),
        avgResponseTime: z.number(),
        errorRate: z.number(),
        resourceEfficiency: z.number(),
      }),
      variantB: z.object({
        name: z.string(),
        avgResponseTime: z.number(),
        errorRate: z.number(),
        resourceEfficiency: z.number(),
      }),
      confidence: z.number(),
      duration: z.string(),
      recommendation: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };
      
      const subscribers = await db.select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.isActive, true));

      type Subscriber = typeof subscribers[0];
      const filteredSubscribers = subscribers.filter((sub: Subscriber) => sub.abTestResults);

      if (filteredSubscribers.length === 0) {
        return { success: true, sent: 0, message: "No subscribers for A/B test results" };
      }

      const configs = await db.select().from(emailConfig).limit(1);
      if (configs.length === 0 || !configs[0].isVerified) {
        return { success: false, error: "Email not configured or not verified" };
      }

      const config = configs[0];
      configureEmail({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword,
        },
        from: `${config.fromName} <${config.fromEmail}>`,
      });

      const template = createABTestResultEmailTemplate(input);

      let sent = 0;
      for (const subscriber of filteredSubscribers) {
        const result = await sendEmail(subscriber.email, template);
        
        await db.insert(emailHistory).values({
          subscriptionId: subscriber.id,
          toEmail: subscriber.email,
          subject: template.subject,
          templateType: "ab_test",
          status: result.success ? "sent" : "failed",
          messageId: result.messageId,
          errorMessage: result.error,
          sentAt: result.success ? new Date() : null,
        });

        if (result.success) sent++;
      }

      return { success: true, sent, total: filteredSubscribers.length };
    }),

  // Send scaling event notification
  sendScalingNotification: publicProcedure
    .input(z.object({
      type: z.enum(["scale_up", "scale_down", "scheduled"]),
      resource: z.string(),
      previousReplicas: z.number(),
      newReplicas: z.number(),
      reason: z.string(),
      aiRecommendation: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };
      
      const subscribers = await db.select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.isActive, true));

      type Subscriber = typeof subscribers[0];
      const filteredSubscribers = subscribers.filter((sub: Subscriber) => sub.scalingEvents);

      if (filteredSubscribers.length === 0) {
        return { success: true, sent: 0, message: "No subscribers for scaling events" };
      }

      const configs = await db.select().from(emailConfig).limit(1);
      if (configs.length === 0 || !configs[0].isVerified) {
        return { success: false, error: "Email not configured or not verified" };
      }

      const config = configs[0];
      configureEmail({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword,
        },
        from: `${config.fromName} <${config.fromEmail}>`,
      });

      const template = createScalingEventEmailTemplate({
        ...input,
        timestamp: new Date(),
      });

      let sent = 0;
      for (const subscriber of filteredSubscribers) {
        const result = await sendEmail(subscriber.email, template);
        
        await db.insert(emailHistory).values({
          subscriptionId: subscriber.id,
          toEmail: subscriber.email,
          subject: template.subject,
          templateType: "scaling",
          status: result.success ? "sent" : "failed",
          messageId: result.messageId,
          errorMessage: result.error,
          sentAt: result.success ? new Date() : null,
        });

        if (result.success) sent++;
      }

      return { success: true, sent, total: filteredSubscribers.length };
    }),
});
