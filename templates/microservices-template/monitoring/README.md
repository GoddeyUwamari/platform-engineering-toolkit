# CloudBill Monitoring Infrastructure

Complete monitoring solution for CloudBill microservices using Prometheus and Grafana.

## Overview

This monitoring infrastructure provides:

- **Metrics Collection**: Prometheus scrapes metrics from all 5 microservices
- **Visualization**: Grafana dashboards for real-time monitoring
- **Alerting**: Comprehensive alert rules for service health and performance
- **Multi-tenant Awareness**: All metrics include tenant_id labels for isolation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CloudBill Services                        │
│  API Gateway (8080) | Auth (3001) | Billing (3002)          │
│  Payment (3003) | Notification (3004)                        │
│                                                               │
│  Each exposes /metrics endpoint with prom-client             │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP scraping every 10-15s
                            ▼
                   ┌─────────────────┐
                   │   Prometheus    │
                   │   Port 9090     │
                   │                 │
                   │  - Time series  │
                   │  - Alert rules  │
                   │  - 30d retention│
                   └────────┬────────┘
                            │ PromQL queries
                            ▼
                   ┌─────────────────┐
                   │    Grafana      │
                   │   Port 3000     │
                   │                 │
                   │  - Dashboards   │
                   │  - Visualization│
                   └─────────────────┘
```

## Quick Start

### 1. Start the Monitoring Stack

Start all services including Prometheus and Grafana:

```bash
docker-compose up -d
```

Or start only monitoring services:

```bash
docker-compose up -d prometheus grafana
```

### 2. Access the UIs

- **Grafana Dashboard**: http://localhost:3000
  - Username: `admin`
  - Password: `admin`
  - Pre-configured dashboard: "CloudBill - Microservices Overview"

- **Prometheus UI**: http://localhost:9090
  - Targets: http://localhost:9090/targets
  - Alerts: http://localhost:9090/alerts
  - Graph: http://localhost:9090/graph

- **Service Metrics Endpoints**:
  - API Gateway: http://localhost:8080/metrics
  - Auth Service: http://localhost:3001/metrics
  - Billing Service: http://localhost:3002/metrics
  - Payment Service: http://localhost:3003/metrics
  - Notification Service: http://localhost:3004/metrics

### 3. Verify Setup

Check that all targets are being scraped:

```bash
# View Prometheus logs
docker-compose logs -f prometheus

