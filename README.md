# DevOps AI Dashboard

[![CI](https://github.com/sileade/devops-ai-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/sileade/devops-ai-dashboard/actions/workflows/ci.yml)
[![CD](https://github.com/sileade/devops-ai-dashboard/actions/workflows/cd.yml/badge.svg)](https://github.com/sileade/devops-ai-dashboard/actions/workflows/cd.yml)
[![E2E Tests](https://github.com/sileade/devops-ai-dashboard/actions/workflows/e2e.yml/badge.svg)](https://github.com/sileade/devops-ai-dashboard/actions/workflows/e2e.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://reactjs.org/)

A comprehensive DevOps management platform with AI-powered automation, real-time monitoring, and intelligent scaling capabilities. Built with React, TypeScript, tRPC, and integrated with Docker, Kubernetes, Ansible, and Terraform.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Staging Environment](#staging-environment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Testing](#testing)
- [E2E Testing](#e2e-testing)
- [Contributing](#contributing)
- [License](#license)

## Features

### Infrastructure Management

| Feature | Description |
|---------|-------------|
| **Docker & Podman** | Full container lifecycle management with real-time stats, logs, and network/volume control (rootless support) |
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

### Deployment Strategies

| Strategy | Description |
|----------|-------------|
| **Canary Deployments** | Progressive rollout with traffic splitting and automatic rollback |
| **Blue-Green Deployments** | Zero-downtime deployments with instant traffic switching |
| **ArgoCD Integration** | GitOps workflow with automatic sync and health monitoring |
| **GitOps Pull Agent** | Webhook-based automatic deployments from GitHub |

### Real-Time Monitoring

- **WebSocket Updates**: Live container and pod status updates without page refresh
- **Metrics Charts**: CPU, Memory, and Network I/O visualization with 24-hour history
- **Alert System**: Configurable thresholds with browser push notifications
- **Live Status Indicators**: Visual feedback for connection status and data freshness
- **Real-time Notifications**: WebSocket-based instant notifications for critical events

### Intelligent Auto-Scaling

| Component | Description |
|-----------|-------------|
| **Rule-Based Scaling** | Define scaling rules with thresholds, cooldowns, and replica limits |
| **AI Predictions** | Machine learning-based load prediction and anomaly detection |
| **Scheduled Scaling** | Cron-based scheduling for predictable workload patterns |
| **A/B Testing** | Experiment with different scaling configurations to optimize performance |
| **Human Approval Mode** | Optional approval workflow for critical scaling decisions |

### Multi-Tenancy & Security

| Feature | Description |
|---------|-------------|
| **Team Management** | Create teams with hierarchical organization |
| **Role-Based Access** | Owner, Admin, Member, Viewer roles with granular permissions |
| **Resource Isolation** | Team-scoped resources and data separation |
| **Audit Logging** | Comprehensive tracking of all user actions |
| **AI Anomaly Detection** | Automatic detection of suspicious activities |

### Integrations

| Integration | Description |
|-------------|-------------|
| **Prometheus/Grafana** | Full observability stack with PromQL queries and dashboard embedding |
| **Multi-Cluster** | Manage multiple Kubernetes clusters from single interface |
| **Email (SMTP)** | Configurable email notifications for alerts and reports |
| **Slack/Discord Bot** | Chat-based deployment management with slash commands |
| **GitHub Actions** | CI/CD workflows with automated testing and deployment |

### PDF Reports

Generate comprehensive reports with charts and AI analysis:

- **Team Analytics**: Team activity, member contributions, resource usage
- **Audit Summary**: Security events, user actions, compliance overview
- **Security Report**: Threat analysis, vulnerability assessment, recommendations
- **Deployment Report**: Deployment history, success rates, rollback analysis

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (React 19)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Dashboard│ │ Containers│ │Kubernetes│ │AI Assistant│         │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │                  │
│       └────────────┴────────────┴────────────┘                  │
│                         │ tRPC                                  │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│                    Server (Express + tRPC)                      │
│  ┌──────────────────────┴──────────────────────┐               │
│  │              tRPC Router (24 modules)        │               │
│  └──────────────────────┬──────────────────────┘               │
│                         │                                       │
│  ┌──────────┐ ┌─────────┴─────────┐ ┌──────────┐               │
│  │ Services │ │   Infrastructure   │ │ WebSocket│               │
│  │(12 modules)│ │ (Docker, K8s, etc)│ │  Server  │               │
│  └────┬─────┘ └─────────┬─────────┘ └────┬─────┘               │
│       │                 │                 │                     │
└───────┼─────────────────┼─────────────────┼─────────────────────┘
        │                 │                 │
┌───────┴─────────────────┴─────────────────┴─────────────────────┐
│                        Data Layer                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  MySQL   │ │   Redis  │ │    S3    │ │Prometheus│           │
│  │(44 tables)│ │  Cache   │ │ Storage  │ │ Metrics  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts |
| **Backend** | Node.js, Express, tRPC 11, Socket.IO |
| **Database** | MySQL/TiDB, Drizzle ORM |
| **Infrastructure** | Docker, Kubernetes, Ansible, Terraform |
| **AI** | LLM Integration for analysis and recommendations |
| **Monitoring** | Prometheus, Grafana, Custom metrics |

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (optional, for container management)
- Kubernetes cluster (optional, for K8s features)

### Installation

```bash
# Clone the repository
git clone https://github.com/sileade/devops-ai-dashboard.git
cd devops-ai-dashboard

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables

```env
# Database
DATABASE_URL=mysql://user:password@host:3306/database

# Authentication
JWT_SECRET=your-jwt-secret
VITE_APP_ID=your-app-id

# Optional: Docker
DOCKER_HOST=unix:///var/run/docker.sock

# Optional: Podman (rootless)
PODMAN_SOCKET_PATH=/run/user/1000/podman/podman.sock

# Optional: Kubernetes
KUBECONFIG=/path/to/kubeconfig

# Optional: Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password

# Optional: Slack/Discord
SLACK_BOT_TOKEN=xoxb-...
DISCORD_BOT_TOKEN=...
```

## Docker Deployment

### One-Line Installation

```bash
curl -fsSL https://raw.githubusercontent.com/sileade/devops-ai-dashboard/main/scripts/install.sh | bash
```

### Docker Compose / Podman Compose

```bash
# Clone repository
git clone https://github.com/sileade/devops-ai-dashboard.git
cd devops-ai-dashboard

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start all services with Docker
docker compose up -d

# Or with Podman
podman-compose up -d

# With monitoring stack (Prometheus + Grafana)
docker compose --profile monitoring up -d

# With Traefik reverse proxy
docker compose --profile traefik up -d
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| **app** | 3000 | Main application |
| **db** | 3306 | MySQL database |
| **redis** | 6379 | Cache and sessions |
| **pull-agent** | 9000 | GitOps deployment agent |
| **prometheus** | 9090 | Metrics collection |
| **grafana** | 3001 | Visualization |
| **traefik** | 80/443 | Reverse proxy with SSL |

### GitOps Pull Agent

The Pull Agent enables automatic deployments:

1. **Webhook Mode**: Receives GitHub webhooks and deploys automatically
2. **Polling Mode**: Checks for updates every 5 minutes (fallback)
3. **Web UI**: Manual control at port 9000

Configure GitHub webhook:
- URL: `https://your-domain.com:9000/webhook`
- Secret: Set in `WEBHOOK_SECRET` environment variable
- Events: `push`

## Configuration

### Alert Thresholds

Navigate to **Settings > Alert Thresholds** to configure:

| Metric | Warning | Critical |
|--------|---------|----------|
| CPU Usage | 80% | 95% |
| Memory Usage | 80% | 95% |
| Disk Usage | 85% | 95% |
| Pod Restarts | 3 | 5 |

### Auto-Scaling Rules

Create rules in **Scaling > Auto-Scaling**:

```json
{
  "name": "High CPU Scale Out",
  "metric": "cpu_percent",
  "operator": "greater_than",
  "threshold": 80,
  "action": "scale_out",
  "cooldown": 300,
  "minReplicas": 2,
  "maxReplicas": 10
}
```

### Scheduled Scaling

Create schedules in **Scaling > Scheduled**:

```json
{
  "name": "Business Hours Scale Up",
  "schedule": "0 0 9 * * 1-5",
  "targetReplicas": 5,
  "timezone": "America/New_York"
}
```

## API Reference

### tRPC Routers

| Router | Endpoints | Description |
|--------|-----------|-------------|
| `auth` | 2 | Authentication (me, logout) |
| `dashboard` | 3 | Overview, stats, activity |
| `docker` | 12 | Container management |
| `kubernetes` | 15 | K8s resource management |
| `ai` | 8 | AI assistant, chat, analysis |
| `autoscaling` | 10 | Scaling rules and history |
| `canary` | 8 | Canary deployments |
| `bluegreen` | 6 | Blue-green deployments |
| `argocd` | 7 | ArgoCD integration |
| `teams` | 12 | Team management |
| `auditLog` | 8 | Audit logging |
| `reports` | 5 | PDF report generation |
| `notifications` | 6 | Real-time notifications |

### Example API Calls

```typescript
// Get dashboard overview
const overview = await trpc.dashboard.getOverview.query();

// List Docker containers
const containers = await trpc.docker.listContainers.query();

// Create canary deployment
await trpc.canary.create.mutate({
  name: "api-server-v2",
  namespace: "production",
  stableImage: "api:v1",
  canaryImage: "api:v2",
  initialWeight: 10,
  stepWeight: 10,
  stepInterval: 300
});

// Generate PDF report
const report = await trpc.reports.generateTeamReport.mutate({
  teamId: "team-123",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-16")
});
```

## Staging Environment

The project includes a complete staging environment configuration for pre-production testing.

### Quick Start Staging

```bash
# Deploy to staging
./scripts/deploy-staging.sh

# With database migrations
./scripts/deploy-staging.sh --migrate

# With monitoring stack
./scripts/deploy-staging.sh --monitoring

# Full deployment with all options
./scripts/deploy-staging.sh --build --migrate --monitoring --logs
```

### Staging Services

| Service | Port | Description |
|---------|------|-------------|
| **app** | 3000 | Main application |
| **db** | 5432 | PostgreSQL database |
| **redis** | 6379 | Cache and sessions |
| **nginx** | 80/443 | Reverse proxy (optional) |
| **prometheus** | 9090 | Metrics (optional) |
| **grafana** | 3001 | Visualization (optional) |

### Environment Configuration

Copy and configure the staging environment file:

```bash
cp .env.example .env.staging
# Edit .env.staging with staging-specific values
```

## CI/CD Pipeline

The project includes a comprehensive CI/CD pipeline with GitHub Actions.

### Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **CI** | Push, PR | Lint, test, type-check, security scan |
| **CD** | Push to main | Build, deploy to staging/production |
| **E2E** | Push, PR | Playwright end-to-end tests |
| **Release** | Tag push | Create GitHub release with changelog |

### Required GitHub Secrets

For deployment to work, configure these secrets in your repository:

| Secret | Description |
|--------|-------------|
| `STAGING_HOST` | Staging server hostname/IP |
| `STAGING_USER` | SSH user for staging |
| `STAGING_SSH_KEY` | SSH private key for staging |
| `PRODUCTION_HOST` | Production server hostname/IP |
| `PRODUCTION_USER` | SSH user for production |
| `PRODUCTION_SSH_KEY` | SSH private key for production |
| `SLACK_WEBHOOK_URL` | Slack notifications (optional) |
| `DISCORD_WEBHOOK_URL` | Discord notifications (optional) |

See [docs/GITHUB-SECRETS-SETUP.md](docs/GITHUB-SECRETS-SETUP.md) for detailed setup instructions.

### Deployment Flow

```
Push to main → CI Tests → Build Docker Image → Deploy to Staging
                                                      ↓
                                              E2E Tests on Staging
                                                      ↓
                                              Deploy to Production
                                                      ↓
                                              Health Check & Notify
```

## Testing

### Run Unit Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test server/auth.logout.test.ts
```

### Test Coverage

| Suite | Tests | Status |
|-------|-------|--------|
| Authentication | 1 | ✅ Pass |
| Chat | 21 | ✅ Pass |
| Chat Features | 11 | ✅ Pass |
| Dashboard | 5 | ✅ Pass |
| Infrastructure | 26 | ✅ Pass |
| **Total** | **64** | **All Pass** |

## E2E Testing

The project uses Playwright for end-to-end testing of critical user flows.

### Run E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI mode (interactive)
pnpm test:e2e:ui

# Run specific test file
npx playwright test e2e/dashboard.spec.ts

# Run against staging environment
E2E_BASE_URL=https://staging.example.com pnpm test:e2e

# View test report
pnpm test:e2e:report
```

### E2E Test Suites

| Suite | Tests | Description |
|-------|-------|-------------|
| Dashboard | 8 | Main dashboard functionality |
| Containers | 8 | Docker/Podman container management |
| Kubernetes | 10 | K8s cluster operations |
| AI Assistant | 10 | AI chat and recommendations |
| **Total** | **36** | Critical user flows |

### Test Configuration

Playwright is configured in `playwright.config.ts` with:

- Chromium browser testing
- Automatic dev server startup
- Screenshot on failure
- Video recording on retry
- HTML and JSON reports

## Code Statistics

| Metric | Value |
|--------|-------|
| Total Lines of Code | 46,765 |
| TypeScript/TSX Files | 171 |
| Server Services | 12 modules |
| Server Routers | 24 modules |
| Client Pages | 28 pages |
| UI Components | 50+ |
| Database Tables | 44 |
| API Endpoints | 100+ |
| Test Cases | 64 |

## Security

### Implemented Measures

| Feature | Status |
|---------|--------|
| OAuth Authentication | ✅ |
| Role-Based Access Control | ✅ |
| Rate Limiting | ✅ |
| Input Validation (Zod) | ✅ |
| SQL Injection Prevention | ✅ |
| XSS Prevention | ✅ |
| Audit Logging | ✅ |
| Session Management | ✅ |

### Best Practices

1. All API keys stored in environment variables
2. Server-side only access to sensitive credentials
3. Parameterized database queries via Drizzle ORM
4. Comprehensive audit trail for compliance

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Run type check: `pnpm tsc --noEmit`
6. Commit: `git commit -m "Add my feature"`
7. Push: `git push origin feature/my-feature`
8. Submit a pull request

### Code Style

- TypeScript strict mode enabled
- ESLint for code linting
- Prettier for formatting
- Conventional commits recommended

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [shadcn/ui](https://ui.shadcn.com/) components
- Charts powered by [Recharts](https://recharts.org/)
- Real-time updates via [Socket.IO](https://socket.io/)
- Database ORM by [Drizzle](https://orm.drizzle.team/)
- Email sending via [Nodemailer](https://nodemailer.com/)

---

**DevOps AI Dashboard** - Intelligent DevOps Automation Platform

*Built with ❤️ for the DevOps community*
