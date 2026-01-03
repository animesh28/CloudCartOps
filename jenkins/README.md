# Jenkins CI/CD Pipelines for CloudCartOps

This directory contains Jenkins pipeline configurations for deploying CloudCartOps microservices to Kubernetes.

## 📋 Overview

Jenkins is responsible for:
- Deploying application services (8 microservices)
- Running health checks
- Managing rollbacks
- Verifying infrastructure readiness

## 📁 Directory Structure

```
jenkins/
├── README.md                  # This file
├── Jenkinsfile.verify         # Infrastructure verification pipeline
├── Jenkinsfile.deploy         # Application deployment pipeline
├── Jenkinsfile.rollback       # Rollback pipeline
├── scripts/                   # Helper scripts (future)
└── pipelines/                 # Individual service pipelines (future)
```

## 🚀 Pipelines

### 1. Infrastructure Verification (`Jenkinsfile.verify`)

**Purpose:** Verify that all infrastructure components are ready before deployment

**What it checks:**
- K3s cluster connectivity
- Vault pod status
- PostgreSQL readiness
- Kafka availability
- Redis connectivity
- Vault secrets configuration

**How to use:**
```groovy
// In Jenkins UI:
// 1. New Item → Pipeline
// 2. Name: "cloudcart-verify-infrastructure"
// 3. Pipeline → Definition → Pipeline script from SCM
// 4. Repository URL: <your-repo>
// 5. Script Path: jenkins/Jenkinsfile.verify
```

### 2. Application Deployment (`Jenkinsfile.deploy`)

**Purpose:** Deploy all CloudCartOps microservices using Kustomize

**Features:**
- Environment selection (dev/prod)
- Custom image tag specification
- Kustomize-based deployment
- Parallel rollout status checks
- Optional health checks

**Parameters:**
- `ENVIRONMENT`: Choose dev or prod overlay
- `IMAGE_TAG`: Docker image tag (default: latest)
- `SKIP_HEALTH_CHECK`: Skip post-deployment health checks

**How to use:**
```groovy
// In Jenkins UI:
// 1. New Item → Pipeline
// 2. Name: "cloudcart-deploy-apps"
// 3. Pipeline → Definition → Pipeline script from SCM
// 4. Repository URL: <your-repo>
// 5. Script Path: jenkins/Jenkinsfile.deploy
// 6. Check "This project is parameterized"
```

**What it deploys:**
- API Gateway
- User Service
- Product Service
- Order Service
- Notification Worker
- Chaos Service
- Metrics Generator
- Frontend

### 3. Rollback Pipeline (`Jenkinsfile.rollback`)

**Purpose:** Rollback deployments to previous versions

**Features:**
- Service selection (all or individual)
- Revision specification
- Confirmation step before rollback
- Post-rollback verification

**Parameters:**
- `SERVICE`: Choose service to rollback or 'all'
- `REVISION`: Revision number (0 = previous)

**How to use:**
```groovy
// In Jenkins UI:
// 1. New Item → Pipeline
// 2. Name: "cloudcart-rollback"
// 3. Pipeline → Definition → Pipeline script from SCM
// 4. Repository URL: <your-repo>
// 5. Script Path: jenkins/Jenkinsfile.rollback
```

## ⚙️ Jenkins Configuration

### Prerequisites

1. **Jenkins Plugins Required:**
   - Kubernetes CLI Plugin
   - Pipeline Plugin
   - Git Plugin
   - Docker Pipeline Plugin (if building images)

2. **Credentials to Configure:**
   ```
   Jenkins → Manage Jenkins → Credentials → Add Credentials
   
   1. SSH Key for K3s VM
      - Kind: SSH Username with private key
      - ID: k3s-vm-ssh-key
      - Username: ubuntu
      - Private Key: <your-ssh-key>
   
   2. Kubeconfig File
      - Kind: Secret file
      - ID: k3s-kubeconfig
      - File: /etc/rancher/k3s/k3s.yaml from K3s VM
   
   3. Docker Hub Credentials (optional)
      - Kind: Username with password
      - ID: dockerhub-credentials
      - Username: anisingh28
      - Password: <your-token>
   ```

