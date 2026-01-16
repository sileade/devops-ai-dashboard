# DevOps AI Dashboard

A comprehensive DevOps management platform with AI-powered automation, real-time monitoring, and intelligent scaling capabilities. Built with React, TypeScript, tRPC, and integrated with Docker, Kubernetes, Ansible, and Terraform.

## Features

### Infrastructure Management

| Feature | Description |
|---------|-------------|
| **Docker Management** | Full container lifecycle management with real-time stats, logs, and network/volume control |
| **Kubernetes Integration** | Pod, Deployment, Service management with namespace switching and resource monitoring |
| **Podman Support** | Rootless container management with pod orchestration |
| **Ansible Automation** | Playbook browser, execution interface, and inventory management |
| **Terraform IaC** | Workspace management, state viewer, and plan/apply interface |

### AI-Powered Capabilities

The platform integrates an AI assistant that provides intelligent DevOps support:

- **Troubleshooting Suggestions**: AI analyzes logs and metrics to identify issues and recommend solutions
- **Command Recommendations**: Context-aware command suggestions for Docker, Kubernetes, and other tools
- **Infrastructure Analysis**: Automated health checks and optimization recommendations
- **Knowledge Base Integration**: Self-learning system that improves recommendations over time
- **Natural Language Chat**: Conversational interface for DevOps queries with persistent history

### Real-Time Monitoring

- **WebSocket Updates**: Live container and pod status updates without page refresh
- **Metrics Charts**: CPU, Memory, and Network I/O visualization with 24-hour history
- **Alert System**: Configurable thresholds with browser push notifications
- **Live Status Indicators**: Visual feedback for connection status and data freshness

### Intelligent Auto-Scaling

The platform features a sophisticated auto-scaling system with AI integration:

| Component | Description |
|-----------|-------------|
| **Rule-Based Scaling** | Define scaling rules with thresholds, cooldowns, and replica limits |
| **AI Predictions** | Machine learning-based load prediction and anomaly detection |
| **Scheduled Scaling** | Cron-based scheduling for predictable workload patterns |
| **A/B Testing** | Experiment with different scaling configurations to optimize performance |
| **Human Approval Mode** | Optional approval workflow for critical scaling decisions |

### Email Notifications (NEW)

SMTP-based email notification system:

- **SMTP Configuration**: Configure any SMTP server (Gmail, SendGrid, custom)
- **Alert Notifications**: Email alerts for critical events with HTML templates
- **A/B Test Results**: Automatic notifications when experiments complete
- **Scaling Events**: Email notifications for auto-scaling actions
- **Subscription Management**: Users can subscribe to specific alert types

### Prometheus/Grafana Integration (NEW)

Full observability stack integration:

- **Prometheus Queries**: Execute PromQL queries directly from the dashboard
- **Metric Scraping**: Pull metrics from Prometheus instances
- **Grafana Dashboards**: Link and embed Grafana dashboards
- **Custom Collectors**: Define custom metrics to collect
- **Saved Queries**: Save and reuse common PromQL queries

### Multi-Cluster Support (NEW)

Manage multiple Kubernetes clusters from a single interface:

- **Cluster Registry**: Register and manage multiple clusters
- **Health Monitoring**: Monitor health status across all clusters
- **Cross-Cluster Comparison**: Compare metrics between clusters
- **Namespace Sync**: Synchronize namespace information
- **Cluster Switching**: Seamlessly switch between clusters

### Security Features

- **Rate Limiting**: Multi-tier rate limiting to protect against DDoS attacks
- **Authentication**: OAuth-based authentication with session management
- **Protected Procedures**: Secure API endpoints with role-based access control

## Technology Stack

### Frontend
- React 19 with TypeScript
- Tailwind CSS 4 for styling
- shadcn/ui component library
- Recharts for data visualization
- Socket.IO client for real-time updates
- Wouter for routing

### Backend
- Express.js with TypeScript
- tRPC for type-safe API
- Drizzle ORM with MySQL/TiDB
- Socket.IO for WebSocket communication
- Nodemailer for email notifications
- LLM integration for AI features

### Infrastructure
- Docker Socket API integration
- Kubernetes API client
- Podman API support
- Ansible execution interface
- Terraform state management
- Prometheus/Grafana integration

