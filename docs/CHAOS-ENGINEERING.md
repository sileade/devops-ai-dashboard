# Chaos Engineering Guide

This document describes the chaos engineering practices and tools available for testing the resilience of the DevOps AI Dashboard.

## Overview

Chaos engineering is the discipline of experimenting on a system to build confidence in its capability to withstand turbulent conditions in production. Our chaos engineering toolkit includes experiments for:

- **CPU Stress**: Test behavior under high CPU load
- **Memory Stress**: Test behavior under memory pressure
- **Network Chaos**: Simulate network latency, packet loss, and bandwidth limitations
- **Container Chaos**: Kill, pause, or resource-limit containers
- **Kubernetes Chaos**: Pod kills, network partitions, and scale-down events
- **Disk I/O Chaos**: Test behavior under disk stress

## Prerequisites

### Required Tools

```bash
# Install stress-ng for CPU/memory/disk stress
sudo apt-get install stress-ng

# Install iproute2 for network chaos (tc command)
sudo apt-get install iproute2

# Docker and kubectl should already be installed
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPERIMENT_DURATION` | Default experiment duration (seconds) | 60 |
| `TARGET_CONTAINER` | Default Docker container name | devops-dashboard |
| `TARGET_NAMESPACE` | Default Kubernetes namespace | default |
| `TARGET_POD` | Default Kubernetes pod name | (auto-selected) |

## Running Experiments

### Using the CLI Script

The main chaos engineering script is located at `chaos/experiments.sh`.

```bash
# Show help
./chaos/experiments.sh help

# CPU stress (80% load for 60 seconds)
./chaos/experiments.sh cpu-stress 80 60

# Memory stress (70% of available memory for 60 seconds)
./chaos/experiments.sh memory-stress 70 60

# Network latency (200ms on eth0 for 60 seconds)
./chaos/experiments.sh network-latency eth0 200 60

# Packet loss (10% on eth0 for 60 seconds)
./chaos/experiments.sh network-loss eth0 10 60

# Kill a container
./chaos/experiments.sh container-kill devops-dashboard

# Pause a container for 60 seconds
./chaos/experiments.sh container-pause devops-dashboard 60

# Run full chaos suite
./chaos/experiments.sh full-suite

# Clean up all chaos experiments
./chaos/experiments.sh cleanup
```

### Using GitHub Actions

Chaos experiments can be triggered via GitHub Actions:

1. Go to **Actions** → **Chaos Engineering**
2. Click **Run workflow**
3. Select:
   - **Experiment**: Type of chaos to run
   - **Duration**: How long to run (seconds)
   - **Environment**: staging or production

**Note**: Production chaos is only allowed during business hours (9 AM - 5 PM, weekdays).

### Scheduled Chaos

By default, chaos tests run automatically:
- **Weekly** on staging (Sunday at 3 AM)

## Experiment Types

### CPU Stress

Simulates high CPU utilization to test:
- Application responsiveness under load
- Auto-scaling triggers
- Alert thresholds

```bash
# 80% CPU load for 2 minutes
./chaos/experiments.sh cpu-stress 80 120
```

### Memory Stress

Simulates memory pressure to test:
- OOM killer behavior
- Memory-based auto-scaling
- Application stability under memory constraints

```bash
# 70% memory usage for 2 minutes
./chaos/experiments.sh memory-stress 70 120
```

### Network Latency

Adds artificial network delay to test:
- Timeout handling
- Retry logic
- User experience under poor network conditions

```bash
# Add 200ms latency with 50ms jitter
./chaos/experiments.sh network-latency eth0 200 60
```

### Packet Loss

Simulates unreliable network to test:
- Connection resilience
- Data integrity
- Retry mechanisms

```bash
# 10% packet loss
./chaos/experiments.sh network-loss eth0 10 60
```

### Container Kill

Abruptly terminates containers to test:
- Container orchestration recovery
- Service discovery updates
- Health check effectiveness

```bash
./chaos/experiments.sh container-kill devops-dashboard
```

### Kubernetes Pod Kill

Terminates pods to test:
- ReplicaSet recovery
- Service continuity
- Rolling update behavior

```bash
./chaos/experiments.sh k8s-pod-kill default my-pod
```

## Safety Guidelines

### Before Running Chaos

1. **Notify the team** - Inform relevant stakeholders
2. **Check monitoring** - Ensure alerting is working
3. **Verify rollback** - Know how to quickly recover
4. **Start small** - Begin with low-impact experiments
5. **Have runbooks ready** - Document recovery procedures

### During Chaos

1. **Monitor closely** - Watch dashboards and logs
2. **Be ready to abort** - Know how to stop experiments
3. **Document observations** - Note unexpected behaviors
4. **Communicate** - Keep team informed of progress

### After Chaos

1. **Verify recovery** - Ensure system is healthy
2. **Clean up** - Remove any chaos artifacts
3. **Document findings** - Record what was learned
4. **Create action items** - Address discovered weaknesses

## Cleanup

Always clean up after experiments:

```bash
# Clean up all chaos experiments
./chaos/experiments.sh cleanup

# Manual cleanup if needed:

# Remove network chaos
sudo tc qdisc del dev eth0 root 2>/dev/null || true

# Unpause containers
docker unpause $(docker ps -q --filter "status=paused") 2>/dev/null || true

# Remove disk fill
rm -rf /tmp/chaos
```

## Monitoring During Chaos

### Key Metrics to Watch

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| CPU Usage | < 70% | 70-85% | > 85% |
| Memory Usage | < 70% | 70-85% | > 85% |
| Response Time (P95) | < 200ms | 200-500ms | > 500ms |
| Error Rate | < 1% | 1-5% | > 5% |
| Request Rate | Stable | ±20% | ±50% |

### Grafana Dashboards

Monitor chaos experiments using:
- **Application Performance** dashboard
- **Infrastructure Health** dashboard
- **k6 Load Testing** dashboard (for load during chaos)

## Integration with Alerting

Chaos experiments should trigger alerts appropriately:

1. **PagerDuty**: Critical alerts during chaos indicate proper alerting
2. **Opsgenie**: Verify on-call notifications work
3. **Slack**: Check warning notifications appear

## Best Practices

### Game Days

Conduct regular "Game Days" where the team:
1. Plans chaos experiments in advance
2. Runs experiments during business hours
3. Practices incident response
4. Documents learnings

### Chaos Maturity Model

| Level | Description | Activities |
|-------|-------------|------------|
| 1 - Basic | Manual experiments | Ad-hoc container kills |
| 2 - Intermediate | Automated experiments | Scheduled chaos in staging |
| 3 - Advanced | Continuous chaos | Chaos in production |
| 4 - Expert | Chaos as code | Fully automated resilience testing |

## Troubleshooting

### Experiment Won't Start

```bash
# Check if stress-ng is installed
which stress-ng

# Check permissions
sudo -v

# Check network interface name
ip link show
```

### Network Chaos Not Working

```bash
# Check if tc is available
which tc

# Check current qdisc
tc qdisc show dev eth0

# Remove existing rules
sudo tc qdisc del dev eth0 root
```

### Container Not Responding

```bash
# Check container status
docker ps -a

# Check container logs
docker logs devops-dashboard

# Force restart
docker restart devops-dashboard
```

## References

- [Principles of Chaos Engineering](https://principlesofchaos.org/)
- [Netflix Chaos Monkey](https://netflix.github.io/chaosmonkey/)
- [Gremlin Chaos Engineering](https://www.gremlin.com/)
- [Chaos Toolkit](https://chaostoolkit.org/)
