# OpenClaw ChatOps Integration

This document describes the integration between DevOps AI Dashboard and OpenClaw (Clawd Bot) for ChatOps functionality.

## Overview

OpenClaw is a personal AI assistant that connects to multiple messaging platforms including WhatsApp, Telegram, Discord, Slack, Microsoft Teams, Matrix, and Signal. By integrating OpenClaw with DevOps AI Dashboard, teams can manage their infrastructure directly from their preferred messaging apps.

## Features

### Communication Channels

The integration supports the following messaging platforms:

| Platform | Features | Use Cases |
|----------|----------|-----------|
| **Telegram** | Bot API, group chats, inline buttons | Quick status checks, alert notifications |
| **Slack** | Webhooks, interactive messages, threads | Team collaboration, incident management |
| **Discord** | Bot integration, server channels | Developer communities, gaming servers |
| **WhatsApp** | Group messaging, media support | On-call notifications, mobile alerts |
| **Microsoft Teams** | Adaptive cards, workflows | Enterprise environments |
| **Matrix** | Federated messaging, E2E encryption | Privacy-focused teams |
| **Signal** | Secure messaging | Sensitive operations |

### ChatOps Commands

Teams can execute DevOps operations directly from chat using these commands:

| Command | Description | Requires Approval |
|---------|-------------|-------------------|
| `/status` | Get current system status and health overview | No |
| `/incidents` | List active incidents with severity and status | No |
| `/approve <incident_id>` | Approve a pending incident resolution action | Yes |
| `/deploy <service> <version>` | Trigger deployment of a service | Yes |
| `/rollback <service>` | Rollback service to previous version | Yes |
| `/scale <service> <replicas>` | Scale service to specified replicas | Yes |
| `/security-scan` | Trigger security vulnerability scan | No |
| `/costs` | Get current cloud cost summary | No |
| `/healing approve <action_id>` | Approve a pending self-healing action | Yes |
| `/help` | Show available commands | No |

### Alert Subscriptions

Configure which alerts are sent to which channels with granular control over alert types and severity levels. Features include quiet hours to prevent notifications during off-hours and severity filtering to reduce alert fatigue.

## Architecture

The integration consists of three main components:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DevOps AI Dashboard                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              OpenClaw Router (tRPC)                      │   │
│  │  - Channel management                                    │   │
│  │  - Alert subscriptions                                   │   │
│  │  - Message handling                                      │   │
│  │  - Command processing                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ HTTP/WebSocket                   │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              OpenClaw Gateway                            │   │
│  │  - Multi-channel support                                 │   │
│  │  - Message routing                                       │   │
│  │  - AI processing (Claude/GPT)                            │   │
│  │  - Agent sandbox                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ Platform APIs                    │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Messaging Platforms                            │   │
│  │  Telegram | Slack | Discord | WhatsApp | Teams | ...     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

### Using Docker Compose

The easiest way to deploy the integration is using the provided Docker Compose configuration:

```bash
# Clone the repository
git clone https://github.com/sileade/devops-ai-dashboard.git
cd devops-ai-dashboard

# Run the setup script
./scripts/setup-openclaw.sh
```

This will start both DevOps AI Dashboard and OpenClaw Gateway with proper networking.

### Manual Setup

If you prefer manual setup, follow these steps:

1. **Start OpenClaw Gateway**:
   ```bash
   docker run -d \
     --name openclaw-gateway \
     -p 18789:18789 \
     -e ANTHROPIC_API_KEY=your_key \
     -v openclaw-config:/home/node/.openclaw \
     ghcr.io/openclaw/openclaw:latest
   ```

2. **Configure DevOps Dashboard**:
   Add these environment variables to your dashboard:
   ```
   OPENCLAW_GATEWAY_URL=http://localhost:18789
   OPENCLAW_GATEWAY_TOKEN=your_token
   ```

3. **Configure channels via CLI**:
   ```bash
   docker exec -it openclaw-gateway openclaw channels login
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCLAW_GATEWAY_URL` | URL of the OpenClaw Gateway | `http://localhost:18789` |
| `OPENCLAW_GATEWAY_TOKEN` | Authentication token for Gateway API | - |
| `ANTHROPIC_API_KEY` | API key for Claude AI | - |
| `OPENAI_API_KEY` | API key for OpenAI (optional) | - |

### Channel Configuration

Each channel type requires specific configuration:

**Telegram:**
- `botToken`: Bot token from @BotFather
- `chatId`: Target chat/group ID

**Slack:**
- `webhookUrl`: Incoming webhook URL
- `channel`: Target channel name

**Discord:**
- `botToken`: Discord bot token
- `channelId`: Target channel ID

## API Reference

### tRPC Endpoints

The integration exposes the following tRPC procedures:

**Queries:**
- `openclaw.getConfig` - Get current configuration
- `openclaw.listChannels` - List all configured channels
- `openclaw.getMessages` - Get message history
- `openclaw.getCommands` - Get available ChatOps commands
- `openclaw.listSubscriptions` - List alert subscriptions
- `openclaw.getStats` - Get integration statistics

**Mutations:**
- `openclaw.updateConfig` - Update gateway configuration
- `openclaw.testConnection` - Test gateway connection
- `openclaw.addChannel` - Add a new channel
- `openclaw.updateChannel` - Update channel configuration
- `openclaw.toggleChannel` - Connect/disconnect channel
- `openclaw.deleteChannel` - Remove a channel
- `openclaw.sendMessage` - Send message to channel
- `openclaw.handleWebhook` - Process incoming webhook
- `openclaw.createSubscription` - Create alert subscription
- `openclaw.updateSubscription` - Update subscription
- `openclaw.deleteSubscription` - Remove subscription
- `openclaw.sendAlert` - Send alert to subscribed channels

### Webhook Integration

OpenClaw Gateway can send webhooks to DevOps Dashboard when messages are received:

```
POST /api/trpc/openclaw.handleWebhook
Content-Type: application/json

{
  "channelType": "telegram",
  "from": "user123",
  "content": "/status",
  "metadata": {
    "messageId": "12345",
    "chatId": "-1001234567890"
  }
}
```

## Security Considerations

The integration implements several security measures:

1. **Token Authentication**: All Gateway API calls require a valid token
2. **Command Approval**: Sensitive operations require explicit approval
3. **Channel Isolation**: Each channel has independent configuration
4. **Quiet Hours**: Prevent alerts during specified time periods
5. **Severity Filtering**: Control which alert levels are sent

## Troubleshooting

### Common Issues

**Gateway Connection Failed:**
- Verify `OPENCLAW_GATEWAY_URL` is correct
- Check if Gateway container is running
- Ensure network connectivity between services

**Channel Not Connecting:**
- Verify channel credentials are correct
- Check platform-specific requirements (bot permissions, etc.)
- Review Gateway logs for detailed errors

**Messages Not Received:**
- Verify webhook URL is accessible
- Check alert subscription configuration
- Ensure channel is enabled and connected

### Logs

View logs for debugging:

```bash
# DevOps Dashboard logs
docker logs devops-ai-dashboard

# OpenClaw Gateway logs
docker logs openclaw-gateway
```

## Contributing

Contributions to the OpenClaw integration are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

This integration is part of DevOps AI Dashboard and is licensed under the same terms.
