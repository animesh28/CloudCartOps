# CloudCartOps CI/CD Implementation Plan
## Ansible + Jenkins Integration

**Date:** January 3, 2026  
**Objective:** Separate infrastructure setup (Ansible) from application deployment (Jenkins)

---

## 📋 Overview

### Current State
- **Jenkins:** Already installed on Ubuntu VM via Ansible
- **K3s Deployment:** Currently done via `deploy.sh` bash script
- **Environment:** Two local VMs running on macOS (Ansible Controller on Mac, Jenkins + K3s on Ubuntu VM)

### Target State
- **Ansible:** Handles infrastructure provisioning (K3s, Helm, Vault setup)
- **Jenkins:** Handles application deployments via CI/CD pipelines
- **Separation of Concerns:** Infrastructure as Code vs. Continuous Deployment

---

## 🎯 Scope Division

### Phase 1: Ansible Responsibilities (Infrastructure)
```
┌─────────────────────────────────────────────────────┐
│               Ansible Playbooks                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✓ Install K3s cluster                             │
│  ✓ Install kubectl                                 │
│  ✓ Install Helm 3                                  │
│  ✓ Configure KUBECONFIG                            │
│  ✓ Deploy Vault Agent Injector (Helm)             │
│  ✓ Deploy Vault StatefulSet                       │
│  ✓ Initialize Vault (secrets, policies, auth)     │
│  ✓ Deploy infrastructure components:              │
│     - Namespace creation                           │
│     - Service accounts                             │
│     - PostgreSQL                                   │
│     - Kafka + Zookeeper                            │
│     - Redis                                        │
│  ✓ Deploy monitoring:                              │
│     - Prometheus                                   │
│  ✓ Configure Ingress controller                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Phase 2: Jenkins Responsibilities (Applications)
```
┌─────────────────────────────────────────────────────┐
│              Jenkins Pipelines                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ✓ Pull Docker images from registry               │
│  ✓ Deploy application services:                   │
│     - API Gateway                                  │
│     - User Service                                 │
│     - Product Service                              │
│     - Order Service                                │
│     - Notification Worker                          │
│     - Chaos Service                                │
│     - Metrics Generator                            │
│     - Frontend                                     │
│  ✓ Run health checks                               │
│  ✓ Verify deployments                              │
│  ✓ Rollback on failure                             │
│  ✓ Send notifications                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Proposed Directory Structure

```
CloudCartOps/
├── ansible/
│   ├── ANSIBLE_README.md
│   ├── inventories.yml                    # Updated with k3s host
│   ├── install_jenkins.yml                # Existing
│   ├── setup_k3s_infrastructure.yml       # NEW: Main playbook
│   │
│   └── roles/
│       ├── jenkins/                       # Existing
│       │   ├── tasks/
│       │   └── vars/
│       │
│       ├── k3s/                           # NEW ROLE
│       │   ├── tasks/
│       │   │   ├── main.yml              # Install k3s, kubectl, helm
│       │   │   ├── install_k3s.yml
│       │   │   ├── install_kubectl.yml
│       │   │   └── install_helm.yml
│       │   ├── vars/
│       │   │   └── main.yml              # k3s version, configs
│       │   ├── templates/
│       │   │   └── kubeconfig.j2
│       │   └── handlers/
│       │       └── main.yml              # Restart k3s service
│       │
│       ├── vault-setup/                   # NEW ROLE
│       │   ├── tasks/
│       │   │   ├── main.yml
│       │   │   ├── install_vault_injector.yml
│       │   │   ├── deploy_vault.yml
│       │   │   └── initialize_vault.yml
│       │   ├── vars/
│       │   │   └── main.yml              # Vault configs
│       │   ├── files/
│       │   │   └── init-vault.sh         # From k8s/scripts/
│       │   └── templates/
│       │       ├── vault-statefulset.yaml.j2
│       │       └── vault-service.yaml.j2
│       │
│       ├── k8s-infrastructure/            # NEW ROLE
│       │   ├── tasks/
│       │   │   ├── main.yml
│       │   │   ├── create_namespace.yml
│       │   │   ├── deploy_postgres.yml
│       │   │   ├── deploy_kafka.yml
│       │   │   ├── deploy_redis.yml
│       │   │   └── deploy_prometheus.yml
│       │   ├── vars/
│       │   │   └── main.yml
│       │   └── files/
│       │       └── k8s/                   # K8s manifests from k8s/base/
│       │           ├── namespace/
│       │           ├── postgres/
│       │           ├── kafka/
│       │           ├── redis/
│       │           └── prometheus/
│       │
│       └── ingress/                       # NEW ROLE
│           ├── tasks/
│           │   └── main.yml
│           ├── templates/
│           │   └── ingress.yaml.j2
│           └── files/
│               └── update-hosts.sh
│
├── jenkins/                                # NEW DIRECTORY
│   ├── README.md
│   ├── Jenkinsfile                        # Main pipeline
│   ├── Jenkinsfile.deploy                 # App deployment
│   ├── Jenkinsfile.rollback               # Rollback pipeline
│   ├── scripts/
│   │   ├── deploy-apps.sh                 # Deploy all apps
│   │   ├── health-check.sh                # Health checks
│   │   └── verify-deployment.sh           # Verification
│   └── pipelines/
│       ├── deploy-api-gateway.groovy
│       ├── deploy-user-service.groovy
│       ├── deploy-product-service.groovy
│       ├── deploy-order-service.groovy
│       ├── deploy-notification-worker.groovy
│       ├── deploy-chaos-service.groovy
│       ├── deploy-metrics-generator.groovy
│       ├── deploy-frontend.groovy
│       └── deploy-all-services.groovy
│
└── k8s/
    ├── base/
    │   ├── api-gateway/
    │   ├── user-service/
    │   ├── product-service/
    │   ├── order-service/
    │   ├── notification-worker/
    │   ├── chaos-service/
    │   ├── metrics-generator/
    │   └── frontend/
    ├── overlays/
    │   ├── dev/
    │   └── prod/
    └── deploy.sh                          # DEPRECATED (reference only)
```

