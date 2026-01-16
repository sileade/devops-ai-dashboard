/**
 * PDF Report Generation Service
 * Generates PDF reports with charts and analytics for teams
 */

import { getDb } from "../db";
import {
  auditLogs,
  teams,
  teamMembers,
  users,
} from "../../drizzle/schema";
import { eq, and, desc, gte, lte, sql, count } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ============================================
// TYPES
// ============================================

export type ReportType = 
  | "team_analytics"
  | "audit_summary"
  | "security_report"
  | "deployment_report"
  | "activity_report";

export interface ReportConfig {
  type: ReportType;
  teamId?: number;
  userId?: number;
  startDate: Date;
  endDate: Date;
  includeCharts: boolean;
  includeAIAnalysis: boolean;
}

export interface ChartData {
  type: "bar" | "line" | "pie" | "doughnut";
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
  }[];
}

export interface ReportSection {
  title: string;
  content: string;
  charts?: ChartData[];
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export interface GeneratedReport {
  id: string;
  type: ReportType;
  title: string;
  generatedAt: number;
  generatedBy: number;
  teamId?: number;
  dateRange: {
    start: string;
    end: string;
  };
  sections: ReportSection[];
  summary: string;
  aiAnalysis?: string;
  htmlContent: string;
}

// ============================================
// REPORT DATA COLLECTION
// ============================================

async function getTeamAnalyticsData(teamId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return null;

  // Get team info
  const team = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (team.length === 0) return null;

  // Get team members
  const members = await db
    .select({
      userId: teamMembers.userId,
      role: teamMembers.role,
      joinedAt: teamMembers.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(teamMembers)
    .leftJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId));

  // Get audit logs for team
  const logs = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.teamId, teamId),
        gte(auditLogs.createdAt, startDate),
        lte(auditLogs.createdAt, endDate)
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1000);

  // Aggregate by action
  const actionCounts: Record<string, number> = {};
  const riskCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  const dailyActivity: Record<string, number> = {};
  const userActivity: Record<string, number> = {};

  for (const log of logs) {
    // Count by action
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    
    // Count by risk
    if (log.riskLevel) {
      riskCounts[log.riskLevel] = (riskCounts[log.riskLevel] || 0) + 1;
    }
    
    // Count by day
    const day = new Date(log.createdAt).toISOString().split('T')[0];
    dailyActivity[day] = (dailyActivity[day] || 0) + 1;
    
    // Count by user
    if (log.userId) {
      userActivity[log.userId.toString()] = (userActivity[log.userId.toString()] || 0) + 1;
    }
  }

  return {
    team: team[0],
    members,
    totalLogs: logs.length,
    actionCounts,
    riskCounts,
    dailyActivity,
    userActivity,
    recentLogs: logs.slice(0, 20),
  };
}

async function getAuditSummaryData(startDate: Date, endDate: Date, teamId?: number) {
  const db = await getDb();
  if (!db) return null;

  const conditions = [
    gte(auditLogs.createdAt, startDate),
    lte(auditLogs.createdAt, endDate),
  ];
  
  if (teamId) {
    conditions.push(eq(auditLogs.teamId, teamId));
  }

  const logs = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(5000);

  // Aggregate data
  const byAction: Record<string, number> = {};
  const byRisk: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  const byStatus: Record<string, number> = { success: 0, failure: 0, pending: 0 };
  const byResourceType: Record<string, number> = {};
  const byHour: Record<number, number> = {};
  const byDay: Record<string, number> = {};

  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    if (log.riskLevel) byRisk[log.riskLevel] = (byRisk[log.riskLevel] || 0) + 1;
    if (log.status) byStatus[log.status] = (byStatus[log.status] || 0) + 1;
    if (log.resourceType) byResourceType[log.resourceType] = (byResourceType[log.resourceType] || 0) + 1;
    
    const date = new Date(log.createdAt);
    byHour[date.getHours()] = (byHour[date.getHours()] || 0) + 1;
    const day = date.toISOString().split('T')[0];
    byDay[day] = (byDay[day] || 0) + 1;
  }

  // Get critical events
  const criticalEvents = logs.filter(l => l.riskLevel === "critical" || l.riskLevel === "high");

  return {
    totalEvents: logs.length,
    byAction,
    byRisk,
    byStatus,
    byResourceType,
    byHour,
    byDay,
    criticalEvents: criticalEvents.slice(0, 50),
    failedEvents: logs.filter(l => l.status === "failure").slice(0, 50),
  };
}

// ============================================
// CHART GENERATION
// ============================================

function generateActivityChart(dailyData: Record<string, number>): ChartData {
  const sortedDays = Object.keys(dailyData).sort();
  return {
    type: "line",
    title: "Daily Activity",
    labels: sortedDays.map(d => new Date(d).toLocaleDateString()),
    datasets: [{
      label: "Events",
      data: sortedDays.map(d => dailyData[d]),
      borderColor: "#3B82F6",
      backgroundColor: "rgba(59, 130, 246, 0.1)",
    }],
  };
}

