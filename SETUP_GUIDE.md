# CloudCartOps Setup Guide
## Quick Start for Ansible + Jenkins Deployment

---

## ✅ Setup Complete!

All Ansible roles and Jenkins pipelines have been created. Here's what was set up:

### 📁 Created Structure

```
CloudCartOps/
├── ansible/
│   ├── setup_k3s_infrastructure.yml   ✅ Main playbook
│   ├── inventories.yml                ✅ Updated (needs your VM IPs)
│   └── roles/
│       ├── k3s/                       ✅ K3s installation role
│       ├── vault-setup/               ✅ Vault deployment & init
│       ├── k8s-infrastructure/        ✅ Stateful services
│       └── ingress/                   ✅ Networking setup
│
└── jenkins/
    ├── README.md                      ✅ Complete documentation
    ├── Jenkinsfile.verify             ✅ Infrastructure verification
    ├── Jenkinsfile.deploy             ✅ Application deployment
    └── Jenkinsfile.rollback           ✅ Rollback pipeline
```

---

## 🚀 Next Steps

### Step 1: Update Inventory File

Edit `ansible/inventories.yml` and replace placeholders:

```yaml
ansible_host: <REPLACE_WITH_JENKINS_VM_IP>  # e.g., 192.168.1.100
ansible_host: <REPLACE_WITH_K3S_VM_IP>      # e.g., 192.168.1.100
ansible_user: ubuntu                         # your VM username
```

### Step 2: Test Ansible Connection

```bash
cd ansible

# Test connection to K3s VM
ansible -i inventories.yml k3s -m ping

# If successful, you should see:
# k3s | SUCCESS => {
#     "ping": "pong"
# }
```

### Step 3: Run Ansible Playbook

```bash
# Full infrastructure setup
ansible-playbook -i inventories.yml setup_k3s_infrastructure.yml -v

# Or run specific components:
ansible-playbook -i inventories.yml setup_k3s_infrastructure.yml --tags k3s
ansible-playbook -i inventories.yml setup_k3s_infrastructure.yml --tags vault
ansible-playbook -i inventories.yml setup_k3s_infrastructure.yml --tags infrastructure
```

**What this does:**
- ✅ Installs K3s cluster
- ✅ Installs kubectl, helm, kustomize
- ✅ Deploys Vault Agent Injector (Helm)
- ✅ Deploys Vault in dev mode
- ✅ Initializes Vault with secrets
- ✅ Deploys PostgreSQL
- ✅ Deploys Kafka + Zookeeper
- ✅ Deploys Redis
- ✅ Deploys Prometheus
- ✅ Configures Ingress

### Step 4: Verify Infrastructure

```bash
# SSH to your K3s VM
ssh ubuntu@<your-vm-ip>

# Check cluster
kubectl get nodes
kubectl get pods -n cloudcart

# You should see:
# - vault-0
# - postgres-0
# - kafka-0
# - zookeeper-0
# - redis-*
# - prometheus-0
```

### Step 5: Configure Jenkins

1. **Access Jenkins:**
   ```
   http://<jenkins-vm-ip>:8080
   ```

2. **Install Required Plugins:**
   - Go to: Manage Jenkins → Plugins → Available
   - Install:
     - Kubernetes CLI Plugin
     - Pipeline Plugin
     - Git Plugin

3. **Add Kubeconfig Credential:**
   ```
   Manage Jenkins → Credentials → Global → Add Credentials
   
   Kind: Secret file
   ID: k3s-kubeconfig
   File: Upload /etc/rancher/k3s/k3s.yaml from K3s VM
   ```

4. **Create Pipeline Jobs:**

   **Job 1: Verify Infrastructure**
   ```
   New Item → cloudcart-verify-infrastructure → Pipeline
   
   Pipeline Definition: Pipeline script from SCM
   SCM: Git
   Repository URL: <your-repo>
   Script Path: jenkins/Jenkinsfile.verify
   ```

   **Job 2: Deploy Applications**
   ```
   New Item → cloudcart-deploy-apps → Pipeline
   
   ☑ This project is parameterized
   Pipeline Definition: Pipeline script from SCM
   SCM: Git
   Repository URL: <your-repo>
   Script Path: jenkins/Jenkinsfile.deploy
   ```

   **Job 3: Rollback**
   ```
   New Item → cloudcart-rollback → Pipeline
   
   ☑ This project is parameterized
   Pipeline Definition: Pipeline script from SCM
   SCM: Git
   Repository URL: <your-repo>
   Script Path: jenkins/Jenkinsfile.rollback
   ```