## Project Structure

```
devops-ai-dashboard/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # Reusable UI components (40+)
│   │   ├── pages/            # Page-level components (22 pages)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── contexts/         # React contexts
│   │   └── lib/              # Utilities and tRPC client
│   └── public/               # Static assets
├── server/                    # Backend Express server
│   ├── routers/              # tRPC router modules (16 modules)
│   │   ├── ai.ts             # AI assistant endpoints
│   │   ├── autoscaling.ts    # Auto-scaling management
│   │   ├── docker.ts         # Docker API integration
│   │   ├── kubernetes.ts     # Kubernetes API integration
│   │   ├── scheduledScaling.ts # Scheduled scaling
│   │   ├── abTesting.ts      # A/B testing for scaling
│   │   ├── email.ts          # Email notifications (NEW)
│   │   ├── prometheus.ts     # Prometheus integration (NEW)
│   │   └── clusters.ts       # Multi-cluster management (NEW)
│   ├── services/             # Business logic services
│   │   ├── email.ts          # Email service with templates
│   │   └── prometheus.ts     # Prometheus client
│   ├── infrastructure/       # Infrastructure integrations
│   │   ├── docker.ts         # Docker client
│   │   ├── kubernetes.ts     # Kubernetes client
│   │   └── ai-autoscaler.ts  # AI scaling engine
│   ├── _core/                # Core server utilities
│   │   ├── websocket.ts      # WebSocket server
│   │   ├── rateLimit.ts      # Rate limiting middleware
│   │   └── llm.ts            # LLM integration
│   └── db.ts                 # Database queries
├── drizzle/                   # Database schema and migrations
└── shared/                    # Shared types and constants
```

## Database Schema

The platform uses 22 database tables for comprehensive data management:

| Table | Purpose |
|-------|---------|
| `users` | User accounts and authentication |
| `chat_sessions` | AI chat conversation sessions |
| `chat_messages` | Individual chat messages with history |
| `metrics_history` | Historical metrics for trend analysis |
| `alert_thresholds` | Configurable alert thresholds |
| `alert_history` | Alert event log |
| `autoscaling_rules` | Auto-scaling rule definitions |
| `autoscaling_history` | Scaling action history |
| `ai_scaling_predictions` | AI-generated scaling predictions |
| `scheduled_scaling` | Scheduled scaling rules |
| `scheduled_scaling_history` | Scheduled scaling execution log |
| `ab_test_experiments` | A/B test experiment definitions |
| `ab_test_metrics` | A/B test performance metrics |
| `email_config` | SMTP configuration (NEW) |
| `email_subscriptions` | Email alert subscriptions (NEW) |
| `email_history` | Sent email log (NEW) |
| `prometheus_config` | Prometheus settings (NEW) |
| `prometheus_metrics` | Saved PromQL queries (NEW) |
| `grafana_dashboards` | Grafana dashboard links (NEW) |
| `kubernetes_clusters` | Multi-cluster registry (NEW) |
| `cluster_namespaces` | Cluster namespace cache (NEW) |
| `cluster_comparisons` | Cross-cluster comparisons (NEW) |

## API Endpoints

The platform exposes 80+ tRPC endpoints organized by module:

### Authentication
- `auth.me` - Get current user
- `auth.logout` - End session

### Dashboard
- `dashboard.overview` - Infrastructure summary
- `dashboard.activity` - Recent activity log
- `dashboard.resourceUsage` - Resource utilization metrics

### Docker
- `docker.listContainers` - List all containers
- `docker.containerAction` - Start/stop/restart containers
- `docker.containerLogs` - Fetch container logs
- `docker.containerStats` - Real-time container stats

### Kubernetes
- `kubernetes.listPods` - List pods by namespace
- `kubernetes.listDeployments` - List deployments
- `kubernetes.scaleDeployment` - Scale deployment replicas
- `kubernetes.executeCommand` - Run kubectl commands

### AI Assistant
- `ai.chat` - Send message to AI assistant
- `ai.getHistory` - Retrieve chat history
- `ai.searchHistory` - Search chat messages
- `ai.exportHistory` - Export chat to JSON/Markdown

