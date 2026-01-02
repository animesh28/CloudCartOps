#!/bin/bash

set -e

echo "====================================="
echo "CloudCartOps K3s Deployment Script"
echo "====================================="

NAMESPACE="cloudcart"
DOCKER_REGISTRY="anisingh28"
IMAGE_PREFIX="cloudcartops"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ENVIRONMENT="${ENVIRONMENT:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGES=(
    "api-gateway"
    "user-service"
    "product-service"
    "order-service"
    "chaos-service"
    "notification-worker"
    "metrics-generator"
    "frontend"
)

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            echo "$ID"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

install_prerequisites() {
    log_info "Installing prerequisites..."
    
    local os=$(detect_os)
    log_info "Detected OS: $os"
    
    case $os in
        ubuntu|debian)
            log_info "Installing on Ubuntu/Debian..."
            sudo apt-get update
            
            # Install kubectl
            if ! command -v kubectl &> /dev/null; then
                log_info "Installing kubectl..."
                curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
                sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
                rm kubectl
                log_info "✓ kubectl installed"
            else
                log_info "✓ kubectl already installed"
            fi
            
            # Install K3s
            if ! command -v k3s &> /dev/null; then
                log_info "Installing K3s..."
                curl -sfL https://get.k3s.io | sh -
                sudo chmod 644 /etc/rancher/k3s/k3s.yaml
                export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
                echo 'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml' >> ~/.bashrc
                log_info "✓ K3s installed"
                
                # Wait for K3s to be ready
                log_info "Waiting for K3s to be ready..."
                sleep 10
                kubectl wait --for=condition=ready node --all --timeout=60s || log_warn "K3s node not ready yet"
            else
                log_info "✓ K3s already installed"
            fi
            
            # Install Helm
            if ! command -v helm &> /dev/null; then
                log_info "Installing Helm..."
                curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
                log_info "✓ Helm installed"
            else
                log_info "✓ Helm already installed"
            fi
            
            # Install Docker (optional, for local testing)
            if ! command -v docker &> /dev/null; then
                read -p "Install Docker for local development? (yes/no): " install_docker
                if [ "$install_docker" = "yes" ]; then
                    log_info "Installing Docker..."
                    sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
                    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
                    sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
                    sudo apt-get update
                    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
                    sudo usermod -aG docker $USER
                    log_info "✓ Docker installed (logout and login for group changes)"
                fi
            else
                log_info "✓ Docker already installed"
            fi
            ;;
        
        macos)
            log_info "Installing on macOS..."
            
            # Check for Homebrew
            if ! command -v brew &> /dev/null; then
                log_error "Homebrew not found. Install from https://brew.sh first."
                exit 1
            fi
            
            # Install kubectl
            if ! command -v kubectl &> /dev/null; then
                log_info "Installing kubectl..."
                brew install kubectl
                log_info "✓ kubectl installed"
            else
                log_info "✓ kubectl already installed"
            fi
            
            # K3s on macOS requires Docker Desktop or similar
            if ! command -v docker &> /dev/null; then
                log_warn "Docker Desktop not found. Install from https://www.docker.com/products/docker-desktop"
                log_warn "For K3s on macOS, you can use: brew install k3d (K3s in Docker)"
            fi
            ;;
        
        *)
            log_error "Unsupported OS. Please install kubectl and K3s manually."
            exit 1
            ;;
    esac
    
    log_info "Prerequisites installation completed!"
    log_info "Please run './deploy.sh check' to verify installation."
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    # Check if kubectl can connect to cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Is K3s running?"
        log_error "Try: sudo systemctl status k3s"
        log_error "Or set: export KUBECONFIG=/etc/rancher/k3s/k3s.yaml"
        exit 1
    fi
    
    # Check if Helm is installed (needed for Vault Agent Injector)
    if ! command -v helm &> /dev/null; then
        log_warn "Helm is not installed. Vault Agent Injector cannot be installed automatically."
        log_warn "Install Helm: curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
    fi
    
    # Check if docker is installed (only if needed)
    if [ "${1:-all}" == "pull" ] || [ "${1:-all}" == "all" ]; then
        if ! command -v docker &> /dev/null; then
            log_warn "Docker is not installed. Image pull will be skipped."
        fi
    fi
    
    log_info "Prerequisites check passed!"
}

