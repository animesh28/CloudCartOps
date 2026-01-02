#!/bin/bash

set -e

echo "=========================================="
echo "Jenkins Server Setup for CloudCartOps"
echo "=========================================="

JENKINS_IP="${1:-192.168.56.10}"
K3S_IP="${2:-192.168.56.11}"

setup_docker_registry() {
    echo "Setting up local Docker registry on port 5000..."
    
    docker run -d -p 5000:5000 --restart=always --name registry \
        -v registry-data:/var/lib/registry \
        registry:2 || echo "Registry already running"
    
    echo "Docker registry running at localhost:5000"
}

configure_k3s_registry() {
    echo "Configuring K3s to use insecure local registry..."
    
    ssh root@${K3S_IP} "mkdir -p /etc/rancher/k3s"
    
    cat > /tmp/registries.yaml <<EOF
mirrors:
  localhost:5000:
    endpoint:
      - "http://${JENKINS_IP}:5000"
configs:
  "${JENKINS_IP}:5000":
    insecure_skip_verify: true
EOF
    
    scp /tmp/registries.yaml root@${K3S_IP}:/etc/rancher/k3s/registries.yaml
    
    ssh root@${K3S_IP} "systemctl restart k3s"
    
    echo "K3s configured to use registry at ${JENKINS_IP}:5000"
}

setup_jenkins_plugins() {
    echo "Installing required Jenkins plugins..."
    
    JENKINS_URL="http://localhost:8080"
    
    PLUGINS=(
        "git"
        "docker-workflow"
        "kubernetes"
        "kubernetes-cli"
        "pipeline-stage-view"
        "docker-plugin"
        "workflow-aggregator"
        "blueocean"
    )
    
    for plugin in "${PLUGINS[@]}"; do
        java -jar jenkins-cli.jar -s ${JENKINS_URL} install-plugin ${plugin} || true
    done
    
    java -jar jenkins-cli.jar -s ${JENKINS_URL} safe-restart
    
    echo "Jenkins plugins installed and restarted"
}

configure_jenkins_credentials() {
    echo "Configuring Jenkins credentials..."
    
    cat <<EOF
Please configure the following in Jenkins UI (http://localhost:8080):

1. Add SSH credentials for K3s server:
   - ID: k3s-server
   - Type: SSH Username with private key
   - Username: root
   - Private Key: Copy from ~/.ssh/id_rsa

2. Install kubectl on Jenkins:
   - Copy kubeconfig from K3s server: /etc/rancher/k3s/k3s.yaml
   - Save to Jenkins: ~/.kube/config
   - Update server IP in kubeconfig to ${K3S_IP}:6443

3. Install required tools:
   - Docker
   - kubectl
   - trivy
   - git

4. Create Jenkins Pipeline:
   - New Item → Pipeline
   - Pipeline script from SCM
   - SCM: Git
   - Repository URL: /path/to/CloudCartOps
   - Script Path: Jenkinsfile
EOF
}

install_tools() {
    echo "Installing required tools on Jenkins server..."
    
    if ! command -v kubectl &> /dev/null; then
        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
        chmod +x kubectl
        sudo mv kubectl /usr/local/bin/
    fi
    
    if ! command -v trivy &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y wget apt-transport-https gnupg lsb-release
        wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
        echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
        sudo apt-get update
        sudo apt-get install -y trivy
    fi
    
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker jenkins
        sudo systemctl enable docker
        sudo systemctl start docker
    fi
    
    echo "All required tools installed"
}

copy_kubeconfig() {
    echo "Copying kubeconfig from K3s server..."
    
    ssh root@${K3S_IP} "cat /etc/rancher/k3s/k3s.yaml" > /tmp/k3s.yaml
    
    sed -i "s/127.0.0.1/${K3S_IP}/g" /tmp/k3s.yaml
    
    sudo mkdir -p /var/lib/jenkins/.kube
    sudo cp /tmp/k3s.yaml /var/lib/jenkins/.kube/config
    sudo chown -R jenkins:jenkins /var/lib/jenkins/.kube
    
    echo "Kubeconfig copied and configured for Jenkins user"
}

test_connectivity() {
    echo "Testing connectivity..."
    
    echo "Testing Docker registry..."
    curl -s http://localhost:5000/v2/_catalog && echo "✓ Docker registry accessible"
    
    echo "Testing K3s connectivity..."
    sudo -u jenkins kubectl --kubeconfig=/var/lib/jenkins/.kube/config get nodes && echo "✓ K3s accessible"
    
    echo "Testing Docker..."
    docker ps && echo "✓ Docker working"
    
    echo "All connectivity tests passed!"
}

case "${1:-all}" in
    registry)
        setup_docker_registry
        ;;
    k3s-registry)
        configure_k3s_registry
        ;;
    plugins)
        setup_jenkins_plugins
        ;;
    tools)
        install_tools
        ;;
    kubeconfig)
        copy_kubeconfig
        ;;
    test)
        test_connectivity
        ;;
    credentials)
        configure_jenkins_credentials
        ;;
    all)
        install_tools
        setup_docker_registry
        configure_k3s_registry
        copy_kubeconfig
        test_connectivity
        configure_jenkins_credentials
        ;;
    *)
        echo "Usage: $0 {registry|k3s-registry|plugins|tools|kubeconfig|test|credentials|all} [JENKINS_IP] [K3S_IP]"
        echo ""
        echo "Examples:"
        echo "  $0 all 192.168.56.10 192.168.56.11"
        echo "  $0 registry"
        echo "  $0 kubeconfig 192.168.56.10 192.168.56.11"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Access Jenkins at http://localhost:8080"
echo "2. Create new Pipeline job"
echo "3. Point to CloudCartOps repository"
echo "4. Run the pipeline"
echo ""
