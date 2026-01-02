# Jenkins CI/CD Pipelines for CloudCartOps

## Overview

CloudCartOps includes two Jenkins pipeline configurations:

1. **Jenkinsfile-complete** - Full CI/CD pipeline (build, test, scan, push, deploy)
2. **Jenkinsfile** - CD-only pipeline (deploy pre-built images)

Both pipelines deploy to K3s Kubernetes cluster with images from Docker Hub (`anisingh28/cloudcartops-*`).

## Prerequisites

### Jenkins Server Setup

**Required Tools:**
- Docker
- kubectl
- Trivy (security scanner)
- Git

**Required Plugins:**
- Docker Pipeline
- Kubernetes CLI
- Git
- Pipeline
- Credentials Binding

### K3s Cluster

**Requirements:**
- Running K3s cluster on VirtualBox VM
- kubectl configured with cluster access
- Minimum 8GB RAM, 4 CPU cores

## Quick Setup

### 1. Deploy Jenkins on VirtualBox

```bash
cd jenkins
docker-compose up -d

docker logs jenkins

echo "Access Jenkins at http://localhost:8080"
echo "Access Registry UI at http://localhost:8081"
```

### 2. Configure Jenkins Credentials

Navigate to **Manage Jenkins → Credentials → Global**:

**Docker Hub Credentials:**
- ID: `docker-hub-credentials`
- Type: Username with password
- Username: `anisingh28`
- Password: Your Docker Hub token

**K3s SSH Access (if needed):**
- ID: `k3s-server-ssh`
- Type: SSH Username with private key
- Username: `root`
- Private Key: Your SSH key for K3s VM

### 3. Configure kubectl for Jenkins

```bash
scp root@<K3S_IP>:/etc/rancher/k3s/k3s.yaml /tmp/k3s.yaml

sed -i 's/127.0.0.1/<K3S_IP>/g' /tmp/k3s.yaml

docker cp /tmp/k3s.yaml jenkins:/var/jenkins_home/.kube/config

docker exec jenkins chown jenkins:jenkins /var/jenkins_home/.kube/config
```

### 4. Create Jenkins Pipeline Jobs

#### Option A: Complete CI/CD Pipeline

1. **New Item** → Enter name `CloudCartOps-CICD` → **Pipeline**
2. **Pipeline Configuration:**
   - Definition: Pipeline script from SCM
   - SCM: Git
   - Repository URL: `https://github.com/your-username/CloudCartOps.git`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile-complete`
3. **Save**

**This pipeline runs:**
- Unit tests for all services
- IntegratioComparison

### Complete CI/CD Pipeline (Jenkinsfile-complete)

**Use when:** Building and deploying from source code

**Stages:**
1. **Checkout** - Clone repository
2. **Unit Tests** - Start docker compose, run tests for all 6 services
3. **Run Tests** - Parallel execution of pytest, go test, npm test
4. **Integration Tests** - Run app_scenarios.sh (10 scenarios)
5. **Cleanup Test Environment** - Stop docker compose
6. **Build Images** - Build 8 Docker images in parallel
7. **Security Scan** - Trivy scan all images (parallel)
8. **Push Images** - Push to Docker Hub (main branch only)
9. **Deploy Infrastructure** - PostgreSQL, Redis, Kafka, Vault
10. **Deploy Applications** - All 8 services with rolling updates
11. **Deploy Monitoring** - Prometheus and Ingress
12. **Wait for Rollout** - Ensure deployments complete
13. **Smoke Tests** - Verify API Gateway health

**Duration:** ~15-20 minutes  
**Triggers:** On every commit to main  
**Best for:** Full development workflow

### Deployment-Only Pipeline (Jenkinsfile)

**Use when:** Deploying pre-built images

**Stages:**
1. **Checkout** - Get K8s manifests
2. **Pull Images** - Pull specified tag from Docker Hub (parallel)
3. **Deploy Infrastructure** - PostgreSQL, Redis, Kafka, Vault
4. **Deploy Applications** - Update deployments with new images
5. **Deploy Monitoring** - Prometheus and Ingress
6. **Wait for Rollout** - Ensure deployments complete
7. **Smoke Tests** - Verify health

**Duration:** ~5-7 minutes  
**Triggers:** Manual with parameters  
**Best for:** Quick deployments, production updates

## Complete CI/CD Pipeline n tests
- Docker image builds
- Security scans with Trivy
- Push to Docker Hub
- DeRun Complete CI/CD Pipeline

Click **Build Now** to start the full pipeline.

### Run Deployment-Only Pipeline

**Deploy latest images:**
```bash
Build with Parameters → IMAGE_TAG: latest
```

**Deploy specific version:**
```bash
Build with Parameters → IMAGE_TAG: main-42-a1b2c3d
```
#### Option B: Deployment-Only Pipeline

1. **New Item** → Enter name `CloudCartOps-Deploy` → **Pipeline**
2. **Pipeline Configuration:**
   - Definition: Pipeline script from SCM
   - SCM: Git
   - Repository URL: `https://github.com/your-username/CloudCartOps.git`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
