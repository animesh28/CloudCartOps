# HashiCorp Vault Integration

## Overview

All sensitive information (database credentials, JWT secrets, API keys) is stored in HashiCorp Vault instead of Kubernetes Secrets. Services use Vault Agent Injector to securely retrieve secrets at runtime.

## Architecture

**Vault Configuration:**
- Deployed as StatefulSet in K3s cluster
- Kubernetes authentication enabled
- KV v2 secrets engine at path `cloudcart/`
- Service-specific policies and roles

**Secret Injection:**
- Vault Agent runs as sidecar container
- Secrets injected into `/vault/secrets/` directory
- Applications source environment variables from injected files
- Auto-renewal handled by Vault Agent

## Secrets Stored in Vault

### Database Credentials
**Path:** `cloudcart/data/database`

```yaml
postgres_user: cloudcart
postgres_password: cloudcart123
postgres_db: cloudcart
postgres_host: postgres.cloudcart.svc.cluster.local
postgres_port: 5432
database_url: postgresql://cloudcart:cloudcart123@postgres:5432/cloudcart
```

### JWT Secret
**Path:** `cloudcart/data/jwt`

```yaml
secret: your-super-secret-jwt-key-change-in-production
```

### Kafka Configuration
**Path:** `cloudcart/data/kafka`

```yaml
bootstrap_servers: kafka.cloudcart.svc.cluster.local:9092
```

### Redis Configuration
**Path:** `cloudcart/data/redis`

```yaml
url: redis://redis.cloudcart.svc.cluster.local:6379
```

## Vault Initialization

### 1. Deploy Vault

```bash
kubectl apply -k k8s/base/vault
kubectl wait --for=condition=ready pod/vault-0 -n cloudcart --timeout=300s
```

### 2. Initialize Vault Secrets

```bash
./k8s/scripts/init-vault.sh all
```

This script:
- Enables Kubernetes authentication
- Creates secrets in KV store
- Creates policies for access control
- Creates roles for service accounts

### 3. Verify Setup

```bash
kubectl exec -n cloudcart vault-0 -- vault kv get cloudcart/database
kubectl exec -n cloudcart vault-0 -- vault policy list
kubectl exec -n cloudcart vault-0 -- vault read auth/kubernetes/role/user-service
```

## Service Integration

### Service Accounts

Each service has its own Kubernetes ServiceAccount:
- `postgres`
- `api-gateway`
- `user-service`
- `product-service`
- `order-service`
- `notification-worker`

### Vault Annotations

Services use annotations to request secret injection:

```yaml
annotations:
  vault.hashicorp.com/agent-inject: "true"
  vault.hashicorp.com/role: "user-service"
  vault.hashicorp.com/agent-inject-secret-database: "cloudcart/data/database"
  vault.hashicorp.com/agent-inject-template-database: |
    {{- with secret "cloudcart/data/database" -}}
    export DATABASE_URL="{{ .Data.data.database_url }}"
    {{- end }}
```

### Secret Access

Secrets are available at `/vault/secrets/` in the container:

```bash
# PostgreSQL
source /vault/secrets/database
# Now $DATABASE_URL is available

# API Gateway
source /vault/secrets/config
# Now $JWT_SECRET is available
```

## Vault Policies

### Database Policy
**Name:** `database-policy`

```hcl
path "cloudcart/data/database" {
  capabilities = ["read"]
}
```

**Assigned to:** postgres

### Application Policy
**Name:** `app-policy`

```hcl
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
```

**Assigned to:** api-gateway, user-service, product-service, order-service, notification-worker

## Vault Roles

Each service has a dedicated Vault role:

```bash
vault write auth/kubernetes/role/user-service \
  bound_service_account_names=user-service \
  bound_service_account_namespaces=cloudcart \
  policies=app-policy \
  ttl=24h
```

## Manual Secret Management

### Add New Secret

```bash
kubectl exec -n cloudcart vault-0 -- vault kv put cloudcart/newservice \
  api_key=secret-key \
  token=secret-token
```

### Update Existing Secret