wait_for_pod() {
    local label=$1
    local timeout=${2:-300}
    
    log_info "Waiting for pod with label $label to be ready..."
    if kubectl wait --for=condition=ready pod -l "$label" -n $NAMESPACE --timeout=${timeout}s 2>/dev/null; then
        log_info "Pod with label $label is ready"
        return 0
    else
        log_warn "Timeout waiting for pod with label $label"
        kubectl get pods -l "$label" -n $NAMESPACE
        return 1
    fi
}

wait_for_statefulset() {
    local name=$1
    local timeout=${2:-300}
    
    log_info "Waiting for StatefulSet $name to be ready..."
    local end_time=$((SECONDS + timeout))
    
    while [ $SECONDS -lt $end_time ]; do
        if kubectl wait --for=condition=ready pod/${name}-0 -n $NAMESPACE --timeout=10s 2>/dev/null; then
            log_info "StatefulSet $name is ready"
            return 0
        fi
        sleep 5
    done
    
    log_warn "Timeout waiting for StatefulSet $name"
    kubectl get pods -l app=$name -n $NAMESPACE
    return 1
}

pull_images() {
    log_info "Pre-caching Docker images to K3s..."
    
    # K3s uses containerd, not Docker
    # We'll use kubectl to create temporary pods that trigger image pulls
    
    log_info "Method 1: Using kubectl run to pre-cache images..."
    
    for service in "${IMAGES[@]}"; do
        local image="${DOCKER_REGISTRY}/${IMAGE_PREFIX}-$service:${IMAGE_TAG}"
        log_info "Pre-caching $service image: $image"
        
        # Create a temporary pod that will trigger image pull
        kubectl run temp-pull-$service \
            --image=$image \
            --restart=Never \
            --image-pull-policy=Always \
            --command -- sleep 5 \
            -n default 2>/dev/null || true
        
        # Wait a moment for the pull to start
        sleep 2
        
        # Delete the temporary pod
        kubectl delete pod temp-pull-$service -n default 2>/dev/null || true
        
        log_info "✓ $service image cached"
    done
    
    log_info "All images pre-cached in K3s!"
    
    # Alternative: If Docker is available, pull to Docker then import to K3s
    if command -v docker &> /dev/null && command -v k3s &> /dev/null; then
        log_info "Method 2: Pulling to Docker and importing to K3s..."
        
        for service in "${IMAGES[@]}"; do
            local image="${DOCKER_REGISTRY}/${IMAGE_PREFIX}-$service:${IMAGE_TAG}"
            
            # Pull with Docker
            if docker pull $image 2>/dev/null; then
                log_info "✓ Pulled $service to Docker"
                
                # Import to K3s containerd
                docker save $image | sudo k3s ctr images import - 2>/dev/null || true
                log_info "✓ Imported $service to K3s"
            fi
        done
    fi
}

verify_images() {
    log_info "Verifying Docker images availability..."
    
    if ! command -v docker &> /dev/null; then
        log_warn "Docker not installed, skipping image verification..."
        return 0
    fi
    
    local all_exist=true
    for service in "${IMAGES[@]}"; do
        if docker image inspect ${DOCKER_REGISTRY}/${IMAGE_PREFIX}-$service:${IMAGE_TAG} &> /dev/null; then
            log_info "✓ $service image exists locally"
        else
            log_warn "✗ $service image not found locally"
            all_exist=false
        fi
    done
    
    if [ "$all_exist" = false ]; then
        log_warn "Some images are missing. Run './deploy.sh pull' to download them."
        return 1
    fi
    
    log_info "All images verified!"
}