# Check Prometheus targets status
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Test a PromQL query
curl -G http://localhost:9090/api/v1/query --data-urlencode 'query=up' | jq
```

## Metrics Collected

### HTTP Metrics

All services expose comprehensive HTTP metrics:

- `http_requests_total` - Total HTTP requests (counter)
  - Labels: `service`, `method`, `route`, `status`, `tenant_id`
- `http_request_duration_seconds` - Request duration histogram (histogram)
  - Labels: `service`, `method`, `route`, `tenant_id`
  - Buckets: 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10
- `http_request_size_bytes` - Request size (histogram)
- `http_response_size_bytes` - Response size (histogram)

### Database Metrics

PostgreSQL connection pool and query metrics:

- `db_pool_total_connections` - Total pool size (gauge)
- `db_pool_active_connections` - Active connections (gauge)
- `db_pool_idle_connections` - Idle connections (gauge)
- `db_pool_waiting_requests` - Waiting requests (gauge)
- `db_query_duration_seconds` - Query execution time (histogram)
  - Labels: `service`, `operation`, `tenant_id`
- `db_errors_total` - Database errors (counter)
  - Labels: `service`, `error_type`, `tenant_id`

### Redis Cache Metrics

Cache hit/miss rates and operation latency:

- `redis_operations_total` - Cache operations (counter)
  - Labels: `service`, `operation` (hit/miss/set/delete), `tenant_id`
- `redis_operation_duration_seconds` - Operation latency (histogram)
- `redis_errors_total` - Redis errors (counter)

### Business Metrics

Domain-specific metrics for CloudBill operations:

- `cloudbill_payments_total` - Payment attempts (counter)
- `cloudbill_payments_succeeded_total` - Successful payments (counter)
- `cloudbill_payments_failed_total` - Failed payments (counter)
- `cloudbill_invoices_generated_total` - Invoices generated (counter)
- `cloudbill_invoices_failed_total` - Invoice generation failures (counter)
- `cloudbill_notifications_sent_total` - Notifications sent (counter)
  - Labels: `notification_type` (email/sms/webhook), `tenant_id`
- `cloudbill_notifications_failed_total` - Notification failures (counter)

### Node.js Runtime Metrics

Standard Node.js process metrics:

- `process_cpu_seconds_total` - CPU usage (counter)
- `process_resident_memory_bytes` - Memory usage (gauge)
- `process_heap_bytes` - Heap size (gauge)
- `nodejs_eventloop_lag_seconds` - Event loop lag (gauge)
- `nodejs_gc_duration_seconds` - GC duration (histogram)

## Grafana Dashboards

### CloudBill - Microservices Overview

Pre-configured dashboard with 13 panels:

1. **Service Health Status** - UP/DOWN status for all services
2. **HTTP Request Rate by Service** - Requests per second
3. **HTTP Error Rate (5xx)** - Error percentage by service
4. **HTTP Request Latency** - P50, P95, P99 latency
5. **Database Connection Pool** - Active/idle connections
6. **Database Query P95 Latency** - Query performance
7. **Redis Cache Hit/Miss Rate** - Cache operations
8. **Cache Hit Ratio** - Overall cache effectiveness
9. **Memory Usage by Service** - RAM consumption
10. **CPU Usage by Service** - CPU utilization
11. **Payment Processing Rate** - Business metrics
12. **Invoice Generation Rate** - Billing metrics
13. **Notification Delivery Rate** - Notification metrics

Dashboard automatically refreshes every 10 seconds.

## Prometheus Alert Rules

Comprehensive alerting covering:

### Service Health Alerts

- **ServiceDown**: Service unreachable for 1+ minute (critical)
- **HighErrorRate**: 5xx errors > 5% for 5 minutes (warning)
- **CriticalErrorRate**: 5xx errors > 20% for 2 minutes (critical)

### Performance Alerts

- **HighLatencyP95**: P95 latency > 2 seconds for 5 minutes (warning)
- **CriticalLatencyP99**: P99 latency > 5 seconds for 3 minutes (critical)
- **SlowDatabaseQueries**: P95 DB query time > 1 second (warning)

### Resource Alerts

- **HighMemoryUsage**: Memory > 1GB for 10 minutes (warning)
- **CriticalMemoryUsage**: Memory > 2GB for 5 minutes (critical)
- **HighCPUUsage**: CPU > 80% for 10 minutes (warning)

### Database Alerts

- **DatabasePoolExhaustion**: Pool usage > 80% for 5 minutes (warning)
- **DatabaseConnectionErrors**: DB connection errors detected (critical)

### Cache Alerts

- **HighCacheMissRate**: Cache miss rate > 50% for 10 minutes (warning)
- **RedisConnectionErrors**: Redis connection errors detected (critical)

### Business Alerts

- **HighPaymentFailureRate**: Payment failures > 10% for 5 minutes (warning)
- **InvoiceGenerationFailures**: Invoice generation failing (warning)
- **NotificationDeliveryFailures**: Notification failure > 15% (warning)

### Traffic Alerts

- **TrafficSpike**: 2x traffic increase for 3 minutes (warning)
- **TrafficDrop**: Traffic < 20% normal for 5 minutes (critical)

## Configuration Files

### Prometheus

- **prometheus.yml** - Main Prometheus configuration
  - Scrape configs for all 5 services
  - 10-15 second scrape intervals
  - Service discovery and labeling
  - 30-day data retention

- **alerts/cloudbill-alerts.yml** - Alert rules
  - 30+ alert rules across 6 categories
  - Configurable thresholds and durations
  - Severity levels: warning, critical

### Grafana

- **provisioning/datasources/prometheus.yml** - Auto-configured Prometheus datasource
- **provisioning/dashboards/dashboard-provider.yml** - Dashboard auto-discovery
- **provisioning/dashboards/cloudbill-overview.json** - Main monitoring dashboard

## Querying Metrics

### PromQL Examples

Get request rate by service:
```promql
sum by (service) (rate(http_requests_total[5m]))
```

Get error rate by service:
```promql
sum by (service) (rate(http_requests_total{status=~"5.."}[5m]))
/
sum by (service) (rate(http_requests_total[5m]))
```

Get P95 latency:
```promql
histogram_quantile(0.95,
  sum by (service, le) (rate(http_request_duration_seconds_bucket[5m]))
)
```

Get cache hit ratio:
```promql
sum by (service) (rate(redis_operations_total{operation="hit"}[5m]))
/
sum by (service) (rate(redis_operations_total[5m]))
```

Get active database connections:
```promql
db_pool_active_connections
```

## Maintenance

### Reload Prometheus Configuration

After modifying prometheus.yml or alert rules:

```bash
# Using lifecycle API (requires --web.enable-lifecycle flag)
curl -X POST http://localhost:9090/-/reload