### Step 6: Run First Deployment

1. **Verify Infrastructure:**
   - Run "cloudcart-verify-infrastructure" job
   - Check console output for ✓ marks

2. **Deploy Applications:**
   - Run "cloudcart-deploy-apps" job
   - Parameters:
     - ENVIRONMENT: `dev`
     - IMAGE_TAG: `latest`
     - SKIP_HEALTH_CHECK: `false`

3. **Verify Deployment:**
   ```bash
   kubectl get pods -n cloudcart
   kubectl get svc -n cloudcart
   ```

---

## 🔍 Verification Checklist

### After Ansible Execution
- [ ] K3s cluster running: `kubectl get nodes`
- [ ] Namespace created: `kubectl get ns cloudcart`
- [ ] Vault pod ready: `kubectl get pod vault-0 -n cloudcart`
- [ ] PostgreSQL ready: `kubectl get pod postgres-0 -n cloudcart`
- [ ] Kafka ready: `kubectl get pod -l app=kafka -n cloudcart`
- [ ] Redis ready: `kubectl get pod -l app=redis -n cloudcart`
- [ ] Prometheus ready: `kubectl get pod -l app=prometheus -n cloudcart`
- [ ] Vault initialized: `kubectl exec -n cloudcart vault-0 -- vault status`

### After Jenkins Deployment
- [ ] All app pods running: `kubectl get pods -n cloudcart`
- [ ] 8 deployments created (api-gateway, user-service, product-service, order-service, notification-worker, chaos-service, metrics-generator, frontend)
- [ ] Services accessible: `kubectl get svc -n cloudcart`
- [ ] Ingress configured: `kubectl get ingress -n cloudcart`

---

## 📚 Documentation

- **Ansible Roles:** See individual role directories for detailed task files
- **Jenkins Pipelines:** See [jenkins/README.md](jenkins/README.md)
- **Implementation Plan:** See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- **K8s Deployment Guide:** See [k8s/K8S_DEPLOYMENT_GUIDE.md](k8s/K8S_DEPLOYMENT_GUIDE.md)

---

## 🐛 Troubleshooting

### Ansible Connection Issues

```bash
# Check SSH connectivity
ssh -vvv ubuntu@<vm-ip>

# Verify SSH key is added
ssh-add -l

# Add SSH key if needed
ssh-add ~/.ssh/id_rsa
```

### K3s Not Starting

```bash
# Check K3s status
sudo systemctl status k3s

# View K3s logs
sudo journalctl -u k3s -f
```

### Vault Initialization Fails

```bash
# Check Vault pod logs
kubectl logs vault-0 -n cloudcart

# Manually run init script
kubectl exec -n cloudcart vault-0 -- /tmp/init-vault.sh
```

### Jenkins Can't Connect to K3s

```bash
# Verify kubeconfig on Jenkins VM
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes

# Check file permissions
ls -la /etc/rancher/k3s/k3s.yaml
# Should be readable by Jenkins user
```

---

## 🎯 Success Criteria

- ✅ Ansible playbook runs without errors
- ✅ All infrastructure pods are Running (1/1 Ready)
- ✅ Vault is initialized with secrets
- ✅ Jenkins can connect to K3s cluster
- ✅ Jenkins pipeline deploys all 8 microservices
- ✅ Applications are accessible via ingress

---

## 📞 Need Help?

- Check [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for detailed architecture
- See [jenkins/README.md](jenkins/README.md) for pipeline documentation
- Review individual Ansible role task files for step-by-step execution

---

**Setup completed on:** January 3, 2026  
**Next action:** Update `ansible/inventories.yml` with your VM IP addresses and run the playbook!
