#!/bin/bash
# Verification script for Jenkins K8s access
# Run this on the Jenkins VM after the playbook completes

set -e

JENKINS_USER="jenkins"
KUBECONFIG_PATH="/home/${JENKINS_USER}/.kube/config"

echo "==========================================="
echo "Verifying Jenkins K8s Access"
echo "==========================================="
echo ""

# Check if kubeconfig exists
if [ ! -f "$KUBECONFIG_PATH" ]; then
    echo "❌ ERROR: kubeconfig not found at $KUBECONFIG_PATH"
    exit 1
fi

echo "✓ Kubeconfig file exists: $KUBECONFIG_PATH"
echo ""

# Check kubeconfig permissions
PERMS=$(stat -c "%a" "$KUBECONFIG_PATH" 2>/dev/null || stat -f "%A" "$KUBECONFIG_PATH" 2>/dev/null)
echo "  Permissions: $PERMS"
echo "  Owner: $(stat -c "%U:%G" "$KUBECONFIG_PATH" 2>/dev/null || stat -f "%Su:%Sg" "$KUBECONFIG_PATH" 2>/dev/null)"
echo ""

# Show server address in kubeconfig
echo "Kubeconfig server address:"
grep "server:" "$KUBECONFIG_PATH" || echo "  ERROR: Could not read server address"
echo ""

# Test kubectl as jenkins user
echo "Testing kubectl access as ${JENKINS_USER} user..."
echo ""

sudo su - ${JENKINS_USER} -c "kubectl version --client" && echo "✓ kubectl client working" || echo "❌ kubectl client failed"
echo ""

sudo su - ${JENKINS_USER} -c "kubectl cluster-info" && echo "✓ Cluster connection successful" || echo "❌ Cluster connection failed"
echo ""

sudo su - ${JENKINS_USER} -c "kubectl get nodes" && echo "✓ Can access nodes" || echo "❌ Cannot access nodes"
echo ""

sudo su - ${JENKINS_USER} -c "kubectl get namespaces" && echo "✓ Can list namespaces" || echo "❌ Cannot list namespaces"
echo ""

sudo su - ${JENKINS_USER} -c "kubectl get pods -n cloudcart" && echo "✓ Can access cloudcart namespace" || echo "❌ Cannot access cloudcart namespace"
echo ""

echo "==========================================="
echo "Verification Complete!"
echo "==========================================="