# Or restart the container
docker-compose restart prometheus
```

### Backup Prometheus Data

```bash
# Backup time series data
docker run --rm -v cloudbill_prometheus_data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz /data

# Restore
docker run --rm -v cloudbill_prometheus_data:/data -v $(pwd):/backup alpine tar xzf /backup/prometheus-backup.tar.gz -C /
```

### Backup Grafana Dashboards

```bash
# Backup Grafana data (includes dashboards, users, settings)
docker run --rm -v cloudbill_grafana_data:/data -v $(pwd):/backup alpine tar czf /backup/grafana-backup.tar.gz /data

# Restore
docker run --rm -v cloudbill_grafana_data:/data -v $(pwd):/backup alpine tar xzf /backup/grafana-backup.tar.gz -C /
```

### Debugging

View Prometheus logs:
```bash
docker-compose logs -f prometheus
```

View Grafana logs:
```bash
docker-compose logs -f grafana
```

Check if Prometheus is scraping targets:
```bash
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health, lastScrape: .lastScrape}'
```

Test Grafana datasource:
```bash
# Login to Grafana API
curl -X GET http://admin:admin@localhost:3000/api/datasources

# Test Prometheus datasource
curl -X GET http://admin:admin@localhost:3000/api/datasources/proxy/1/api/v1/query?query=up
```

## Production Considerations

### Security

1. **Change default credentials**:
   ```bash
   # In .env file or docker-compose.yml
   GRAFANA_ADMIN_USER=your_admin_user
   GRAFANA_ADMIN_PASSWORD=strong_password_here
   ```

2. **Enable HTTPS** for Grafana and Prometheus UIs

3. **Restrict access** using firewall rules or reverse proxy

4. **Use authentication** for Prometheus API endpoints

### Performance

1. **Adjust scrape intervals** based on data volume:
   - High-traffic services: 10s
   - Low-traffic services: 30s

2. **Tune Prometheus retention**:
   - Default: 30 days
   - Adjust in docker-compose.yml: `--storage.tsdb.retention.time=90d`

3. **Configure recording rules** for expensive queries

4. **Use remote storage** for long-term retention (Thanos, Cortex, M3DB)

### Alerting

1. **Set up Alertmanager** for alert routing and deduplication

2. **Configure notification channels**:
   - Email
   - Slack
   - PagerDuty
   - Webhook

3. **Define on-call schedules** and escalation policies

4. **Test alert rules** regularly:
   ```bash
   # Manually trigger alerts by stopping a service
   docker-compose stop auth-service

   # Check alert status in Prometheus
   curl http://localhost:9090/api/v1/alerts | jq
   ```

## Troubleshooting

### Prometheus Not Scraping Services

1. Check service health:
   ```bash
   docker-compose ps
   ```

2. Verify metrics endpoints are accessible:
   ```bash
   curl http://localhost:8080/metrics
   ```

3. Check Prometheus targets page: http://localhost:9090/targets

4. Review Prometheus logs:
   ```bash
   docker-compose logs prometheus | grep -i error
   ```

### Grafana Dashboard Not Loading Data

1. Verify Prometheus datasource is configured:
   - Settings > Data Sources > Prometheus

2. Test datasource connection in Grafana UI

3. Check if Prometheus has data:
   ```bash
   curl http://localhost:9090/api/v1/query?query=up
   ```

4. Review Grafana logs:
   ```bash
   docker-compose logs grafana | grep -i error
   ```

### High Memory Usage

Prometheus memory usage grows with:
- Number of metrics
- Scrape frequency
- Retention period
- Number of labels

Solutions:
1. Reduce scrape frequency
2. Decrease retention period
3. Use metric relabeling to drop unnecessary metrics
4. Increase container memory limits

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [prom-client (Node.js)](https://github.com/siimon/prom-client)

## Support

For issues or questions:
1. Check CloudBill documentation: `/docs`
2. Review service logs: `docker-compose logs [service-name]`
3. Open an issue on GitHub