---

## 🔧 Implementation Details

### 1. Ansible Role: k3s

**Purpose:** Install and configure K3s cluster

**Tasks:**
```yaml
# roles/k3s/tasks/main.yml
---
- name: Update apt cache
  apt:
    update_cache: yes
  become: true

- name: Install prerequisites
  apt:
    name:
      - curl
      - apt-transport-https
      - ca-certificates
    state: present
  become: true

- name: Check if K3s is already installed
  command: which k3s
  register: k3s_check
  ignore_errors: true
  changed_when: false

- name: Install K3s
  shell: |
    curl -sfL https://get.k3s.io | sh -
  become: true
  when: k3s_check.rc != 0

- name: Set proper permissions on kubeconfig
  file:
    path: /etc/rancher/k3s/k3s.yaml
    mode: '0644'
  become: true

- name: Add KUBECONFIG to bashrc
  lineinfile:
    path: "{{ ansible_env.HOME }}/.bashrc"
    line: 'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml'
    create: yes

- name: Wait for K3s to be ready
  command: kubectl get nodes
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml
  retries: 10
  delay: 5
  register: result
  until: result.rc == 0
  become: true

- name: Install kubectl
  get_url:
    url: "https://dl.k8s.io/release/{{ kubectl_version }}/bin/linux/{{ ansible_architecture }}/kubectl"
    dest: /usr/local/bin/kubectl
    mode: '0755'
  become: true

- name: Install Helm
  shell: |
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  become: true
  args:
    creates: /usr/local/bin/helm
```

**Variables:**
```yaml
# roles/k3s/vars/main.yml
---
kubectl_version: "v1.28.0"
k3s_version: "latest"
kubeconfig_path: "/etc/rancher/k3s/k3s.yaml"
```

---

### 2. Ansible Role: vault-setup

**Purpose:** Deploy and initialize HashiCorp Vault

