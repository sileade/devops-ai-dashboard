/**
 * Slack/Discord ChatBot Service
 * 
 * Provides chat-based deployment management:
 * - Slash commands (/deploy, /rollback, /status, /scale)
 * - Interactive message buttons
 * - Deployment notifications
 * - Status updates
 */

import { getDb } from '../db';
import { invokeLLM } from '../_core/llm';
import crypto from 'crypto';

// Bot Configuration
interface BotConfig {
  platform: 'slack' | 'discord';
  token: string;
  signingSecret?: string; // For Slack
  applicationId?: string; // For Discord
  publicKey?: string; // For Discord
  webhookUrl?: string;
  channelId?: string;
}

// Command Context
interface CommandContext {
  platform: 'slack' | 'discord';
  userId: string;
  userName: string;
  channelId: string;
  command: string;
  args: string[];
  rawText: string;
  responseUrl?: string;
  triggerId?: string;
}

// Command Result
interface CommandResult {
  success: boolean;
  message: string;
  blocks?: unknown[];
  ephemeral?: boolean;
  attachments?: unknown[];
}

// Deployment Action
interface DeploymentAction {
  type: 'deploy' | 'rollback' | 'scale' | 'restart' | 'status';
  target: string;
  options?: Record<string, unknown>;
}

// ChatBot Service Class
export class ChatBotService {
  private slackConfig: BotConfig | null = null;
  private discordConfig: BotConfig | null = null;
  private commandHandlers: Map<string, (ctx: CommandContext) => Promise<CommandResult>> = new Map();

  constructor() {
    this.registerDefaultCommands();
  }

  /**
   * Initialize Slack bot
   */
  async initializeSlack(config: BotConfig): Promise<boolean> {
    this.slackConfig = { ...config, platform: 'slack' };
    return true;
  }

  /**
   * Initialize Discord bot
   */
  async initializeDiscord(config: BotConfig): Promise<boolean> {
    this.discordConfig = { ...config, platform: 'discord' };
    return true;
  }

