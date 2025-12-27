# CloudCart Ops - Enterprise Microservices Platform

> **A production-ready microservices e-commerce platform** built for demonstrating DevOps, SRE practices, and enterprise cloud architecture. Complete with chaos engineering, observability, and Kubernetes deployment patterns.

**👤 Built for:** Cloud Reliability Engineers, DevOps professionals, and SRE practitioners
**📊 Status:** ✅ Production Ready | 🚀 Fully Tested | 📡 Observable

---

## 📖 Table of Contents

1. **[Quick Start](#quick-start)** - Get running in 5 minutes
2. **[Architecture](#architecture)** - System design & components
3. **[Features](#features)** - What's included
4. **[Microservices](#microservices)** - Service breakdown
5. **[Technology Stack](#technology-stack)** - Tools & frameworks
6. **[API Endpoints](#api-endpoints)** - Complete API reference
7. **[Kafka Events](#kafka-events)** - Event-driven architecture
8. **[Running the System](#running-the-system)** - Local & cloud deployment
9. **[Chaos Engineering](#chaos-engineering)** - Testing resilience
10. **[Monitoring & Observability](#monitoring--observability)** - Grafana dashboards
11. **[Troubleshooting](#troubleshooting)** - Common issues

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js (v16+)
- Python (3.9+)
- Go (1.19+)
- kubectl (for Kubernetes testing)

###  Setup

- Pre-requisite: Docker Desktop installed on the machine and is running!

```bash
# Clone and navigate
cd /Users/animesh.singh/Documents/CloudOps

# Start all services
docker-compose up

# Wait for services (2-3 minutes)
docker-compose ps

# Access the application
# Frontend: http://localhost:3001
# API Gateway: http://localhost:3000
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (grafana)
```

### Test It
```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test@123",
    "full_name": "Test User"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "Test@123"}'

# View Kafka events
docker-compose logs -f notification-worker
```

---

## 🏗 Architecture

### System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend (React - Port 3001)                  │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTP/REST
                            ▼
        ┌───────────────────────────────────────┐
        │  API Gateway (Node.js - Port 3000)    │
        │  - Authentication (JWT)               │
        │  - Rate Limiting (Redis)              │
        │  - Chaos Middleware (Real Failures)   │ ◄── TRUE CHAOS!
        └────┬────────────┬──────────┬─────────┘
             │            │          │
    ┌────────▼─┐   ┌──────▼──┐  ┌───▼─────┐
    │ User Svc │   │Order Svc│  │Product  │
    │(FastAPI) │   │(Go)     │  │Svc(Flask)
    │Port 8001 │   │Port 8003│  │Port 8002│
    └────┬─────┘   └──┬──────┘  └────┬────┘
         │            │              │
         │            ▼              │
         │   ┌────────────────┐      │
         │   │  PostgreSQL    │      │
         │   │  Database      │      │
         │   │  (Port 5432)   │      │
         │   └────────────────┘      │
         │                           │
         └───────────┬───────────────┘
                     │ Events
                     ▼
        ┌────────────────────────────┐
        │  Kafka Broker (Port 9092)  │
        │  - order.created           │
        │  - order.payment_confirmed │
        │  - order.status_changed    │
        │  - chaos.injected ◄── Chaos Events!
        └────────────┬───────────────┘
                     │ Consume Events
                     ▼
    ┌──────────────────────────────────────┐
    │ Notification Worker (Python)         │
    │ - Logs events with rich details      │
    │ - Shows chaos injection in logs      │
    └──────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    Observability Layer                            │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ Prometheus   │  │ Grafana         │  │ Chaos Service    │   │
│  │ (Metrics)    │  │ (Dashboards)    │  │ (Port 8004)      │   │
│  └──────────────┘  └─────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Key Architecture Patterns

1. **Microservices with Bounded Contexts**
   - Each service owns its data
   - Communicates via APIs and events
   - Independent scaling

2. **Event-Driven Architecture**
   - Kafka as message broker
   - Async communication
   - Temporal decoupling

3. **API Gateway Pattern**
   - Single entry point
   - Authentication/Authorization
   - Rate limiting
   - **Chaos Middleware** (NEW! Injects real failures)

4. **RBAC (Role-Based Access Control)**
   - `is_admin` field in users table
   - Admin dashboard with full access
   - Users see only their orders

5. **Real Chaos Injection**
   - Middleware in API Gateway
   - Injects latency, errors, timeouts
   - Published as Kafka events for observability
   - Visible in Grafana dashboards

---

## ✨ Features

### ✅ Microservices Architecture
- 8 independent microservices
- Different tech stacks (Node, Python, Go)
- Service-to-service communication
- Independent deployment

### ✅ Event-Driven Design
- Kafka message streaming
- 7+ event topics
- Async processing
- Real-time notifications

### ✅ Complete Authentication
- JWT-based authentication
- Bcrypt password hashing
- Password validation at service level
- 24-hour token expiry

### ✅ Order Lifecycle Management
- 6 order states (awaiting_payment → delivered)
- State machine validation
- Stock reduction on payment
- Stock restoration on cancellation/return

### ✅ Real Chaos Engineering
- **Latency injection** → Delays requests (Prometheus tracked)
- **Error injection** → Random HTTP errors (5xx codes)
- **Timeout injection** → Connection timeouts
- **Kafka events** → All chaos published to Kafka
- **Grafana visualization** → See chaos events as annotations

### ✅ Admin Dashboard
- Real-time order management
- User management
- Inventory control
- Chaos engineering controls (UI)

### ✅ Role-Based Access Control
- Admins: Full access to all orders
- Users: Can only see their orders, cancel only
- Frontend enforces permissions

### ✅ Observability
- Prometheus metrics collection
- Grafana dashboards (5+ pre-built)
- SRE Golden Signals visualization
- Chaos event tracking
- Kafka lag monitoring
- Deployment frequency tracking

### ✅ Stock Management
- Automatic deduction on payment
- Restoration on cancellation
- Restoration on return
- Low stock alerts
- Inventory dashboard

### ✅ Production-Ready Features
- Health checks on all services
- Proper error handling
- Input validation
- Rate limiting
- CORS configuration
- Helmet security headers
- Request logging (Morgan)

---

## 🔧 Microservices

| Service | Tech | Port | Purpose |
|---------|------|------|---------|
| **API Gateway** | Node.js/Express | 3000 | Request routing, auth, rate limiting, chaos middleware |
| **User Service** | Python/FastAPI | 8001 | User CRUD, authentication, bcrypt password handling |
| **Product Service** | Python/Flask | 8002 | Product catalog, inventory management, stock control |
| **Order Service** | Go | 8003 | Order lifecycle, payment processing, Kafka event publishing |
| **Notification Worker** | Python | N/A | Kafka consumer, event logging, notification handling |
| **Chaos Service** | Python/FastAPI | 8004 | Chaos injection, event publishing, configuration |
| **Frontend** | React | 3001 | User interface, order management, admin dashboard |
| **Metrics Generator** | Python | N/A | Generates synthetic metrics for dashboards |

---

## 🛠 Technology Stack

### Backend Services
- **API Gateway**: Node.js, Express.js
- **User Service**: Python, FastAPI
- **Product Service**: Python, Flask
- **Order Service**: Go, Gorilla Mux
- **Notification Worker**: Python, Kafka consumer
- **Chaos Service**: Python, FastAPI

### Frontend
- React 18
- React Router v6
- Context API (state management)
- Axios (HTTP client)

### Data & Messaging
- **Database**: PostgreSQL
- **Cache**: Redis
- **Message Broker**: Kafka
- **Message Format**: JSON

### Infrastructure
- **Containerization**: Docker, Docker Compose
- **Orchestration**: Kubernetes (via Kind for local testing)
- **IaC**: Terraform (Azure AKS)
- **Configuration Management**: Ansible

### Observability
- **Metrics**: Prometheus
- **Visualization**: Grafana
- **Security Headers**: Helmet
- **HTTP Logging**: Morgan
- **Rate Limiting**: Express Rate Limit

---

## 📡 API Endpoints

### Authentication
```
POST   /api/auth/register          Register new user
POST   /api/auth/login             Login (returns JWT token)
GET    /api/auth/validate          Validate token
```

### Users
```
GET    /api/users                  List all users (admin only)
GET    /api/users/:id              Get user details
POST   /api/users                  Create user
```

### Products
```
GET    /api/products               List all products
GET    /api/products/:id           Get product details
POST   /api/products               Create product (admin)
PATCH  /api/products/:id/stock     Update stock level
```

### Orders
```
GET    /api/orders                 List all orders (admin)
GET    /api/orders/my-orders       Get user's orders
GET    /api/orders/:id             Get order details
POST   /api/orders                 Create new order
PATCH  /api/orders/:id/status      Update order status (admin)
POST   /api/orders/:id/pay         Process payment
```

### Chaos Engineering
```
GET    /chaos/config               Get current chaos config
PUT    /chaos/config               Update chaos config
POST   /chaos/inject/latency       Inject latency
POST   /chaos/inject/error         Inject HTTP error
POST   /chaos/inject/random        Inject random chaos
POST   /chaos/enable               Enable chaos service
POST   /chaos/disable              Disable chaos service
GET    /chaos/test/slow            Test slow endpoint
GET    /chaos/test/error           Test error endpoint
GET    /chaos/test/memory-leak     Test memory consumption
```

---

## 📊 Kafka Events

### Order Lifecycle Events

| Event | Topic | Published By | Consumed By | Payload |
|-------|-------|--------------|-------------|---------|
| Order Created | `order.created` | Order Service | Notification Worker | order_id, user_id, total_amount, items |
| Payment Confirmed | `order.payment_confirmed` | Order Service | Notification Worker | order_id, payment_method, amount |
| Status Changed | `order.status_changed` | Order Service | Notification Worker | order_id, old_status, new_status, message |
| User Created | `user.created` | User Service | Notification Worker | user_id, username, email |

### Chaos Events

| Event | Topic | Published By | Purpose |
|-------|-------|--------------|---------|
| Chaos Injected | `chaos.injected` | Chaos Service / API Gateway Middleware | Observability, Grafana annotations |

**Example Chaos Event:**
```json
{
  "chaos_type": "latency",
  "details": "500ms delay injected to order-service",
  "service": "order-service",
  "timestamp": "2025-12-26T10:30:00Z"
}
```

---

## 🚀 Running the System

### Local Development (Docker Compose)

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api-gateway
docker-compose logs -f notification-worker

# Stop all services
docker-compose down

# Stop with volume cleanup
docker-compose down -v
```

### Kubernetes (Local with Kind)

```bash
# Create Kind cluster
kind create cluster --name cloudcart

# Build and load images
docker build -t cloudcart/api-gateway services/api-gateway/
kind load docker-image cloudcart/api-gateway --name cloudcart

# Deploy
kubectl apply -f k8s/base/

# View pods
kubectl get pods

# Port forward
kubectl port-forward svc/api-gateway 3000:3000
```

### Azure Deployment (Terraform)

```bash
cd terraform/

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -out=tfplan

# Apply (creates AKS cluster)
terraform apply tfplan

# Get credentials
az aks get-credentials --resource-group cloudcart-rg --name cloudcart-aks

# Deploy with Ansible
ansible-playbook ansible/playbooks/deploy.yaml
```

---

## ⚡ Chaos Engineering

### What is Chaos Engineering?

Chaos engineering is the practice of injecting controlled failures into a system to test its resilience and discover weaknesses before they happen in production.

### How CloudCart Implements It

#### 1. **Real Chaos Injection (API Gateway Middleware)**
```
Request Flow:
User → Browser → API Gateway
                    ↓
                Chaos Middleware
                    ↓
              Check chaos config
                    ↓
         (10% error rate? inject 500)
         (25% latency? inject 200ms delay)
         (5% timeout? return 504)
                    ↓
         Forward to downstream service
```

**Metrics Collected:**
- `chaos_injected_latency_ms` - Latency histogram
- `chaos_injected_errors_total` - Error counter
- `chaos_injected_timeouts_total` - Timeout counter

#### 2. **Event Publishing (Kafka)**
All chaos events published to `chaos.injected` topic:
```json
{
  "chaos_type": "latency",
  "details": "500ms delay",
  "service": "order-service",
  "timestamp": "2025-12-26T10:30:00Z"
}
```

#### 3. **Observability (Grafana)**
- Chaos events as annotations on graphs
- Real-time visibility of failures
- Historical tracking

### Using Chaos via Admin Dashboard

**Step 1: Open Admin Dashboard**
```
Navigate to http://localhost:3001
Click 🔧 Admin (if you're admin user)
Click ⚡ Chaos Engineering tab
```

**Step 2: Enable Chaos**
```
Click "❌ Enable Chaos Service"
```

**Step 3: Inject Latency**
```
Input: Min=500ms, Max=2000ms
Click "📡 Inject Latency"
Result: All requests will have 500-2000ms delay
Grafana shows: Latency spikes in dashboard
Kafka shows: chaos.injected events
```

**Step 4: Inject Errors**
```
Select: 500 (Internal Server Error)
Click "📡 Inject HTTP Error"
Result: ~10% of requests return 500 error
Grafana shows: Error rate spike
Kafka shows: chaos.injected events
```

**Step 5: Monitor in Grafana**
```
Navigate to Grafana: http://localhost:3000
View "API Latency" dashboard
See latency spikes from chaos
See annotations marking chaos events
```

### Example Chaos Scenarios

**Scenario 1: Test Order Processing Resilience**
```
1. Enable chaos (5% error rate, 1000-3000ms latency)
2. Place order (will randomly fail or delay)
3. Check Grafana: Error rate increases
4. Check Kafka: chaos.injected events published
5. Check notification-worker logs: Chaos event consumption
```

**Scenario 2: Test Admin Dashboard Under Chaos**
```
1. Enable chaos
2. Click "Refresh Orders" button
3. Some requests fail (500 error)
4. Some requests are slow (3+ seconds)
5. UI shows errors gracefully
6. Admin can still manage orders
```

**Scenario 3: Test Kafka Consumer Lag**
```
1. Enable chaos (high latency: 2000-5000ms)
2. Create multiple orders
3. Check Grafana: notification-worker lag increases
4. Demonstrates impact of latency on event processing
```

---

## 📊 Monitoring & Observability

### Grafana Dashboards (Pre-Built)

#### 1. **SRE Golden Signals Dashboard**
Monitors the 4 key metrics for reliability:
- **Latency** (p50, p95, p99 percentiles)
- **Traffic** (requests per second)
- **Errors** (error rate percentage)
- **Saturation** (CPU, memory, disk usage)

#### 2. **API Gateway Dashboard**
- Request rate by endpoint
- Latency distribution
- Error rate by service
- Rate limiting events
- **Chaos injection events** (annotations)

#### 3. **Order Service Dashboard**
- Order creation rate
- Payment processing time
- Status transition counts
- Stock reduction events
- Order lifecycle metrics

#### 4. **Kafka Dashboard**
- Consumer lag by topic
- Message throughput
- `chaos.injected` topic monitoring
- Notification worker processing rate

#### 5. **Chaos Engineering Dashboard**
- Active chaos status
- Chaos event timeline
- Error injection history
- Latency injection history
- Impact on system metrics

### Prometheus Queries

```promql
# API Latency (p95)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error Rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Chaos Latency Injected
chaos_injected_latency_ms_bucket

# Kafka Consumer Lag
kafka_consumergroup_lag

# Pod Restarts
increase(kube_pod_container_status_restarts_total[1h])
```

---

## 🔐 Security

### Authentication
- ✅ JWT tokens (24-hour expiry)
- ✅ Bcrypt password hashing (10 rounds)
- ✅ Password validation at service level
- ✅ Token validation on protected routes

### Authorization
- ✅ Role-based access control (RBAC)
- ✅ `is_admin` field in database
- ✅ Frontend permission checks
- ✅ Backend authorization on APIs

### API Security
- ✅ CORS configuration
- ✅ Helmet security headers
- ✅ Rate limiting (100 req/min per IP)
- ✅ Input validation
- ✅ SQL injection prevention (ORM)

### Data Protection
- ✅ Password never exposed in API responses
- ✅ Proper error messages (no info leakage)
- ✅ HTTPS ready (Helmet, CORS)
- ✅ Database credentials in .env

---

## 📋 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Products Table
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock INT NOT NULL,
  category VARCHAR(100),
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Orders Table
```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'awaiting_payment',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Order Items Table
```sql
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🐛 Troubleshooting

### "Connection refused" errors

**Problem:** Services can't connect to each other
```
Error: connect ECONNREFUSED 127.0.0.1:8001
```

**Solution:**
```bash
# Check all services are running
docker-compose ps

# If any are down, restart them
docker-compose up -d

# Check logs
docker-compose logs <service-name>
```

### "Kafka is not responding"

**Problem:** Notification worker can't connect to Kafka
```
Error: KafkaError: Network error
```

**Solution:**
```bash
# Check Kafka is running
docker-compose ps | grep kafka

# Reset Kafka
docker-compose down
docker-compose up -d kafka

# Wait 10 seconds for Kafka to fully start
sleep 10

# Restart worker
docker-compose restart notification-worker
```

### "Database connection error"

**Problem:** Can't connect to PostgreSQL
```
Error: FATAL: remaining connection slots are reserved
```

**Solution:**
```bash
# Check PostgreSQL is running
docker-compose ps | grep postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres

# Wait for database to initialize (15-20 seconds)
sleep 20

# Restart services
docker-compose up -d
```

### "Frontend can't reach API"

**Problem:** Frontend getting 404 or connection refused

**Solution:**
```bash
# Check API Gateway is running
curl http://localhost:3000/health

# If not, restart it
docker-compose restart api-gateway

# Check browser console for errors
# Verify frontend uses correct API URL: http://localhost:3000
```

### "Chaos not working"

**Problem:** Injecting chaos doesn't cause failures
```
Chaos enabled, but no errors or latency
```

**Solution:**
```bash
# Check chaos middleware is loaded
docker-compose logs api-gateway | grep -i chaos

# Check chaos config
curl http://localhost:8004/chaos/config

# Try manual injection
curl -X POST http://localhost:8004/chaos/inject/latency \
  -H "Content-Type: application/json" \
  -d '{"min_ms": 1000, "max_ms": 2000}'

# Check Kafka events
docker-compose logs notification-worker | grep chaos
```

---

## 📝 License

MIT License - Feel free to use for learning and demonstrations.

---

## 👨‍💼 Author Notes

Built with focus on:
- ✅ Production-ready patterns
- ✅ SRE best practices
- ✅ Real chaos injection
- ✅ Complete documentation
- ✅ Interview-grade implementation

---

**Last Updated**: December 26, 2025
**Status**: ✅ Production Ready
