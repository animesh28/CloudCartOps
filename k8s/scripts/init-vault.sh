#!/bin/bash

set -e

NAMESPACE="cloudcart"
VAULT_POD="vault-0"

echo "=========================================="
echo "Initializing HashiCorp Vault for K8s"
echo "=========================================="

wait_for_vault() {
    echo "Waiting for Vault to be ready..."
    kubectl wait --for=condition=ready pod/${VAULT_POD} -n ${NAMESPACE} --timeout=300s
    sleep 5
}

enable_kubernetes_auth() {
    echo "Enabling Kubernetes authentication..."
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault auth enable kubernetes 2>/dev/null || echo "Kubernetes auth already enabled"
    
    KUBERNETES_HOST="https://kubernetes.default.svc"
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- sh -c "
        vault write auth/kubernetes/config \
            kubernetes_host=\"${KUBERNETES_HOST}\" \
            kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
            token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token
    "
    
    echo "✓ Kubernetes auth configured"
}

create_secrets() {
    echo "Creating application secrets in Vault..."
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault secrets enable -path=cloudcart kv-v2 2>/dev/null || echo "KV engine already enabled"
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault kv put cloudcart/database \
        postgres_user=cloudcart \
        postgres_password=cloudcart123 \
        postgres_db=cloudcart \
        postgres_host=postgres.cloudcart.svc.cluster.local \
        postgres_port=5432 \
        database_url="postgresql://cloudcart:cloudcart123@postgres.cloudcart.svc.cluster.local:5432/cloudcart?sslmode=disable"
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault kv put cloudcart/jwt \
        secret=your-super-secret-jwt-key-change-in-production-$(date +%s)
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault kv put cloudcart/kafka \
        bootstrap_servers=kafka.cloudcart.svc.cluster.local:9092
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault kv put cloudcart/redis \
        url=redis://redis.cloudcart.svc.cluster.local:6379
    
    echo "✓ Secrets created in Vault"
}

create_policies() {
    echo "Creating Vault policies..."
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- sh -c 'cat > /tmp/database-policy.hcl <<EOF
path "cloudcart/data/database" {
  capabilities = ["read"]
}
EOF'
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault policy write database-policy /tmp/database-policy.hcl
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- sh -c 'cat > /tmp/app-policy.hcl <<EOF
path "cloudcart/data/database" {
  capabilities = ["read"]
}
path "cloudcart/data/jwt" {
  capabilities = ["read"]
}
path "cloudcart/data/kafka" {
  capabilities = ["read"]
}
path "cloudcart/data/redis" {
  capabilities = ["read"]
}
EOF'
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault policy write app-policy /tmp/app-policy.hcl
    
    echo "✓ Policies created"
}

create_roles() {
    echo "Creating Vault roles for services..."
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault write auth/kubernetes/role/postgres \
        bound_service_account_names=postgres \
        bound_service_account_namespaces=${NAMESPACE} \
        policies=database-policy \
        ttl=24h
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault write auth/kubernetes/role/api-gateway \
        bound_service_account_names=api-gateway \
        bound_service_account_namespaces=${NAMESPACE} \
        policies=app-policy \
        ttl=24h
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault write auth/kubernetes/role/user-service \
        bound_service_account_names=user-service \
        bound_service_account_namespaces=${NAMESPACE} \
        policies=app-policy \
        ttl=24h
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault write auth/kubernetes/role/product-service \
        bound_service_account_names=product-service \
        bound_service_account_namespaces=${NAMESPACE} \
        policies=app-policy \
        ttl=24h
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault write auth/kubernetes/role/order-service \
        bound_service_account_names=order-service \
        bound_service_account_namespaces=${NAMESPACE} \
        policies=app-policy \
        ttl=24h
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault write auth/kubernetes/role/notification-worker \
        bound_service_account_names=notification-worker \
        bound_service_account_namespaces=${NAMESPACE} \
        policies=app-policy \
        ttl=24h
    
    echo "✓ Roles created for all services"
}

verify_setup() {
    echo "Verifying Vault setup..."
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault kv get cloudcart/database
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault policy list
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault auth list
    
    echo "✓ Vault setup verified"
}

case "${1:-all}" in
    wait)
        wait_for_vault
        ;;
    auth)
        enable_kubernetes_auth
        ;;
    secrets)
        create_secrets
        ;;
    policies)
        create_policies
        ;;
    roles)
        create_roles
        ;;
    verify)
        verify_setup
        ;;
    all)
        wait_for_vault
        enable_kubernetes_auth
        create_secrets
        create_policies
        create_roles
        verify_setup
        ;;
    *)
        echo "Usage: $0 {wait|auth|secrets|policies|roles|verify|all}"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "Vault initialization complete!"
echo "=========================================="
echo ""
echo "Vault is now configured with:"
echo "  - Kubernetes authentication enabled"
echo "  - Application secrets stored"
echo "  - Policies for access control"
echo "  - Roles for service accounts"
echo ""
echo "Services can now use Vault annotations to inject secrets"
echo ""