```bash
kubectl exec -n cloudcart vault-0 -- vault kv patch cloudcart/database \
  postgres_password=new-secure-password
```

### Read Secret

```bash
kubectl exec -n cloudcart vault-0 -- vault kv get cloudcart/database
```

### Delete Secret

```bash
kubectl exec -n cloudcart vault-0 -- vault kv delete cloudcart/database
```

### View Secret Versions

```bash
kubectl exec -n cloudcart vault-0 -- vault kv metadata get cloudcart/database
```

## Troubleshooting

### Check Vault Agent Status

```bash
kubectl logs -n cloudcart <pod-name> -c vault-agent
```

### Verify Secret Injection

```bash
kubectl exec -n cloudcart <pod-name> -c <container-name> -- ls -la /vault/secrets/
kubectl exec -n cloudcart <pod-name> -c <container-name> -- cat /vault/secrets/database
```

### Check Service Account Token

```bash
kubectl exec -n cloudcart <pod-name> -- cat /var/run/secrets/kubernetes.io/serviceaccount/token
```

### Vault Authentication Test

```bash
kubectl exec -n cloudcart vault-0 -- vault write auth/kubernetes/login \
  role=user-service \
  jwt=<service-account-token>
```

### Common Issues

**Secret Not Injected:**
- Verify Vault is running: `kubectl get pods -n cloudcart | grep vault`
- Check annotations on deployment
- Verify service account exists
- Check Vault role configuration

**Permission Denied:**
- Verify policy allows read access
- Check role binds correct service account
- Ensure namespace matches

**Vault Agent Init Container Fails:**
- Check Vault is accessible from pod
- Verify Kubernetes auth is enabled
- Check service account token is mounted

## Security Best Practices

1. **Rotate Secrets Regularly**
   ```bash
   kubectl exec -n cloudcart vault-0 -- vault kv patch cloudcart/database \
     postgres_password=$(openssl rand -base64 32)
   ```

2. **Use Least Privilege Policies**
   - Each service only accesses required secrets
   - Read-only access for applications
   - Admin access restricted

3. **Enable Audit Logging**
   ```bash
   kubectl exec -n cloudcart vault-0 -- vault audit enable file \
     file_path=/vault/logs/audit.log
   ```

4. **Backup Vault Data**
   ```bash
   kubectl exec -n cloudcart vault-0 -- tar czf /tmp/vault-backup.tar.gz /vault/data
   kubectl cp cloudcart/vault-0:/tmp/vault-backup.tar.gz ./vault-backup-$(date +%Y%m%d).tar.gz
   ```

5. **Monitor Secret Access**
   ```bash
   kubectl exec -n cloudcart vault-0 -- vault audit list
   ```

## Production Considerations

### High Availability

For production, deploy Vault with:
- 3+ replicas
- Raft storage backend
- Auto-unseal with cloud KMS
- Load balancer for vault service

### Disaster Recovery

1. **Regular Backups:**
   - Backup Vault storage backend
   - Export policies and roles
   - Document unseal keys securely

2. **Recovery Procedure:**
   - Restore Vault data
   - Unseal Vault
   - Verify authentication
   - Test secret access

### Monitoring

Monitor Vault metrics:
- Token expiration
- Secret access patterns
- Authentication failures
- Storage capacity

## Migration from K8s Secrets

If migrating from existing Kubernetes Secrets:

1. **Export existing secrets:**
   ```bash
   kubectl get secret postgres-secret -n cloudcart -o yaml > backup.yaml
   ```

2. **Import to Vault:**
   ```bash
   ./k8s/scripts/init-vault.sh secrets
   ```

3. **Update deployments:**
   ```bash
   kubectl apply -k k8s/base/
   ```

4. **Verify and clean up:**
   ```bash
   kubectl delete secret postgres-secret app-secrets -n cloudcart
   ```

## Access Vault UI

```bash
kubectl port-forward -n cloudcart vault-0 8200:8200
```

Access at: http://localhost:8200

Token: `root` (dev mode)

**⚠️ Change root token in production!**