install_vault_injector() {
    log_info "Installing Vault Agent Injector..."
    
    # Check if Helm is installed
    if ! command -v helm &> /dev/null; then
        log_error "Helm is required to install Vault Agent Injector."
        log_error "Install Helm first: curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
        exit 1
    fi
    
    # Check if namespace exists
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        log_info "Creating namespace $NAMESPACE..."
        kubectl create namespace $NAMESPACE
    fi
    
    # Add HashiCorp Helm repo
    log_info "Adding HashiCorp Helm repository..."
    helm repo add hashicorp https://helm.releases.hashicorp.com
    helm repo update
    
    # Check if Vault is already installed
    if helm list -n $NAMESPACE 2>/dev/null | grep -q "^vault"; then
        log_warn "Vault Helm chart already installed, upgrading..."
        helm upgrade vault hashicorp/vault \
            --set "injector.enabled=true" \
            --set "injector.externalVaultAddr=http://vault:8200" \
            --set "server.enabled=false" \
            -n $NAMESPACE
    else
        log_info "Installing Vault Agent Injector (standalone)..."
        helm install vault hashicorp/vault \
            --set "injector.enabled=true" \
            --set "injector.externalVaultAddr=http://vault:8200" \
            --set "server.enabled=false" \
            -n $NAMESPACE
    fi
    
    # Wait for Vault Agent Injector to be ready
    log_info "Waiting for Vault Agent Injector pod to be ready..."
    sleep 10  # Give time for pod to be created
    
    if kubectl wait --for=condition=ready pod \
        -l app.kubernetes.io/name=vault-agent-injector \
        -n $NAMESPACE \
        --timeout=180s 2>/dev/null; then
        log_info "✓ Vault Agent Injector pod is ready!"
    else
        log_error "Vault Agent Injector failed to become ready"
        log_error "Checking pod status..."
        kubectl get pods -l app.kubernetes.io/name=vault-agent-injector -n $NAMESPACE
        kubectl describe pod -l app.kubernetes.io/name=vault-agent-injector -n $NAMESPACE | tail -30
        kubectl logs -l app.kubernetes.io/name=vault-agent-injector -n $NAMESPACE --tail=50 2>/dev/null || true
        return 1
    fi
    
    # Verify webhook configuration exists
    if kubectl get mutatingwebhookconfiguration vault-agent-injector-cfg &>/dev/null; then
        log_info "✓ Vault Agent Injector webhook configured!"
    else
        log_warn "Webhook configuration not found, but pod is running"
    fi
}

deploy_infrastructure() {
    log_info "Deploying infrastructure layer..."
    
    # Install Vault Agent Injector first (required for secret injection)
    log_info "Checking for Vault Agent Injector..."
    if kubectl get pod -l app.kubernetes.io/name=vault-agent-injector -n $NAMESPACE 2>/dev/null | grep -q "Running"; then
        log_info "✓ Vault Agent Injector pod already running"
    else
        log_warn "Vault Agent Injector pod not found or not running. Installing..."
        install_vault_injector || {
            log_error "Failed to install Vault Agent Injector"
            log_error "Deployment cannot continue without secret injection"
            log_error "Install manually or run: ./deploy.sh install-vault-injector"
            exit 1
        }
    fi
    
    # Deploy namespace
    log_info "Creating namespace..."
    kubectl apply -k ${SCRIPT_DIR}/base/namespace
    sleep 2
    
    # Deploy common resources (service accounts)
    log_info "Deploying service accounts for Vault authentication..."
    kubectl apply -k ${SCRIPT_DIR}/base/common
    sleep 2
    
    # Deploy Vault FIRST (required by PostgreSQL and other services)
    log_info "Deploying Vault..."
    kubectl apply -k ${SCRIPT_DIR}/base/vault
    wait_for_statefulset "vault" 300 || {
        log_error "Vault deployment failed"
        kubectl logs -l app=vault -n $NAMESPACE --tail=50
        return 1
    }
    
    log_info "✓ Vault is ready. Proceeding with other infrastructure..."
    
    # Deploy Zookeeper (Kafka dependency)
    log_info "Deploying Zookeeper..."
    kubectl apply -k ${SCRIPT_DIR}/base/kafka
    wait_for_pod "app=zookeeper" 180 || {
        log_error "Zookeeper deployment failed"
        kubectl logs -l app=zookeeper -n $NAMESPACE --tail=50
        return 1
    }
    sleep 10  # Give Zookeeper time to fully initialize
    
    # Wait for Kafka
    log_info "Waiting for Kafka to be ready..."
    wait_for_pod "app=kafka" 300 || {
        log_error "Kafka deployment failed"
        kubectl logs -l app=kafka -n $NAMESPACE --tail=50
        return 1
    }
    sleep 10  # Give Kafka time to create topics
    
    # Deploy Redis
    log_info "Deploying Redis..."
    kubectl apply -k ${SCRIPT_DIR}/base/redis
    wait_for_pod "app=redis" 180 || {
        log_error "Redis deployment failed"
        kubectl logs -l app=redis -n $NAMESPACE --tail=50
        return 1
    }
    
    # Verify Redis connectivity
    log_info "Verifying Redis connectivity..."
    kubectl exec -n $NAMESPACE $(kubectl get pod -l app=redis -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}') -- redis-cli ping || log_warn "Redis not ready yet"
    
    log_info "✓ Infrastructure components deployed (Vault, Kafka, Redis, Zookeeper)"
    log_info "Note: PostgreSQL will be deployed after Vault initialization (in vault step)"
}

