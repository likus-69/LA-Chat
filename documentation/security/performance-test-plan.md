# LA Chat — Performance Test Plan

## Target

The LA Chat single-server deployment should handle:
- 2,000 concurrent users
- 50,000 messages/day (~0.35 msg/s average, 5 msg/s peak)
- 50 req/s API peak
- 2,000 concurrent WebSocket connections

## Load testing tools

- **k6** for HTTP API load testing
- **Artillery** for WebSocket load testing
- **pgbench** for PostgreSQL benchmarking

## Scenarios

### 1. Auth load test
- 100 concurrent login requests
- Measure: P95 latency < 500ms, 0 errors
- Script: `tests/performance/k6-auth.js`

### 2. Message send load test
- 50 concurrent users sending 1 message/second for 60 seconds
- Measure: P95 send latency < 200ms, 0 duplicates
- Script: `tests/performance/k6-send.js`

### 3. WebSocket connection saturation
- 2,000 concurrent WebSocket connections holding for 5 minutes
- Measure: memory usage < 512MB, 0 dropped connections
- Script: `tests/performance/artillery-ws.yml`

### 4. Message history pagination
- 100 concurrent users loading 50-message pages from a 10,000-message conversation
- Measure: P95 page load < 300ms

### 5. Database benchmark
- pgbench with 50 concurrent clients, 100,000 transactions
- Measure: TPS > 500

## Monitoring during tests

- Prometheus + Grafana dashboards
- Watch: CPU, RAM, DB connections, query latency, WS connection count
- Alert if: CPU > 80%, RAM > 80%, DB connections > 80% of pool

## Pass criteria

- All scenarios complete with 0 errors
- P95 latency within targets
- No memory leaks (RAM returns to baseline after test)
- No connection drops
