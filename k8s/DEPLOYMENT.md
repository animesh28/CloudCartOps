# CloudCartOps K3s Deployment Guide

## Infrastructure Overview

### Architecture Components

**Stateful Services (StatefulSets with PVC):**
- PostgreSQL 15 (5Gi storage)
- Zookeeper (2Gi storage)
- Kafka (5Gi storage)
- HashiCorp Vault (1Gi storage)
- Prometheus (10Gi storage)

**Stateless Services (Deployments):**
- Redis
- API Gateway (2 replicas)
- User Service (2 replicas)
- Product Service (2 replicas)
- Order Service (2 replicas)
- Chaos Service (1 replica)
- Notification Worker (2 replicas)
- Metrics Generator (1 replica)
- Frontend (2 replicas)

**Networking:**
- Ingress with NGINX for external access
- ClusterIP services for internal communication
- Headless services for StatefulSets

## Deployment Steps

### 1. Prerequisites

```bash
curl -sfL https://get.k3s.io | sh -

sudo systemctl status k3s

mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config
export KUBECONFIG=~/.kube/config

kubectl version
kubectl get nodes
```

### 2. Install Kustomize

```bash
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
sudo mv kustomize /usr/local/bin/
```

### 3. Build Docker Images

```bash
cd /path/to/CloudCartOps

docker build -t cloudcart/api-gateway:latest ./services/api-gateway
docker build -t cloudcart/user-service:latest ./services/user-service
docker build -t cloudcart/product-service:latest ./services/product-service
docker build -t cloudcart/order-service:latest ./services/order-service
docker build -t cloudcart/chaos-service:latest ./services/chaos-service
docker build -t cloudcart/notification-worker:latest ./services/notification-worker
docker build -t cloudcart/metrics-generator:latest ./services/metrics-generator
docker build -t cloudcart/frontend:latest ./services/frontend
```

### 4. Import Images to K3s

```bash
docker save cloudcart/api-gateway:latest | sudo k3s ctr images import -
docker save cloudcart/user-service:latest | sudo k3s ctr images import -
docker save cloudcart/product-service:latest | sudo k3s ctr images import -
docker save cloudcart/order-service:latest | sudo k3s ctr images import -
docker save cloudcart/chaos-service:latest | sudo k3s ctr images import -
docker save cloudcart/notification-worker:latest | sudo k3s ctr images import -
docker save cloudcart/metrics-generator:latest | sudo k3s ctr images import -
docker save cloudcart/frontend:latest | sudo k3s ctr images import -
```

### 5. Deploy Infrastructure Layer

```bash
cd k8s

kubectl apply -k base/namespace

kubectl apply -k base/postgres
kubectl wait --for=condition=ready pod -l app=postgres -n cloudcart --timeout=300s

kubectl apply -k base/redis
kubectl apply -k base/kafka
kubectl wait --for=condition=ready pod -l app=kafka -n cloudcart --timeout=300s

kubectl apply -k base/vault
kubectl wait --for=condition=ready pod -l app=vault -n cloudcart --timeout=300s
```

### 6. Initialize Vault

Vault is configured to store all sensitive information (database credentials, JWT secrets, etc.):

```bash
./k8s/scripts/init-vault.sh all
```

This configures:
- Kubernetes authentication
- Application secrets (database, JWT, Kafka, Redis)
- Access policies for each service
- Roles for service accounts

**See [VAULT_INTEGRATION.md](VAULT_INTEGRATION.md) for detailed Vault configuration.**

### 7. Deploy Application Services

```bash
kubectl apply -k base/api-gateway
kubectl apply -k base/user-service
kubectl apply -k base/product-service
kubectl apply -k base/order-service
kubectl apply -k base/chaos-service
kubectl apply -k base/notification-worker
kubectl apply -k base/metrics-generator
kubectl apply -k base/frontend
```

### 8. Deploy Monitoring

```bash
kubectl apply -k base/prometheus
```