initialize_vault() {
    log_info "Initializing Vault with automated script..."
    
    # Check if Vault is ready
    log_info "Verifying Vault pod is ready..."
    if ! kubectl get pod vault-0 -n $NAMESPACE &> /dev/null; then
        log_error "Vault pod not found. Deploy infrastructure first."
        return 1
    fi
    
    # Make init-vault.sh executable
    if [ -f "${SCRIPT_DIR}/scripts/init-vault.sh" ]; then
        chmod +x "${SCRIPT_DIR}/scripts/init-vault.sh"
        
        log_info "Running Vault initialization script..."
        if "${SCRIPT_DIR}/scripts/init-vault.sh" all; then
            log_info "✓ Vault initialized successfully!"
        else
            log_error "Vault initialization failed"
            return 1
        fi
    else
        log_error "Vault initialization script not found at ${SCRIPT_DIR}/scripts/init-vault.sh"
        return 1
    fi
    
    # Verify Vault configuration
    log_info "Verifying Vault configuration..."
    
    # Check if secrets engine is enabled
    if kubectl exec -n $NAMESPACE vault-0 -- vault secrets list | grep -q "cloudcart"; then
        log_info "✓ KV secrets engine enabled at cloudcart/"
    else
        log_error "✗ KV secrets engine not found"
        return 1
    fi
    
    # Check if Kubernetes auth is enabled
    if kubectl exec -n $NAMESPACE vault-0 -- vault auth list | grep -q "kubernetes"; then
        log_info "✓ Kubernetes auth backend enabled"
    else
        log_error "✗ Kubernetes auth backend not found"
        return 1
    fi
    
    # Verify at least one secret exists
    if kubectl exec -n $NAMESPACE vault-0 -- vault kv get cloudcart/database &> /dev/null; then
        log_info "✓ Database secrets configured"
    else
        log_error "✗ Database secrets not found"
        return 1
    fi
    
    # NOW deploy PostgreSQL (after Vault is fully configured)
    log_info "Deploying PostgreSQL (now that Vault is configured)..."
    kubectl apply -k ${SCRIPT_DIR}/base/postgres
    
    log_info "Waiting for PostgreSQL to be ready..."
    wait_for_statefulset "postgres" 300 || {
        log_error "PostgreSQL deployment failed"
        log_error "Check logs: kubectl logs postgres-0 -n $NAMESPACE"
        log_error "Check init container: kubectl logs postgres-0 -c vault-agent-init -n $NAMESPACE"
        return 1
    }
    
    # Verify PostgreSQL is accepting connections
    log_info "Verifying PostgreSQL connectivity..."
    kubectl exec -n $NAMESPACE postgres-0 -c postgres -- pg_isready -U cloudcart || log_warn "PostgreSQL not ready yet"
    log_info "✓ PostgreSQL is ready!"
    
    log_info "Vault and PostgreSQL initialization complete!"
}