3. **Build with Parameters:**
   - IMAGE_TAG: Specify version (default: latest)
   - ENVIRONMENT: dev or prod
4. **Save**

**This pipeline runs:**
- Pull images from Docker Hub
- Deploy to K3s
- Smoke tests

#### Option C: Multi-Branch Pipeline (Recommended)

1. **New Item** → Enter name `CloudCartOps` → **Multibranch Pipeline**
2. **Branch Sources:**
   - Add source: Git
   - Repository URL: `https://github.com/your-username/CloudCartOps.git`
   - Credentials: (if private repo)
3. **Build Configuration:**
   - Mode: by Jenkinsfile
   - Script Path: `Jenkinsfile-complete`
4. **Scan Multibranch Pipeline Triggers:**
   - Periodically if not otherwise run: 1 minute
5. Typical CI/CD Workflows

### Workflow 1: GitHub Actions + Jenkins CD

**Best for:** Teams using GitHub, want PR checks

1. **GitHub Actions** (on every commit):
   - Run unit tests
   - Build images
   - Security scan
   - Push to Docker Hub
   
2. **Jenkins CD** (manual or scheduled):
   - Pull latest images
   - Deploy to K3s
   - Run smoke tests

**Setup:**
- Use existing `.github/workflows/ci.yml`
- Use `Jenkinsfile` for deployment
- Trigger Jenkins manually or via we(PostgreSQL, Redis, Kafka) to be healthy
- Waits for application endpoints to respond

### Stage 3: Run Tests (Parallel)
Runs unit tests for all 6 services in parallel:
- **user-service** - pytest (Python)
- **product-service** - pytest (Python)
- **chaos-service** - pytest (Python)
- **notification-worker** - pytest (Python)
- **order-service** - go test (Golang)
- **api-gateway** - npm test (Node.js)

### Stage 4: Integration Tests
- Runs `tests/app_scenarios.sh`
- Tests 10 end-to-end scenarios
- Validates full user journey

### Stage 5: Cleanup Test Environment
- Stops all docker compose services
- Removes volumes

### Stage 6o Docker Hub
   - Deploy to K3s
   - Smoke tests

**Setup:**7
- Use `Jenkinsfile-complete`
- Configure SCM polling or webhooks
- Auto-deploy on main branch

### Workflow 3: Hybrid Approach

**Best for:** Different environments

1. **GitHub Actions** (PR and dev branches):
   - Run tests
   - Build and scan images
   - Push with dev tags

2. **Jenkins** (production):
   - Pull production tags
   - Deploy to production K3s
   - Run extensive smoke tests
   - Approval gates

**Setup:**
- GitHub Actions for CI
- `Jenkinsfile` with manual approval
- Separate K3s clusters

## Environment-Specific Deployments

### Development Environment

```groovy
// In Jenkinsfile, use dev overlay
sh "kubectl apply -k k8s/overlays/dev"
```

**Characteristics:**
- 1 replica per service
- Reduced resource limits
- Dev image tags
- Fast deployment

### Production Environment

```groovy
// In Jenkinsfile, use prod overlay
sh "kubectl apply -k k8s/overlays/prod"
```

**Characteristics:**
- 3 replicas per service
- Higher resource limits
- Versioned tags (v1.0.0)
- High availability

**Benefits:**
- Automatically creates jobs for each branch
- Runs full CI/CD on main branch
- Tests PRs without deployment
- Clean separation of environments

### 5. Run the Pipeline

Click **Build Now** to start the pipeline.

## Pipeline Stages