### Auto-Scaling
- `autoscaling.listRules` - Get scaling rules
- `autoscaling.createRule` - Create new rule
- `autoscaling.getPredictions` - Get AI predictions
- `autoscaling.approveAction` - Approve pending action

### Scheduled Scaling
- `scheduledScaling.list` - List schedules
- `scheduledScaling.create` - Create schedule
- `scheduledScaling.executeNow` - Manual execution

### A/B Testing
- `abTesting.list` - List experiments
- `abTesting.create` - Create experiment
- `abTesting.start` - Start experiment
- `abTesting.complete` - Complete and determine winner

### Email Notifications (NEW)
- `email.getConfig` - Get SMTP configuration
- `email.saveConfig` - Save SMTP settings
- `email.testConfig` - Test SMTP connection
- `email.sendTestEmail` - Send test email
- `email.getSubscriptions` - List subscriptions
- `email.addSubscription` - Add email subscription
- `email.sendAlertNotification` - Send alert email
- `email.sendABTestNotification` - Send A/B test results
- `email.sendScalingNotification` - Send scaling event email

### Prometheus/Grafana (NEW)
- `prometheus.getConfig` - Get Prometheus configuration
- `prometheus.saveConfig` - Save Prometheus settings
- `prometheus.testPrometheus` - Test Prometheus connection
- `prometheus.testGrafana` - Test Grafana connection
- `prometheus.query` - Execute PromQL query
- `prometheus.queryRange` - Execute range query
- `prometheus.getMetrics` - Get available metrics
- `prometheus.saveMetricQuery` - Save custom query
- `prometheus.saveDashboard` - Save Grafana dashboard link
- `prometheus.getEmbedUrl` - Get Grafana embed URL

### Multi-Cluster (NEW)
- `clusters.list` - List registered clusters
- `clusters.add` - Register new cluster
- `clusters.update` - Update cluster configuration
- `clusters.delete` - Remove cluster
- `clusters.testConnection` - Test cluster connectivity
- `clusters.getHealth` - Get cluster health status
- `clusters.getMetrics` - Get cluster metrics
- `clusters.syncNamespaces` - Sync namespace information
- `clusters.compareMetrics` - Compare metrics across clusters
- `clusters.setDefault` - Set default cluster

## Installation

### Prerequisites
- Node.js 22+
- pnpm package manager
- MySQL/TiDB database
- Docker (for container management)
- Kubernetes cluster (optional)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/sileade/devops-ai-dashboard.git
cd devops-ai-dashboard
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Push database schema:
```bash
pnpm db:push
```

5. Start development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing secret |
| `DOCKER_SOCKET` | Docker socket path (default: /var/run/docker.sock) |
| `KUBERNETES_CONFIG` | Path to kubeconfig file |
| `BUILT_IN_FORGE_API_URL` | LLM API endpoint |
| `BUILT_IN_FORGE_API_KEY` | LLM API key |

### Alert Thresholds

Default alert thresholds are automatically created:

| Metric | Warning | Critical |
|--------|---------|----------|
| CPU Usage | 80% | 95% |
| Memory Usage | 80% | 95% |
| Disk Usage | 85% | 95% |
| Pod Restarts | 3 | 5 |

## Testing

Run the test suite:
```bash
pnpm test
```

The project includes 64 tests covering:
- Authentication flows
- Dashboard API endpoints
- Infrastructure integrations
- Chat history persistence
- AI assistant functionality

## Code Statistics

| Metric | Value |
|--------|-------|
| Total Lines of Code | 31,652 |
| TypeScript/TSX Files | 147 |
| Server Routers | 16 modules |
| Client Pages | 22 pages |
| UI Components | 40+ |
| Database Tables | 22 |
| API Endpoints | 80+ |
| Test Cases | 64 |

## Code Quality

The codebase follows best practices:

- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **Modular architecture** with separated routers
- **Rate limiting** for API protection
- **Comprehensive error handling**

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pnpm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built with [shadcn/ui](https://ui.shadcn.com/) components
- Charts powered by [Recharts](https://recharts.org/)
- Real-time updates via [Socket.IO](https://socket.io/)
- Database ORM by [Drizzle](https://orm.drizzle.team/)
- Email sending via [Nodemailer](https://nodemailer.com/)