deploy_applications() {
    log_info "Deploying application services..."
    
    # Check if Vault Agent Injector is available (required for secret injection)
    log_info "Checking for Vault Agent Injector..."
    if ! kubectl get mutatingwebhookconfiguration 2>/dev/null | grep -q vault; then
        log_warn "Vault Agent Injector not found!"
        log_warn "Secrets will NOT be injected automatically."
        log_warn "Install with: helm install vault hashicorp/vault --set 'injector.enabled=true'"
        log_warn "Continuing anyway, but services may fail to start..."
    else
        log_info "✓ Vault Agent Injector is available"
    fi
    
    # Determine deployment path based on environment
    local deploy_path
    if [ "$ENVIRONMENT" = "dev" ]; then
        deploy_path="${SCRIPT_DIR}/overlays/dev"
        log_info "Deploying applications using DEV overlay (1 replica, lower resources)..."
        kubectl apply -k "$deploy_path"
    else
        log_info "Deploying applications using PRODUCTION base (2 replicas)..."
        # Deploy services in order
        local services=(
            "user-service"
            "product-service"
            "order-service"
            "notification-worker"
            "chaos-service"
            "metrics-generator"
            "api-gateway"
            "frontend"
        )
        
        for service in "${services[@]}"; do
            log_info "Deploying $service..."
            if kubectl apply -k ${SCRIPT_DIR}/base/$service; then
                log_info "✓ $service deployment created"
            else
                log_error "✗ Failed to deploy $service"
                return 1
            fi
            sleep 2
        done
    fi
    
    # Wait for all deployments to be available
    log_info "Waiting for application deployments to be ready..."
    for service in "${services[@]}"; do
        log_info "Waiting for $service..."
        if kubectl wait --for=condition=available deployment/$service -n $NAMESPACE --timeout=300s 2>/dev/null; then
            log_info "✓ $service is available"
            
            # Check if Vault secrets were injected
            local pod=$(kubectl get pod -l app=$service -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
            if [ -n "$pod" ]; then
                if kubectl get pod $pod -n $NAMESPACE -o json 2>/dev/null | grep -q 'vault-agent' ; then
                    log_info "  ✓ Vault Agent sidecar detected"
                else
                    log_warn "  ✗ No Vault Agent sidecar (secrets may not be injected)"
                fi
            fi
        else
            log_warn "✗ $service deployment timed out"
            kubectl describe deployment/$service -n $NAMESPACE | tail -20
        fi
    done
    
    log_info "Application services deployed successfully!"
}

deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    kubectl apply -k ${SCRIPT_DIR}/base/prometheus
    
    log_info "Waiting for Prometheus to be ready..."
    wait_for_pod "app=prometheus" 180 || log_warn "Prometheus may not be ready yet"
    
    log_info "Monitoring deployed successfully!"
}

configure_ingress() {
    log_info "Configuring Ingress..."
    
    # Check if Traefik or nginx-ingress is installed (K3s default is Traefik)
    if ! kubectl get svc -n kube-system 2>/dev/null | grep -q "traefik\|ingress"; then
        log_warn "No ingress controller found. K3s should have Traefik by default."
        log_warn "Check with: kubectl get svc -n kube-system"
    fi
    
    kubectl apply -f ${SCRIPT_DIR}/base/common/ingress.yaml
    
    # Add hosts entries (only if running on the same machine)
    log_info "Configuring /etc/hosts entries..."
    if ! grep -q "cloudcart.local" /etc/hosts 2>/dev/null; then
        log_info "Adding entries to /etc/hosts (requires sudo)..."
        echo "# CloudCartOps entries" | sudo tee -a /etc/hosts
        echo "127.0.0.1 cloudcart.local prometheus.cloudcart.local vault.cloudcart.local" | sudo tee -a /etc/hosts
        log_info "✓ Hosts entries added"
    else
        log_info "✓ Hosts entries already exist"
    fi
    
    log_info "Ingress configured successfully!"
}

