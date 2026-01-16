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
- LLM integration for AI features

### Infrastructure
- Docker Socket API integration
- Kubernetes API client
- Podman API support
- Ansible execution interface
- Terraform state management

## Project Structure

```
devops-ai-dashboard/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/            # Page-level components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── contexts/         # React contexts
│   │   └── lib/              # Utilities and tRPC client
│   └── public/               # Static assets
├── server/                    # Backend Express server
│   ├── routers/              # tRPC router modules
│   │   ├── ai.ts             # AI assistant endpoints
│   │   ├── autoscaling.ts    # Auto-scaling management
│   │   ├── docker.ts         # Docker API integration
│   │   ├── kubernetes.ts     # Kubernetes API integration
│   │   ├── scheduledScaling.ts # Scheduled scaling
│   │   └── abTesting.ts      # A/B testing for scaling
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

The platform uses 15+ database tables for comprehensive data management:

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

## API Endpoints

The platform exposes 60+ tRPC endpoints organized by module:

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
git clone https://github.com/yourusername/devops-ai-dashboard.git
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

The project includes 64+ tests covering:
- Authentication flows
- Dashboard API endpoints
- Infrastructure integrations
- Chat history persistence
- AI assistant functionality

## Performance Monitoring

### Lighthouse CI

Automated performance auditing is integrated into the CI/CD pipeline using Lighthouse CI.

**Local Usage:**
```bash
# Run Lighthouse audit locally
npx lhci autorun

# Run against specific URL
npx lhci collect --url=http://localhost:3000
```

**Performance Budgets:**
| Metric | Target | Threshold |
|--------|--------|----------|
| LCP (Largest Contentful Paint) | < 2.5s | Warning |
| FCP (First Contentful Paint) | < 1.8s | Warning |
| CLS (Cumulative Layout Shift) | < 0.1 | Error |
| TBI (Total Blocking Time) | < 300ms | Warning |
| Performance Score | > 80% | Warning |
| Accessibility Score | > 90% | Error |

**Configuration:** See `lighthouserc.js` for full configuration.

### Sentry Error Tracking

Production error monitoring is handled by Sentry.

**Setup:**
1. Create a Sentry project at [sentry.io](https://sentry.io)
2. Add environment variables:
   ```bash
   # Server-side
   SENTRY_DSN=https://xxx@sentry.io/xxx
   SENTRY_ENVIRONMENT=production
   
   # Client-side
   VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
   VITE_SENTRY_ENVIRONMENT=production
   ```

**Features:**
- Automatic error capture with stack traces
- Performance monitoring and tracing
- Session replay for debugging
- Source map integration
- Custom error context and tags

**Usage in Code:**
```typescript
// Server-side
import { captureException, addBreadcrumb } from './server/sentry';

try {
  // risky operation
} catch (error) {
  captureException(error, { userId: user.id });
}

// Client-side
import { captureException } from '@/lib/sentry';
```

### Load Testing with k6

Performance and load testing using k6.

**Install k6:**
```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker run -i grafana/k6 run - <k6/load-test.js
```

**Running Tests:**
```bash
# Standard load test
k6 run k6/load-test.js

# Stress test (find breaking point)
k6 run k6/stress-test.js

# Spike test (sudden traffic bursts)
k6 run k6/spike-test.js

# Custom parameters
k6 run --vus 50 --duration 5m k6/load-test.js

# Against staging/production
k6 run -e BASE_URL=https://staging.example.com k6/load-test.js
```

**Test Types:**
| Type | Purpose | VUs | Duration |
|------|---------|-----|----------|
| Load | Normal traffic simulation | 10-100 | 14 min |
| Stress | Find breaking point | 50-300 | 28 min |
| Spike | Sudden traffic bursts | 10-500 | 5 min |

**Performance Thresholds:**
- 95% of requests < 500ms
- 99% of requests < 1000ms
- Error rate < 1%
- Checks pass rate > 95%

### Grafana Monitoring Stack

Comprehensive monitoring with Grafana, Prometheus, and InfluxDB.

**Quick Start:**
```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access dashboards
# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
# InfluxDB: http://localhost:8086
```

**Available Dashboards:**
| Dashboard | Description |
|-----------|-------------|
| k6 Load Testing | VUs, response times, error rates from k6 tests |
| Application Performance | CPU, memory, HTTP metrics, latency percentiles |
| Infrastructure Health | Node metrics, container stats, disk usage |

**Alerting Integration:**
Configured alert routing to multiple channels:
- **PagerDuty** — Critical incidents (P1)
- **Opsgenie** — On-call management
- **Slack** — Team notifications
- **Discord** — Community alerts
- **Email** — Fallback notifications

**Environment Variables for Alerting:**
```bash
PAGERDUTY_ROUTING_KEY=your-routing-key
OPSGENIE_API_KEY=your-api-key
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Chaos Engineering

Test system resilience with chaos experiments.

**Available Experiments:**
```bash
# CPU stress (80% load for 60 seconds)
./chaos/experiments.sh cpu-stress 80 60

# Memory stress (70% for 60 seconds)
./chaos/experiments.sh memory-stress 70 60

# Network latency (200ms on eth0)
./chaos/experiments.sh network-latency eth0 200 60

# Container kill
./chaos/experiments.sh container-kill devops-dashboard

# Full chaos suite
./chaos/experiments.sh full-suite

# Cleanup
./chaos/experiments.sh cleanup
```

