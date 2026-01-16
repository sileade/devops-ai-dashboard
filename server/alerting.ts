/**
 * Alerting Service for DevOps AI Dashboard
 * 
 * Provides unified interface for sending alerts to:
 * - PagerDuty
 * - Opsgenie
 * - Slack
 * - Discord
 * - Email
 */

// Environment variables are accessed via process.env

// Alert severity levels
export type AlertSeverity = 'critical' | 'error' | 'warning' | 'info';

// Alert interface
export interface Alert {
  title: string;
  description: string;
  severity: AlertSeverity;
  source: string;
  deduplicationKey?: string;
  details?: Record<string, string>;
  links?: Array<{ href: string; text: string }>;
  tags?: string[];
}

// Alert result
export interface AlertResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

/**
 * Send alert to PagerDuty
 */
export async function sendPagerDutyAlert(alert: Alert): Promise<AlertResult> {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  
  if (!routingKey) {
    return { success: false, provider: 'pagerduty', error: 'PAGERDUTY_ROUTING_KEY not configured' };
  }

  const severityMap: Record<AlertSeverity, string> = {
    critical: 'critical',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };

  const payload = {
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: alert.deduplicationKey || `${alert.source}-${alert.title}`,
    payload: {
      summary: alert.title,
      source: alert.source,
      severity: severityMap[alert.severity],
      timestamp: new Date().toISOString(),
      custom_details: {
        description: alert.description,
        ...alert.details
      }
    },
    links: alert.links?.map(l => ({ href: l.href, text: l.text })) || [],
    images: []
  };

  try {
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (response.ok) {
      return { success: true, provider: 'pagerduty', messageId: data.dedup_key };
    } else {
      return { success: false, provider: 'pagerduty', error: data.message || 'Unknown error' };
    }
  } catch (error) {
    return { success: false, provider: 'pagerduty', error: String(error) };
  }
}

/**
 * Resolve PagerDuty alert
 */
export async function resolvePagerDutyAlert(deduplicationKey: string): Promise<AlertResult> {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
  
  if (!routingKey) {
    return { success: false, provider: 'pagerduty', error: 'PAGERDUTY_ROUTING_KEY not configured' };
  }

  const payload = {
    routing_key: routingKey,
    event_action: 'resolve',
    dedup_key: deduplicationKey
  };

  try {
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return { success: true, provider: 'pagerduty' };
    } else {
      const data = await response.json();
      return { success: false, provider: 'pagerduty', error: data.message || 'Unknown error' };
    }
  } catch (error) {
    return { success: false, provider: 'pagerduty', error: String(error) };
  }
}

/**
 * Send alert to Opsgenie
 */
export async function sendOpsgenieAlert(alert: Alert): Promise<AlertResult> {
  const apiKey = process.env.OPSGENIE_API_KEY;
  
  if (!apiKey) {
    return { success: false, provider: 'opsgenie', error: 'OPSGENIE_API_KEY not configured' };
  }

  const priorityMap: Record<AlertSeverity, string> = {
    critical: 'P1',
    error: 'P2',
    warning: 'P3',
    info: 'P5'
  };

  const payload = {
    message: alert.title,
    description: alert.description,
    priority: priorityMap[alert.severity],
    source: alert.source,
    alias: alert.deduplicationKey || `${alert.source}-${alert.title}`,
    tags: alert.tags || ['devops-dashboard'],
    details: alert.details || {},
    entity: alert.source
  };

  try {
    const response = await fetch('https://api.opsgenie.com/v2/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `GenieKey ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (response.ok) {
      return { success: true, provider: 'opsgenie', messageId: data.requestId };
    } else {
      return { success: false, provider: 'opsgenie', error: data.message || 'Unknown error' };
    }
  } catch (error) {
    return { success: false, provider: 'opsgenie', error: String(error) };
  }
}

/**
 * Close Opsgenie alert
 */
export async function closeOpsgenieAlert(alias: string): Promise<AlertResult> {
  const apiKey = process.env.OPSGENIE_API_KEY;
  
  if (!apiKey) {
    return { success: false, provider: 'opsgenie', error: 'OPSGENIE_API_KEY not configured' };
  }

  try {
    const response = await fetch(`https://api.opsgenie.com/v2/alerts/${alias}/close?identifierType=alias`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `GenieKey ${apiKey}`
      },
      body: JSON.stringify({ source: 'DevOps AI Dashboard' })
    });

    if (response.ok) {
      return { success: true, provider: 'opsgenie' };
    } else {
      const data = await response.json();
      return { success: false, provider: 'opsgenie', error: data.message || 'Unknown error' };
    }
  } catch (error) {
    return { success: false, provider: 'opsgenie', error: String(error) };
  }
}

/**
 * Send alert to Slack
 */