run_health_checks() {
    log_info "Running health checks..."
    
    local failed_checks=0
    
    # Check API Gateway health (Node.js - has wget/curl)
    local api_pod=$(kubectl get pod -l app=api-gateway -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -n "$api_pod" ]; then
        if kubectl exec -n $NAMESPACE $api_pod -c api-gateway -- sh -c 'wget -q -O- http://localhost:3000/health || curl -s http://localhost:3000/health' &> /dev/null; then
            log_info "✓ API Gateway health check passed"
        else
            log_warn "✗ API Gateway health check failed"
            kubectl logs -n $NAMESPACE $api_pod -c api-gateway --tail=5 2>/dev/null || true
            ((failed_checks++))
        fi
    fi
    
    # Check User Service health (Python - use Python HTTP client)
    local user_pod=$(kubectl get pod -l app=user-service -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -n "$user_pod" ]; then
        if kubectl exec -n $NAMESPACE $user_pod -c user-service -- python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health').read()" &> /dev/null; then
            log_info "✓ User Service health check passed"
        else
            log_warn "✗ User Service health check failed"
            kubectl logs -n $NAMESPACE $user_pod -c user-service --tail=5 2>/dev/null || true
            ((failed_checks++))
        fi
    fi
    
    # Check Product Service health (Python - use Python HTTP client)
    local product_pod=$(kubectl get pod -l app=product-service -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -n "$product_pod" ]; then
        if kubectl exec -n $NAMESPACE $product_pod -c product-service -- python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health').read()" &> /dev/null; then
            log_info "✓ Product Service health check passed"
        else
            log_warn "✗ Product Service health check failed"
            kubectl logs -n $NAMESPACE $product_pod -c product-service --tail=5 2>/dev/null || true
            ((failed_checks++))
        fi
    fi
    
    # Check Order Service health (Go - use wget/curl)
    local order_pod=$(kubectl get pod -l app=order-service -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -n "$order_pod" ]; then
        if kubectl exec -n $NAMESPACE $order_pod -c order-service -- sh -c 'wget -q -O- http://localhost:8003/health || curl -s http://localhost:8003/health' &> /dev/null; then
            log_info "✓ Order Service health check passed"
        else
            log_warn "✗ Order Service health check failed"
            kubectl logs -n $NAMESPACE $order_pod -c order-service --tail=5 2>/dev/null || true
            ((failed_checks++))
        fi
    fi
    
    if [ $failed_checks -gt 0 ]; then
        log_warn "$failed_checks health check(s) failed"
        return 1
    fi
    
    log_info "All health checks passed!"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    echo ""
    echo "====================================="
    echo "PODS STATUS"
    echo "====================================="
    kubectl get pods -n $NAMESPACE -o wide
    
    echo ""
    echo "====================================="
    echo "SERVICES"
    echo "====================================="
    kubectl get svc -n $NAMESPACE
    
    echo ""
    echo "====================================="
    echo "PERSISTENT VOLUME CLAIMS"
    echo "====================================="
    kubectl get pvc -n $NAMESPACE
    
    echo ""
    echo "====================================="
    echo "INGRESS RULES"
    echo "====================================="
    kubectl get ingress -n $NAMESPACE
    
    echo ""
    echo "====================================="
    echo "POD READINESS SUMMARY"
    echo "====================================="
    local total_pods=$(kubectl get pods -n $NAMESPACE --no-headers 2>/dev/null | wc -l)
    local ready_pods=$(kubectl get pods -n $NAMESPACE --no-headers 2>/dev/null | grep -c "Running" || true)
    echo "Ready: $ready_pods / $total_pods pods"
    
    # Check for failed pods
    local failed_pods=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running,status.phase!=Succeeded --no-headers 2>/dev/null | wc -l)
    if [ $failed_pods -gt 0 ]; then
        echo ""
        log_warn "Found $failed_pods pod(s) not in Running state:"
        kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running,status.phase!=Succeeded
        
        echo ""
        log_info "Recent events for troubleshooting:"
        kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -10
    fi
    
    echo ""
    echo "====================================="
    echo "DEPLOYMENT COMPLETED"
    echo "====================================="
    echo ""
    log_info "Access points:"
    echo "  - Frontend: http://cloudcart.local"
    echo "  - API: http://cloudcart.local/api"
    echo "  - Prometheus: http://prometheus.cloudcart.local"
    echo "  - Vault UI: http://vault.cloudcart.local"
    echo ""
    log_info "Vault Root Token: root (dev mode)"
    echo ""
    log_info "Useful commands:"
    echo "  - Watch pods: kubectl get pods -n $NAMESPACE -w"
    echo "  - View logs: kubectl logs -f <pod-name> -n $NAMESPACE"
    echo "  - Describe pod: kubectl describe pod <pod-name> -n $NAMESPACE"
    echo "  - Port forward: kubectl port-forward svc/api-gateway 3000:3000 -n $NAMESPACE"
    echo ""
}

cleanup() {
    log_warn "Cleaning up CloudCartOps deployment..."
    
    read -p "Are you sure you want to delete everything in namespace $NAMESPACE? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log_info "Cleanup cancelled"
        return 0
    fi
    
    # Uninstall Helm releases first
    log_info "Removing Helm releases..."
    if helm list -n $NAMESPACE 2>/dev/null | grep -q "vault"; then
        log_info "Uninstalling Vault Helm chart..."
        helm uninstall vault -n $NAMESPACE 2>/dev/null || true
        sleep 5
    fi
    
    # Delete namespace and all resources
    log_info "Deleting namespace $NAMESPACE and all resources..."
    kubectl delete namespace $NAMESPACE --force --grace-period=0 2>/dev/null || true
    
    # Wait for namespace to be fully deleted
    log_info "Waiting for namespace cleanup..."
    local timeout=60
    local elapsed=0
    while kubectl get namespace $NAMESPACE &>/dev/null && [ $elapsed -lt $timeout ]; do
        sleep 2
        elapsed=$((elapsed + 2))
    done
    
    if kubectl get namespace $NAMESPACE &>/dev/null; then
        log_warn "Namespace still exists after $timeout seconds"
        log_info "Run: kubectl get namespace $NAMESPACE -o json | jq '.spec.finalizers = []' | kubectl replace --raw /api/v1/namespaces/$NAMESPACE/finalize -f -"
    else
        log_info "✓ Namespace deleted successfully"
    fi
    
    log_info "Cleanup completed!"
}