### 9. Configure Ingress

```bash
kubectl apply -f base/common/ingress.yaml

echo "127.0.0.1 cloudcart.local prometheus.cloudcart.local vault.cloudcart.local" | sudo tee -a /etc/hosts
```

### 10. Verify Deployment

```bash
kubectl get all -n cloudcart

kubectl get pvc -n cloudcart

kubectl get ingress -n cloudcart

kubectl logs -n cloudcart -l app=api-gateway --tail=50
```

## Environment-Specific Deployments

### Development Environment

```bash
kubectl apply -k overlays/dev
```

### Production Environment

```bash
kubectl apply -k overlays/prod
```

## Access Endpoints

**Application:**
- Frontend: http://cloudcart.local
- API Gateway: http://cloudcart.local/api

**Monitoring:**
- Prometheus: http://prometheus.cloudcart.local

**Vault:**
- Vault UI: http://vault.cloudcart.local

## Storage Configuration

K3s uses local-path provisioner by default:
- Storage location: /var/lib/rancher/k3s/storage
- Persistent volumes are bound to specific nodes
- Data persists across pod restarts
- Backup strategy required for production

## Backup Strategy

```bash
kubectl exec -n cloudcart postgres-0 -- pg_dump -U cloudcart cloudcart > backup-$(date +%Y%m%d).sql

kubectl exec -n cloudcart vault-0 -- tar czf - /vault/data > vault-backup-$(date +%Y%m%d).tar.gz

kubectl get pvc -n cloudcart -o yaml > pvc-backup-$(date +%Y%m%d).yaml
```

## Scaling Operations

```bash
kubectl scale deployment api-gateway -n cloudcart --replicas=3

kubectl scale deployment user-service -n cloudcart --replicas=5

kubectl scale statefulset kafka -n cloudcart --replicas=3
```

## Troubleshooting

```bash
kubectl describe pod <pod-name> -n cloudcart

kubectl logs -n cloudcart <pod-name> --tail=100 -f

kubectl exec -it -n cloudcart <pod-name> -- /bin/sh

kubectl get events -n cloudcart --sort-by='.lastTimestamp'

kubectl top pods -n cloudcart
kubectl top nodes
```

## Cleanup

```bash
kubectl delete -k overlays/dev

kubectl delete -k base

kubectl delete namespace cloudcart
```

## Resource Requirements

**Minimum Node Specs:**
- CPU: 4 cores
- Memory: 8GB RAM
- Storage: 50GB SSD

**Recommended for Production:**
- CPU: 8+ cores
- Memory: 16GB+ RAM
- Storage: 100GB+ SSD
- Multi-node cluster for HA

## Security Considerations

1. Change default passwords in postgres-secret.yaml
2. Update JWT secret in app-secrets.yaml
3. Secure Vault root token (vault-keys.txt)
4. Enable TLS for Ingress in production
5. Configure NetworkPolicies for pod isolation
6. Use RBAC for service accounts
7. Enable Pod Security Standards
8. Implement secrets rotation policy

## High Availability Setup

For production HA:
1. Deploy 3+ Kafka replicas
2. Deploy 3+ Zookeeper replicas  
3. Configure PostgreSQL with replication
4. Use external load balancer
5. Multi-zone node placement
6. Configure pod anti-affinity rules
7. Implement health checks and auto-healing

## Monitoring & Alerts

```bash
kubectl port-forward -n cloudcart svc/prometheus 9090:9090

kubectl port-forward -n cloudcart svc/api-gateway 3000:3000
```

Access metrics at:
- http://localhost:9090 (Prometheus UI)
- http://localhost:3000/metrics (API Gateway metrics)

## Update Strategy

Rolling updates:
```bash
kubectl set image deployment/api-gateway api-gateway=cloudcart/api-gateway:v2.0.0 -n cloudcart

kubectl rollout status deployment/api-gateway -n cloudcart

kubectl rollout undo deployment/api-gateway -n cloudcart
```
