#!/bin/bash

set -e

NAMESPACE="cloudcart"
VAULT_POD="vault-0"

echo "=========================================="
echo "Initializing HashiCorp Vault for K8s"
echo "=========================================="

wait_for_vault() {
    echo "Waiting for Vault pod to be running..."
    # Don't wait for "ready" - Vault won't be ready until initialized
    # Just wait for the pod to exist and be running
    for i in {1..60}; do
        if kubectl get pod ${VAULT_POD} -n ${NAMESPACE} &> /dev/null; then
            POD_STATUS=$(kubectl get pod ${VAULT_POD} -n ${NAMESPACE} -o jsonpath='{.status.phase}')
            if [ "$POD_STATUS" = "Running" ]; then
                echo "✓ Vault pod is running"
                sleep 5
                return 0
            fi
        fi
        echo "Waiting for Vault pod... (attempt $i/60)"
        sleep 2
    done
    echo "ERROR: Vault pod did not start"
    return 1
}

initialize_vault() {
    echo "Using Vault in dev mode (auto-unsealed)..."
    echo "Logging in with root token..."
    
    # Dev mode uses token 'root' by default
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault login root
    
    echo "✓ Vault ready (dev mode)"
    echo "Root Token: root"
}

enable_kubernetes_auth() {
    echo "Enabling Kubernetes authentication..."
    
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- vault auth enable kubernetes 2>/dev/null || echo "Kubernetes auth already enabled"
    
    KUBERNETES_HOST="https://kubernetes.default.svc"
    
    # Get the vault service account token
    echo "Getting Vault service account token for Kubernetes auth..."
    TOKEN_NAME=$(kubectl get sa vault -n ${NAMESPACE} -o jsonpath='{.secrets[0].name}' 2>/dev/null)
    
    if [ -z "$TOKEN_NAME" ]; then
        echo "No auto-generated token found. Creating a token for vault service account..."
        # Kubernetes 1.24+ doesn't auto-create tokens, so we create one
        kubectl create token vault -n ${NAMESPACE} --duration=87600h > /tmp/vault-token.txt
        VAULT_SA_TOKEN=$(cat /tmp/vault-token.txt)
        rm /tmp/vault-token.txt
    else
        echo "Using existing service account secret: $TOKEN_NAME"
        VAULT_SA_TOKEN=$(kubectl get secret ${TOKEN_NAME} -n ${NAMESPACE} -o jsonpath='{.data.token}' | base64 -d)
    fi
    
    # Get the CA certificate
    KUBE_CA_CERT=$(kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- cat /var/run/secrets/kubernetes.io/serviceaccount/ca.crt)
    
    # Configure Kubernetes auth with the token
    kubectl exec -n ${NAMESPACE} ${VAULT_POD} -- sh -c "
        vault write auth/kubernetes/config \
            kubernetes_host=\"${KUBERNETES_HOST}\" \
            kubernetes_ca_cert=\"${KUBE_CA_CERT}\" \
            token_reviewer_jwt=\"${VAULT_SA_TOKEN}\" \
            disable_iss_validation=true
    "
    
    echo "✓ Kubernetes auth configured with vault service account token"
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
        initialize_vault
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
