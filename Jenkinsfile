// This is the CD-only pipeline for deploying pre-built images
// For complete CI/CD (build, test, scan, deploy), use Jenkinsfile-complete

pipeline {
    agent any
    
    environment {
        DOCKER_HUB_REPO = 'anisingh28'
        IMAGE_PREFIX = 'cloudcartops'
        K8S_NAMESPACE = 'cloudcart'
        IMAGE_TAG = "${params.IMAGE_TAG ?: 'latest'}"
    }
    
    parameters {
        string(name: 'IMAGE_TAG', defaultValue: 'latest', description: 'Docker image tag to deploy')
        choice(name: 'ENVIRONMENT', choices: ['dev', 'prod'], description: 'Deployment environment')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git rev-parse HEAD'
            }
        }
        
        stage('Pull Images') {
            parallel {
                stage('Pull API Gateway') {
                    steps {
                        sh "docker pull ${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-api-gateway:${IMAGE_TAG}"
                    }
                }
                stage('Pull User Service') {
                    steps {
                        sh "docker pull ${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-user-service:${IMAGE_TAG}"
                    }
                }
                stage('Pull Product Service') {
                    steps {
                        sh "docker pull ${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-product-service:${IMAGE_TAG}"
                    }
                }
                stage('Pull Order Service') {
                    steps {
                        sh "docker pull ${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-order-service:${IMAGE_TAG}"
                    }
                }
                stage('Pull Chaos Service') {
                    steps {
                        sh "docker pull ${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-chaos-service:${IMAGE_TAG}"
                    }
                }
                stage('Pull Notification Worker') {
                    steps {
                        sh "docker pull ${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-notification-worker:${IMAGE_TAG}"
                    }
                }
                stage('Pull Metrics Generator') {
                    steps {
                        sh "docker pull ${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-metrics-generator:${IMAGE_TAG}"
                    }
                }
                stage('Pull Frontend') {
                    steps {
                        sh "docker pull ${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-frontend:${IMAGE_TAG}"
                    }
                }
            }
        }
        
        stage('Deploy Infrastructure') {
            steps {
                script {
                    sh """
                        cd k8s
                        
                        kubectl apply -k base/namespace
                        
                        kubectl apply -k base/postgres
                        kubectl wait --for=condition=ready pod -l app=postgres -n ${K8S_NAMESPACE} --timeout=300s
                        
                        kubectl apply -k base/redis
                        kubectl apply -k base/kafka
                        kubectl wait --for=condition=ready pod -l app=kafka -n ${K8S_NAMESPACE} --timeout=300s
                        HUB_REPO}/${IMAGE_PREFIX}-api-gateway:${BUILD_TAG} -n ${K8S_NAMESPACE} || \
                        kubectl apply -k base/api-gateway
                        
                        kubectl set image deployment/user-service user-service=${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-user-service:${BUILD_TAG} -n ${K8S_NAMESPACE} || \
                        kubectl apply -k base/user-service
                        
                        kubectl set image deployment/product-service product-service=${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-product-service:${BUILD_TAG} -n ${K8S_NAMESPACE} || \
                        kubectl apply -k base/product-service
                        
                        kubectl set image deployment/order-service order-service=${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-order-service:${BUILD_TAG} -n ${K8S_NAMESPACE} || \
                        kubectl apply -k base/order-service
                        
                        kubectl set image deployment/chaos-service chaos-service=${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-chaos-service:${BUILD_TAG} -n ${K8S_NAMESPACE} || \
                        kubectl apply -k base/chaos-service
                        
                        kubectl set image deployment/notification-worker notification-worker=${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-notification-worker:${BUILD_TAG} -n ${K8S_NAMESPACE} || \
                        kubectl apply -k base/notification-worker
                        
                        kubectl set image deployment/metrics-generator metrics-generator=${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-metrics-generator:${BUILD_TAG} -n ${K8S_NAMESPACE} || \
                        kubectl apply -k base/metrics-generator
                        
                        kubectl set image deployment/frontend frontend=${DOCKER_HUB_REPO}/${IMAGE_PREFIX}-
                        kubectl set image deployment/metrics-generator metrics-generator=${DOCKER_REGISTRY}/cloudcart/metrics-generator:${BUILD_TAG} -n ${K8S_NAMESPACE} || \
                        kubectl apply -k base/metrics-generator
                        
                        kubectl set image deployment/frontend frontend=${DOCKER_REGISTRY}/cloudcart/frontend:${BUILD_TAG} -n ${K8S_NAMESPACE} || \
                        kubectl apply -k base/frontend
                        
                        kubectl apply -k base/prometheus
                        kubectl apply -f base/common/ingress.yaml
                        
                        kubectl rollout status deployment/api-gateway -n ${K8S_NAMESPACE} --timeout=300s
                        kubectl rollout status deployment/user-service -n ${K8S_NAMESPACE} --timeout=300s
                        kubectl rollout status deployment/product-service -n ${K8S_NAMESPACE} --timeout=300s
                        kubectl rollout status deployment/order-service -n ${K8S_NAMESPACE} --timeout=300s
                    """
                }
            }
        }
        
        stage('Smoke Tests') {
            when {
                branch 'main'
            }
            steps {
                script {
                    sh """
                        kubectl wait --for=condition=ready pod -l app=api-gateway -n ${K8S_NAMESPACE} --timeout=300s
                        
                        POD=\$(kubectl get pod -l app=api-gateway -n ${K8S_NAMESPACE} -o jsonpath='{.items[0].metadata.name}')
                        kubectl exec -n ${K8S_NAMESPACE} \$POD -- wget -q -O- http://localhost:3000/health || exit 1
                        
                        echo "Smoke tests passed!"
                    """
                }
            }
        }
    }
    
    post {
        success {
            echo 'Pipeline completed successfully!'
            sh """
                kubectl get pods -n ${K8S_NAMESPACE}
                kubectl get svc -n ${K8S_NAMESPACE}
            """
        }
        failure {
            echo 'Pipeline failed!'
            sh """
                kubectl get pods -n ${K8S_NAMESPACE} || true
                kubectl logs -n ${K8S_NAMESPACE} -l app=api-gateway --tail=50 || true
            """
        }
        always {
            sh 'docker compose down -v || true'
            cleanWs()
        }
    }
}
