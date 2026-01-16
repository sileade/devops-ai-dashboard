#!/bin/bash

# Chaos Engineering Experiments for DevOps AI Dashboard
# 
# This script provides various chaos experiments to test system resilience.
# Use with caution - these experiments can cause service disruptions!
#
# Prerequisites:
# - stress-ng (for CPU/memory stress)
# - tc (traffic control for network chaos)
# - Docker (for container experiments)
# - kubectl (for Kubernetes experiments)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EXPERIMENT_DURATION=${EXPERIMENT_DURATION:-60}
TARGET_CONTAINER=${TARGET_CONTAINER:-"devops-dashboard"}
TARGET_NAMESPACE=${TARGET_NAMESPACE:-"default"}
TARGET_POD=${TARGET_POD:-""}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if required tools are installed
check_prerequisites() {
    local missing_tools=()
    
    command -v stress-ng >/dev/null 2>&1 || missing_tools+=("stress-ng")
    command -v tc >/dev/null 2>&1 || missing_tools+=("iproute2")
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_warn "Missing tools: ${missing_tools[*]}"
        log_info "Install with: sudo apt-get install ${missing_tools[*]}"
    fi
}

# ============================================
# CPU Stress Experiments
# ============================================

cpu_stress() {
    local cpu_load=${1:-80}
    local duration=${2:-$EXPERIMENT_DURATION}
    
    log_info "Starting CPU stress experiment: ${cpu_load}% load for ${duration}s"
    
    # Calculate number of workers based on CPU count
    local cpu_count=$(nproc)
    local workers=$((cpu_count * cpu_load / 100))
    [ $workers -lt 1 ] && workers=1
    
    stress-ng --cpu $workers --timeout ${duration}s --metrics-brief
    
    log_success "CPU stress experiment completed"
}

cpu_stress_container() {
    local container=${1:-$TARGET_CONTAINER}
    local cpu_load=${2:-80}
    local duration=${3:-$EXPERIMENT_DURATION}
    
    log_info "Starting CPU stress in container: $container"
    
    docker exec $container sh -c "
        apt-get update && apt-get install -y stress-ng 2>/dev/null || true
        stress-ng --cpu 2 --timeout ${duration}s
    " &
    
    local pid=$!
    sleep $duration
    wait $pid 2>/dev/null || true
    
    log_success "Container CPU stress completed"
}

# ============================================
# Memory Stress Experiments
# ============================================

memory_stress() {
    local memory_percent=${1:-80}
    local duration=${2:-$EXPERIMENT_DURATION}
    
    log_info "Starting memory stress experiment: ${memory_percent}% for ${duration}s"
    
    # Get total memory in MB
    local total_mem=$(free -m | awk '/^Mem:/{print $2}')
    local target_mem=$((total_mem * memory_percent / 100))
    
    stress-ng --vm 1 --vm-bytes ${target_mem}M --timeout ${duration}s --metrics-brief
    
    log_success "Memory stress experiment completed"
}

memory_stress_container() {
    local container=${1:-$TARGET_CONTAINER}
    local memory_mb=${2:-512}
    local duration=${3:-$EXPERIMENT_DURATION}
    
    log_info "Starting memory stress in container: $container (${memory_mb}MB)"
    
    docker exec $container sh -c "
        apt-get update && apt-get install -y stress-ng 2>/dev/null || true
        stress-ng --vm 1 --vm-bytes ${memory_mb}M --timeout ${duration}s
    " &
    
    local pid=$!
    sleep $duration
    wait $pid 2>/dev/null || true
    
    log_success "Container memory stress completed"
}

# ============================================
# Network Chaos Experiments
# ============================================

network_latency() {
    local interface=${1:-eth0}
    local latency=${2:-200}
    local duration=${3:-$EXPERIMENT_DURATION}
    
    log_info "Adding ${latency}ms latency to $interface for ${duration}s"
    
    # Add latency
    sudo tc qdisc add dev $interface root netem delay ${latency}ms 50ms distribution normal
    
    log_info "Latency added. Waiting ${duration}s..."
    sleep $duration
    
    # Remove latency
    sudo tc qdisc del dev $interface root
    
    log_success "Network latency experiment completed"
}

network_packet_loss() {
    local interface=${1:-eth0}
    local loss_percent=${2:-10}
    local duration=${3:-$EXPERIMENT_DURATION}
    
    log_info "Adding ${loss_percent}% packet loss to $interface for ${duration}s"
    
    # Add packet loss
    sudo tc qdisc add dev $interface root netem loss ${loss_percent}%
    
    log_info "Packet loss added. Waiting ${duration}s..."
    sleep $duration
    
    # Remove packet loss
    sudo tc qdisc del dev $interface root
    
    log_success "Network packet loss experiment completed"
}

