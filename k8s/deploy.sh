#!/bin/bash

set -e

echo "====================================="
echo "CloudCartOps K3s Deployment Script"
echo "====================================="

NAMESPACE="cloudcart"
DOCKER_REGISTRY="anisingh28"
IMAGE_PREFIX="cloudcartops"
IMAGES=(
    "api-gateway"
    "user-service"
    "product-service"
    "order-service"
    "chaos-service"
    "notification-worker"
    "metrics-generator"
    "frontend"
)

build_images() {
    echo "Building Docker images..."
    for service in "${IMAGES[@]}"; do
        echo "Building $service..."
        docker build -t ${DOCKER_REGISTRY}/${IMAGE_PREFIX}-$service:latest ./services/$service
    done
    echo "All images built successfully!"
}

push_images() {
    echo "Pushing images to Docker Hub..."
    echo "Login to Docker Hub first: docker login -u ${DOCKER_REGISTRY}"
    for service in "${IMAGES[@]}"; do
        echo "Pushing $service..."
        docker push ${DOCKER_REGISTRY}/${IMAGE_PREFIX}-$service:latest
    done
    echo "All images pushed successfully!"
}

deploy_infrastructure() {
    echo "Deploying infrastructure layer..."
    
    kubectl apply -k k8s/base/namespace
    sleep 5
    
    kubectl apply -k k8s/base/postgres
    echo "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s
    
    kubectl apply -k k8s/base/redis
    kubectl apply -k k8s/base/kafka
    echo "Waiting for Kafka to be ready..."
    kubectl wait --for=condition=ready pod -l app=kafka -n $NAMESPACE --timeout=300s
    
    kubectl apply -k k8s/base/vault
    echo "Waiting for Vault to be ready..."
    kubectl wait --for=condition=ready pod -l app=vault -n $NAMESPACE --timeout=300s
    
    echo "Infrastructure deployed successfully!"
}

initialize_vault() {
    echo "Initializing Vault..."
    
    sleep 10
    
    kubectl exec -n $NAMESPACE vault-0 -- vault operator init -key-shares=1 -key-threshold=1 > vault-keys.txt 2>/dev/null || true
    
    if [ -f vault-keys.txt ]; then
        UNSEAL_KEY=$(grep 'Unseal Key 1:' vault-keys.txt | awk '{print $NF}')
        ROOT_TOKEN=$(grep 'Initial Root Token:' vault-keys.txt | awk '{print $NF}')
        
        kubectl exec -n $NAMESPACE vault-0 -- vault operator unseal $UNSEAL_KEY
        kubectl exec -n $NAMESPACE vault-0 -- vault login $ROOT_TOKEN
        
        kubectl exec -n $NAMESPACE vault-0 -- vault secrets enable -path=cloudcart kv-v2 2>/dev/null || true
        
        echo "Vault initialized successfully!"
        echo "Root token saved in vault-keys.txt - KEEP THIS SECURE!"
    else
        echo "Vault already initialized or initialization failed"
    fi
}

deploy_applications() {
    echo "Deploying application services..."
    
    kubectl apply -k k8s/base/api-gateway
    kubectl apply -k k8s/base/user-service
    kubectl apply -k k8s/base/product-service
    kubectl apply -k k8s/base/order-service
    kubectl apply -k k8s/base/chaos-service
    kubectl apply -k k8s/base/notification-worker
    kubectl apply -k k8s/base/metrics-generator
    kubectl apply -k k8s/base/frontend
    
    echo "Application services deployed successfully!"
}

deploy_monitoring() {
    echo "Deploying monitoring stack..."
    
    kubectl apply -k k8s/base/prometheus
    
    echo "Monitoring deployed successfully!"
}

configure_ingress() {
    echo "Configuring Ingress..."
    
    kubectl apply -f k8s/base/common/ingress.yaml
    
    if ! grep -q "cloudcart.local" /etc/hosts; then
        echo "127.0.0.1 cloudcart.local prometheus.cloudcart.local vault.cloudcart.local" | sudo tee -a /etc/hosts
    fi
    
    echo "Ingress configured successfully!"
}

verify_deployment() {
    echo "Verifying deployment..."
    
    echo ""
    echo "Pods:"
    kubectl get pods -n $NAMESPACE
    
    echo ""
    echo "Services:"
    kubectl get svc -n $NAMESPACE
    
    echo ""
    echo "PVCs:"
    kubectl get pvc -n $NAMESPACE
    
    echo ""
    echo "Ingress:"
    kubectl get ingress -n $NAMESPACE
    
    echo ""
    echo "====================================="
    echo "Deployment completed successfully!"
    echo "====================================="
    echo ""
    echo "Access your application at:"
    echo "  - Frontend: http://cloudcart.local"
    echo "  - API: http://cloudcart.local/api"
    echo "  - Prometheus: http://prometheus.cloudcart.local"
    echo "  - Vault: http://vault.cloudcart.local"
    echo ""
}

case "${1:-all}" in
    build)
        build_images
    push)
        push_images
        ;;
    infra)
        deploy_infrastructure
        ;;
    vault)
        initialize_vault
        ;;
    apps)
        deploy_applications
        ;;
    monitoring)
        deploy_monitoring
        ;;
    ingress)
        configure_ingress
        ;;
    verify)
        verify_deployment
        ;;
    all)
        build_images
        push_images
        deploy_infrastructure
        initialize_vault
        deploy_applications
        deploy_monitoring
        configure_ingress
        verify_deployment
        ;;
    *)
        echo "Usage: $0 {build|push
        echo "Usage: $0 {build|import|infra|vault|apps|monitoring|ingress|verify|all}"
        exit 1
        ;;
esac
