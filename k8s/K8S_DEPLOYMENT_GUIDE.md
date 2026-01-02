# CloudCartOps Kubernetes Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Vault Configuration](#vault-configuration)
5. [Deployment Components](#deployment-components)
6. [Deployment Process](#deployment-process)
7. [Environment Configuration](#environment-configuration)
8. [Troubleshooting](#troubleshooting)

---

## Overview

CloudCartOps is a microservices-based e-commerce platform deployed on K3s (lightweight Kubernetes) with HashiCorp Vault for secret management. This guide covers the complete deployment process, architecture decisions, and operational procedures.

### Key Features
- **Secret Management**: HashiCorp Vault with Agent Injector for automatic secret injection
- **Stateful Services**: PostgreSQL, Kafka, Zookeeper with persistent storage
- **Multi-Environment**: Dev and production configurations using Kustomize overlays
- **Automated Deployment**: Single-command deployment script with health checks
- **Monitoring**: Prometheus metrics collection

---

## Prerequisites

### Required Tools
- **kubectl**: Kubernetes CLI (v1.24+)
- **K3s**: Lightweight Kubernetes (auto-installed by deploy.sh)
- **Helm**: Package manager for Kubernetes (v3.0+)
- **Docker** (optional): For local image building and testing

### VM Requirements
- **OS**: Ubuntu 22.04 LTS (recommended) or Debian-based Linux
- **Architecture**: ARM64 (aarch64) or AMD64
- **CPU**: 4+ cores
- **Memory**: 8GB+ RAM
- **Storage**: 50GB+ available disk space
- **Network**: Static IP or DHCP reservation

### Installation (Ubuntu)
```bash
# Run automated setup
cd k8s
./deploy.sh setup

# Manual installation
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install kubectl /usr/local/bin/

curl -sfL https://get.k3s.io | sh -
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

---

## Architecture

### Infrastructure Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        K3s Cluster (cloudcart namespace)         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Vault      │  │  PostgreSQL  │  │    Kafka     │         │
│  │ StatefulSet  │  │ StatefulSet  │  │ StatefulSet  │         │
│  │   (1 pod)    │  │   (1 pod)    │  │   (1 pod)    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│         │                  │                  │                  │
│         │                  │                  │                  │
│  ┌──────▼───────────────────▼──────────────────▼─────────┐     │
│  │          Vault Agent Injector (Helm Chart)            │     │
│  │  - Mutating Webhook: Injects vault-agent sidecars    │     │
│  │  - External Vault: http://vault:8200                  │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Application Services                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ API Gateway  │  │ User Service │  │Product Service│  │   │
│  │  │  (2 pods)    │  │  (2 pods)    │  │  (2 pods)    │  │   │
│  │  │ Node.js      │  │ FastAPI      │  │ Flask        │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │Order Service │  │Notification  │  │   Frontend   │  │   │
│  │  │  (2 pods)    │  │   Worker     │  │  (2 pods)    │  │   │
│  │  │ Go           │  │  (2 pods)    │  │ React        │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Supporting Services                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │    Redis     │  │  Prometheus  │  │Chaos Service │  │   │
│  │  │  (1 pod)     │  │  (1 pod)     │  │  (1 pod)     │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Service Ports

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| API Gateway | 3000 | HTTP | Main application API |
| User Service | 8001 | HTTP | User management |
| Product Service | 8002 | HTTP | Product catalog |
| Order Service | 8003 | HTTP | Order processing |
| Chaos Service | 8004 | HTTP | Chaos engineering |
| Notification Worker | 8005 | HTTP | Metrics endpoint |
| PostgreSQL | 5432 | TCP | Database |
| Redis | 6379 | TCP | Cache |
| Kafka | 9092 | TCP | Message broker |
| Zookeeper | 2181 | TCP | Kafka coordination |
| Vault | 8200 | HTTP | Secret management |
| Prometheus | 9090 | HTTP | Metrics collection |

---

## Vault Configuration

### Overview
HashiCorp Vault is deployed in **development mode** for easy setup. In production, use proper initialization with seal keys.

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vault Pod (vault-0)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  vault container (hashicorp/vault:1.15)              │   │
│  │  - Mode: dev (-dev flag)                             │   │
│  │  - Root Token: root                                  │   │
│  │  - Auto-unsealed                                     │   │
│  │  - Listen: 0.0.0.0:8200                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

                           │
                           │ K8s Service (vault:8200)
                           ▼

┌─────────────────────────────────────────────────────────────┐
│           Vault Agent Injector (Helm Chart)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  vault-agent-injector pod                            │   │
│  │  - Mutating Webhook Server                           │   │
│  │  - External Vault: http://vault:8200                 │   │
│  │  - Watches: vault.hashicorp.com/* annotations        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

                           │
                           │ Webhook Intercept
                           ▼

┌─────────────────────────────────────────────────────────────┐
│         Application Pod (e.g., user-service)                │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Init Container: vault-agent-init                  │    │
│  │  - Authenticates with Vault (K8s auth)             │    │
│  │  - Fetches secrets                                 │    │
│  │  - Writes to /vault/secrets/                       │    │
│  │  - Exits after initial fetch                       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Sidecar Container: vault-agent                    │    │
│  │  - Keeps secrets updated                           │    │
│  │  - Watches for secret changes                      │    │
│  │  - Updates /vault/secrets/ files                   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Application Container: user-service               │    │
│  │  - Reads /vault/secrets/database                   │    │
│  │  - Sources secrets: . /vault/secrets/database      │    │
│  │  - Starts with injected secrets                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Shared Volume: /vault/secrets (emptyDir - Memory)          │
└─────────────────────────────────────────────────────────────┘
```

### Vault Initialization Process

The `scripts/init-vault.sh` script performs:

1. **Enable KV Secrets Engine**
   ```bash
   vault secrets enable -version=2 -path=cloudcart kv
   ```

2. **Create Kubernetes Auth Method**
   ```bash
   vault auth enable kubernetes
   
   # Get service account token (K8s 1.24+)
   kubectl create token vault -n cloudcart --duration=87600h > /tmp/vault-token.txt
   
   vault write auth/kubernetes/config \
       kubernetes_host="https://kubernetes.default.svc" \
       kubernetes_ca_cert="${KUBE_CA_CERT}" \
       token_reviewer_jwt="${VAULT_SA_TOKEN}" \
       disable_iss_validation=true
   ```

3. **Store Secrets**
   ```bash
   # Database credentials
   vault kv put cloudcart/database \
       postgres_user="cloudcart" \
       postgres_password="secure_password" \
       postgres_db="cloudcart" \
       database_url="postgresql://cloudcart:secure_password@postgres:5432/cloudcart"
   
   # JWT secret
   vault kv put cloudcart/jwt secret="your-256-bit-secret"
   
   # Kafka configuration
   vault kv put cloudcart/kafka bootstrap_servers="kafka:29092"
   
   # Redis configuration
   vault kv put cloudcart/redis url="redis://redis:6379"
   ```

4. **Create Policies**
   ```hcl
   # database-policy.hcl
   path "cloudcart/data/database" {
     capabilities = ["read"]
   }
   
   # app-policy.hcl
   path "cloudcart/data/*" {
     capabilities = ["read"]
   }
   ```

5. **Create Roles**
   ```bash
   vault write auth/kubernetes/role/postgres \
       bound_service_account_names=postgres \
       bound_service_account_namespaces=cloudcart \
       policies=database-policy \
       ttl=24h
   
   vault write auth/kubernetes/role/user-service \
       bound_service_account_names=user-service \
       bound_service_account_namespaces=cloudcart \
       policies=app-policy \
       ttl=24h
   ```

### Secret Injection Annotations

Each service deployment includes these annotations:

```yaml
metadata:
  annotations:
    # Enable Vault injection
    vault.hashicorp.com/agent-inject: "true"
    
    # Service account role
    vault.hashicorp.com/role: "user-service"
    
    # Inject database secret
    vault.hashicorp.com/agent-inject-secret-database: "cloudcart/data/database"
    
    # Template for secret file
    vault.hashicorp.com/agent-inject-template-database: |
      {{- with secret "cloudcart/data/database" -}}
      export DATABASE_URL="{{ .Data.data.database_url }}"
      {{- end }}
```

### Container Command to Load Secrets

```yaml
containers:
- name: user-service
  image: anisingh28/cloudcartops-user-service:latest
  command: ["/bin/sh"]
  args: ["-c", ". /vault/secrets/database && . /vault/secrets/kafka && exec python main.py"]
```

**Key Points:**
- Use `.` (dot) instead of `source` for POSIX sh compatibility
- Secrets are sourced before application starts
- Environment variables are loaded into the shell
- Application inherits all exported variables

---

## Deployment Components

### Namespace Structure

```
k8s/
├── base/                           # Base Kubernetes manifests
│   ├── namespace/                  # Namespace definition
│   │   ├── namespace.yaml
│   │   └── kustomization.yaml
│   │
│   ├── common/                     # Shared resources
│   │   ├── serviceaccounts.yaml   # Service accounts for Vault auth
│   │   ├── ingress.yaml           # Traefik ingress rules
│   │   └── kustomization.yaml
│   │
│   ├── vault/                      # Vault deployment
│   │   ├── statefulset.yaml       # Vault server (dev mode)
│   │   ├── service.yaml           # ClusterIP service
│   │   ├── serviceaccount.yaml    # Vault service account
│   │   ├── configmap.yaml         # Vault config
│   │   └── kustomization.yaml
│   │
│   ├── postgres/                   # PostgreSQL
│   │   ├── statefulset.yaml       # 1 replica, 5Gi PVC
│   │   ├── service.yaml           # Headless service
│   │   ├── configmap.yaml         # init-db.sql script
│   │   └── kustomization.yaml
│   │
│   ├── kafka/                      # Kafka + Zookeeper
│   │   ├── zookeeper-statefulset.yaml
│   │   ├── zookeeper-service.yaml
│   │   ├── kafka-statefulset.yaml
│   │   ├── kafka-service.yaml
│   │   └── kustomization.yaml
│   │
│   ├── redis/                      # Redis cache
│   │   ├── deployment.yaml        # 1 replica
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   │
│   ├── api-gateway/                # Node.js gateway
│   │   ├── deployment.yaml        # 2 replicas, Vault annotations
│   │   ├── service.yaml           # LoadBalancer/ClusterIP
│   │   └── kustomization.yaml
│   │
│   ├── user-service/               # FastAPI service
│   │   ├── deployment.yaml        # 2 replicas, Python
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   │
│   ├── product-service/            # Flask service
│   │   ├── deployment.yaml        # 2 replicas, Python
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   │
│   ├── order-service/              # Go service
│   │   ├── deployment.yaml        # 2 replicas, Go
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   │
│   ├── notification-worker/        # Kafka consumer
│   │   ├── deployment.yaml        # 2 replicas, Python
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   │
│   ├── chaos-service/              # Chaos engineering
│   │   ├── deployment.yaml        # 1 replica, Python
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   │
│   ├── metrics-generator/          # Metrics generation
│   │   ├── deployment.yaml        # 1 replica, Python
│   │   └── kustomization.yaml
│   │
│   ├── frontend/                   # React frontend
│   │   ├── deployment.yaml        # 2 replicas, Nginx
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   │
│   └── prometheus/                 # Monitoring
│       ├── statefulset.yaml       # 1 replica, 10Gi PVC
│       ├── service.yaml
│       ├── configmap.yaml         # Scrape configs
│       └── kustomization.yaml
│
├── overlays/                       # Environment-specific configs
│   ├── dev/
│   │   └── kustomization.yaml     # 1 replica, lower resources
│   └── prod/
│       └── kustomization.yaml     # 2 replicas, full resources
│
├── scripts/
│   └── init-vault.sh              # Vault initialization automation
│
└── deploy.sh                       # Main deployment script
```

### Kustomize Overlays

**Development Overlay** (`overlays/dev/kustomization.yaml`):
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: cloudcart
resources:
  - ../../base

replicas:
  - name: api-gateway
    count: 1
  - name: user-service
    count: 1
  - name: product-service
    count: 1
  # ... other services with 1 replica

patches:
  - patch: |-
      - op: replace
        path: /spec/template/spec/containers/0/resources/requests/memory
        value: "128Mi"
      - op: replace
        path: /spec/template/spec/containers/0/resources/limits/memory
        value: "256Mi"
    target:
      kind: Deployment
```

**Production Overlay** (`overlays/prod/kustomization.yaml`):
- 2 replicas for all services
- Full resource requests/limits
- Production-grade configurations

### StatefulSets vs Deployments

**StatefulSets** (require stable identity and storage):
- PostgreSQL: Database with persistent data
- Kafka: Message broker with log persistence
- Zookeeper: Coordination service
- Vault: Secret storage
- Prometheus: Metrics time-series data

**Deployments** (stateless, can scale easily):
- API Gateway
- User Service
- Product Service
- Order Service
- Notification Worker
- Chaos Service
- Metrics Generator
- Frontend
- Redis (ephemeral cache)

### Service Types

**ClusterIP** (internal only):
- All microservices
- PostgreSQL
- Redis
- Kafka
- Vault

**LoadBalancer** (external access):
- API Gateway (if cloud provider supports)
- Frontend (if cloud provider supports)

**Headless** (StatefulSet DNS):
- PostgreSQL
- Kafka
- Zookeeper

---

## Deployment Process

### Automated Deployment

**Complete Deployment:**
```bash
cd k8s

# Production (2 replicas)
./deploy.sh all

# Development (1 replica, lower resources)
ENVIRONMENT=dev ./deploy.sh all

# Specific version
IMAGE_TAG=v1.2.3 ./deploy.sh all
```

### Step-by-Step Deployment

```bash
# 1. Prerequisites check
./deploy.sh check

# 2. Pull Docker images (optional)
./deploy.sh pull

# 3. Deploy infrastructure
./deploy.sh infra
# Deploys: Vault Agent Injector, namespace, service accounts, Vault, Kafka, Zookeeper, Redis

# 4. Initialize Vault
./deploy.sh vault
# Runs: scripts/init-vault.sh
# Creates: Secrets, policies, roles
# Deploys: PostgreSQL (after Vault ready)

# 5. Deploy applications
./deploy.sh apps
# Deploys: All 8 microservices with Vault injection

# 6. Deploy monitoring
./deploy.sh monitoring
# Deploys: Prometheus

# 7. Configure ingress
./deploy.sh ingress
# Deploys: Traefik ingress rules
# Updates: /etc/hosts

# 8. Verify deployment
./deploy.sh verify

# 9. Run health checks
./deploy.sh health
```

### Deployment Order (Critical!)

1. **Vault Agent Injector** (Helm chart)
   - Must be installed FIRST
   - Required for secret injection
   - Mutating webhook must be active

2. **Vault Server** (StatefulSet)
   - Must be running before initialization
   - Wait for pod to be Ready

3. **Initialize Vault** (scripts/init-vault.sh)
   - Enable Kubernetes auth
   - Create service account token (10-year duration)
   - Configure token_reviewer_jwt
   - Store secrets
   - Create policies and roles

4. **PostgreSQL** (StatefulSet)
   - Deployed AFTER Vault initialization
   - Requires Vault secrets for credentials
   - Vault Agent Injector must inject secrets

5. **Kafka, Zookeeper, Redis**
   - Can deploy in parallel
   - No Vault dependencies

6. **Application Services**
   - Deployed AFTER Vault ready
   - Vault Agent Injector injects secrets
   - Each pod gets init container + sidecar

7. **Monitoring & Ingress**
   - Final step
   - No dependencies

### Cleanup

```bash
# Remove everything
./deploy.sh cleanup

# Manual cleanup
helm uninstall vault -n cloudcart
kubectl delete namespace cloudcart --force --grace-period=0
```

---

## Environment Configuration

### Environment Variables

**ENVIRONMENT** (dev | production):
```bash
# Development deployment
export ENVIRONMENT=dev
./deploy.sh all

# OR inline
ENVIRONMENT=dev ./deploy.sh all
```

**IMAGE_TAG** (default: latest):
```bash
# Specific version
export IMAGE_TAG=v1.2.3
./deploy.sh all

# OR inline
IMAGE_TAG=main-42-abc123 ./deploy.sh all
```

### Resource Allocation

**Development:**
```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

**Production:**
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Replica Counts

| Environment | Replicas | Total Pods | Memory Usage |
|-------------|----------|------------|--------------|
| Development | 1 | ~15 pods | ~4-5 GB |
| Production | 2 | ~25 pods | ~8-10 GB |

---

## Troubleshooting

### Common Issues

**1. Vault Agent Injector Not Found**

Symptom:
```
[ERROR] Vault Agent Injector not found
[ERROR] Deployment cannot continue without secret injection
```

Solution:
```bash
./deploy.sh install-vault-injector

# Verify
kubectl get pod -l app.kubernetes.io/name=vault-agent-injector -n cloudcart
kubectl get mutatingwebhookconfiguration vault-agent-injector-cfg
```

**2. PostgreSQL CrashLoopBackOff**

Symptom:
```
postgres-0   0/2   CrashLoopBackOff
Logs: /vault/secrets/database: No such file or directory
```

Causes:
- Vault not initialized
- Vault Agent Injector not running
- Service account missing

Solution:
```bash
# Check Vault Agent Injector
kubectl get pod -l app.kubernetes.io/name=vault-agent-injector -n cloudcart

# Re-initialize Vault
./deploy.sh vault

# Check PostgreSQL logs
kubectl logs postgres-0 -c vault-agent-init -n cloudcart
kubectl describe pod postgres-0 -n cloudcart
```

**3. 403 Permission Denied from Vault**

Symptom:
```
vault-agent-init logs: Code: 403. Errors: * permission denied
```

Cause: token_reviewer_jwt not configured

Solution:
```bash
# Check Vault K8s auth config
kubectl exec -n cloudcart vault-0 -- vault read auth/kubernetes/config

# Should see:
# token_reviewer_jwt: <long token>

# If missing, re-run init
./deploy.sh vault
```

**4. Application Pods Using Placeholder Secrets**

Symptom:
```
Error: Could not parse SQLAlchemy URL from string 'placeholder'
```

Cause: Secrets not sourced in container command

Solution:
Check deployment.yaml has proper command:
```yaml
command: ["/bin/sh"]
args: ["-c", ". /vault/secrets/database && . /vault/secrets/kafka && exec python main.py"]
```

**5. Health Checks Failing**

Symptom:
```
[WARN] ✗ User Service health check failed
```

Cause: wget/curl not installed, or wrong container targeted

Solution:
```bash
# Python services use urllib
kubectl exec -n cloudcart user-service-xxx -c user-service -- \
  python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8001/health').read())"

# Node.js services use wget/curl
kubectl exec -n cloudcart api-gateway-xxx -c api-gateway -- \
  wget -q -O- http://localhost:3000/health
```

**6. Images Platform Mismatch**

Symptom:
```
ImagePullBackOff: no match for platform in manifest
```

Cause: Docker images built for wrong architecture (AMD64 vs ARM64)

Solution:
Build multi-platform images:
```yaml
# .github/workflows/ci.yml
- uses: docker/build-push-action@v6
  with:
    platforms: linux/amd64,linux/arm64
    push: true
    tags: anisingh28/cloudcartops-user-service:latest
```

### Debugging Commands

```bash
# Check all pods
kubectl get pods -n cloudcart

# Watch pod status
kubectl get pods -n cloudcart -w

# Describe pod
kubectl describe pod <pod-name> -n cloudcart

# View logs (app container)
kubectl logs <pod-name> -c <container-name> -n cloudcart

# View logs (vault-agent-init)
kubectl logs <pod-name> -c vault-agent-init -n cloudcart

# View logs (vault-agent sidecar)
kubectl logs <pod-name> -c vault-agent -n cloudcart --follow

# Execute command in pod
kubectl exec -it <pod-name> -c <container-name> -n cloudcart -- /bin/sh

# Check Vault status
kubectl exec -n cloudcart vault-0 -- vault status

# List Vault secrets
kubectl exec -n cloudcart vault-0 -- vault kv list cloudcart/

# Read specific secret
kubectl exec -n cloudcart vault-0 -- vault kv get cloudcart/database

# Check Vault auth methods
kubectl exec -n cloudcart vault-0 -- vault auth list

# Check Vault policies
kubectl exec -n cloudcart vault-0 -- vault policy list

# Check events
kubectl get events -n cloudcart --sort-by='.lastTimestamp'

# Port forward to service
kubectl port-forward svc/api-gateway 3000:3000 -n cloudcart

# Check resource usage
kubectl top pods -n cloudcart
kubectl top nodes
```

### Logs Analysis

```bash
# Application startup issues
kubectl logs <pod-name> -c <app-container> -n cloudcart --tail=50

# Vault injection issues
kubectl logs <pod-name> -c vault-agent-init -n cloudcart

# Database connection issues
kubectl logs postgres-0 -c postgres -n cloudcart --tail=50

# Kafka issues
kubectl logs kafka-0 -n cloudcart --tail=50
```

---

## Best Practices

### Security

1. **Never commit secrets to Git**
   - Use Vault for all sensitive data
   - Rotate secrets regularly

2. **Use RBAC**
   - Service accounts per service
   - Least privilege policies

3. **Network Policies**
   - Restrict pod-to-pod communication
   - Allow only necessary traffic

### Operations

1. **Monitor Resource Usage**
   ```bash
   kubectl top pods -n cloudcart
   kubectl top nodes
   ```

2. **Set Resource Limits**
   - Always define requests and limits
   - Use Vertical Pod Autoscaler for tuning

3. **Health Checks**
   - Liveness probes: Restart unhealthy pods
   - Readiness probes: Remove from service endpoints

4. **Backup Strategy**
   - PostgreSQL: Daily dumps
   - Kafka: Topic replication
   - Vault: Snapshot backups

### Development Workflow

1. **Local Development**
   ```bash
   ENVIRONMENT=dev ./deploy.sh all
   ```

2. **Testing**
   ```bash
   ./deploy.sh health
   kubectl logs -f <pod-name> -n cloudcart
   ```

3. **Cleanup Between Tests**
   ```bash
   ./deploy.sh cleanup
   ```

4. **Production Deployment**
   ```bash
   IMAGE_TAG=v1.0.0 ENVIRONMENT=production ./deploy.sh all
   ```

---

## Access Points

Once deployed, access services via:

- **Frontend**: http://cloudcart.local
- **API**: http://cloudcart.local/api
- **Prometheus**: http://prometheus.cloudcart.local
- **Vault UI**: http://vault.cloudcart.local

Add to `/etc/hosts`:
```
127.0.0.1 cloudcart.local prometheus.cloudcart.local vault.cloudcart.local
```

Vault Root Token (dev mode): `root`

---

## Additional Resources

- **HashiCorp Vault Documentation**: https://www.vaultproject.io/docs
- **Kubernetes Documentation**: https://kubernetes.io/docs
- **K3s Documentation**: https://docs.k3s.io
- **Kustomize Documentation**: https://kustomize.io

---

**Last Updated**: January 2, 2026  
**Version**: 1.0.0
