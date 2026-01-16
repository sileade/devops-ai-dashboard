/**
 * ChatBot Router
 * 
 * tRPC procedures for Slack/Discord bot integration
 */

import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { chatBotService } from '../services/chatbot';

export const chatBotRouter = router({
  // Initialize Slack bot
  initializeSlack: protectedProcedure
    .input(z.object({
      token: z.string().min(1),
      signingSecret: z.string().min(1),
      webhookUrl: z.string().url().optional(),
      channelId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const success = await chatBotService.initializeSlack({
        platform: 'slack',
        token: input.token,
        signingSecret: input.signingSecret,
        webhookUrl: input.webhookUrl,
        channelId: input.channelId,
      });
      return { success };
    }),

  // Initialize Discord bot
  initializeDiscord: protectedProcedure
    .input(z.object({
      token: z.string().min(1),
      applicationId: z.string().min(1),
      publicKey: z.string().min(1),
      webhookUrl: z.string().url().optional(),
      channelId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const success = await chatBotService.initializeDiscord({
        platform: 'discord',
        token: input.token,
        applicationId: input.applicationId,
        publicKey: input.publicKey,
        webhookUrl: input.webhookUrl,
        channelId: input.channelId,
      });
      return { success };
    }),

  // Handle slash command
  handleCommand: publicProcedure
    .input(z.object({
      platform: z.enum(['slack', 'discord']),
      userId: z.string(),
      userName: z.string(),
      channelId: z.string(),
      command: z.string(),
      text: z.string(),
      responseUrl: z.string().optional(),
      triggerId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const args = input.text.split(/\s+/).filter(Boolean);
      
      const result = await chatBotService.handleCommand({
        platform: input.platform,
        userId: input.userId,
        userName: input.userName,
        channelId: input.channelId,
        command: input.command.replace(/^\//, ''),
        args,
        rawText: input.text,
        responseUrl: input.responseUrl,
        triggerId: input.triggerId,
      });

      return result;
    }),

  // Handle interaction (button click, etc.)
  handleInteraction: publicProcedure
    .input(z.object({
      platform: z.enum(['slack', 'discord']),
      payload: z.unknown(),
    }))
    .mutation(async ({ input }) => {
      const result = await chatBotService.handleInteraction(
        input.platform,
        input.payload
      );
      return result;
    }),

  // Send notification
  sendNotification: protectedProcedure
    .input(z.object({
      platform: z.enum(['slack', 'discord']),
      message: z.string(),
      blocks: z.array(z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const success = await chatBotService.sendNotification(
        input.platform,
        input.message,
        input.blocks
      );
      return { success };
    }),

  // Get available commands
  getCommands: publicProcedure
    .query(async () => {
      return {
        commands: [
          {
            name: 'deploy',
            description: 'Deploy an application',
            usage: '/deploy <app-name> [--env=production] [--version=latest]',
            examples: [
              '/deploy api-server',
              '/deploy web-frontend --env=staging',
              '/deploy backend --version=v2.0.0',
            ],
          },
          {
            name: 'rollback',
            description: 'Rollback to a previous version',
            usage: '/rollback <app-name> [revision]',
            examples: [
              '/rollback api-server',
              '/rollback web-frontend abc123',
            ],
          },
          {
            name: 'status',
            description: 'Check application or infrastructure status',
            usage: '/status [app-name]',
            examples: [
              '/status',
              '/status api-server',
            ],
          },
          {
            name: 'scale',
            description: 'Scale application replicas',
            usage: '/scale <app-name> <replicas>',
            examples: [
              '/scale api-server 5',
              '/scale worker 3',
            ],
          },
          {
            name: 'restart',
            description: 'Restart an application',
            usage: '/restart <app-name>',
            examples: [
              '/restart api-server',
            ],
          },
          {
            name: 'logs',
            description: 'View application logs',
            usage: '/logs <app-name> [lines]',
            examples: [
              '/logs api-server',
              '/logs api-server 100',
            ],
          },
          {
            name: 'ai',
            description: 'Ask AI for DevOps help',
            usage: '/ai <question>',
            examples: [
              '/ai how do I debug a crashing pod?',
              '/ai what causes high memory usage?',
            ],
          },
          {
            name: 'help',
            description: 'Show available commands',
            usage: '/help',
            examples: ['/help'],
          },
        ],
      };
    }),

  // Verify Slack signature
  verifySlackSignature: publicProcedure
    .input(z.object({
      signature: z.string(),
      timestamp: z.string(),
      body: z.string(),
    }))
    .query(({ input }) => {
      const valid = chatBotService.verifySlackSignature(
        input.signature,
        input.timestamp,
        input.body
      );
      return { valid };
    }),

  // Verify Discord signature
  verifyDiscordSignature: publicProcedure
    .input(z.object({
      signature: z.string(),
      timestamp: z.string(),
      body: z.string(),
    }))
    .query(({ input }) => {
      const valid = chatBotService.verifyDiscordSignature(
        input.signature,
        input.timestamp,
        input.body
      );
      return { valid };
    }),
});