**Tasks:**
```yaml
# roles/vault-setup/tasks/main.yml
---
- name: Add HashiCorp Helm repository
  command: helm repo add hashicorp https://helm.releases.hashicorp.com
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Update Helm repositories
  command: helm repo update
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Check if Vault namespace exists
  command: kubectl get namespace {{ namespace }}
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml
  register: namespace_check
  ignore_errors: true
  changed_when: false

- name: Create namespace if not exists
  command: kubectl create namespace {{ namespace }}
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml
  when: namespace_check.rc != 0

- name: Install Vault Agent Injector via Helm
  command: >
    helm upgrade --install vault hashicorp/vault 
    --namespace {{ namespace }}
    --set "injector.enabled=true"
    --set "injector.externalVaultAddr=http://vault:8200"
    --set "server.enabled=false"
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Wait for Vault Agent Injector to be ready
  command: >
    kubectl wait --for=condition=ready pod 
    -l app.kubernetes.io/name=vault-agent-injector 
    -n {{ namespace }} --timeout=300s
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Deploy Vault StatefulSet
  command: kubectl apply -k {{ vault_manifest_path }}
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Wait for Vault pod to be ready
  command: kubectl wait --for=condition=ready pod vault-0 -n {{ namespace }} --timeout=300s
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Copy Vault initialization script
  copy:
    src: init-vault.sh
    dest: /tmp/init-vault.sh
    mode: '0755'

- name: Initialize Vault with secrets
  shell: |
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    /tmp/init-vault.sh
  args:
    executable: /bin/bash
```

---

### 3. Ansible Role: k8s-infrastructure

**Purpose:** Deploy stateful services (PostgreSQL, Kafka, Redis, Prometheus)

**Tasks:**
```yaml
# roles/k8s-infrastructure/tasks/main.yml
---
- name: Deploy common resources (service accounts)
  command: kubectl apply -k {{ role_path }}/files/k8s/common/
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Deploy PostgreSQL
  command: kubectl apply -k {{ role_path }}/files/k8s/postgres/
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Wait for PostgreSQL to be ready
  command: kubectl wait --for=condition=ready pod postgres-0 -n {{ namespace }} --timeout=300s
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Deploy Kafka and Zookeeper
  command: kubectl apply -k {{ role_path }}/files/k8s/kafka/
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Wait for Zookeeper
  command: kubectl wait --for=condition=ready pod -l app=zookeeper -n {{ namespace }} --timeout=180s
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Wait for Kafka
  command: kubectl wait --for=condition=ready pod -l app=kafka -n {{ namespace }} --timeout=300s
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Deploy Redis
  command: kubectl apply -k {{ role_path }}/files/k8s/redis/
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Wait for Redis
  command: kubectl wait --for=condition=ready pod -l app=redis -n {{ namespace }} --timeout=180s
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Deploy Prometheus
  command: kubectl apply -k {{ role_path }}/files/k8s/prometheus/
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml

- name: Wait for Prometheus
  command: kubectl wait --for=condition=ready pod -l app=prometheus -n {{ namespace }} --timeout=180s
  environment:
    KUBECONFIG: /etc/rancher/k3s/k3s.yaml
```

---

### 4. Main Ansible Playbook

**File:** `ansible/setup_k3s_infrastructure.yml`

```yaml
---
- name: Setup CloudCartOps K3s Infrastructure
  hosts: k3s
  become: true
  gather_facts: yes
  
  vars:
    namespace: cloudcart
    vault_manifest_path: /tmp/vault-manifests
    
  roles:
    - role: k3s
      tags: ['k3s', 'setup']
      
    - role: vault-setup
      tags: ['vault', 'security']
      
    - role: k8s-infrastructure
      tags: ['infrastructure', 'database', 'messaging']
      
    - role: ingress
      tags: ['ingress', 'networking']

  post_tasks:
    - name: Display cluster information
      debug:
        msg: |
          =========================================
          K3s Infrastructure Setup Complete!
          =========================================
          
          Cluster Status:
            - Namespace: {{ namespace }}
            - Vault: http://vault.cloudcart.local
            - Prometheus: http://prometheus.cloudcart.local
          
          Next Steps:
            1. Verify infrastructure: kubectl get pods -n {{ namespace }}
            2. Run Jenkins deployment pipeline
            3. Access applications via ingress
          
          =========================================
```

---

### 5. Updated Inventory File

**File:** `ansible/inventories.yml`

```yaml
all:
  children:
    cicd:
      hosts:
        jenkins:
          ansible_host: 192.168.1.100  # Your Jenkins VM IP
          role: cd-node
          owner: animesh28
          
    k3s_cluster:
      hosts:
        k3s:
          ansible_host: 192.168.1.100  # Same VM or different
          ansible_user: ubuntu
          ansible_become: true
          ansible_python_interpreter: /usr/bin/python3
          
  vars:
    ansible_ssh_common_args: '-o StrictHostKeyChecking=no'
```