export async function sendSlackAlert(alert: Alert): Promise<AlertResult> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    return { success: false, provider: 'slack', error: 'SLACK_WEBHOOK_URL not configured' };
  }

  const colorMap: Record<AlertSeverity, string> = {
    critical: '#dc3545',
    error: '#fd7e14',
    warning: '#ffc107',
    info: '#17a2b8'
  };

  const emojiMap: Record<AlertSeverity, string> = {
    critical: '🚨',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const payload = {
    attachments: [{
      color: colorMap[alert.severity],
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emojiMap[alert.severity]} ${alert.title}`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: alert.description
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*Source:* ${alert.source} | *Severity:* ${alert.severity.toUpperCase()} | *Time:* ${new Date().toISOString()}`
            }
          ]
        }
      ]
    }]
  };

  // Add details if present
  if (alert.details && Object.keys(alert.details).length > 0) {
    const detailsText = Object.entries(alert.details)
      .map(([key, value]) => `*${key}:* ${value}`)
      .join('\n');
    
    payload.attachments[0].blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: detailsText
      }
    });
  }

  // Add action buttons if links present
  if (alert.links && alert.links.length > 0) {
    (payload.attachments[0].blocks as any[]).push({
      type: 'actions',
      elements: alert.links.map(link => ({
        type: 'button',
        text: {
          type: 'plain_text',
          text: link.text
        },
        url: link.href
      }))
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return { success: true, provider: 'slack' };
    } else {
      const text = await response.text();
      return { success: false, provider: 'slack', error: text };
    }
  } catch (error) {
    return { success: false, provider: 'slack', error: String(error) };
  }
}

/**
 * Send alert to Discord
 */
export async function sendDiscordAlert(alert: Alert): Promise<AlertResult> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    return { success: false, provider: 'discord', error: 'DISCORD_WEBHOOK_URL not configured' };
  }

  const colorMap: Record<AlertSeverity, number> = {
    critical: 0xdc3545,
    error: 0xfd7e14,
    warning: 0xffc107,
    info: 0x17a2b8
  };

  const payload = {
    embeds: [{
      title: alert.title,
      description: alert.description,
      color: colorMap[alert.severity],
      fields: [
        { name: 'Source', value: alert.source, inline: true },
        { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
        ...(alert.details ? Object.entries(alert.details).map(([name, value]) => ({ name, value, inline: true })) : [])
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'DevOps AI Dashboard'
      }
    }]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return { success: true, provider: 'discord' };
    } else {
      const text = await response.text();
      return { success: false, provider: 'discord', error: text };
    }
  } catch (error) {
    return { success: false, provider: 'discord', error: String(error) };
  }
}

/**
 * Send alert to all configured providers based on severity
 */
export async function sendAlert(alert: Alert): Promise<AlertResult[]> {
  const results: AlertResult[] = [];

  // Critical alerts go to PagerDuty + Opsgenie + Slack
  if (alert.severity === 'critical') {
    const [pagerduty, opsgenie, slack] = await Promise.all([
      sendPagerDutyAlert(alert),
      sendOpsgenieAlert(alert),
      sendSlackAlert(alert)
    ]);
    results.push(pagerduty, opsgenie, slack);
  }
  // Error alerts go to Opsgenie + Slack
  else if (alert.severity === 'error') {
    const [opsgenie, slack] = await Promise.all([
      sendOpsgenieAlert(alert),
      sendSlackAlert(alert)
    ]);
    results.push(opsgenie, slack);
  }
  // Warning alerts go to Slack + Discord
  else if (alert.severity === 'warning') {
    const [slack, discord] = await Promise.all([
      sendSlackAlert(alert),
      sendDiscordAlert(alert)
    ]);
    results.push(slack, discord);
  }
  // Info alerts go to Slack only
  else {
    const slack = await sendSlackAlert(alert);
    results.push(slack);
  }

  return results;
}

/**
 * Resolve alert across all providers
 */
export async function resolveAlert(deduplicationKey: string): Promise<AlertResult[]> {
  const results: AlertResult[] = [];

  const [pagerduty, opsgenie] = await Promise.all([
    resolvePagerDutyAlert(deduplicationKey),
    closeOpsgenieAlert(deduplicationKey)
  ]);

  results.push(pagerduty, opsgenie);

  // Send resolution notification to Slack
  const slack = await sendSlackAlert({
    title: '✅ Alert Resolved',
    description: `Alert ${deduplicationKey} has been resolved`,
    severity: 'info',
    source: 'DevOps AI Dashboard'
  });
  results.push(slack);

  return results;
}

export default {
  sendAlert,
  resolveAlert,
  sendPagerDutyAlert,
  resolvePagerDutyAlert,
  sendOpsgenieAlert,
  closeOpsgenieAlert,
  sendSlackAlert,
  sendDiscordAlert
};
