/**
 * PDF Reports Router
 * tRPC endpoints for report generation and download
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  generateReport,
  type ReportType,
} from "../services/pdfReports";

const reportTypeSchema = z.enum([
  "team_analytics",
  "audit_summary",
  "security_report",
  "deployment_report",
  "activity_report",
]);

export const reportsRouter = router({
  // Generate a report
  generate: protectedProcedure
    .input(
      z.object({
        type: reportTypeSchema,
        teamId: z.number().optional(),
        startDate: z.string(), // ISO date string
        endDate: z.string(), // ISO date string
        includeCharts: z.boolean().optional().default(true),
        includeAIAnalysis: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const report = await generateReport(
        {
          type: input.type as ReportType,
          teamId: input.teamId,
          userId: ctx.user.id,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          includeCharts: input.includeCharts,
          includeAIAnalysis: input.includeAIAnalysis,
        },
        ctx.user.id
      );

      if (!report) {
        throw new Error("Failed to generate report");
      }

      return {
        id: report.id,
        title: report.title,
        type: report.type,
        generatedAt: report.generatedAt,
        dateRange: report.dateRange,
        summary: report.summary,
        aiAnalysis: report.aiAnalysis,
        htmlContent: report.htmlContent,
      };
    }),

  // Get available report types
  getTypes: protectedProcedure.query(async () => {
    return [
      {
        type: "team_analytics",
        name: "Team Analytics Report",
        description: "Comprehensive team activity and performance analysis",
        requiresTeam: true,
      },
      {
        type: "audit_summary",
        name: "Audit Log Summary",
        description: "Summary of all audit events with risk analysis",
        requiresTeam: false,
      },
      {
        type: "security_report",
        name: "Security Report",
        description: "Security-focused analysis of events and threats",
        requiresTeam: false,
      },
      {
        type: "deployment_report",
        name: "Deployment Report",
        description: "Deployment history and success metrics",
        requiresTeam: false,
      },
      {
        type: "activity_report",
        name: "Activity Report",
        description: "User and system activity overview",
        requiresTeam: false,
      },
    ];
  }),

  // Get report presets (common date ranges)
  getPresets: protectedProcedure.query(async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return [
      {
        name: "Last 7 Days",
        startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: now.toISOString(),
      },
      {
        name: "Last 30 Days",
        startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: now.toISOString(),
      },
      {
        name: "Last 90 Days",
        startDate: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: now.toISOString(),
      },
      {
        name: "This Month",
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        endDate: now.toISOString(),
      },
      {
        name: "Last Month",
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        endDate: new Date(now.getFullYear(), now.getMonth(), 0).toISOString(),
      },
      {
        name: "This Year",
        startDate: new Date(now.getFullYear(), 0, 1).toISOString(),
        endDate: now.toISOString(),
      },
    ];
  }),
});
