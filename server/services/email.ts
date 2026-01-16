import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

let transporter: Transporter | null = null;
let emailConfig: EmailConfig | null = null;

export function configureEmail(config: EmailConfig): void {
  emailConfig = config;
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
}

export function getEmailConfig(): EmailConfig | null {
  return emailConfig;
}

export function isEmailConfigured(): boolean {
  return transporter !== null && emailConfig !== null;
}

export async function testEmailConnection(): Promise<{ success: boolean; error?: string }> {
  if (!transporter) {
    return { success: false, error: 'Email not configured' };
  }
  
  try {
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendEmail(
  to: string | string[],
  template: EmailTemplate
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!transporter || !emailConfig) {
    return { success: false, error: 'Email not configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Email Templates
export function createAlertEmailTemplate(alert: {
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  resource: string;
  value: number;
  threshold: number;
  timestamp: Date;
}): EmailTemplate {
  const typeColors = {
    critical: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  const typeLabels = {
    critical: 'CRITICAL',
    warning: 'WARNING',
    info: 'INFO',
  };

  const color = typeColors[alert.type];
  const label = typeLabels[alert.type];

  return {
    subject: `[${label}] ${alert.title} - DevOps AI Dashboard`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: ${color}; color: white; padding: 20px; }
          .header h1 { margin: 0; font-size: 18px; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 8px; }
          .content { padding: 20px; }
          .metric { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
          .metric:last-child { border-bottom: none; }
          .metric-label { color: #6b7280; }
          .metric-value { font-weight: 600; color: #111827; }
          .footer { padding: 20px; background: #f9fafb; text-align: center; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; background: ${color}; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <span class="badge">${label}</span>
              <h1>${alert.title}</h1>
            </div>
            <div class="content">
              <p style="color: #374151; margin-top: 0;">${alert.message}</p>
              <div class="metric">
                <span class="metric-label">Resource</span>
                <span class="metric-value">${alert.resource}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Current Value</span>
                <span class="metric-value">${alert.value.toFixed(1)}%</span>
              </div>
              <div class="metric">
                <span class="metric-label">Threshold</span>
                <span class="metric-value">${alert.threshold}%</span>
              </div>
              <div class="metric">
                <span class="metric-label">Time</span>
                <span class="metric-value">${alert.timestamp.toLocaleString()}</span>
              </div>
              <center>
                <a href="#" class="button">View Dashboard</a>
              </center>
            </div>
            <div class="footer">
              DevOps AI Dashboard - Automated Alert Notification
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
[${label}] ${alert.title}

${alert.message}

Resource: ${alert.resource}
Current Value: ${alert.value.toFixed(1)}%
Threshold: ${alert.threshold}%
Time: ${alert.timestamp.toLocaleString()}

---
DevOps AI Dashboard - Automated Alert Notification
    `.trim(),
  };
}

export function createABTestResultEmailTemplate(experiment: {
  name: string;
  winner: 'A' | 'B' | 'none';
  variantA: { name: string; avgResponseTime: number; errorRate: number; resourceEfficiency: number };
  variantB: { name: string; avgResponseTime: number; errorRate: number; resourceEfficiency: number };
  confidence: number;
  duration: string;
  recommendation: string;
}): EmailTemplate {
  const winnerColor = experiment.winner === 'none' ? '#6b7280' : '#10b981';
  const winnerText = experiment.winner === 'none' 
    ? 'No clear winner' 
    : `Variant ${experiment.winner} wins`;

  return {
    subject: `[A/B Test Complete] ${experiment.name} - ${winnerText}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: #8b5cf6; color: white; padding: 20px; }
          .header h1 { margin: 0; font-size: 18px; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 8px; }
          .content { padding: 20px; }
          .winner-banner { background: ${winnerColor}; color: white; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
          .winner-banner h2 { margin: 0; font-size: 20px; }
          .comparison { display: flex; gap: 16px; margin-bottom: 20px; }
          .variant { flex: 1; background: #f9fafb; padding: 16px; border-radius: 8px; }
          .variant h3 { margin: 0 0 12px 0; font-size: 14px; color: #374151; }
          .variant-metric { margin-bottom: 8px; }
          .variant-metric-label { font-size: 12px; color: #6b7280; }
          .variant-metric-value { font-size: 16px; font-weight: 600; color: #111827; }
          .recommendation { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-top: 20px; }
          .recommendation h4 { margin: 0 0 8px 0; color: #92400e; }
          .recommendation p { margin: 0; color: #78350f; }
          .footer { padding: 20px; background: #f9fafb; text-align: center; color: #6b7280; font-size: 12px; }
          .confidence { font-size: 14px; color: #6b7280; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <span class="badge">A/B TEST COMPLETE</span>
              <h1>${experiment.name}</h1>
            </div>
            <div class="content">
              <div class="winner-banner">
                <h2>${winnerText}</h2>
                <p class="confidence">Confidence: ${experiment.confidence.toFixed(1)}% | Duration: ${experiment.duration}</p>
              </div>
              
              <div class="comparison">
                <div class="variant" style="${experiment.winner === 'A' ? 'border: 2px solid #10b981;' : ''}">
                  <h3>Variant A: ${experiment.variantA.name}</h3>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Avg Response Time</div>
                    <div class="variant-metric-value">${experiment.variantA.avgResponseTime.toFixed(0)}ms</div>
                  </div>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Error Rate</div>
                    <div class="variant-metric-value">${experiment.variantA.errorRate.toFixed(2)}%</div>
                  </div>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Resource Efficiency</div>
                    <div class="variant-metric-value">${experiment.variantA.resourceEfficiency.toFixed(1)}%</div>
                  </div>
                </div>
                
                <div class="variant" style="${experiment.winner === 'B' ? 'border: 2px solid #10b981;' : ''}">
                  <h3>Variant B: ${experiment.variantB.name}</h3>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Avg Response Time</div>
                    <div class="variant-metric-value">${experiment.variantB.avgResponseTime.toFixed(0)}ms</div>
                  </div>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Error Rate</div>
                    <div class="variant-metric-value">${experiment.variantB.errorRate.toFixed(2)}%</div>
                  </div>
                  <div class="variant-metric">
                    <div class="variant-metric-label">Resource Efficiency</div>
                    <div class="variant-metric-value">${experiment.variantB.resourceEfficiency.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
              
              <div class="recommendation">
                <h4>AI Recommendation</h4>
                <p>${experiment.recommendation}</p>
              </div>
            </div>
            <div class="footer">
              DevOps AI Dashboard - A/B Test Results
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
[A/B TEST COMPLETE] ${experiment.name}

${winnerText}
Confidence: ${experiment.confidence.toFixed(1)}%
Duration: ${experiment.duration}

Variant A: ${experiment.variantA.name}
- Avg Response Time: ${experiment.variantA.avgResponseTime.toFixed(0)}ms
- Error Rate: ${experiment.variantA.errorRate.toFixed(2)}%
- Resource Efficiency: ${experiment.variantA.resourceEfficiency.toFixed(1)}%

Variant B: ${experiment.variantB.name}
- Avg Response Time: ${experiment.variantB.avgResponseTime.toFixed(0)}ms
- Error Rate: ${experiment.variantB.errorRate.toFixed(2)}%
- Resource Efficiency: ${experiment.variantB.resourceEfficiency.toFixed(1)}%

AI Recommendation:
${experiment.recommendation}

---
DevOps AI Dashboard - A/B Test Results
    `.trim(),
  };
}

export function createScalingEventEmailTemplate(event: {
  type: 'scale_up' | 'scale_down' | 'scheduled';
  resource: string;
  previousReplicas: number;
  newReplicas: number;
  reason: string;
  aiRecommendation?: string;
  timestamp: Date;
}): EmailTemplate {
  const typeLabels = {
    scale_up: 'SCALE UP',
    scale_down: 'SCALE DOWN',
    scheduled: 'SCHEDULED SCALING',
  };

  const typeColors = {
    scale_up: '#10b981',
    scale_down: '#f59e0b',
    scheduled: '#3b82f6',
  };

  const label = typeLabels[event.type];
  const color = typeColors[event.type];

  return {
    subject: `[${label}] ${event.resource}: ${event.previousReplicas} → ${event.newReplicas} replicas`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: ${color}; color: white; padding: 20px; }
          .header h1 { margin: 0; font-size: 18px; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 8px; }
          .content { padding: 20px; }
          .scaling-visual { text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px; margin-bottom: 20px; }
          .scaling-numbers { display: flex; align-items: center; justify-content: center; gap: 20px; }
          .replica-count { font-size: 36px; font-weight: 700; color: #111827; }
          .arrow { font-size: 24px; color: ${color}; }
          .metric { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
          .metric:last-child { border-bottom: none; }
          .metric-label { color: #6b7280; }
          .metric-value { font-weight: 600; color: #111827; }
          .ai-recommendation { background: #ede9fe; border-left: 4px solid #8b5cf6; padding: 16px; margin-top: 20px; }
          .ai-recommendation h4 { margin: 0 0 8px 0; color: #5b21b6; }
          .ai-recommendation p { margin: 0; color: #6d28d9; }
          .footer { padding: 20px; background: #f9fafb; text-align: center; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <span class="badge">${label}</span>
              <h1>${event.resource}</h1>
            </div>
            <div class="content">
              <div class="scaling-visual">
                <div class="scaling-numbers">
                  <span class="replica-count">${event.previousReplicas}</span>
                  <span class="arrow">→</span>
                  <span class="replica-count">${event.newReplicas}</span>
                </div>
                <p style="color: #6b7280; margin: 8px 0 0 0;">replicas</p>
              </div>
              
              <div class="metric">
                <span class="metric-label">Reason</span>
                <span class="metric-value">${event.reason}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Time</span>
                <span class="metric-value">${event.timestamp.toLocaleString()}</span>
              </div>
              
              ${event.aiRecommendation ? `
              <div class="ai-recommendation">
                <h4>AI Analysis</h4>
                <p>${event.aiRecommendation}</p>
              </div>
              ` : ''}
            </div>
            <div class="footer">
              DevOps AI Dashboard - Scaling Event Notification
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
[${label}] ${event.resource}

Replicas: ${event.previousReplicas} → ${event.newReplicas}
Reason: ${event.reason}
Time: ${event.timestamp.toLocaleString()}
${event.aiRecommendation ? `\nAI Analysis:\n${event.aiRecommendation}` : ''}

---
DevOps AI Dashboard - Scaling Event Notification
    `.trim(),
  };
}