---

## 🚀 Jenkins Pipeline Strategy

### Pipeline 1: Infrastructure Verification

**Purpose:** Verify infrastructure is ready before deployment

**File:** `jenkins/Jenkinsfile.verify`

```groovy
pipeline {
    agent any
    
    environment {
        KUBECONFIG = '/etc/rancher/k3s/k3s.yaml'
        NAMESPACE = 'cloudcart'
    }
    
    stages {
        stage('Verify K3s Cluster') {
            steps {
                script {
                    sh '''
                        kubectl cluster-info
                        kubectl get nodes
                    '''
                }
            }
        }
        
        stage('Verify Infrastructure Pods') {
            steps {
                script {
                    sh '''
                        echo "Checking infrastructure components..."
                        kubectl get pods -n $NAMESPACE
                        
                        # Check Vault
                        kubectl wait --for=condition=ready pod vault-0 -n $NAMESPACE --timeout=60s
                        
                        # Check PostgreSQL
                        kubectl wait --for=condition=ready pod postgres-0 -n $NAMESPACE --timeout=60s
                        
                        # Check Kafka
                        kubectl wait --for=condition=ready pod -l app=kafka -n $NAMESPACE --timeout=60s
                        
                        # Check Redis
                        kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=60s
                        
                        echo "✓ All infrastructure components are ready!"
                    '''
                }
            }
        }
        
        stage('Verify Vault Configuration') {
            steps {
                script {
                    sh '''
                        # Check if Vault is initialized
                        kubectl exec -n $NAMESPACE vault-0 -- vault status || true
                        
                        # Verify secrets exist
                        kubectl exec -n $NAMESPACE vault-0 -- \
                            vault kv get cloudcart/database || \
                            echo "WARNING: Database secrets not found"
                    '''
                }
            }
        }
    }
    
    post {
        success {
            echo '✓ Infrastructure verification passed!'
        }
        failure {
            echo '✗ Infrastructure verification failed!'
            sh 'kubectl get pods -n $NAMESPACE'
            sh 'kubectl get events -n $NAMESPACE --sort-by=.lastTimestamp | tail -20'
        }
    }
}
```

---

### Pipeline 2: Application Deployment

**Purpose:** Deploy all application services

**File:** `jenkins/Jenkinsfile.deploy`