### Stage 1: Checkout
- Clones the repository
- Captures Git commit hash for tagging

### Stage 2: Unit Tests
- Starts all services with `docker compose`
- Waits for infrastructure services to be healthy
- Runs unit tests for all 6 services:
  - user-service (pytest)
  - product-service (pytest)
  - chaos-service (pytest)
  - notification-worker (pytest)
  - order-service (go test)
  - api-gateway (npm test)
- Tears down containers after tests

### Stage 3: Build Images (Parallel)
Builds 8 Docker images in parallel:
- `anisingh28/cloudcartops-api-gateway`
- `anisingh28/cloudcartops-user-service`
- `anisingh28/cloudcartops-product-service`
- `anisingh28/cloudcartops-order-service`
- `anisingh28/cloudcartops-chaos-service`
- `anising8: Push Images
**Only on `main` branch:**
- Logs into Docker Hub
- Pushes all images with both tags

### Stage 9: Deploy Infrastructure
**Only on `main` branch:**
- Deploys infrastructure layer (PostgreSQL, Redis, Kafka, Vault)
- Waits for services to be ready
- Initializes Vault with secrets

### Stage 10: Deploy Applications
**Only on `main` branch:**
- Deploys application services
- Updates images using `kubectl set image` (rolling update)

### Stage 11: Deploy Monitoring
**Only on `main` branch:**
- Deploys Prometheus
- Configures Ingress

### Stage 12: Wait for Rollout
**Only on `main` branch:**
- Waits for all deployments to complete
- Ensures pods are ready

### Stage 13 Docker Hub
- Pushes all images with both tags

### Stage 6: Deploy to K8s
**Only on `main` branch:**
- Deploys infrastructure la-complete:**
- `DOCKER_HUB_REPO`: `anisingh28`
- `IMAGE_PREFIX`: `cloudcartops`
- `K8S_NAMESPACE`: `cloudcart`
- `BUILD_TAG`: `<branch>-<build>-<commit>`

**Configured in Jenkinsfile (deployment-only):**
- `IMAGE_TAG`: Parameter (default: latest)

### Stage 7: Smoke Tests
**Only on `main` branch:**
- Verifies API Gateway health endpoint
- Confirms successful deployment

## Environment Variables

**Configured in Jenkinsfile:**
- `DOCKER_HUB_REPO`: `anisingh28`
- `IMAGE_PREFIX`: `cloudcartops`
- `K8S_NAMESPACE`: `cloudcart`
- `BUILD_TAG`: `<branch>-<build>-<commit>`

## Manual Deployment Commands

### Deploy Infrastructure Only

```bash
cd k8s
kubectl apply -k base/namespace
kubectl apply -k base/postgres
kubectl apply -k base/redis
kubectl apply -k base/kafka
kubectl apply -k base/vault
```

### Deploy Applications Only

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

### Rolling Update Single Service

```bash
kubectl set image deployment/api-gateway \
  api-gateway=anisingh28/cloudcartops-api-gateway:main-42-a1b2c3d \
  -n cloudcart

kubectl rollout status deployment/api-gateway -n cloudcart
```

### Rollback Deployment

```bash
kubectl rollout undo deployment/api-gateway -n cloudcart

kubectl rollout history deployment/api-gateway -n cloudcart
```

## Monitoring Pipeline

### View Build Logs

```bash
docker exec jenkins tail -f /var/jenkins_home/jobs/CloudCartOps/builds/<build-number>/log
```

### Check K8s Deployment Status

```bash
kubectl get pods -n cloudcart

kubectl get deployments -n cloudcart

kubectl rollout status deployment/api-gateway -n cloudcart
```

### View Service Logs

```bash
kubectl logs -f deployment/api-gateway -n cloudcart --tail=100

kubectl logs -f -l app=user-service -n cloudcart
```

## Troubleshooting

### Pipeline Fails at Unit Tests

**Check Docker Compose:**
```bash
docker compose ps
docker compose logs api-gateway
```

**Restart Services:**
```bash
docker compose down -v
docker compose up -d --build
```

### Pipeline Fails at Docker Push

**Verify Credentials:**
```bash
docker login -u anisingh28
```

**Check Jenkins Credentials:**
- Navigate to **Manage Jenkins → Credentials**
- Verify `docker-hub-credentials` exists
- Update password with Docker Hub token

### Pipeline Fails at K8s Deployment

**Verify kubectl Access:**
```bash
docker exec jenkins kubectl get nodes