show_usage() {
    cat << 'EOF'
Usage: ./deploy.sh [COMMAND]

Commands:
  setup                   - Install prerequisites (kubectl, K3s, Docker)
  install-vault-injector  - Install Vault Agent Injector (required for secrets)
  check                   - Check prerequisites and environment
  pull                    - Pre-cache Docker images to K3s
  verify-images - Verify Docker images are available locally
  infra         - Deploy infrastructure (PostgreSQL, Redis, Kafka, Vault)
  vault         - Initialize Vault with secrets and policies
  apps          - Deploy application services
  monitoring    - Deploy Prometheus monitoring
  ingress       - Configure Ingress and hosts file
  health        - Run health checks on deployed services
  verify        - Verify deployment status
  cleanup       - Delete all resources (with confirmation)
  all           - Run complete deployment (pull + infra + vault + apps + monitoring + ingress + verify + health)

Environment Variables:
  IMAGE_TAG     - Docker image tag to deploy (default: latest)
                  Example: IMAGE_TAG=v1.0.0 ./deploy.sh all
  ENVIRONMENT   - Deployment environment: dev or production (default: production)
                  Example: ENVIRONMENT=dev ./deploy.sh all

Examples:
  # First-time setup (installs kubectl, K3s, Docker)
  ./deploy.sh setup
  
  # Complete deployment with latest images (production - 2 replicas)
  ./deploy.sh all
  
  # Deploy to dev environment (1 replica, lower resources)
  ENVIRONMENT=dev ./deploy.sh all
  
  # Deploy specific version to dev
  ENVIRONMENT=dev IMAGE_TAG=v1.0.0 ./deploy.sh all
  
  # Step-by-step deployment
  ./deploy.sh check
  ./deploy.sh pull
  ./deploy.sh infra
  ./deploy.sh vault
  ./deploy.sh apps
  ./deploy.sh monitoring
  ./deploy.sh ingress
  ./deploy.sh verify
  ./deploy.sh health
  
  # Cleanup everything
  ./deploy.sh cleanup

Manual Setup (Alternative to ./deploy.sh setup):
  
  Ubuntu/Debian:
    # Install kubectl
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
    
    # Install K3s
    curl -sfL https://get.k3s.io | sh -
    sudo chmod 644 /etc/rancher/k3s/k3s.yaml
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    
    # Install Docker (optional)
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
  
  macOS:
    # Install Homebrew first: https://brew.sh
    brew install kubectl
    
    # Install Docker Desktop: https://www.docker.com/products/docker-desktop
    # Or use K3d: brew install k3d && k3d cluster create cloudcart

EOF
}

case "${1:-all}" in
    setup)
        install_prerequisites
        ;;
    install-vault-injector)
        install_vault_injector
        ;;
    check)
        check_prerequisites "$1"
        ;;
    pull)
        check_prerequisites "$1"
        pull_images
        ;;
    verify-images)
        verify_images
        ;;
    infra)
        check_prerequisites "$1"
        deploy_infrastructure
        ;;
    vault)
        check_prerequisites "$1"
        initialize_vault
        ;;
    apps)
        check_prerequisites "$1"
        deploy_applications
        ;;
    monitoring)
        check_prerequisites "$1"
        deploy_monitoring
        ;;
    ingress)
        check_prerequisites "$1"
        configure_ingress
        ;;
    health)
        run_health_checks
        ;;
    verify)
        verify_deployment
        ;;
    cleanup)
        cleanup
        ;;
    all)
        check_prerequisites "$1"
        pull_images
        deploy_infrastructure
        initialize_vault
        deploy_applications
        deploy_monitoring
        configure_ingress
        verify_deployment
        run_health_checks
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        log_error "Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac

log_info "Script completed successfully!"