```groovy
pipeline {
    agent any
    
    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['dev', 'prod'],
            description: 'Deployment environment'
        )
        string(
            name: 'IMAGE_TAG',
            defaultValue: 'latest',
            description: 'Docker image tag to deploy'
        )
        booleanParam(
            name: 'SKIP_HEALTH_CHECK',
            defaultValue: false,
            description: 'Skip health checks after deployment'
        )
    }
    
    environment {
        KUBECONFIG = '/etc/rancher/k3s/k3s.yaml'
        NAMESPACE = 'cloudcart'
        DOCKER_REGISTRY = 'anisingh28'
        IMAGE_PREFIX = 'cloudcartops'
    }
    
    stages {
        stage('Pre-deployment Check') {
            steps {
                script {
                    echo "Deploying to: ${params.ENVIRONMENT}"
                    echo "Image tag: ${params.IMAGE_TAG}"
                    
                    sh '''
                        kubectl cluster-info
                        kubectl get pods -n $NAMESPACE | grep -E "vault|postgres|kafka|redis" || {
                            echo "ERROR: Infrastructure not ready!"
                            exit 1
                        }
                    '''
                }
            }
        }
        
        stage('Deploy Application Services') {
            parallel {
                stage('Deploy API Gateway') {
                    steps {
                        script {
                            sh """
                                kubectl apply -k k8s/base/api-gateway/
                                kubectl set image deployment/api-gateway \
                                    api-gateway=${DOCKER_REGISTRY}/${IMAGE_PREFIX}-api-gateway:${params.IMAGE_TAG} \
                                    -n ${NAMESPACE}
                            """
                        }
                    }
                }
                
                stage('Deploy User Service') {
                    steps {
                        script {
                            sh """
                                kubectl apply -k k8s/base/user-service/
                                kubectl set image deployment/user-service \
                                    user-service=${DOCKER_REGISTRY}/${IMAGE_PREFIX}-user-service:${params.IMAGE_TAG} \
                                    -n ${NAMESPACE}
                            """
                        }
                    }
                }
                
                stage('Deploy Product Service') {
                    steps {
                        script {
                            sh """
                                kubectl apply -k k8s/base/product-service/
                                kubectl set image deployment/product-service \
                                    product-service=${DOCKER_REGISTRY}/${IMAGE_PREFIX}-product-service:${params.IMAGE_TAG} \
                                    -n ${NAMESPACE}
                            """
                        }
                    }
                }
                
                stage('Deploy Order Service') {
                    steps {
                        script {
                            sh """
                                kubectl apply -k k8s/base/order-service/
                                kubectl set image deployment/order-service \
                                    order-service=${DOCKER_REGISTRY}/${IMAGE_PREFIX}-order-service:${params.IMAGE_TAG} \
                                    -n ${NAMESPACE}
                            """
                        }
                    }
                }
                
                stage('Deploy Notification Worker') {
                    steps {
                        script {
                            sh """
                                kubectl apply -k k8s/base/notification-worker/
                                kubectl set image deployment/notification-worker \
                                    notification-worker=${DOCKER_REGISTRY}/${IMAGE_PREFIX}-notification-worker:${params.IMAGE_TAG} \
                                    -n ${NAMESPACE}
                            """
                        }
                    }
                }
                
                stage('Deploy Chaos Service') {
                    steps {
                        script {
                            sh """
                                kubectl apply -k k8s/base/chaos-service/
                                kubectl set image deployment/chaos-service \
                                    chaos-service=${DOCKER_REGISTRY}/${IMAGE_PREFIX}-chaos-service:${params.IMAGE_TAG} \
                                    -n ${NAMESPACE}
                            """
                        }
                    }
                }
                
                stage('Deploy Metrics Generator') {
                    steps {
                        script {
                            sh """
                                kubectl apply -k k8s/base/metrics-generator/
                                kubectl set image deployment/metrics-generator \
                                    metrics-generator=${DOCKER_REGISTRY}/${IMAGE_PREFIX}-metrics-generator:${params.IMAGE_TAG} \
                                    -n ${NAMESPACE}
                            """
                        }
                    }
                }
                
                stage('Deploy Frontend') {
                    steps {
                        script {
                            sh """
                                kubectl apply -k k8s/base/frontend/
                                kubectl set image deployment/frontend \
                                    frontend=${DOCKER_REGISTRY}/${IMAGE_PREFIX}-frontend:${params.IMAGE_TAG} \
                                    -n ${NAMESPACE}
                            """
                        }
                    }
                }
            }
        }
        
        stage('Wait for Rollout') {
            steps {
                script {
                    sh '''
                        echo "Waiting for deployments to complete..."
                        
                        kubectl rollout status deployment/api-gateway -n $NAMESPACE --timeout=300s
                        kubectl rollout status deployment/user-service -n $NAMESPACE --timeout=300s
                        kubectl rollout status deployment/product-service -n $NAMESPACE --timeout=300s
                        kubectl rollout status deployment/order-service -n $NAMESPACE --timeout=300s
                        kubectl rollout status deployment/notification-worker -n $NAMESPACE --timeout=300s
                        kubectl rollout status deployment/chaos-service -n $NAMESPACE --timeout=300s
                        kubectl rollout status deployment/metrics-generator -n $NAMESPACE --timeout=300s
                        kubectl rollout status deployment/frontend -n $NAMESPACE --timeout=300s
                        
                        echo "✓ All deployments completed successfully!"
                    '''
                }
            }
        }
        
        stage('Health Checks') {
            when {
                expression { !params.SKIP_HEALTH_CHECK }
            }
            steps {
                script {
                    sh '''
                        echo "Running health checks..."
                        
                        # Get pod names
                        API_POD=$(kubectl get pod -l app=api-gateway -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}')
                        USER_POD=$(kubectl get pod -l app=user-service -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}')
                        PRODUCT_POD=$(kubectl get pod -l app=product-service -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}')
                        ORDER_POD=$(kubectl get pod -l app=order-service -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}')
                        
                        # Health check API Gateway
                        kubectl exec -n $NAMESPACE $API_POD -- wget -q -O- http://localhost:3000/health || {
                            echo "WARNING: API Gateway health check failed"
                        }
                        
                        # Health check User Service
                        kubectl exec -n $NAMESPACE $USER_POD -- python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || {
                            echo "WARNING: User Service health check failed"
                        }
                        
                        # Check all pods are running
                        kubectl get pods -n $NAMESPACE
                        
                        echo "✓ Health checks completed!"
                    '''
                }
            }
        }
    }
    
    post {
        success {
            echo '✓ Deployment successful!'
            sh 'kubectl get pods -n $NAMESPACE -o wide'
        }
        failure {
            echo '✗ Deployment failed!'
            sh '''
                kubectl get pods -n $NAMESPACE
                kubectl get events -n $NAMESPACE --sort-by=.lastTimestamp | tail -30
                
                echo "Failed pod logs:"
                for pod in $(kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running -o name 2>/dev/null); do
                    echo "=== Logs for $pod ==="
                    kubectl logs $pod -n $NAMESPACE --tail=50 || true
                done
            '''
        }
        always {
            archiveArtifacts artifacts: '**/logs/*.log', allowEmptyArchive: true
        }
    }
}
```