network_bandwidth_limit() {
    local interface=${1:-eth0}
    local bandwidth=${2:-1mbit}
    local duration=${3:-$EXPERIMENT_DURATION}
    
    log_info "Limiting bandwidth to $bandwidth on $interface for ${duration}s"
    
    # Add bandwidth limit
    sudo tc qdisc add dev $interface root tbf rate $bandwidth burst 32kbit latency 400ms
    
    log_info "Bandwidth limited. Waiting ${duration}s..."
    sleep $duration
    
    # Remove bandwidth limit
    sudo tc qdisc del dev $interface root
    
    log_success "Network bandwidth limit experiment completed"
}

# ============================================
# Container Chaos Experiments
# ============================================

container_kill() {
    local container=${1:-$TARGET_CONTAINER}
    
    log_info "Killing container: $container"
    
    docker kill $container
    
    log_success "Container killed"
}

container_pause() {
    local container=${1:-$TARGET_CONTAINER}
    local duration=${2:-$EXPERIMENT_DURATION}
    
    log_info "Pausing container: $container for ${duration}s"
    
    docker pause $container
    
    log_info "Container paused. Waiting ${duration}s..."
    sleep $duration
    
    docker unpause $container
    
    log_success "Container unpaused"
}

container_resource_limit() {
    local container=${1:-$TARGET_CONTAINER}
    local cpu_limit=${2:-0.5}
    local memory_limit=${3:-256m}
    
    log_info "Limiting container resources: CPU=${cpu_limit}, Memory=${memory_limit}"
    
    docker update --cpus $cpu_limit --memory $memory_limit $container
    
    log_success "Container resource limits applied"
}

# ============================================
# Kubernetes Chaos Experiments
# ============================================

k8s_pod_kill() {
    local namespace=${1:-$TARGET_NAMESPACE}
    local pod=${2:-$TARGET_POD}
    
    if [ -z "$pod" ]; then
        # Kill a random pod
        pod=$(kubectl get pods -n $namespace -o jsonpath='{.items[0].metadata.name}')
    fi
    
    log_info "Killing pod: $pod in namespace: $namespace"
    
    kubectl delete pod $pod -n $namespace --grace-period=0 --force
    
    log_success "Pod killed"
}

k8s_pod_network_partition() {
    local namespace=${1:-$TARGET_NAMESPACE}
    local pod=${2:-$TARGET_POD}
    local duration=${3:-$EXPERIMENT_DURATION}
    
    log_info "Creating network partition for pod: $pod"
    
    # Apply network policy to isolate pod
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: chaos-network-partition
  namespace: $namespace
spec:
  podSelector:
    matchLabels:
      app: $pod
  policyTypes:
  - Ingress
  - Egress
EOF
    
    log_info "Network partition applied. Waiting ${duration}s..."
    sleep $duration
    
    # Remove network policy
    kubectl delete networkpolicy chaos-network-partition -n $namespace
    
    log_success "Network partition removed"
}

k8s_scale_down() {
    local namespace=${1:-$TARGET_NAMESPACE}
    local deployment=${2:-"devops-dashboard"}
    local replicas=${3:-0}
    local duration=${4:-$EXPERIMENT_DURATION}
    
    # Save current replica count
    local current_replicas=$(kubectl get deployment $deployment -n $namespace -o jsonpath='{.spec.replicas}')
    
    log_info "Scaling down deployment: $deployment to $replicas replicas"
    
    kubectl scale deployment $deployment -n $namespace --replicas=$replicas
    
    log_info "Scaled down. Waiting ${duration}s..."
    sleep $duration
    
    # Restore replica count
    kubectl scale deployment $deployment -n $namespace --replicas=$current_replicas
    
    log_success "Deployment scaled back to $current_replicas replicas"
}

# ============================================
# Disk I/O Chaos Experiments
# ============================================

disk_io_stress() {
    local duration=${1:-$EXPERIMENT_DURATION}
    local workers=${2:-2}
    
    log_info "Starting disk I/O stress for ${duration}s"
    
    stress-ng --hdd $workers --timeout ${duration}s --metrics-brief
    
    log_success "Disk I/O stress completed"
}

disk_fill() {
    local target_dir=${1:-/tmp/chaos}
    local size_mb=${2:-1024}
    
    log_info "Filling disk with ${size_mb}MB in $target_dir"
    
    mkdir -p $target_dir
    dd if=/dev/zero of=$target_dir/chaos_fill bs=1M count=$size_mb
    
    log_success "Disk filled. Remove with: rm -rf $target_dir"
}

# ============================================
# Combined Experiments
# ============================================

full_chaos_suite() {
    log_info "Running full chaos suite..."
    
    log_info "1/5: CPU stress (30s)"
    cpu_stress 70 30
    sleep 10
    
    log_info "2/5: Memory stress (30s)"
    memory_stress 60 30
    sleep 10
    
    log_info "3/5: Network latency (30s)"
    network_latency eth0 100 30
    sleep 10
    
    log_info "4/5: Disk I/O stress (30s)"
    disk_io_stress 30 1
    sleep 10
    
    log_info "5/5: Container pause (30s)"
    container_pause $TARGET_CONTAINER 30
    
    log_success "Full chaos suite completed!"
}