### Environment Variables

Configure these in Jenkins global environment or pipeline:

```groovy
KUBECONFIG = '/etc/rancher/k3s/k3s.yaml'
NAMESPACE = 'cloudcart'
DOCKER_REGISTRY = 'anisingh28'
IMAGE_PREFIX = 'cloudcartops'
```

### Setting up Kubeconfig Access

**Option 1: Copy kubeconfig to Jenkins**
```bash
# On Jenkins VM
sudo mkdir -p /var/lib/jenkins/.kube
sudo cp /etc/rancher/k3s/k3s.yaml /var/lib/jenkins/.kube/config
sudo chown -R jenkins:jenkins /var/lib/jenkins/.kube
```

**Option 2: Use kubeconfig credential**
```groovy
// In Jenkinsfile
withCredentials([file(credentialsId: 'k3s-kubeconfig', variable: 'KUBECONFIG')]) {
    sh 'kubectl get pods -n cloudcart'
}
```

## 📝 Usage Examples

### Example 1: Deploy to Dev Environment

1. Run "cloudcart-verify-infrastructure" pipeline
2. If successful, run "cloudcart-deploy-apps" with:
   - ENVIRONMENT: `dev`
   - IMAGE_TAG: `latest`
   - SKIP_HEALTH_CHECK: `false`

### Example 2: Deploy Specific Version to Production

1. Verify infrastructure
2. Run "cloudcart-deploy-apps" with:
   - ENVIRONMENT: `prod`
   - IMAGE_TAG: `v1.0.0`
   - SKIP_HEALTH_CHECK: `false`

### Example 3: Rollback a Failed Deployment

1. Run "cloudcart-rollback" with:
   - SERVICE: `all` or specific service
   - REVISION: `0` (previous) or specific number

## 🔍 Troubleshooting

### Common Issues

**1. Kubeconfig not found**
```
Error: The connection to the server localhost:8080 was refused
```
**Solution:** Ensure KUBECONFIG environment variable is set correctly

**2. Vault secrets not found**
```
WARNING: Database secrets not found
```
**Solution:** Run the Ansible vault-setup role again or manually initialize Vault

**3. Image pull errors**
```
Failed to pull image "anisingh28/cloudcartops-*:latest"
```
**Solution:** 
- Verify Docker registry credentials
- Ensure images exist in Docker Hub
- Check image tag is correct

**4. Pod not ready timeout**
```
error: timed out waiting for the condition on pods
```
**Solution:**
- Check pod logs: `kubectl logs <pod-name> -n cloudcart`
- Check events: `kubectl get events -n cloudcart`
- Verify Vault annotations are correct

### Debugging Commands

```bash
# Check pod status
kubectl get pods -n cloudcart

# Check pod logs
kubectl logs -f <pod-name> -n cloudcart

# Describe pod for events
kubectl describe pod <pod-name> -n cloudcart

# Check deployment status
kubectl rollout status deployment/<service-name> -n cloudcart

# Check Vault status
kubectl exec -n cloudcart vault-0 -- vault status

# Verify secrets
kubectl exec -n cloudcart vault-0 -- vault kv get cloudcart/database
```

## 🔐 Security Notes

- **Vault Token:** In dev mode, token is `root` (change for production)
- **Docker Registry:** Use tokens instead of passwords
- **SSH Keys:** Rotate regularly and use key-based authentication
- **Kubeconfig:** Restrict access to Jenkins user only

## 📚 Additional Resources

- [Jenkins Pipeline Documentation](https://www.jenkins.io/doc/book/pipeline/)
- [Kubernetes CLI Plugin](https://plugins.jenkins.io/kubernetes-cli/)
- [Kustomize Documentation](https://kustomize.io/)
- [Vault Agent Injector](https://www.vaultproject.io/docs/platform/k8s/injector)

## 🤝 Contributing

When adding new pipelines:
1. Create Jenkinsfile in this directory
2. Update this README with pipeline details
3. Test in dev environment first
4. Document parameters and environment variables

---

**Last Updated:** January 3, 2026  
**Maintained By:** DevOps Team