---

### Pipeline 3: Rollback

**File:** `jenkins/Jenkinsfile.rollback`

```groovy
pipeline {
    agent any
    
    parameters {
        string(
            name: 'REVISION',
            defaultValue: '0',
            description: 'Revision number to rollback to (0 = previous revision)'
        )
        choice(
            name: 'SERVICE',
            choices: ['all', 'api-gateway', 'user-service', 'product-service', 'order-service', 'notification-worker', 'chaos-service', 'metrics-generator', 'frontend'],
            description: 'Service to rollback'
        )
    }
    
    environment {
        KUBECONFIG = '/etc/rancher/k3s/k3s.yaml'
        NAMESPACE = 'cloudcart'
    }
    
    stages {
        stage('Rollback Confirmation') {
            steps {
                script {
                    echo "Rolling back ${params.SERVICE} to revision ${params.REVISION}"
                    
                    input message: 'Proceed with rollback?', ok: 'Yes, rollback'
                }
            }
        }
        
        stage('Execute Rollback') {
            steps {
                script {
                    if (params.SERVICE == 'all') {
                        sh '''
                            kubectl rollout undo deployment/api-gateway -n $NAMESPACE
                            kubectl rollout undo deployment/user-service -n $NAMESPACE
                            kubectl rollout undo deployment/product-service -n $NAMESPACE
                            kubectl rollout undo deployment/order-service -n $NAMESPACE
                            kubectl rollout undo deployment/notification-worker -n $NAMESPACE
                            kubectl rollout undo deployment/chaos-service -n $NAMESPACE
                            kubectl rollout undo deployment/metrics-generator -n $NAMESPACE
                            kubectl rollout undo deployment/frontend -n $NAMESPACE
                        '''
                    } else {
                        sh """
                            kubectl rollout undo deployment/${params.SERVICE} -n ${NAMESPACE}
                        """
                    }
                }
            }
        }
        
        stage('Verify Rollback') {
            steps {
                script {
                    sh '''
                        echo "Verifying rollback..."
                        kubectl get pods -n $NAMESPACE
                        
                        sleep 10
                        
                        kubectl get pods -n $NAMESPACE -o wide
                    '''
                }
            }
        }
    }
}
```

---

## 📝 Execution Steps

### Step 1: Update Inventory

```bash
# Edit ansible/inventories.yml with your VM IP addresses
vim ansible/inventories.yml
```

### Step 2: Run Ansible Playbook

```bash
# From your Mac (Ansible controller)
cd ansible

# Test connection
ansible -i inventories.yml k3s -m ping

# Run infrastructure setup
ansible-playbook -i inventories.yml setup_k3s_infrastructure.yml -v

# Or run specific parts
ansible-playbook -i inventories.yml setup_k3s_infrastructure.yml --tags k3s
ansible-playbook -i inventories.yml setup_k3s_infrastructure.yml --tags vault
ansible-playbook -i inventories.yml setup_k3s_infrastructure.yml --tags infrastructure
```

### Step 3: Configure Jenkins

1. **Install Required Plugins:**
   - Kubernetes CLI Plugin
   - Pipeline Plugin
   - Git Plugin
   - Docker Pipeline Plugin