**Experiment Types:**
| Type | Description | Use Case |
|------|-------------|----------|
| CPU Stress | High CPU utilization | Test auto-scaling triggers |
| Memory Stress | Memory pressure | Test OOM handling |
| Network Latency | Add artificial delay | Test timeout handling |
| Packet Loss | Simulate unreliable network | Test retry logic |
| Container Kill | Abrupt termination | Test recovery mechanisms |
| Disk I/O Stress | Heavy disk operations | Test I/O bound scenarios |

**GitHub Actions Workflow:**
Chaos experiments can be triggered via GitHub Actions with configurable experiment type, duration, and target environment. Production chaos is restricted to business hours.

See `docs/CHAOS-ENGINEERING.md` for detailed documentation.

### Terraform State Visualization

Interactive graph visualization of Terraform infrastructure resources using D3.js.

**Features:**
- **Force-directed graph** — Visual representation of resource dependencies
- **Provider color coding** — AWS (orange), GCP (blue), Azure (purple), Kubernetes (blue)
- **Interactive controls** — Zoom, pan, drag nodes, click for details
- **Resource filtering** — Filter by provider, type, or search by name
- **Dependency tracking** — Visual links showing resource relationships
- **State parsing** — Automatic parsing of terraform.tfstate files

**Usage:**
```tsx
import { TerraformGraph } from '@/components/TerraformGraph';
import { parseTerraformState } from '@/server/terraform';

// Parse state file
const graphData = parseTerraformState(terraformStateJson);

// Render interactive graph
<TerraformGraph
  data={graphData}
  onNodeClick={(node) => console.log('Selected:', node)}
/>
```

**Supported Providers:**
| Provider | Icon | Color | Resources |
|----------|------|-------|----------|
| AWS | ☁️ | #FF9900 | EC2, RDS, S3, Lambda, etc. |
| GCP | 🔷 | #4285F4 | Compute, Cloud SQL, GCS, etc. |
| Azure | 🔶 | #0078D4 | VMs, SQL, Storage, etc. |
| Kubernetes | ⚓ | #326CE5 | Deployments, Services, etc. |

### ArgoCD GitOps Integration

Full integration with ArgoCD for GitOps-based continuous deployment.

**Features:**
- **Application listing** — View all ArgoCD applications with health/sync status
- **Sync operations** — Trigger manual sync with optional revision targeting
- **Rollback support** — Rollback to any previous deployment revision
- **Resource tree** — View Kubernetes resources managed by each application
- **Real-time status** — Health and sync status with color indicators

**API Client Usage:**
```typescript
import { ArgoCDClient } from '@/server/argocd';

const client = new ArgoCDClient({
  serverUrl: 'https://argocd.example.com',
  token: process.env.ARGOCD_TOKEN,
});

// List applications
const apps = await client.listApplications();

// Sync application
await client.syncApplication('my-app', {
  revision: 'main',
  prune: true,
});

// Rollback to previous revision
await client.rollbackApplication('my-app', 5);
```

**Status Colors:**
| Health Status | Color | Description |
|--------------|-------|-------------|
| Healthy | 🟢 Green | All resources healthy |
| Progressing | 🔵 Blue | Deployment in progress |
| Degraded | 🔴 Red | Some resources unhealthy |
| Suspended | 🟡 Yellow | Application suspended |
| Missing | ⚫ Gray | Resources not found |

### Cloud Cost Monitoring

Unified cost tracking across AWS, GCP, and Azure with AI-powered recommendations.

**Features:**
- **Multi-cloud support** — AWS Cost Explorer, GCP Billing, Azure Cost Management
- **Cost breakdown** — By service, region, and custom tags
- **Budget tracking** — Set limits and receive threshold alerts
- **Forecasting** — Predict future costs based on usage patterns
- **AI recommendations** — Rightsizing, reserved instances, unused resources
- **Cost alerts** — Budget thresholds, anomaly detection, cost spikes

**Usage:**
```typescript
import { CostMonitoringService } from '@/server/cost-monitoring';

const costService = new CostMonitoringService({
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    credentials: process.env.GCP_CREDENTIALS,
  },
  azure: {
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
    tenantId: process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
});

// Get all costs
const costs = await costService.getAllCosts('2024-01-01', '2024-01-31');

// Get total across providers
const total = await costService.getTotalCost('2024-01-01', '2024-01-31');

// Get cost alerts
const alerts = await costService.getAlerts();
```

**Cost Recommendations:**
| Category | Description | Typical Savings |
|----------|-------------|----------------|
| Rightsizing | Downsize underutilized instances | 20-40% |
| Reserved Instances | Commit to 1-3 year terms | 30-60% |
| Unused Resources | Delete orphaned disks, IPs | 5-15% |
| Spot/Preemptible | Use for fault-tolerant workloads | 60-90% |

**Environment Variables:**
```bash
# AWS
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# GCP
GCP_PROJECT_ID=your-project-id
GCP_CREDENTIALS='{"type":"service_account",...}'

# Azure
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

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