# ============================================
# Cleanup Functions
# ============================================

cleanup_network() {
    log_info "Cleaning up network chaos..."
    
    for iface in $(ip link show | grep -E '^[0-9]+:' | awk -F: '{print $2}' | tr -d ' '); do
        sudo tc qdisc del dev $iface root 2>/dev/null || true
    done
    
    log_success "Network chaos cleaned up"
}

cleanup_all() {
    log_info "Cleaning up all chaos experiments..."
    
    cleanup_network
    
    # Unpause any paused containers
    docker unpause $(docker ps -q --filter "status=paused") 2>/dev/null || true
    
    # Remove chaos disk fill
    rm -rf /tmp/chaos 2>/dev/null || true
    
    log_success "All chaos experiments cleaned up"
}

# ============================================
# Main Menu
# ============================================

show_help() {
    cat << EOF
Chaos Engineering Experiments

Usage: $0 <experiment> [options]

Experiments:
  cpu-stress [load%] [duration]       - CPU stress test
  cpu-stress-container [container]    - CPU stress in container
  memory-stress [percent] [duration]  - Memory stress test
  memory-stress-container [container] - Memory stress in container
  network-latency [iface] [ms]        - Add network latency
  network-loss [iface] [percent]      - Add packet loss
  network-bandwidth [iface] [rate]    - Limit bandwidth
  container-kill [container]          - Kill container
  container-pause [container]         - Pause container
  container-limit [container]         - Limit container resources
  k8s-pod-kill [namespace] [pod]      - Kill Kubernetes pod
  k8s-network-partition [namespace]   - Network partition pod
  k8s-scale-down [namespace] [deploy] - Scale down deployment
  disk-io-stress [duration]           - Disk I/O stress
  disk-fill [dir] [size_mb]           - Fill disk space
  full-suite                          - Run all experiments
  cleanup                             - Clean up all experiments

Environment Variables:
  EXPERIMENT_DURATION - Default duration in seconds (default: 60)
  TARGET_CONTAINER    - Default container name
  TARGET_NAMESPACE    - Default Kubernetes namespace
  TARGET_POD          - Default pod name

Examples:
  $0 cpu-stress 80 120
  $0 network-latency eth0 200 60
  $0 container-kill devops-dashboard
  $0 full-suite
  $0 cleanup
EOF
}

# Main
case "${1:-help}" in
    cpu-stress)
        check_prerequisites
        cpu_stress "${2:-80}" "${3:-$EXPERIMENT_DURATION}"
        ;;
    cpu-stress-container)
        cpu_stress_container "${2:-$TARGET_CONTAINER}" "${3:-80}" "${4:-$EXPERIMENT_DURATION}"
        ;;
    memory-stress)
        check_prerequisites
        memory_stress "${2:-80}" "${3:-$EXPERIMENT_DURATION}"
        ;;
    memory-stress-container)
        memory_stress_container "${2:-$TARGET_CONTAINER}" "${3:-512}" "${4:-$EXPERIMENT_DURATION}"
        ;;
    network-latency)
        network_latency "${2:-eth0}" "${3:-200}" "${4:-$EXPERIMENT_DURATION}"
        ;;
    network-loss)
        network_packet_loss "${2:-eth0}" "${3:-10}" "${4:-$EXPERIMENT_DURATION}"
        ;;
    network-bandwidth)
        network_bandwidth_limit "${2:-eth0}" "${3:-1mbit}" "${4:-$EXPERIMENT_DURATION}"
        ;;
    container-kill)
        container_kill "${2:-$TARGET_CONTAINER}"
        ;;
    container-pause)
        container_pause "${2:-$TARGET_CONTAINER}" "${3:-$EXPERIMENT_DURATION}"
        ;;
    container-limit)
        container_resource_limit "${2:-$TARGET_CONTAINER}" "${3:-0.5}" "${4:-256m}"
        ;;
    k8s-pod-kill)
        k8s_pod_kill "${2:-$TARGET_NAMESPACE}" "${3:-$TARGET_POD}"
        ;;
    k8s-network-partition)
        k8s_pod_network_partition "${2:-$TARGET_NAMESPACE}" "${3:-$TARGET_POD}" "${4:-$EXPERIMENT_DURATION}"
        ;;
    k8s-scale-down)
        k8s_scale_down "${2:-$TARGET_NAMESPACE}" "${3:-devops-dashboard}" "${4:-0}" "${5:-$EXPERIMENT_DURATION}"
        ;;
    disk-io-stress)
        check_prerequisites
        disk_io_stress "${2:-$EXPERIMENT_DURATION}" "${3:-2}"
        ;;
    disk-fill)
        disk_fill "${2:-/tmp/chaos}" "${3:-1024}"
        ;;
    full-suite)
        check_prerequisites
        full_chaos_suite
        ;;
    cleanup)
        cleanup_all
        ;;
    help|--help|-h|*)
        show_help
        ;;
esac