2. **Configure Credentials:**
   ```
   Jenkins > Manage Jenkins > Credentials
   
   Add:
   - SSH key for K3s VM access
   - Docker Hub credentials (if needed)
   - Kubeconfig file
   ```

3. **Create Jenkins Jobs:**
   ```
   New Item > Pipeline
   
   Jobs to create:
   1. "cloudcart-verify-infrastructure"
   2. "cloudcart-deploy-apps"
   3. "cloudcart-rollback"
   ```

4. **Configure Pipeline Scripts:**
   - Point to Jenkinsfile paths in Git repo
   - Or paste pipeline scripts directly

### Step 4: Run First Deployment

```bash
# In Jenkins UI:
1. Run "cloudcart-verify-infrastructure" job
2. If successful, run "cloudcart-deploy-apps" job
3. Monitor deployment in Jenkins console output
```

---

## 🔍 Verification Checklist

### After Ansible Execution
- [ ] K3s cluster is running: `kubectl get nodes`
- [ ] Namespace created: `kubectl get ns cloudcart`
- [ ] Vault pod ready: `kubectl get pod vault-0 -n cloudcart`
- [ ] PostgreSQL ready: `kubectl get pod postgres-0 -n cloudcart`
- [ ] Kafka ready: `kubectl get pod -l app=kafka -n cloudcart`
- [ ] Redis ready: `kubectl get pod -l app=redis -n cloudcart`
- [ ] Prometheus ready: `kubectl get pod -l app=prometheus -n cloudcart`
- [ ] Vault initialized: `kubectl exec -n cloudcart vault-0 -- vault status`

### After Jenkins Deployment
- [ ] All app pods running: `kubectl get pods -n cloudcart`
- [ ] Services accessible: `kubectl get svc -n cloudcart`
- [ ] Ingress configured: `kubectl get ingress -n cloudcart`
- [ ] Health checks pass
- [ ] Applications accessible via browser

---

## 🚦 Next Steps

1. **Create Ansible Roles:**
   - [ ] Create `roles/k3s` directory structure
   - [ ] Create `roles/vault-setup` directory structure
   - [ ] Create `roles/k8s-infrastructure` directory structure
   - [ ] Create `roles/ingress` directory structure

2. **Copy K8s Manifests:**
   - [ ] Copy manifests from `k8s/base/` to `roles/k8s-infrastructure/files/k8s/`
   - [ ] Copy `init-vault.sh` to `roles/vault-setup/files/`

3. **Create Jenkins Directory:**
   - [ ] Create `jenkins/` directory
   - [ ] Add Jenkinsfiles
   - [ ] Add helper scripts

4. **Update Inventory:**
   - [ ] Add K3s VM IP address
   - [ ] Configure SSH access

5. **Test Ansible Playbook:**
   - [ ] Run playbook against test VM
   - [ ] Verify infrastructure deployment
   - [ ] Document any issues

6. **Configure Jenkins:**
   - [ ] Install plugins
   - [ ] Create credentials
   - [ ] Create pipeline jobs
   - [ ] Test deployment pipeline

---

## 📚 Additional Information Needed

Before implementation, please provide:

1. **VM IP Addresses:**
   - Jenkins VM IP: `____________`
   - K3s VM IP: `____________` (same as Jenkins or different?)

2. **SSH Access:**
   - Username for VMs: `____________`
   - SSH key location: `____________`

3. **Architecture Preference:**
   - Single VM for both Jenkins + K3s? Yes/No
   - Separate VMs? Yes/No

4. **Docker Registry:**
   - Continue using Docker Hub (anisingh28)? Yes/No
   - Set up private registry? Yes/No

5. **Environment:**
   - Start with dev environment? Yes/No
   - Deploy to prod immediately? Yes/No

---

## 🎯 Success Criteria

- ✅ Ansible playbook successfully sets up K3s + infrastructure
- ✅ Vault is initialized with all secrets
- ✅ Jenkins can connect to K3s cluster
- ✅ Jenkins pipeline deploys all 8 microservices
- ✅ All health checks pass
- ✅ Applications accessible via ingress
- ✅ Monitoring (Prometheus) is functional
- ✅ Rollback capability works

---

**Ready to proceed with implementation?**

Let me know:
1. If this plan looks good
2. Any modifications needed
3. The information requested above
4. Which component to build first
