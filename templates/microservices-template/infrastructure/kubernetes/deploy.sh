#!/bin/bash

# CloudBill Kubernetes Deployment Script
# Usage: ./deploy.sh [environment] [action]
# Example: ./deploy.sh production apply

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=${1:-base}
ACTION=${2:-apply}
NAMESPACE="cloudbill"

# Print functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi

    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi

    print_info "Prerequisites check passed!"
}

# Validate environment
validate_environment() {
    if [[ ! "$ENVIRONMENT" =~ ^(base|development|production)$ ]]; then
        print_error "Invalid environment: $ENVIRONMENT"
        echo "Valid environments: base, development, production"
        exit 1
    fi
}

# Check if secrets are default
check_secrets() {
    print_warn "⚠️  SECURITY CHECK ⚠️"
    print_warn "Please ensure you have updated the secrets in base/secrets.yaml"
    print_warn "Default secrets are NOT secure for production use!"

    if [[ "$ENVIRONMENT" == "production" ]]; then
        read -p "Have you updated all secrets for production? (yes/no): " confirm
        if [[ "$confirm" != "yes" ]]; then
            print_error "Please update secrets before deploying to production."
            exit 1
        fi
    fi
}

# Deploy infrastructure
deploy_infrastructure() {
    print_info "Deploying infrastructure components..."

    # Create namespace first
    kubectl apply -f base/namespace.yaml

    # Deploy secrets and configmaps
    kubectl apply -f base/secrets.yaml
    kubectl apply -f base/configmap.yaml

    # Deploy databases
    print_info "Deploying PostgreSQL..."
    kubectl apply -f base/postgres.yaml

    print_info "Deploying Redis..."
    kubectl apply -f base/redis.yaml

    # Wait for databases
    print_info "Waiting for databases to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s || true
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s || true

    print_info "Infrastructure deployed successfully!"
}

# Deploy services
deploy_services() {
    print_info "Deploying microservices..."

    kubectl apply -f base/auth-service.yaml
    kubectl apply -f base/billing-service.yaml
    kubectl apply -f base/payment-service.yaml
    kubectl apply -f base/notification-service.yaml
    kubectl apply -f base/api-gateway.yaml

    print_info "Services deployed successfully!"
}

# Deploy ingress
deploy_ingress() {
    print_info "Deploying ingress..."

    # Check if NGINX ingress controller is installed
    if ! kubectl get ns ingress-nginx &> /dev/null; then
        print_warn "NGINX Ingress Controller not found!"
        read -p "Would you like to install it? (yes/no): " install_nginx
        if [[ "$install_nginx" == "yes" ]]; then
            kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
            print_info "Waiting for ingress controller to be ready..."
            sleep 10
        fi
    fi

    # Check if cert-manager is installed
    if ! kubectl get ns cert-manager &> /dev/null; then
        print_warn "cert-manager not found!"
        read -p "Would you like to install it? (yes/no): " install_cert_manager
        if [[ "$install_cert_manager" == "yes" ]]; then
            kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
            print_info "Waiting for cert-manager to be ready..."
            sleep 20
        fi
    fi

    kubectl apply -f base/ingress.yaml
    print_info "Ingress deployed successfully!"
}

# Deploy using kustomize
deploy_with_kustomize() {
    local target_path

    if [[ "$ENVIRONMENT" == "base" ]]; then
        target_path="base/"
    else
        target_path="overlays/$ENVIRONMENT/"
    fi

    print_info "Deploying using kustomize from $target_path..."
    kubectl apply -k "$target_path"
}

# Show deployment status
show_status() {
    print_info "Deployment Status:"
    echo ""

    print_info "Pods:"
    kubectl get pods -n $NAMESPACE
    echo ""

    print_info "Services:"
    kubectl get svc -n $NAMESPACE
    echo ""

    print_info "Ingress:"
    kubectl get ingress -n $NAMESPACE
    echo ""

    print_info "HPA:"
    kubectl get hpa -n $NAMESPACE
    echo ""
}

# Main deployment
main() {
    echo "====================================="
    echo "CloudBill Kubernetes Deployment"
    echo "====================================="
    echo "Environment: $ENVIRONMENT"
    echo "Action: $ACTION"
    echo "====================================="
    echo ""

    check_prerequisites
    validate_environment

    if [[ "$ACTION" == "apply" ]]; then
        check_secrets

        if command -v kustomize &> /dev/null || kubectl version --client -o json | grep -q "kustomize"; then
            # Use kustomize if available
            deploy_with_kustomize
        else
            # Manual deployment
            deploy_infrastructure
            sleep 5
            deploy_services
            sleep 3
            deploy_ingress
        fi

        sleep 5
        show_status

        echo ""
        print_info "✅ Deployment complete!"
        print_info "To access the API Gateway:"
        print_info "  kubectl port-forward -n $NAMESPACE service/api-gateway 8080:8080"
        echo ""
        print_info "To view logs:"
        print_info "  kubectl logs -n $NAMESPACE -l app=api-gateway -f"

    elif [[ "$ACTION" == "delete" ]]; then
        print_warn "This will delete all CloudBill resources!"
        read -p "Are you sure? (yes/no): " confirm
        if [[ "$confirm" == "yes" ]]; then
            print_info "Deleting resources..."
            kubectl delete namespace $NAMESPACE
            print_info "Resources deleted successfully!"
        else
            print_info "Deletion cancelled."
        fi

    elif [[ "$ACTION" == "status" ]]; then
        show_status

    else
        print_error "Invalid action: $ACTION"
        echo "Valid actions: apply, delete, status"
        exit 1
    fi
}

# Run main function
main
