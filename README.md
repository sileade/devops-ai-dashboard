# DevOps AI Dashboard

[![CI](https://github.com/sileade/devops-ai-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/sileade/devops-ai-dashboard/actions/workflows/ci.yml)
[![CD](https://github.com/sileade/devops-ai-dashboard/actions/workflows/cd.yml/badge.svg)](https://github.com/sileade/devops-ai-dashboard/actions/workflows/cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

### Canary Deployments (NEW)

Progressive rollout system with automatic health monitoring:

| Feature | Description |
|---------|-------------|
| **Traffic Splitting** | Percentage-based, header-based, or cookie-based traffic routing |
| **Progressive Rollout** | Configurable increments (e.g., 10% -> 25% -> 50% -> 100%) |
| **Health Monitoring** | Real-time error rate, latency, and pod health tracking |
| **Auto-Rollback** | Automatic rollback when health thresholds are exceeded |
| **AI Analysis** | AI-powered recommendations during rollout |
| **Manual Controls** | Pause, resume, promote, or rollback at any time |

**Canary Deployment Flow:**

1. Create deployment with canary image and configuration
2. Start deployment - canary receives initial traffic (e.g., 10%)
3. System monitors metrics and compares canary vs stable
4. If healthy, traffic automatically increases at configured intervals
5. If unhealthy, automatic rollback to stable version
6. When 100% traffic reached, promote canary to stable

**Configuration Options:**

```yaml
Canary Configuration:
  initialCanaryPercent: 10      # Starting traffic percentage
  targetCanaryPercent: 100      # Final traffic percentage
  incrementPercent: 10          # Traffic increase per step
  incrementIntervalMinutes: 5   # Time between increments
  errorRateThreshold: 5         # Max error rate (%) before rollback
  latencyThresholdMs: 1000      # Max latency (ms) before rollback
  successRateThreshold: 95      # Min success rate (%) to progress
  autoRollbackEnabled: true     # Enable automatic rollback
```

### ArgoCD Integration (NEW)

Full GitOps workflow management with ArgoCD:

| Feature | Description |
|---------|-------------|
| **Application Management** | Create, sync, and manage ArgoCD applications |
| **Automatic Sync** | Trigger sync on git push events |
| **Health Monitoring** | Real-time application health status |
| **Rollback Support** | One-click rollback to previous revisions |
| **AI Analysis** | AI-powered recommendations for deployments |

### Slack/Discord Bot (NEW)

Chat-based deployment management:

- **/deploy** - Deploy applications with confirmation buttons
- **/rollback** - Rollback to previous versions
- **/status** - Check infrastructure status
- **/scale** - Scale application replicas
- **/restart** - Restart applications
- **/logs** - View application logs
- **/ai** - Ask AI for DevOps help

**Setup:**
1. Create Slack/Discord app with slash commands
2. Configure webhook URLs in the dashboard
3. Use interactive buttons for safe confirmations

### Blue-Green Deployments (NEW)

Zero-downtime deployments with instant traffic switching:

| Feature | Description |
|---------|-------------|
| **Dual Environments** | Maintain blue and green environments simultaneously |
| **Instant Switch** | Switch 100% traffic instantly between environments |
| **Gradual Switch** | Optionally shift traffic in configurable increments |
| **Auto-Rollback** | Automatic rollback on health check failures |
| **Health Monitoring** | Real-time replica health tracking |

**Blue-Green Flow:**

1. Deploy new version to inactive environment (e.g., green)
2. Wait for all replicas to become healthy
3. Switch traffic from active (blue) to new (green)
4. Keep old environment as instant rollback target
5. Next deployment goes to blue environment

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

### Quick Install (Docker Compose)

The fastest way to deploy DevOps AI Dashboard:

```bash
# One-liner installation
curl -fsSL https://raw.githubusercontent.com/sileade/devops-ai-dashboard/main/scripts/install.sh | sudo bash

# With options
curl -fsSL https://raw.githubusercontent.com/sileade/devops-ai-dashboard/main/scripts/install.sh | sudo bash -s -- \
  --domain devops.example.com \
  --with-monitoring \
  --with-traefik
```

#### Installation Options

| Option | Description |
|--------|-------------|
| `--domain <domain>` | Domain name (default: localhost) |
| `--branch <branch>` | Git branch to deploy (default: main) |
| `--install-dir <path>` | Installation directory (default: /opt/devops-dashboard) |
| `--with-monitoring` | Enable Prometheus/Grafana stack |
| `--with-traefik` | Use Traefik instead of Nginx (with auto SSL) |

### Docker Compose Manual Setup

1. Clone the repository:
```bash
git clone https://github.com/sileade/devops-ai-dashboard.git
cd devops-ai-dashboard
```

2. Create environment file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start services:
```bash
# Basic setup (app + database + redis)
docker compose up -d

# With monitoring (Prometheus + Grafana)
docker compose --profile monitoring up -d

# With Traefik (auto SSL)
docker compose --profile traefik up -d

# Full stack
docker compose --profile monitoring --profile traefik up -d
```

4. Access the application:
- Dashboard: http://localhost:3000
- Prometheus: http://localhost:9090 (if enabled)
- Grafana: http://localhost:3001 (if enabled)

### CI/CD with GitHub Actions (NEW)

The platform includes comprehensive CI/CD workflows:

#### Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **CI** | PR, Push to main | Run tests, lint, type check, security scan |
| **CD** | Push to main (after CI) | Build Docker image, deploy to staging/production |
| **Release** | Tag push, Manual | Create GitHub release with artifacts |

#### CI Workflow Features
- TypeScript type checking
- Unit tests with Vitest
- ESLint code quality checks
- Security scanning with Trivy and CodeQL
- Dependency vulnerability audit

#### CD Workflow Features
- Multi-platform Docker builds (amd64, arm64)
- Push to GitHub Container Registry
- Automatic deployment to staging
- Manual approval for production
- Rollback capability

#### Setup

1. Add repository secrets:
   - `DEPLOY_HOST`: SSH host for deployment
   - `DEPLOY_USER`: SSH username
   - `DEPLOY_KEY`: SSH private key
   - `SLACK_WEBHOOK_URL`: (Optional) Slack notifications

2. Enable GitHub Actions in repository settings

3. Create a release:
```bash
git tag v1.0.0
git push origin v1.0.0
```

### GitOps-lite Pull Agent

The Pull Agent enables automatic deployments from GitHub:

#### Features
- **Webhook Support**: Instant deployment on git push
- **Polling Fallback**: Checks for updates every 5 minutes
- **Auto Rollback**: Reverts to previous version on failed deployment
- **Notifications**: Slack, Telegram, and custom webhook support
- **Health Checks**: Validates deployment before completing
- **Web Interface**: Built-in UI for manual control (NEW)
- **GitHub Actions Integration**: View workflow status (NEW)
- **Real-time Logs**: WebSocket-based live logging (NEW)

#### GitHub Webhook Setup

1. Go to your repository Settings → Webhooks → Add webhook
2. Configure:
   - **Payload URL**: `http://your-domain:9000/webhook/github`
   - **Content type**: `application/json`
   - **Secret**: Use the value from `GITHUB_WEBHOOK_SECRET` in your `.env`
   - **Events**: Select "Just the push event"

#### Pull Agent Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/status` | GET | Deployment status and history |
| `/webhook/github` | POST | GitHub webhook receiver |
| `/deploy` | POST | Manual deployment trigger |
| `/check-updates` | GET | Check for available updates |
| `/rollback` | POST | Rollback to specific commit |
| `/history` | GET | Deployment history |
| `/logs` | GET | Deployment logs |
| `/commits` | GET | Git commit history |
| `/containers` | GET | Docker containers status |
| `/github/actions` | GET | GitHub Actions runs |
| `/github/trigger-workflow` | POST | Trigger GitHub workflow |
| `/ws` | WebSocket | Real-time logs and status |

### Manual Setup (Development)

#### Prerequisites
- Node.js 22+
- pnpm package manager
- MySQL/TiDB database
- Docker (for container management)
- Kubernetes cluster (optional)

#### Setup

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

## Multi-Tenancy (NEW)

The platform supports multi-tenancy for managing multiple teams with isolated resources:

### Features

| Feature | Description |
|---------|-------------|
| **Team Management** | Create and manage teams with custom branding |
| **Role-Based Access** | Owner, Admin, Member, Viewer roles with granular permissions |
| **Resource Isolation** | Team-scoped resources and data separation |
| **Invitation System** | Email-based invitations with expiration |
| **Team Switching** | Quick navigation between teams |
| **Activity Tracking** | Per-team activity logs and statistics |
| **AI Insights** | AI-powered team health analysis |

### Team Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, can delete team, transfer ownership |
| **Admin** | Manage members, settings, resources |
| **Member** | Create and manage own resources |
| **Viewer** | Read-only access to team resources |

### Usage

1. Navigate to **Teams** in the sidebar
2. Create a new team or select existing
3. Invite members via email
4. Manage roles and permissions
5. View team activity and AI insights

## Audit Log (NEW)

Comprehensive audit logging for tracking all user activities:

### Features

| Feature | Description |
|---------|-------------|
| **Event Tracking** | All user actions logged with full context |
| **Risk Assessment** | Automatic risk level classification (low/medium/high/critical) |
| **Suspicious Activity Detection** | AI-powered anomaly detection |
| **Filtering & Search** | Advanced filtering by action, user, risk, status |
| **Export** | Export logs in JSON or CSV format |
| **Retention Policies** | Configurable log retention periods |
| **Real-time Alerts** | Notifications for suspicious activities |
| **Session Management** | Track and invalidate user sessions |

### Logged Events

- Authentication (login, logout, failed attempts)
- Resource operations (create, read, update, delete)
- Deployments (deploy, rollback, scale)
- Team management (invites, role changes)
- Configuration changes
- Secret access
- AI queries

### Usage

1. Navigate to **Audit Log** in the sidebar
2. Use filters to find specific events
3. Click on events for detailed information
4. View analytics for patterns
5. Check AI anomaly detection for security insights

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `auditLog.getLogs` | Query audit logs with filters |
| `auditLog.getStats` | Get audit log statistics |
| `auditLog.export` | Export logs to file |
| `auditLog.detectAnomalies` | AI-powered anomaly detection |
| `auditLog.getSessions` | Get user sessions |
| `auditLog.invalidateSession` | Invalidate a session |

## Real-time Notifications (NEW)

The platform includes a WebSocket-based real-time notification system:

### Features

| Feature | Description |
|---------|-------------|
| **Live Updates** | WebSocket connection for instant notifications |
| **Notification Channels** | Critical, warning, info, and success levels |
| **Sound Alerts** | Audio notifications for critical events |
| **Notification Center** | Centralized notification management |
| **Filtering** | Filter by type, read status, and source |
| **Preferences** | Per-user notification settings |

### Notification Types

- **Critical**: High CPU/memory alerts, deployment failures, security incidents
- **Warning**: Pending approvals, resource thresholds, degraded services
- **Info**: Team updates, configuration changes, scheduled events
- **Success**: Completed deployments, successful tests, resolved issues

### Integration

Notifications are automatically triggered by:
- Audit log events (critical and high-risk)
- Deployment status changes
- Auto-scaling actions
- Security anomaly detection
- Team membership changes

## PDF Reports (NEW)

Generate comprehensive PDF reports with charts and AI analysis:

### Report Types

| Type | Description |
|------|-------------|
| **Team Analytics** | Team activity, member contributions, resource usage |
| **Audit Summary** | Security events, user actions, compliance overview |
| **Security Report** | Threat analysis, vulnerability assessment, recommendations |
| **Deployment Report** | Deployment history, success rates, rollback analysis |
| **Activity Report** | System activity, API usage, performance metrics |

### Features

- **SVG Charts**: Visual data representation with bar, line, and pie charts
- **AI Analysis**: Intelligent insights and recommendations
- **Date Range Selection**: Custom or preset time periods
- **Team Filtering**: Generate reports for specific teams
- **Export Options**: Download as HTML, print to PDF

### Usage

1. Navigate to **Reports** in the sidebar
2. Select a report type
3. Choose date range and options
4. Click "Generate Report"
5. Preview, print, or download

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
| Total Lines of Code | 35,000+ |
| TypeScript/TSX Files | 147 |
| Server Routers | 18 modules |
| Client Pages | 24 pages |
| UI Components | 40+ |
| Database Tables | 28 |
| API Endpoints | 100+ |
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