function generateRiskDistributionChart(riskData: Record<string, number>): ChartData {
  return {
    type: "doughnut",
    title: "Risk Distribution",
    labels: ["Low", "Medium", "High", "Critical"],
    datasets: [{
      label: "Events",
      data: [riskData.low || 0, riskData.medium || 0, riskData.high || 0, riskData.critical || 0],
      backgroundColor: ["#22C55E", "#EAB308", "#F97316", "#EF4444"],
    }],
  };
}

function generateActionBreakdownChart(actionData: Record<string, number>): ChartData {
  const sortedActions = Object.entries(actionData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  return {
    type: "bar",
    title: "Top Actions",
    labels: sortedActions.map(([action]) => action),
    datasets: [{
      label: "Count",
      data: sortedActions.map(([, count]) => count),
      backgroundColor: "#8B5CF6",
    }],
  };
}

function generateHourlyActivityChart(hourlyData: Record<number, number>): ChartData {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return {
    type: "bar",
    title: "Activity by Hour",
    labels: hours.map(h => `${h}:00`),
    datasets: [{
      label: "Events",
      data: hours.map(h => hourlyData[h] || 0),
      backgroundColor: "#06B6D4",
    }],
  };
}

// ============================================
// HTML GENERATION
// ============================================

function generateChartSvg(chart: ChartData): string {
  const width = 400;
  const height = 250;
  const padding = 40;
  
  if (chart.type === "bar") {
    const data = chart.datasets[0].data;
    const maxValue = Math.max(...data, 1);
    const barWidth = (width - padding * 2) / data.length - 4;
    
    let bars = "";
    data.forEach((value, i) => {
      const barHeight = (value / maxValue) * (height - padding * 2);
      const x = padding + i * (barWidth + 4);
      const y = height - padding - barHeight;
      bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${Array.isArray(chart.datasets[0].backgroundColor) ? chart.datasets[0].backgroundColor[i] : chart.datasets[0].backgroundColor || '#3B82F6'}" rx="2"/>`;
      bars += `<text x="${x + barWidth/2}" y="${height - 10}" text-anchor="middle" font-size="8" fill="#666">${chart.labels[i].slice(0, 8)}</text>`;
    });
    
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#f8f9fa" rx="8"/>
      <text x="${width/2}" y="20" text-anchor="middle" font-weight="bold" font-size="12" fill="#333">${chart.title}</text>
      ${bars}
    </svg>`;
  }
  
  if (chart.type === "line") {
    const data = chart.datasets[0].data;
    const maxValue = Math.max(...data, 1);
    const points: string[] = [];
    
    data.forEach((value, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
      const y = height - padding - (value / maxValue) * (height - padding * 2);
      points.push(`${x},${y}`);
    });
    
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#f8f9fa" rx="8"/>
      <text x="${width/2}" y="20" text-anchor="middle" font-weight="bold" font-size="12" fill="#333">${chart.title}</text>
      <polyline points="${points.join(' ')}" fill="none" stroke="${chart.datasets[0].borderColor || '#3B82F6'}" stroke-width="2"/>
      ${points.map((p, i) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3" fill="${chart.datasets[0].borderColor || '#3B82F6'}"/>`).join('')}
    </svg>`;
  }
  
  if (chart.type === "doughnut" || chart.type === "pie") {
    const data = chart.datasets[0].data;
    const total = data.reduce((a, b) => a + b, 0) || 1;
    const colors = chart.datasets[0].backgroundColor as string[];
    const cx = width / 2;
    const cy = height / 2 + 10;
    const r = 70;
    const innerR = chart.type === "doughnut" ? 40 : 0;
    
    let paths = "";
    let startAngle = -Math.PI / 2;
    
    data.forEach((value, i) => {
      const angle = (value / total) * Math.PI * 2;
      const endAngle = startAngle + angle;
      
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      
      const largeArc = angle > Math.PI ? 1 : 0;
      
      if (innerR > 0) {
        const ix1 = cx + innerR * Math.cos(startAngle);
        const iy1 = cy + innerR * Math.sin(startAngle);
        const ix2 = cx + innerR * Math.cos(endAngle);
        const iy2 = cy + innerR * Math.sin(endAngle);
        paths += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z" fill="${colors[i]}"/>`;
      } else {
        paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${colors[i]}"/>`;
      }
      
      startAngle = endAngle;
    });
    
    // Legend
    let legend = "";
    chart.labels.forEach((label, i) => {
      legend += `<rect x="${width - 100}" y="${40 + i * 18}" width="12" height="12" fill="${colors[i]}" rx="2"/>`;
      legend += `<text x="${width - 82}" y="${50 + i * 18}" font-size="10" fill="#333">${label}: ${data[i]}</text>`;
    });
    
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#f8f9fa" rx="8"/>
      <text x="${width/2}" y="20" text-anchor="middle" font-weight="bold" font-size="12" fill="#333">${chart.title}</text>
      ${paths}
      ${legend}
    </svg>`;
  }
  
  return "";
}

function generateHtmlReport(report: GeneratedReport): string {
  const chartsHtml = report.sections
    .flatMap(s => s.charts || [])
    .map(chart => generateChartSvg(chart))
    .join("\n");

  const sectionsHtml = report.sections.map(section => `
    <div class="section">
      <h2>${section.title}</h2>
      <div class="content">${section.content}</div>
      ${section.charts ? section.charts.map(c => generateChartSvg(c)).join('') : ''}
      ${section.table ? `
        <table>
          <thead>
            <tr>${section.table.headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${section.table.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>
  `).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6; padding: 40px; max-width: 1000px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .header h1 { font-size: 28px; color: #1f2937; margin-bottom: 8px; }
    .header .meta { color: #6b7280; font-size: 14px; }
    .summary { background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 32px; }
    .summary h2 { font-size: 18px; margin-bottom: 12px; }
    .summary p { opacity: 0.95; }
    .section { margin-bottom: 32px; }
    .section h2 { font-size: 20px; color: #1f2937; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    .content { margin-bottom: 16px; }
    .ai-analysis { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 0 8px 8px 0; margin-top: 24px; }
    .ai-analysis h3 { color: #166534; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    tr:hover { background: #f9fafb; }
    svg { margin: 16px 0; display: block; }
    .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
    @media print { body { padding: 20px; } .section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.title}</h1>
    <div class="meta">
      Generated: ${new Date(report.generatedAt).toLocaleString()}<br>
      Period: ${report.dateRange.start} to ${report.dateRange.end}
    </div>
  </div>
  
  <div class="summary">
    <h2>Executive Summary</h2>
    <p>${report.summary}</p>
  </div>
  
  ${sectionsHtml}
  
  ${report.aiAnalysis ? `
    <div class="ai-analysis">
      <h3>🤖 AI Analysis & Recommendations</h3>
      <p>${report.aiAnalysis}</p>
    </div>
  ` : ''}
  
  <div class="footer">
    DevOps AI Dashboard - Report ID: ${report.id}
  </div>
</body>
</html>`;
}

// ============================================
// REPORT GENERATION
// ============================================

export async function generateTeamAnalyticsReport(
  config: ReportConfig,
  userId: number
): Promise<GeneratedReport | null> {
  if (!config.teamId) return null;
  
  const data = await getTeamAnalyticsData(config.teamId, config.startDate, config.endDate);
  if (!data) return null;

  const sections: ReportSection[] = [
    {
      title: "Team Overview",
      content: `<p><strong>Team:</strong> ${data.team.name}</p>
        <p><strong>Members:</strong> ${data.members.length}</p>
        <p><strong>Total Events:</strong> ${data.totalLogs}</p>
        <p><strong>Period:</strong> ${config.startDate.toLocaleDateString()} - ${config.endDate.toLocaleDateString()}</p>`,
    },
    {
      title: "Activity Analysis",
      content: `<p>The team recorded ${data.totalLogs} events during this period.</p>`,
      charts: config.includeCharts ? [
        generateActivityChart(data.dailyActivity),
        generateRiskDistributionChart(data.riskCounts),
      ] : undefined,
    },
    {
      title: "Action Breakdown",
      content: `<p>Most frequent actions performed by team members:</p>`,
      charts: config.includeCharts ? [generateActionBreakdownChart(data.actionCounts)] : undefined,
      table: {
        headers: ["Action", "Count", "Percentage"],
        rows: Object.entries(data.actionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([action, count]) => [
            action,
            count.toString(),
            `${((count / data.totalLogs) * 100).toFixed(1)}%`,
          ]),
      },
    },
    {
      title: "Team Members Activity",
      content: `<p>Activity breakdown by team member:</p>`,
      table: {
        headers: ["Member", "Role", "Events", "Joined"],
        rows: data.members.map(m => [
          m.userName || "Unknown",
          m.role,
          (data.userActivity[m.userId.toString()] || 0).toString(),
          m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "N/A",
        ]),
      },
    },
  ];

  let aiAnalysis: string | undefined;
  if (config.includeAIAnalysis) {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a DevOps analyst. Provide brief, actionable insights based on team activity data. Focus on security, efficiency, and recommendations. Keep response under 200 words.",
          },
          {
            role: "user",
            content: `Analyze this team activity data:
Team: ${data.team.name}
Members: ${data.members.length}
Total Events: ${data.totalLogs}
Risk Distribution: ${JSON.stringify(data.riskCounts)}
Top Actions: ${JSON.stringify(Object.entries(data.actionCounts).slice(0, 5))}

Provide key insights and recommendations.`,
          },
        ],
      });
      aiAnalysis = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content 
        : undefined;
    } catch (e) {
      console.error("AI analysis failed:", e);
    }
  }

  const report: GeneratedReport = {
    id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: "team_analytics",
    title: `Team Analytics Report - ${data.team.name}`,
    generatedAt: Date.now(),
    generatedBy: userId,
    teamId: config.teamId,
    dateRange: {
      start: config.startDate.toISOString().split('T')[0],
      end: config.endDate.toISOString().split('T')[0],
    },
    sections,
    summary: `This report covers ${data.totalLogs} events from ${data.members.length} team members over the selected period. Risk distribution shows ${data.riskCounts.critical || 0} critical, ${data.riskCounts.high || 0} high, ${data.riskCounts.medium || 0} medium, and ${data.riskCounts.low || 0} low risk events.`,
    aiAnalysis,
    htmlContent: "",
  };

  report.htmlContent = generateHtmlReport(report);
  return report;
}

export async function generateAuditSummaryReport(
  config: ReportConfig,
  userId: number
): Promise<GeneratedReport | null> {
  const data = await getAuditSummaryData(config.startDate, config.endDate, config.teamId);
  if (!data) return null;

  const sections: ReportSection[] = [
    {
      title: "Overview",
      content: `<p><strong>Total Events:</strong> ${data.totalEvents}</p>
        <p><strong>Success Rate:</strong> ${((data.byStatus.success / data.totalEvents) * 100).toFixed(1)}%</p>
        <p><strong>Critical Events:</strong> ${data.criticalEvents.length}</p>
        <p><strong>Failed Operations:</strong> ${data.failedEvents.length}</p>`,
    },
    {
      title: "Risk Analysis",
      content: `<p>Distribution of events by risk level:</p>`,
      charts: config.includeCharts ? [generateRiskDistributionChart(data.byRisk)] : undefined,
    },
    {
      title: "Activity Patterns",
      content: `<p>When are most events occurring?</p>`,
      charts: config.includeCharts ? [
        generateActivityChart(data.byDay),
        generateHourlyActivityChart(data.byHour),
      ] : undefined,
    },
    {
      title: "Top Actions",
      content: `<p>Most frequently performed actions:</p>`,
      charts: config.includeCharts ? [generateActionBreakdownChart(data.byAction)] : undefined,
    },
    {
      title: "Critical Events",
      content: `<p>High-risk events requiring attention:</p>`,
      table: data.criticalEvents.length > 0 ? {
        headers: ["Time", "Action", "Resource", "Risk", "Status"],
        rows: data.criticalEvents.slice(0, 20).map(e => [
          new Date(e.createdAt).toLocaleString(),
          e.action,
          e.resourceName || "-",
          e.riskLevel || "-",
          e.status || "-",
        ]),
      } : undefined,
    },
  ];

  let aiAnalysis: string | undefined;
  if (config.includeAIAnalysis) {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a security analyst. Analyze audit log data and provide security insights and recommendations. Keep response under 200 words.",
          },
          {
            role: "user",
            content: `Analyze this audit summary:
Total Events: ${data.totalEvents}
Risk Distribution: ${JSON.stringify(data.byRisk)}
Status Distribution: ${JSON.stringify(data.byStatus)}
Critical Events: ${data.criticalEvents.length}
Failed Events: ${data.failedEvents.length}

Provide security insights and recommendations.`,
          },
        ],
      });
      aiAnalysis = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content 
        : undefined;
    } catch (e) {
      console.error("AI analysis failed:", e);
    }
  }

  const report: GeneratedReport = {
    id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: "audit_summary",
    title: "Audit Log Summary Report",
    generatedAt: Date.now(),
    generatedBy: userId,
    teamId: config.teamId,
    dateRange: {
      start: config.startDate.toISOString().split('T')[0],
      end: config.endDate.toISOString().split('T')[0],
    },
    sections,
    summary: `This audit summary covers ${data.totalEvents} events. The success rate is ${((data.byStatus.success / data.totalEvents) * 100).toFixed(1)}%. There were ${data.criticalEvents.length} critical events and ${data.failedEvents.length} failed operations during this period.`,
    aiAnalysis,
    htmlContent: "",
  };

  report.htmlContent = generateHtmlReport(report);
  return report;
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

export async function generateReport(
  config: ReportConfig,
  userId: number
): Promise<GeneratedReport | null> {
  switch (config.type) {
    case "team_analytics":
      return generateTeamAnalyticsReport(config, userId);
    case "audit_summary":
    case "security_report":
      return generateAuditSummaryReport(config, userId);
    default:
      return generateAuditSummaryReport(config, userId);
  }
}