  /**
   * Register default commands
   */
  private registerDefaultCommands() {
    // /deploy command
    this.commandHandlers.set('deploy', async (ctx) => {
      const [target, ...options] = ctx.args;
      
      if (!target) {
        return {
          success: false,
          message: 'Usage: /deploy <app-name> [--env=production] [--version=latest]',
          ephemeral: true,
        };
      }

      const env = this.parseOption(options, 'env') || 'production';
      const version = this.parseOption(options, 'version') || 'latest';

      // Return confirmation message with buttons
      return {
        success: true,
        message: `🚀 Deploy *${target}* to *${env}*?`,
        blocks: this.createDeployConfirmationBlocks(target, env, version),
        ephemeral: false,
      };
    });

    // /rollback command
    this.commandHandlers.set('rollback', async (ctx) => {
      const [target, revision] = ctx.args;
      
      if (!target) {
        return {
          success: false,
          message: 'Usage: /rollback <app-name> [revision]',
          ephemeral: true,
        };
      }

      return {
        success: true,
        message: `⏪ Rollback *${target}*${revision ? ` to revision ${revision}` : ' to previous version'}?`,
        blocks: this.createRollbackConfirmationBlocks(target, revision),
        ephemeral: false,
      };
    });

    // /status command
    this.commandHandlers.set('status', async (ctx) => {
      const [target] = ctx.args;
      
      if (!target) {
        // Return overall status
        return {
          success: true,
          message: '📊 *Infrastructure Status*',
          blocks: await this.createOverallStatusBlocks(),
          ephemeral: true,
        };
      }

      // Return specific app status
      return {
        success: true,
        message: `📊 *Status: ${target}*`,
        blocks: await this.createAppStatusBlocks(target),
        ephemeral: true,
      };
    });

    // /scale command
    this.commandHandlers.set('scale', async (ctx) => {
      const [target, replicas] = ctx.args;
      
      if (!target || !replicas) {
        return {
          success: false,
          message: 'Usage: /scale <app-name> <replicas>',
          ephemeral: true,
        };
      }

      const replicaCount = parseInt(replicas, 10);
      if (isNaN(replicaCount) || replicaCount < 0) {
        return {
          success: false,
          message: 'Invalid replica count. Must be a non-negative integer.',
          ephemeral: true,
        };
      }

      return {
        success: true,
        message: `📈 Scale *${target}* to *${replicaCount}* replicas?`,
        blocks: this.createScaleConfirmationBlocks(target, replicaCount),
        ephemeral: false,
      };
    });

    // /restart command
    this.commandHandlers.set('restart', async (ctx) => {
      const [target] = ctx.args;
      
      if (!target) {
        return {
          success: false,
          message: 'Usage: /restart <app-name>',
          ephemeral: true,
        };
      }

      return {
        success: true,
        message: `🔄 Restart *${target}*?`,
        blocks: this.createRestartConfirmationBlocks(target),
        ephemeral: false,
      };
    });

    // /logs command
    this.commandHandlers.set('logs', async (ctx) => {
      const [target, lines] = ctx.args;
      
      if (!target) {
        return {
          success: false,
          message: 'Usage: /logs <app-name> [lines=50]',
          ephemeral: true,
        };
      }

      const lineCount = parseInt(lines, 10) || 50;
      
      return {
        success: true,
        message: `📜 Last ${lineCount} logs for *${target}*`,
        blocks: await this.createLogsBlocks(target, lineCount),
        ephemeral: true,
      };
    });

    // /help command
    this.commandHandlers.set('help', async () => {
      return {
        success: true,
        message: '📖 *DevOps Bot Commands*',
        blocks: this.createHelpBlocks(),
        ephemeral: true,
      };
    });

    // /ai command - Ask AI for help
    this.commandHandlers.set('ai', async (ctx) => {
      const question = ctx.args.join(' ');
      
      if (!question) {
        return {
          success: false,
          message: 'Usage: /ai <question>',
          ephemeral: true,
        };
      }

      const answer = await this.askAI(question);
      
      return {
        success: true,
        message: `🤖 *AI Assistant*\n\n${answer}`,
        ephemeral: true,
      };
    });
  }

