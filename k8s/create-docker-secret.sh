#!/bin/bash

# Create Docker Hub image pull secret ( Not Mandatory, only if you are pulling from private repo )

read -p "Enter Docker Hub username: " DOCKER_USERNAME
read -sp "Enter Docker Hub password/token: " DOCKER_PASSWORD
echo ""
read -p "Enter Docker Hub email: " DOCKER_EMAIL

kubectl create secret docker-registry regcred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=${DOCKER_USERNAME} \
  --docker-password=${DOCKER_PASSWORD} \
  --docker-email=${DOCKER_EMAIL} \
  -n cloudcart

echo "✓ Docker registry secret created"