docker exec jenkins kubectl config view
```

**Check Kubeconfig:**
```bash
docker exec jenkins cat /var/jenkins_home/.kube/config
```

**Verify Cluster Connectivity:**
```bash
kubectl get pods -n cloudcart
kubectl get events -n cloudcart --sort-by='.lastTimestamp'
```

### Image Pull Errors in K8s

**Check Image Exists:**
```bash
docker pull anisingh28/cloudcartops-api-gateway:latest
```

**Verify Pod Events:**
```bash
kubectl describe pod <pod-name> -n cloudcart
```

**Force Pull Latest:**
```bash
kubectl delete pod <pod-name> -n cloudcart
```

## Advanced Configuration

### Build on Multiple Branches

**Modify Jenkinsfile to deploy dev overlay:**
```groovy
stage('Deploy to K8s') {
    when {
        anyOf {
            branch 'main'
            branch 'develop'
        }
    }
    steps {
        script {
            def overlay = env.BRANCH_NAME == 'main' ? 'prod' : 'dev'
            sh """
                cd k8s
                kubectl apply -k overlays/${overlay}
            """
        }
    }
}
```

### Parallel Deployment

**Enable parallel service deployment:**
```groovy
parallel {
    stage('User Service') {
        steps {
            sh "kubectl apply -k base/user-service"
        }
    }
    stage('Product Service') {
        steps {
            sh "kubectl apply -k base/product-service"
        }
    }
}
```

### Notifications

**Add Slack/Email notifications:**
```groovy
post {
    success {
        slackSend color: 'good', message: "Build ${env.BUILD_NUMBER} succeeded"
    }
    failure {
        mail to: 'team@example.com',
             subject: "Pipeline Failed: ${env.JOB_NAME}",
             body: "Build ${env.BUILD_NUMBER} failed"
    }
}
```
erformance Metrics

### Complete CI/CD Pipeline (Jenkinsfile-complete)

**Typical Execution Times:**
- Unit Tests: 3-5 minutes
- Integration Tests: 2-3 minutes
- Build Images (parallel): 3-5 minutes
- Security Scan (parallel): 2-3 minutes
- Push Images: 1-2 minutes
- Deploy Infrastructure: 2-3 minutes
- Deploy Applications: 2-3 minutes
- Smoke Tests: 1 minute
- **Total: ~17-25 minutes**

**Resource Usage:**
- CPU: High during parallel builds
- RAM: ~4GB for docker compose tests
- Disk: ~10GB for images and cache
- Network: ~2GB downloads, ~1GB uploads

### Deployment-Only Pipeline (Jenkinsfile)

**Typical Execution Times:**
- Pull Images (parallel): 1-2 minutes
- Deploy Infrastructure: 2-3 minutes
- Deploy Applications: 2-3 minutes
- Smoke Tests: 1 minute
- **Total: ~5-7 minutes**

**Resource Usage:**
- CPU: Low to medium
- RAM: ~1GB
- Disk: ~5GB for images
- Network: ~1GB downloads=1 to fail on vulnerabilities:**
   ```groovy
   trivy image --severity CRITICAL --exit-code 1
   ```
4. **Scan base images before build**
5. **Use least-privilege K8s service accounts**
6. **Enable RBAC and NetworkPolicies**

## Pipeline Performance

**Typical Execution Times:**
- Unit Tests: 3-5 minutes
- Build Images (parallel): 2-4 minutes
- Security Scan (parallel): 2-3 minutes
- Push Images: 1-2 minutes
- Deploy to K8s: 2-3 minutes
- **Total: ~12-17 minutes**

**Optimization Tips:**
- Use Docker layer caching
- Cache npm/pip dependencies
- Run tests in parallel where possible
- Use smaller base images

## Access Points After Deployment

Once pipeline completes:
- **Frontend**: http://cloudcart.local
- **API**: http://cloudcart.local/api
- **Prometheus**: http://prometheus.cloudcart.local
- **Vault**: http://vault.cloudcart.local

Add to `/etc/hosts` on your local machine:
```bash
echo "<K3S_IP> cloudcart.local prometheus.cloudcart.local vault.cloudcart.local" | sudo tee -a /etc/hosts
```