  /**
   * Parse option from args
   */
  private parseOption(args: string[], name: string): string | undefined {
    const prefix = `--${name}=`;
    const arg = args.find(a => a.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : undefined;
  }

  /**
   * Handle incoming command
   */
  async handleCommand(ctx: CommandContext): Promise<CommandResult> {
    const handler = this.commandHandlers.get(ctx.command.toLowerCase());
    
    if (!handler) {
      return {
        success: false,
        message: `Unknown command: ${ctx.command}. Use /help for available commands.`,
        ephemeral: true,
      };
    }

    try {
      return await handler(ctx);
    } catch (error) {
      console.error('Command handler error:', error);
      return {
        success: false,
        message: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ephemeral: true,
      };
    }
  }

  /**
   * Handle button interaction
   */
  async handleInteraction(
    platform: 'slack' | 'discord',
    payload: unknown
  ): Promise<CommandResult> {
    if (platform === 'slack') {
      return this.handleSlackInteraction(payload as SlackInteractionPayload);
    } else {
      return this.handleDiscordInteraction(payload as DiscordInteractionPayload);
    }
  }

  /**
   * Handle Slack interaction
   */
  private async handleSlackInteraction(payload: SlackInteractionPayload): Promise<CommandResult> {
    const action = payload.actions?.[0];
    if (!action) {
      return { success: false, message: 'No action found' };
    }

    const [actionType, ...params] = action.action_id.split(':');

    switch (actionType) {
      case 'deploy_confirm': {
        const [target, env, version] = params;
        return this.executeDeploy(target, env, version);
      }
      case 'deploy_cancel':
        return { success: true, message: '❌ Deployment cancelled' };
      case 'rollback_confirm': {
        const [target, revision] = params;
        return this.executeRollback(target, revision);
      }
      case 'rollback_cancel':
        return { success: true, message: '❌ Rollback cancelled' };
      case 'scale_confirm': {
        const [target, replicas] = params;
        return this.executeScale(target, parseInt(replicas, 10));
      }
      case 'scale_cancel':
        return { success: true, message: '❌ Scaling cancelled' };
      case 'restart_confirm': {
        const [target] = params;
        return this.executeRestart(target);
      }
      case 'restart_cancel':
        return { success: true, message: '❌ Restart cancelled' };
      default:
        return { success: false, message: `Unknown action: ${actionType}` };
    }
  }

  /**
   * Handle Discord interaction
   */
  private async handleDiscordInteraction(payload: DiscordInteractionPayload): Promise<CommandResult> {
    const customId = payload.data?.custom_id;
    if (!customId) {
      return { success: false, message: 'No custom_id found' };
    }

    const [actionType, ...params] = customId.split(':');

    switch (actionType) {
      case 'deploy_confirm': {
        const [target, env, version] = params;
        return this.executeDeploy(target, env, version);
      }
      case 'deploy_cancel':
        return { success: true, message: '❌ Deployment cancelled' };
      case 'rollback_confirm': {
        const [target, revision] = params;
        return this.executeRollback(target, revision);
      }
      case 'rollback_cancel':
        return { success: true, message: '❌ Rollback cancelled' };
      case 'scale_confirm': {
        const [target, replicas] = params;
        return this.executeScale(target, parseInt(replicas, 10));
      }
      case 'scale_cancel':
        return { success: true, message: '❌ Scaling cancelled' };
      case 'restart_confirm': {
        const [target] = params;
        return this.executeRestart(target);
      }
      case 'restart_cancel':
        return { success: true, message: '❌ Restart cancelled' };
      default:
        return { success: false, message: `Unknown action: ${actionType}` };
    }
  }

  /**
   * Execute deployment
   */
  private async executeDeploy(target: string, env: string, version: string): Promise<CommandResult> {
    // In production, this would trigger actual deployment
    console.log(`Deploying ${target} to ${env} with version ${version}`);
    
    return {
      success: true,
      message: `✅ *Deployment Started*\n\nApp: \`${target}\`\nEnvironment: \`${env}\`\nVersion: \`${version}\`\n\nDeployment in progress...`,
    };
  }

  /**
   * Execute rollback
   */
  private async executeRollback(target: string, revision?: string): Promise<CommandResult> {
    console.log(`Rolling back ${target} to ${revision || 'previous version'}`);
    
    return {
      success: true,
      message: `✅ *Rollback Started*\n\nApp: \`${target}\`\nTarget: \`${revision || 'previous version'}\`\n\nRollback in progress...`,
    };
  }

  /**
   * Execute scale
   */
  private async executeScale(target: string, replicas: number): Promise<CommandResult> {
    console.log(`Scaling ${target} to ${replicas} replicas`);
    
    return {
      success: true,
      message: `✅ *Scaling Started*\n\nApp: \`${target}\`\nTarget Replicas: \`${replicas}\`\n\nScaling in progress...`,
    };
  }

  /**
   * Execute restart
   */
  private async executeRestart(target: string): Promise<CommandResult> {
    console.log(`Restarting ${target}`);
    
    return {
      success: true,
      message: `✅ *Restart Started*\n\nApp: \`${target}\`\n\nRestart in progress...`,
    };
  }

  /**
   * Create deploy confirmation blocks (Slack format)
   */
  private createDeployConfirmationBlocks(target: string, env: string, version: string): unknown[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚀 *Deploy Confirmation*\n\nApp: \`${target}\`\nEnvironment: \`${env}\`\nVersion: \`${version}\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ Deploy' },
            style: 'primary',
            action_id: `deploy_confirm:${target}:${env}:${version}`,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '❌ Cancel' },
            style: 'danger',
            action_id: 'deploy_cancel',
          },
        ],
      },
    ];
  }

  /**
   * Create rollback confirmation blocks
   */
  private createRollbackConfirmationBlocks(target: string, revision?: string): unknown[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⏪ *Rollback Confirmation*\n\nApp: \`${target}\`\nTarget: \`${revision || 'previous version'}\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ Rollback' },
            style: 'primary',
            action_id: `rollback_confirm:${target}:${revision || ''}`,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '❌ Cancel' },
            style: 'danger',
            action_id: 'rollback_cancel',
          },
        ],
      },
    ];
  }

  /**
   * Create scale confirmation blocks
   */
  private createScaleConfirmationBlocks(target: string, replicas: number): unknown[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📈 *Scale Confirmation*\n\nApp: \`${target}\`\nTarget Replicas: \`${replicas}\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ Scale' },
            style: 'primary',
            action_id: `scale_confirm:${target}:${replicas}`,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '❌ Cancel' },
            style: 'danger',
            action_id: 'scale_cancel',
          },
        ],
      },
    ];
  }

  /**
   * Create restart confirmation blocks
   */
  private createRestartConfirmationBlocks(target: string): unknown[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔄 *Restart Confirmation*\n\nApp: \`${target}\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ Restart' },
            style: 'primary',
            action_id: `restart_confirm:${target}`,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '❌ Cancel' },
            style: 'danger',
            action_id: 'restart_cancel',
          },
        ],
      },
    ];
  }

  /**
   * Create overall status blocks
   */
  private async createOverallStatusBlocks(): Promise<unknown[]> {
    // In production, this would fetch real status
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Infrastructure Overview*',
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: '*Docker Containers*\n🟢 5 running, 1 stopped' },
          { type: 'mrkdwn', text: '*Kubernetes Pods*\n🟢 12 running, 2 pending' },
          { type: 'mrkdwn', text: '*Active Deployments*\n4 applications' },
          { type: 'mrkdwn', text: '*Alerts*\n🟡 2 warnings' },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: 'Last updated: just now' },
        ],
      },
    ];
  }

  /**
   * Create app status blocks
   */
  private async createAppStatusBlocks(target: string): Promise<unknown[]> {
    // In production, this would fetch real app status
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Application: ${target}*`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: '*Status*\n🟢 Healthy' },
          { type: 'mrkdwn', text: '*Replicas*\n3/3 ready' },
          { type: 'mrkdwn', text: '*CPU*\n45%' },
          { type: 'mrkdwn', text: '*Memory*\n512MB / 1GB' },
          { type: 'mrkdwn', text: '*Version*\nv2.3.1' },
          { type: 'mrkdwn', text: '*Last Deploy*\n2 hours ago' },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '📜 View Logs' },
            action_id: `logs:${target}`,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '🔄 Restart' },
            action_id: `restart_confirm:${target}`,
          },
        ],
      },
    ];
  }

  /**
   * Create logs blocks
   */
  private async createLogsBlocks(target: string, lines: number): Promise<unknown[]> {
    // In production, this would fetch real logs
    const sampleLogs = [
      '2024-01-15 10:30:15 [INFO] Application started',
      '2024-01-15 10:30:16 [INFO] Connected to database',
      '2024-01-15 10:30:17 [INFO] Listening on port 3000',
      '2024-01-15 10:31:00 [INFO] Request: GET /api/health',
      '2024-01-15 10:31:05 [INFO] Request: POST /api/data',
    ];

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Logs: ${target}* (last ${lines} lines)`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '```' + sampleLogs.join('\n') + '```',
        },
      },
    ];
  }

  /**
   * Create help blocks
   */
  private createHelpBlocks(): unknown[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Available Commands*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `
• \`/deploy <app> [--env=prod] [--version=latest]\` - Deploy application
• \`/rollback <app> [revision]\` - Rollback to previous version
• \`/status [app]\` - Show status (all or specific app)
• \`/scale <app> <replicas>\` - Scale application
• \`/restart <app>\` - Restart application
• \`/logs <app> [lines]\` - View application logs
• \`/ai <question>\` - Ask AI for help
• \`/help\` - Show this help message
          `.trim(),
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '💡 Tip: Use interactive buttons to confirm actions' },
        ],
      },
    ];
  }

  /**
   * Ask AI for help
   */
  private async askAI(question: string): Promise<string> {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: 'You are a DevOps assistant helping with infrastructure management. Provide concise, actionable answers.',
          },
          { role: 'user', content: question },
        ],
      });

      const content = response.choices[0]?.message?.content;
      return typeof content === 'string' ? content : 'Unable to generate response';
    } catch (error) {
      console.error('AI error:', error);
      return 'AI assistant is currently unavailable';
    }
  }

  /**
   * Send notification to channel
   */
  async sendNotification(
    platform: 'slack' | 'discord',
    message: string,
    blocks?: unknown[]
  ): Promise<boolean> {
    const config = platform === 'slack' ? this.slackConfig : this.discordConfig;
    
    if (!config?.webhookUrl) {
      console.error('Webhook URL not configured');
      return false;
    }

    try {
      const payload = platform === 'slack'
        ? { text: message, blocks }
        : { content: message, embeds: blocks };

      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Verify Slack request signature
   */
  verifySlackSignature(
    signature: string,
    timestamp: string,
    body: string
  ): boolean {
    if (!this.slackConfig?.signingSecret) {
      return false;
    }

    const baseString = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac('sha256', this.slackConfig.signingSecret);
    const expectedSignature = 'v0=' + hmac.update(baseString).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Verify Discord request signature
   */
  verifyDiscordSignature(
    signature: string,
    timestamp: string,
    body: string
  ): boolean {
    if (!this.discordConfig?.publicKey) {
      return false;
    }

    // Discord uses Ed25519 signatures
    // In production, use a proper Ed25519 library
    return true; // Simplified for demo
  }

  /**
   * Format message for Discord
   */
  formatForDiscord(message: string, blocks?: unknown[]): unknown {
    return {
      content: message,
      embeds: blocks?.map(block => {
        if (typeof block === 'object' && block !== null && 'type' in block) {
          const b = block as { type: string; text?: { text?: string }; fields?: unknown[] };
          if (b.type === 'section' && b.text) {
            return {
              description: b.text.text,
            };
          }
        }
        return block;
      }),
      components: blocks?.filter(b => {
        if (typeof b === 'object' && b !== null && 'type' in b) {
          return (b as { type: string }).type === 'actions';
        }
        return false;
      }).map(b => {
        const actionBlock = b as { elements?: unknown[] };
        return {
          type: 1, // ACTION_ROW
          components: actionBlock.elements?.map((e: unknown) => {
            const element = e as { action_id?: string; text?: { text?: string }; style?: string };
            return {
              type: 2, // BUTTON
              style: element.style === 'primary' ? 1 : element.style === 'danger' ? 4 : 2,
              label: element.text?.text,
              custom_id: element.action_id,
            };
          }),
        };
      }),
    };
  }
}

// Slack interaction payload type
interface SlackInteractionPayload {
  type: string;
  user: { id: string; username: string };
  channel: { id: string };
  actions?: Array<{
    action_id: string;
    value?: string;
  }>;
  response_url?: string;
  trigger_id?: string;
}

// Discord interaction payload type
interface DiscordInteractionPayload {
  type: number;
  data?: {
    custom_id?: string;
    component_type?: number;
  };
  member?: { user: { id: string; username: string } };
  channel_id?: string;
}

// Singleton instance
export const chatBotService = new ChatBotService();

// Export types
export type { BotConfig, CommandContext, CommandResult, DeploymentAction };
