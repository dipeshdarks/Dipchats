# DIPCHATS — PRODUCTION DEPLOYMENT & SCALING SPECIFICATION

## Multi-Node, Load-Balanced, Cloud-Native Production Architecture

**Project:** DipChats
**Runtime:** Node.js + TypeScript (Fastify)
**Database:** PostgreSQL 16+ (Drizzle ORM)
**Cache/PubSub:** Redis 7+ (Cluster mode)
**Object Storage:** MinIO (Distributed mode)
**Container Orchestration:** Kubernetes
**CI/CD:** GitHub Actions + ArgoCD

---

# 1. Production Architecture Overview

## 1.1 High-Level Topology

The production deployment uses a multi-tier architecture with CDN edge protection, L7 load balancing, horizontally scalable application pods, and managed data services.

```text
Internet
    |
    v
Cloudflare (TLS/WAF/DDoS)
    |
    v
NGINX Ingress (L7 LB)
    |           |
    v           v
API Pods    WebSocket Pods
(3-10)      (3-10)
    |           |
    +-----+-----+
          |
          v
    Redis Cluster (6 nodes)
          |
    +-----+-----+
    |           |
    v           v
PostgreSQL   MinIO
Primary+2R   (4 nodes)
+ PgBouncer
```

## 1.2 Component Inventory

| Component | Replicas | CPU (req) | Memory (req) | Purpose |
|-----------|----------|-----------|--------------|---------|
| API Gateway | 3-10 | 500m | 512Mi | REST API, file uploads |
| WebSocket Gateway | 3-10 | 500m | 512Mi | Real-time connections |
| PostgreSQL Primary | 1 | 2000m | 4Gi | Read/write database |
| PostgreSQL Replica | 2 | 1000m | 2Gi | Read replicas |
| PgBouncer | 2 | 250m | 256Mi | Connection pooling |
| Redis Cluster | 6 | 500m | 1Gi | Cache, PubSub, presence |
| MinIO | 4 | 1000m | 2Gi | Object storage |
| Prometheus | 1 | 500m | 1Gi | Metrics collection |
| Grafana | 1 | 250m | 256Mi | Dashboards |

## 1.3 Network Segmentation

```text
+---------------------------------------------------------------+
|  Public Subnet (Internet-facing)                              |
|  +-- Cloudflare edge                                          |
|  +-- Load Balancer                                            |
+---------------------------------------------------------------+
|  Application Subnet                                           |
|  +-- API Gateway pods                                         |
|  +-- WebSocket Gateway pods                                   |
|  +-- Internal load balancer                                   |
+---------------------------------------------------------------+
|  Data Subnet (isolated)                                       |
|  +-- PostgreSQL pods                                          |
|  +-- Redis Cluster pods                                       |
|  +-- MinIO pods                                               |
+---------------------------------------------------------------+
|  Monitoring Subnet                                            |
|  +-- Prometheus                                               |
|  +-- Grafana                                                  |
|  +-- Alertmanager                                             |
+---------------------------------------------------------------+
```

---

# 2. Kubernetes Deployment

## 2.1 Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dipchats-production
  labels:
    app.kubernetes.io/name: dipchats
    app.kubernetes.io/env: production
```

## 2.2 API Gateway Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dipchats-api
  namespace: dipchats-production
  labels:
    app: dipchats-api
    tier: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dipchats-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 2
  template:
    metadata:
      labels:
        app: dipchats-api
        tier: backend
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "4000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: dipchats-api
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
        - name: api
          image: ghcr.io/dipchats/server:latest
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 4000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: dipchats-config
            - secretRef:
                name: dipchats-secrets
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "4000"
            - name: HOST
              value: "0.0.0.0"
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 15
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health
              port: http
            failureThreshold: 30
            periodSeconds: 2
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10"]
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: dipchats-api
```

## 2.3 WebSocket Gateway Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dipchats-websocket
  namespace: dipchats-production
  labels:
    app: dipchats-websocket
    tier: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dipchats-websocket
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 2
  template:
    metadata:
      labels:
        app: dipchats-websocket
        tier: backend
    spec:
      serviceAccountName: dipchats-websocket
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
      containers:
        - name: websocket
          image: ghcr.io/dipchats/server:latest
          imagePullPolicy: Always
          command: ["node", "dist/websocket.js"]
          ports:
            - name: ws
              containerPort: 4001
              protocol: TCP
          envFrom:
            - configMapRef:
                name: dipchats-config
            - secretRef:
                name: dipchats-secrets
          env:
            - name: NODE_ENV
              value: "production"
            - name: WS_PORT
              value: "4001"
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
          livenessProbe:
            tcpSocket:
              port: ws
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            tcpSocket:
              port: ws
            initialDelaySeconds: 5
            periodSeconds: 5
```

## 2.4 Services

```yaml
apiVersion: v1
kind: Service
metadata:
  name: dipchats-api
  namespace: dipchats-production
  labels:
    app: dipchats-api
spec:
  type: ClusterIP
  selector:
    app: dipchats-api
  ports:
    - name: http
      port: 4000
      targetPort: http
      protocol: TCP
---
apiVersion: v1
kind: Service
metadata:
  name: dipchats-websocket
  namespace: dipchats-production
  labels:
    app: dipchats-websocket
spec:
  type: ClusterIP
  selector:
    app: dipchats-websocket
  ports:
    - name: ws
      port: 4001
      targetPort: ws
      protocol: TCP
```

## 2.5 Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dipchats-ingress
  namespace: dipchats-production
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "86400"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "86400"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "10"
    nginx.ingress.kubernetes.io/upstream-hash-by: "$remote_addr"
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://app.dipchats.example.com"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PATCH, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "Content-Type, Authorization, X-Request-ID"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.dipchats.example.com
        - ws.dipchats.example.com
      secretName: dipchats-tls
  rules:
    - host: api.dipchats.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: dipchats-api
                port:
                  number: 4000
    - host: ws.dipchats.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: dipchats-websocket
                port:
                  number: 4001
```

## 2.6 Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dipchats-api-hpa
  namespace: dipchats-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dipchats-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 25
          periodSeconds: 120
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dipchats-websocket-hpa
  namespace: dipchats-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dipchats-websocket
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: websocket_connections
        target:
          type: AverageValue
          averageValue: "2000"
```

## 2.7 ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dipchats-config
  namespace: dipchats-production
data:
  NODE_ENV: "production"
  PORT: "4000"
  WS_PORT: "4001"
  DATABASE_HOST: "dipchats-pgbouncer"
  DATABASE_PORT: "6432"
  DATABASE_NAME: "dipchats"
  REDIS_HOST: "dipchats-redis-cluster"
  REDIS_PORT: "6379"
  S3_ENDPOINT: "http://dipchats-minio:9000"
  S3_BUCKET: "dipchats"
  SESSION_TOKEN_EXPIRY: "3600"
  CHALLENGE_EXPIRY: "60"
  RATE_LIMIT_IP: "500"
  RATE_LIMIT_DEVICE: "200"
  RATE_LIMIT_MESSAGES: "60"
  MAX_FILE_SIZE: "104857600"
  SIGNED_URL_EXPIRY: "900"
  LOG_LEVEL: "info"
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4317"
  OTEL_SERVICE_NAME: "dipchats-api"
```

## 2.8 Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: dipchats-secrets
  namespace: dipchats-production
type: Opaque
stringData:
  DATABASE_URL: "postgresql://dipchats_user:REDACTED@dipchats-pgbouncer:6432/dipchats?sslmode=require"
  REDIS_URL: "redis://:REDACTED@dipchats-redis-cluster:6379"
  S3_ACCESS_KEY: "REDACTED"
  S3_SECRET_KEY: "REDACTED"
  SESSION_SECRET: "REDACTED"
  JWT_SECRET: "REDACTED"
```

---

# 3. Database Deployment

## 3.1 PostgreSQL Primary/Replica

### Primary StatefulSet

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: dipchats-postgres-primary
  namespace: dipchats-production
spec:
  serviceName: dipchats-postgres-primary
  replicas: 1
  selector:
    matchLabels:
      app: dipchats-postgres
      role: primary
  template:
    metadata:
      labels:
        app: dipchats-postgres
        role: primary
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
              name: postgres
          env:
            - name: POSTGRES_DB
              value: "dipchats"
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: dipchats-db-credentials
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: dipchats-db-credentials
                  key: password
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          resources:
            requests:
              cpu: 2000m
              memory: 4Gi
            limits:
              cpu: 4000m
              memory: 8Gi
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
            - name: postgres-wal
              mountPath: /var/lib/postgresql/wal
          livenessProbe:
            exec:
              command: ["pg_isready", "-U", "dipchats"]
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "dipchats"]
            initialDelaySeconds: 5
            periodSeconds: 5
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 100Gi
    - metadata:
        name: postgres-wal
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 50Gi
```

### PostgreSQL Primary Init ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dipchats-postgres-init
  namespace: dipchats-production
data:
  init-primary.sh: |
    #!/bin/bash
    set -e

    # Enable WAL archiving
    cat >> "$PGDATA/postgresql.conf" <<EOF
    wal_level = replica
    max_wal_senders = 10
    wal_keep_size = 1024
    archive_mode = on
    archive_command = 'test ! -f /archive/%f && cp %p /archive/%f'
    hot_standby = on
    max_replication_slots = 10
    log_statement = 'mod'
    log_min_duration_statement = 1000
    shared_preload_libraries = 'pg_stat_statements'
    pg_stat_statements.track = all
    EOF

    # Configure replication permissions
    cat >> "$PGDATA/pg_hba.conf" <<EOF
    host replication replicator 0.0.0.0/0 md5
    EOF
```

### Primary Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: dipchats-postgres-primary
  namespace: dipchats-production
spec:
  type: ClusterIP
  selector:
    app: dipchats-postgres
    role: primary
  ports:
    - name: postgres
      port: 5432
      targetPort: postgres
```

### Replica StatefulSet

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: dipchats-postgres-replica
  namespace: dipchats-production
spec:
  serviceName: dipchats-postgres-replica
  replicas: 2
  selector:
    matchLabels:
      app: dipchats-postgres
      role: replica
  template:
    metadata:
      labels:
        app: dipchats-postgres
        role: replica
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
              name: postgres
          env:
            - name: POSTGRES_DB
              value: "dipchats"
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: dipchats-db-credentials
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: dipchats-db-credentials
                  key: password
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
            - name: PRIMARY_HOST
              value: dipchats-postgres-primary
          resources:
            requests:
              cpu: 1000m
              memory: 2Gi
            limits:
              cpu: 2000m
              memory: 4Gi
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 100Gi
```

### Replica Service (Read-only)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: dipchats-postgres-replica
  namespace: dipchats-production
spec:
  type: ClusterIP
  selector:
    app: dipchats-postgres
    role: replica
  ports:
    - name: postgres
      port: 5432
      targetPort: postgres
```

## 3.2 Connection Pooling (PgBouncer)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dipchats-pgbouncer
  namespace: dipchats-production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: dipchats-pgbouncer
  template:
    metadata:
      labels:
        app: dipchats-pgbouncer
    spec:
      containers:
        - name: pgbouncer
          image: bitnami/pgbouncer:1.23.1
          ports:
            - containerPort: 6432
              name: pgbouncer
          env:
            - name: POSTGRESQL_HOST
              value: "dipchats-postgres-primary"
            - name: POSTGRESQL_PORT
              value: "5432"
            - name: POSTGRESQL_USERNAME
              valueFrom:
                secretKeyRef:
                  name: dipchats-db-credentials
                  key: username
            - name: POSTGRESQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: dipchats-db-credentials
                  key: password
            - name: POSTGRESQL_DATABASE
              value: "dipchats"
            - name: PGBOUNCER_POOL_MODE
              value: "transaction"
            - name: PGBOUNCER_MAX_CLIENT_CONN
              value: "1000"
            - name: PGBOUNCER_DEFAULT_POOL_SIZE
              value: "50"
            - name: PGBOUNCER_MIN_POOL_SIZE
              value: "10"
            - name: PGBOUNCER_RESERVE_POOL_SIZE
              value: "10"
            - name: PGBOUNCER_SERVER_IDLE_TIMEOUT
              value: "300"
            - name: PGBOUNCER_SERVER_lifetime
              value: "3600"
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            tcpSocket:
              port: pgbouncer
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            tcpSocket:
              port: pgbouncer
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: dipchats-pgbouncer
  namespace: dipchats-production
spec:
  type: ClusterIP
  selector:
    app: dipchats-pgbouncer
  ports:
    - name: pgbouncer
      port: 6432
      targetPort: pgbouncer
```

## 3.3 Backup Strategy

```text
PostgreSQL Backup:
  - WAL archiving: continuous (to MinIO /archive bucket)
  - Base backup: daily at 02:00 UTC (pg_basebackup)
  - Retention: 30 days for WAL, 90 days for base backups
  - Backup to: s3://dipchats-backups/postgres/
  - Encryption: AES-256 at rest via MinIO

Redis Backup:
  - RDB snapshots: every 5 minutes (Kubernetes PVC snapshot)
  - AOF: every second
  - Retention: 24 hours for AOF, snapshots retained 7 days
  - Backup to: s3://dipchats-backups/redis/

MinIO Backup:
  - Versioning enabled on all buckets
  - Cross-region replication for production data
  - Lifecycle policies: IA after 90 days, archive after 365 days
```

### CronJob for PostgreSQL Backup

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: dipchats-postgres-backup
  namespace: dipchats-production
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:16-alpine
              command:
                - /bin/sh
                - -c
                - |
                  pg_dumpall -h dipchats-postgres-primary -U dipchats |                   gzip |                   aws s3 s3://dipchats-backups/postgres/daily-$(date +%Y%m%d).sql.gz
              env:
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: dipchats-db-credentials
                      key: password
          restartPolicy: OnFailure
```

## 3.4 Point-in-Time Recovery

```text
PITR Procedure:
  1. Identify target recovery timestamp
  2. Restore latest base backup from s3://dipchats-backups/postgres/
  3. Replay WAL files from backup archive up to target timestamp
  4. Configure recovery.conf with:
     - restore_command = 'aws s3 cp s3://dipchats-backups/postgres/wal/%f %p'
     - recovery_target_time = '<target_timestamp>'
  5. Start PostgreSQL in recovery mode
  6. Verify data integrity
  7. Promote to primary if needed

RPO Target: 1 minute (WAL archival interval)
RTO Target: 30 minutes (from backup initiation to service restoration)
```

---

# 4. Redis Deployment

## 4.1 Redis Cluster

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: dipchats-redis
  namespace: dipchats-production
spec:
  serviceName: dipchats-redis-cluster
  replicas: 6
  selector:
    matchLabels:
      app: dipchats-redis
  template:
    metadata:
      labels:
        app: dipchats-redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
              name: redis
            - containerPort: 16379
              name: gossip
          command:
            - redis-server
            - /etc/redis/redis.conf
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: 1000m
              memory: 2Gi
          volumeMounts:
            - name: redis-data
              mountPath: /data
            - name: redis-config
              mountPath: /etc/redis
          livenessProbe:
            exec:
              command: ["redis-cli", "ping"]
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            exec:
              command: ["redis-cli", "ping"]
            initialDelaySeconds: 5
            periodSeconds: 5
  volumeClaimTemplates:
    - metadata:
        name: redis-data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 20Gi
```

### Redis Cluster ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dipchats-redis-config
  namespace: dipchats-production
data:
  redis.conf: |
    port 6379
    cluster-enabled yes
    cluster-config-file /data/nodes.conf
    cluster-node-timeout 5000
    appendonly yes
    appendfsync everysec
    auto-aof-rewrite-percentage 100
    auto-aof-rewrite-min-size 64mb
    save 900 1
    save 300 10
    save 60 10000
    maxmemory 1gb
    maxmemory-policy allkeys-lru
    hz 10
    dynamic-hz yes
    io-threads 2
    io-threads-do-reads yes
    loglevel notice
    slowlog-log-slower-than 10000
    slowlog-max-len 128
    notify-keyspace-events ""
    client-output-buffer-limit normal 0 0 0
    client-output-buffer-limit replica 256mb 64mb 60
    client-output-buffer-limit pubsub 32mb 8mb 60
    repl-backlog-size 256mb
    repl-backlog-ttl 3600
```

### Redis Cluster Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: dipchats-redis-cluster
  namespace: dipchats-production
spec:
  type: ClusterIP
  clusterIP: None
  selector:
    app: dipchats-redis
  ports:
    - name: redis
      port: 6379
      targetPort: redis
    - name: gossip
      port: 16379
      targetPort: gossip
```

## 4.2 Persistence Configuration

```text
Redis Persistence:
  - AOF (Append Only File): enabled, fsync every second
  - RDB Snapshots: 900 1, 300 10, 60 10000
  - PVC: 20Gi per node (fast-ssd storage class)
  - Cluster mode: 3 masters + 3 replicas
  - Data durability: AOF every second provides sub-second RPO
```

## 4.3 Memory Management

```text
Memory Policy:
  - maxmemory: 1Gi per node
  - maxmemory-policy: allkeys-lru
  - Eviction: Least Recently Used across all keys
  - Keys eligible for eviction: presence, typing indicators, rate limits
  - Keys NOT eligible: session tokens (TTL-based), channel membership cache

Key Expiry:
  - presence:{device_id}: 60s TTL (heartbeat-renewed)
  - typing:{channel_id}:{device_id}: 5s TTL
  - ratelimit:{scope}:{id}: variable TTL (per endpoint)
  - session:{token_hash}: 3600s TTL
  - ws:connection:{id}: no TTL (deleted on disconnect)

PubSub Channels:
  - messages:{channel_id} — new message fan-out
  - presence:{device_id} — presence change broadcast
  - sync:{device_id} — sync events
  - notifications:{device_id} — push notification triggers
```

---

# 5. Object Storage (MinIO)

## 5.1 Distributed Mode

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: dipchats-minio
  namespace: dipchats-production
spec:
  serviceName: dipchats-minio
  replicas: 4
  selector:
    matchLabels:
      app: dipchats-minio
  template:
    metadata:
      labels:
        app: dipchats-minio
    spec:
      containers:
        - name: minio
          image: minio/minio:latest
          command:
            - minio
            - server
            - http://dipchats-minio-{0...3}.dipchats-minio:9000/data
            - --console-address
            - ":9001"
          ports:
            - containerPort: 9000
              name: api
            - containerPort: 9001
              name: console
          env:
            - name: MINIO_ROOT_USER
              valueFrom:
                secretKeyRef:
                  name: dipchats-minio-credentials
                  key: root-user
            - name: MINIO_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: dipchats-minio-credentials
                  key: root-password
            - name: MINIO_BROWSER
              value: "off"
          resources:
            requests:
              cpu: 1000m
              memory: 2Gi
            limits:
              cpu: 2000m
              memory: 4Gi
          volumeMounts:
            - name: minio-data
              mountPath: /data
          livenessProbe:
            httpGet:
              path: /minio/health/live
              port: api
            initialDelaySeconds: 30
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: /minio/health/ready
              port: api
            initialDelaySeconds: 10
            periodSeconds: 10
  volumeClaimTemplates:
    - metadata:
        name: minio-data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 500Gi
---
apiVersion: v1
kind: Service
metadata:
  name: dipchats-minio
  namespace: dipchats-production
spec:
  type: ClusterIP
  clusterIP: None
  selector:
    app: dipchats-minio
  ports:
    - name: api
      port: 9000
      targetPort: api
    - name: console
      port: 9001
      targetPort: console
```

## 5.2 Lifecycle Policies

```text
Bucket: dipchats (primary)
  - Versioning: enabled
  - Lifecycle:
    - Transition to Infrequent Access after 90 days
    - Transition to Archive after 365 days
    - Delete non-current versions after 30 days
    - Abort incomplete multipart uploads after 7 days

Bucket: dipchats-backups
  - Versioning: disabled
  - Lifecycle:
    - Delete objects after 90 days
    - Compress WAL archives with gzip before upload

Bucket: dipchats-temp
  - Versioning: disabled
  - Lifecycle:
    - Delete objects after 24 hours
    - Used for signed URL uploads (temporary)
```

## 5.3 Cross-Region Replication

```text
Primary Region:   us-east-1 (primary MinIO cluster)
Replica Region:   us-west-2 (secondary MinIO cluster)

Replication Rules:
  - Bucket: dipchats
  - Prefix: uploads/
  - Status: Enabled
  - Destination: arn:minio:replication:us-west-2:dipchats/dipchats
  - Delete replication: enabled
  - Delete marker replication: enabled

Replication Lag Target: < 60 seconds
Fallback: Direct MinIO I/O on primary if replica unreachable
```

---

# 6. CDN Integration

## 6.1 Static Asset Delivery

```text
CDN Provider: Cloudflare (or AWS CloudFront)

Static Assets:
  - Web app bundle (JS, CSS, images)
  - Served from: https://app.dipchats.example.com
  - Origin: MinIO bucket 'dipchats-static'
  - Cache-Control: public, max-age=31536000, immutable
  - Brotli compression: enabled
  - HTTP/3 (QUIC): enabled
  - Early Hints: enabled

Edge Rules:
  - Strip query strings for cache key (except version params)
  - Cache static assets at edge for 1 year
  - Bypass cache for /api/* and /ws/* paths
  - Rate limit: 1000 requests/minute per IP for static assets
```

## 6.2 File Attachment Caching

```text
File Attachments (encrypted content):
  - Origin: MinIO signed URLs
  - Cache-Control: private, no-cache
  - CDN: NO CACHING (encrypted content, user-specific)
  - Signed URL TTL: 15 minutes
  - Re-download required after expiry

File Previews (thumbnails, previews):
  - Origin: MinIO signed URLs
  - Cache-Control: public, max-age=86400
  - CDN: CACHE for 24 hours (non-sensitive preview data)
  - Generated server-side on first request, cached in MinIO

Upload Flow:
  1. Client requests signed upload URL
  2. Server generates presigned PUT URL (15min expiry)
  3. Client uploads directly to MinIO
  4. Client confirms upload, sends message with attachment metadata
  5. Recipients download via signed GET URL (15min expiry)

Download Flow:
  1. Client requests file by file_id
  2. Server verifies channel membership
  3. Server generates signed GET URL
  4. Client downloads file directly from MinIO
  5. Client verifies SHA-256 hash
  6. Client decrypts if is_encrypted=true
```

---

# 7. Monitoring and Observability

## 7.1 Prometheus Metrics

### Application Metrics

The DipChats server exposes Prometheus metrics at `/metrics`:

```text
# Connection metrics
websocket_connections_total          — Total WebSocket connections
websocket_connections_active         — Currently active connections
websocket_messages_sent_total       — Messages sent via WebSocket
websocket_messages_received_total   — Messages received via WebSocket
websocket_reconnections_total       — Client reconnection count

# Message metrics
messages_created_total              — Messages created (by channel type)
messages_per_second                 — Current message throughput
message_latency_seconds             — End-to-end message delivery latency
message_delivery_duration_seconds   — Server processing time

# API metrics
http_requests_total                 — HTTP requests (by method, path, status)
http_request_duration_seconds       — HTTP request latency
http_request_size_bytes             — Request payload size
http_response_size_bytes            — Response payload size

# Presence metrics
presence_updates_total              — Presence state changes
presence_active_devices             — Currently online devices
typing_indicator_active             — Active typing indicators

# Sync metrics
sync_requests_total                 — Sync requests received
sync_events_delivered_total         — Events delivered via sync
sync_cursor_age_seconds            — Age of oldest sync cursor

# Database metrics
db_connections_active               — Active database connections
db_query_duration_seconds           — Database query latency
db_replication_lag_seconds          — Replica lag

# Redis metrics
redis_operations_total              — Redis operations (by type)
redis_hit_ratio                     — Redis cache hit ratio
redis_memory_usage_bytes            — Redis memory consumption

# File metrics
file_uploads_total                  — File uploads completed
file_downloads_total                — File downloads completed
file_storage_bytes                  — Total file storage used
```

### Prometheus Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: dipchats-production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
        - name: prometheus
          image: prom/prometheus:latest
          ports:
            - containerPort: 9090
          volumeMounts:
            - name: prometheus-config
              mountPath: /etc/prometheus
            - name: prometheus-data
              mountPath: /prometheus
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: 1000m
              memory: 2Gi
```

### Prometheus ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: dipchats-production
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    scrape_configs:
      - job_name: 'dipchats-api'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names: ['dipchats-production']
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
          - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
            action: replace
            target_label: __address__
            regex: ([^:]+)(?::\d+)?;(\d+)
            replacement: $1:$2

      - job_name: 'dipchats-websocket'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            regex: dipchats-websocket
            action: keep

      - job_name: 'postgres'
        static_configs:
          - targets: ['postgres-exporter:9187']

      - job_name: 'redis'
        static_configs:
          - targets: ['redis-exporter:9121']

    rule_files:
      - 'alert_rules.yml'

    alerting:
      alertmanagers:
        - static_configs:
            - targets: ['alertmanager:9093']
```

## 7.2 Grafana Dashboards

### Grafana Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: dipchats-production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:latest
          ports:
            - containerPort: 3000
          env:
            - name: GF_SECURITY_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: dipchats-grafana
                  key: admin-password
            - name: GF_SERVER_ROOT_URL
              value: "https://grafana.dipchats.example.com"
          volumeMounts:
            - name: grafana-data
              mountPath: /var/lib/grafana
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
```

### Key Dashboards

```text
Dashboard: DipChats Overview
  - WebSocket connections (active, total, reconnections)
  - Messages per second (by channel type)
  - Message latency (p50, p95, p99)
  - API request rate and error rate
  - Active devices

Dashboard: Infrastructure
  - CPU/Memory usage per pod
  - Database connection pool utilization
  - Redis memory and hit ratio
  - MinIO storage and request rate
  - Network I/O per pod

Dashboard: Database
  - Query latency (p50, p95, p99)
  - Active connections (PgBouncer pool)
  - Replication lag
  - Cache hit ratio (pg_stat_statements)
  - Slow query count

Dashboard: Security
  - Failed authentication attempts
  - Rate limit violations
  - Device registration rate
  - Session token distribution
```

## 7.3 Alerting Rules

### Prometheus Alert Rules ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-alerts
  namespace: dipchats-production
data:
  alert_rules.yml: |
    groups:
      - name: dipchats-critical
        rules:
          - alert: HighErrorRate
            expr: |
              rate(http_requests_total{status=~"5.."}[5m])
              / rate(http_requests_total[5m]) > 0.05
            for: 5m
            labels:
              severity: critical
            annotations:
              summary: "High error rate on DipChats API"
              description: "Error rate is {{ $value | humanizePercentage }}"

          - alert: HighLatency
            expr: |
              histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
            for: 5m
            labels:
              severity: warning
            annotations:
              summary: "High API latency"
              description: "p95 latency is {{ $value }}s"

          - alert: WebSocketConnectionsHigh
            expr: websocket_connections_active > 8000
            for: 10m
            labels:
              severity: warning
            annotations:
              summary: "High WebSocket connection count"
              description: "{{ $value }} active connections"

          - alert: DatabaseReplicationLag
            expr: pg_replication_lag > 10
            for: 5m
            labels:
              severity: critical
            annotations:
              summary: "PostgreSQL replication lag"
              description: "Replica lag is {{ $value }}s"

          - alert: DatabaseConnectionPoolExhausted
            expr: |
              pg_stat_activity_count / pgbouncer_pools_client_active_connections > 0.9
            for: 5m
            labels:
              severity: critical
            annotations:
              summary: "Database connection pool nearly exhausted"

          - alert: RedisMemoryHigh
            expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.85
            for: 5m
            labels:
              severity: warning
            annotations:
              summary: "Redis memory usage above 85%"

          - alert: MinIODiskSpaceLow
            expr: |
              minio_cluster_disk_free_bytes / minio_cluster_disk_total_bytes < 0.15
            for: 10m
            labels:
              severity: critical
            annotations:
              summary: "MinIO disk space below 15%"

          - alert: PodNotReady
            expr: kube_pod_status_ready{condition="true"} == 0
            for: 5m
            labels:
              severity: critical
            annotations:
              summary: "Pod {{ $labels.pod }} not ready"

          - alert: PodCrashLooping
            expr: |
              rate(kube_pod_container_status_restarts_total[15m]) > 0
            for: 5m
            labels:
              severity: warning
            annotations:
              summary: "Pod {{ $labels.pod }} crash looping"
```

## 7.4 Distributed Tracing (OpenTelemetry)

```text
OpenTelemetry Collector Configuration:

Receivers:
  - otlp (gRPC on 4317, HTTP on 4318)
  - prometheus

Processors:
  - batch (batch size: 8192, timeout: 200ms)
  - memory_limiter (limit: 512MB, spike: 256MB)

Exporters:
  - otlp/jaeger (for trace storage)
  - prometheus (for metrics)

Service Pipeline:
  receivers: [otlp]
  processors: [batch, memory_limiter]
  exporters: [otlp/jaeger, prometheus]

Instrumentation:
  - Fastify HTTP plugin for request tracing
  - Database query tracing (pg driver hooks)
  - Redis operation tracing (ioredis hooks)
  - WebSocket message tracing
  - File upload/download tracing

Trace Propagation:
  - W3C TraceContext (primary)
  - Baggage (context propagation)

Sampling:
  - Head-based sampling: 10% for normal requests
  - Always sample: errors, slow requests (>1s)
  - Always sample: authentication failures
```

## 7.5 Log Aggregation

```text
Log Format: JSON structured logging

Log Levels:
  - error: System errors, unhandled exceptions
  - warn: Rate limits, deprecations, retryable errors
  - info: Request lifecycle, connection events
  - debug: Detailed diagnostics (production: disabled)

Log Fields:
  - timestamp: ISO 8601
  - level: error | warn | info | debug
  - message: Human-readable message
  - request_id: X-Request-ID (for correlation)
  - device_id: Device identifier (if authenticated)
  - channel_id: Channel identifier (if applicable)
  - duration_ms: Request processing time
  - status_code: HTTP status code
  - error_code: Machine-readable error code

NEVER Log:
  - Private keys or key material
  - Session tokens
  - Message content (ciphertext)
  - User passwords (none exist)
  - Database credentials
  - API keys or secrets

Log Pipeline:
  1. Application emits JSON to stdout
  2. Kubernetes collects via container runtime
  3. Fluentd/Filebeat parses and forwards
  4. Elasticsearch stores and indexes
  5. Kibana provides search and visualization

Retention:
  - Hot: 7 days (Elasticsearch)
  - Warm: 30 days (S3 snapshot)
  - Cold: 90 days (S3 Glacier)
```

---

# 8. Security

## 8.1 TLS Termination

```text
Layer 1: Cloudflare Edge
  - TLS 1.3 termination
  - Certificate: Cloudflare managed (or custom)
  - HSTS: max-age=31536000; includeSubDomains; preload
  - OCSP stapling: enabled

Layer 2: NGINX Ingress
  - TLS 1.2+ enforcement
  - Certificate: Let's Encrypt via cert-manager
  - Auto-renewal: 30 days before expiry
  - Cipher suites: TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256

Layer 3: Application
  - Internal TLS between services (mTLS optional)
  - PostgreSQL: sslmode=require
  - Redis: TLS for cluster bus
  - MinIO: TLS for API and console
```

## 8.2 WAF Rules

```text
Cloudflare WAF Rules:

  Block:
    - SQL injection patterns
    - Cross-site scripting (XSS)
    - Path traversal attempts
    - Known attack signatures (OWASP Top 10)
    - Requests from known malicious IPs

  Challenge:
    - Rate limit exceeded (bot detection)
    - Suspicious user agents
    - Missing browser fingerprint

  Allow:
    - API endpoints (authenticated)
    - WebSocket connections
    - Health check endpoints
    - Static assets

  Custom Rules:
    - Block requests with invalid Content-Type for POST/PATCH
    - Block requests exceeding 10MB body size
    - Challenge requests from high-risk countries
    - Rate limit: 100 requests/minute per IP for auth endpoints
```

## 8.3 DDoS Protection

```text
Cloudflare DDoS Protection:

  Layer 3/4 (Network):
    - Volumetric attack mitigation
    - SYN flood protection
    - UDP flood protection
    - ICMP flood protection

  Layer 7 (Application):
    - HTTP flood protection
    - Slowloris protection
    - WebSocket flood protection
    - Challenge page for suspicious traffic

  Rate Limiting (Application):
    - Per IP: 500 requests/minute (global)
    - Per device: 200 requests/minute (authenticated)
    - Per endpoint: varies (see API.md)
    - WebSocket: 100 messages/minute per connection

  Auto-scaling:
    - HPA responds to traffic spikes
    - Pre-warmed pod count: 3 (baseline)
    - Scale-up: 2 pods per minute
    - Scale-down: 25% per 2 minutes (stabilization: 5 minutes)
```

## 8.4 Secret Management

```text
Secret Storage:
  - Kubernetes Secrets (base64, encrypted at rest)
  - External Secrets Operator (for cloud KMS)
  - Sealed Secrets (for GitOps)

Secret Rotation:
  - Database credentials: rotate every 90 days
  - S3 access keys: rotate every 90 days
  - Session secrets: rotate every 180 days
  - TLS certificates: auto-renew via cert-manager

Access Control:
  - RBAC: minimal service account permissions
  - Network policies: restrict pod-to-pod communication
  - Pod security policies: non-root, read-only root filesystem
  - Image scanning: Trivy in CI pipeline
  - Runtime security: Falco for anomaly detection

Environment Variables:
  - Secrets injected via Kubernetes Secrets
  - Never commit secrets to Git
  - Never log secrets or credentials
  - Use sealed-secrets for GitOps storage
```

---

# 9. CI/CD Pipeline

## 9.1 Build, Test, Deploy

### GitHub Actions Workflow

```yaml
name: DipChats CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit
      - run: npm run test:integration
      - name: Upload coverage
        uses: codecov/codecov-action@v4

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: |
          docker build -t ghcr.io/dipchats/server:${{ github.sha }} -f apps/server/Dockerfile .
          docker build -t ghcr.io/dipchats/web:${{ github.sha }} -f apps/web/Dockerfile .
      - name: Push to GHCR
        run: |
          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker push ghcr.io/dipchats/server:${{ github.sha }}
          docker push ghcr.io/dipchats/web:${{ github.sha }}

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: |
          kubectl set image deployment/dipchats-api             api=ghcr.io/dipchats/server:${{ github.sha }}             -n dipchats-staging
          kubectl set image deployment/dipchats-websocket             websocket=ghcr.io/dipchats/server:${{ github.sha }}             -n dipchats-staging

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production (ArgoCD)
        run: |
          argocd app set dipchats             --parameter imageTag=${{ github.sha }}
          argocd app sync dipchats --prune
```

## 9.2 Blue-Green Deployment

```text
Blue-Green Strategy:

  Blue (current):
    - 3 API pods serving production traffic
    - 3 WebSocket pods serving connections
    - All pods on version N

  Green (new):
    - 3 API pods with version N+1 (not yet receiving traffic)
    - 3 WebSocket pods with version N+1
    - Running health checks

  Switch Process:
    1. Deploy green pods alongside blue
    2. Wait for green pods to pass readiness checks
    3. Update Ingress backend to point to green service
    4. Drain existing WebSocket connections from blue (grace period: 60s)
    5. Monitor error rates for 5 minutes
    6. If healthy: terminate blue pods
    7. If unhealthy: revert Ingress to blue, terminate green

  Rollback Trigger:
    - Error rate > 5% for 2 minutes
    - p99 latency > 3 seconds for 2 minutes
    - Any pod in CrashLoopBackOff
    - Health check failures > 3 consecutive
```

## 9.3 Rollback Strategy

```text
Automated Rollback:
  - ArgoCD keeps last 10 successful sync states
  - On failed deployment: auto-revert to previous state
  - Alert sent to team via Slack/PagerDuty

Manual Rollback:
  - argocd app history dipchats
  - argocd app rollback dipchats <revision>

Database Rollback:
  - Migrations must be backward-compatible
  - Never drop columns in a single migration
  - Rollback scripts tested for every migration
  - Point-in-time recovery available for data issues

Client Rollback:
  - Web: Previous version served from CDN cache
  - Mobile: App store version (no immediate rollback possible)
  - Desktop: Auto-update with rollback to previous version
```

---

# 10. Scaling Targets

## 10.1 Concurrent Users

| Tier | Concurrent Users | WebSocket Pods | API Pods | Database Connections |
|------|-----------------|----------------|----------|---------------------|
| Small | 1,000 | 3 | 3 | 50 |
| Medium | 10,000 | 5 | 5 | 100 |
| Large | 50,000 | 8 | 8 | 200 |
| X-Large | 100,000+ | 10+ | 10+ | 300+ |

## 10.2 Messages Per Second

| Tier | Messages/sec | Redis Ops/sec | DB Writes/sec |
|------|-------------|---------------|---------------|
| Small | 100 | 1,000 | 50 |
| Medium | 1,000 | 10,000 | 500 |
| Large | 5,000 | 50,000 | 2,500 |
| X-Large | 10,000+ | 100,000+ | 5,000+ |

## 10.3 File Storage Capacity

| Tier | Storage | Files | Bandwidth |
|------|---------|-------|-----------|
| Small | 100 GiB | 100,000 | 10 GB/month |
| Medium | 1 TiB | 1,000,000 | 100 GB/month |
| Large | 10 TiB | 10,000,000 | 1 TB/month |
| X-Large | 100+ TiB | 100,000,000+ | 10+ TB/month |

## 10.4 Resource Sizing Guidelines

```text
Per WebSocket Connection:
  - Memory: ~50 KB (connection state + buffers)
  - CPU: ~0.1 ms per message (encryption + routing)
  - Network: ~1 KB/s average (heartbeat + messages)

Per API Request:
  - Memory: ~1 MB (request/response buffers)
  - CPU: ~5 ms average (validation + business logic)
  - Database: 1-3 queries per request

Per Message (end-to-end):
  - Server CPU: ~2 ms (validate, persist, fan-out)
  - Redis ops: 2-5 (pub/sub, presence check)
  - DB writes: 1 (message insert)
  - DB reads: 0-10 (membership lookup for fan-out)
```

---

# 11. Disaster Recovery

## 11.1 RTO/RPO Targets

| Metric | Target | Implementation |
|--------|--------|---------------|
| RPO (Recovery Point Objective) | 1 minute | WAL archiving, Redis AOF |
| RTO (Recovery Time Objective) | 30 minutes | Automated failover, backup restoration |
| Availability | 99.95% | Multi-replica, health checks, auto-restart |
| Data Durability | 99.999999999% | Replicated storage, cross-region backup |

## 11.2 Multi-Region Strategy

```text
Primary Region: us-east-1
  - Full deployment (API, WS, DB, Redis, MinIO)
  - All write traffic
  - Active-active for reads

Secondary Region: us-west-2
  - Read replicas (PostgreSQL)
  - Redis replica (async replication)
  - MinIO replica (cross-region replication)
  - Passive standby for writes
  - Activated on primary region failure

Failover Procedure:
  1. Primary region health checks fail (3 consecutive)
  2. DNS failover to secondary region (Route53 health check)
  3. Promote PostgreSQL replica to primary
  4. Redis replica becomes primary (sentinel or manual)
  5. MinIO replica becomes primary
  6. API/WS pods in secondary region start serving
  7. Clients auto-reconnect (WebSocket reconnection)

DNS TTL: 60 seconds (for fast failover)
Health Check Interval: 10 seconds
Failure Threshold: 3 missed checks (30 seconds)
```

## 11.3 Failover Procedures

```text
Scenario 1: Single Pod Failure
  - Kubernetes auto-restarts pod (liveness probe)
  - No manual intervention required
  - Target recovery: < 30 seconds

Scenario 2: Node Failure
  - Kubernetes reschedules pods to healthy nodes
  - Topology spread ensures distribution
  - Target recovery: < 2 minutes

Scenario 3: Database Primary Failure
  - PgBouncer detects connection failure
  - Replication automatically promotes replica
  - Application reconnects via PgBouncer
  - Target recovery: < 5 minutes
  - Manual: Restore primary from WAL archive

Scenario 4: Redis Cluster Node Failure
  - Cluster detects node failure (cluster-node-timeout: 5000ms)
  - Replica promoted automatically
  - Application reconnects via cluster
  - Target recovery: < 10 seconds

Scenario 5: Complete Region Failure
  - DNS failover to secondary region
  - Promote all replicas
  - Full service restoration
  - Target recovery: < 30 minutes

Scenario 6: Data Corruption
  - Identify corruption scope
  - Restore from point-in-time backup
  - Replay WAL to target timestamp
  - Validate data integrity
  - Target recovery: < 2 hours
```

---

# 12. Cost Estimation Guidelines

## 12.1 Infrastructure Cost Breakdown

| Component | Small (1K users) | Medium (10K users) | Large (50K users) |
|-----------|------------------|--------------------|--------------------|
| Kubernetes (3 nodes) | $150/mo | $300/mo | $600/mo |
| API/WS Pods (6 total) | Included | Included | Included |
| PostgreSQL (primary + 2 replicas) | $200/mo | $400/mo | $800/mo |
| PgBouncer (2 pods) | $20/mo | $40/mo | $80/mo |
| Redis Cluster (6 nodes) | $100/mo | $200/mo | $400/mo |
| MinIO (4 nodes, 2TB each) | $200/mo | $400/mo | $800/mo |
| Storage (SSD, 500Gi) | $50/mo | $100/mo | $200/mo |
| CDN (Cloudflare Pro) | $20/mo | $200/mo | $500/mo |
| Monitoring (Prometheus + Grafana) | $50/mo | $100/mo | $200/mo |
| Backup Storage | $20/mo | $50/mo | $100/mo |
| DNS + TLS | $10/mo | $10/mo | $10/mo |
| **Total** | **~$820/mo** | **~$1,800/mo** | **~$3,690/mo** |

## 12.2 Cost Optimization Strategies

```text
Reserved Instances:
  - 1-year commitment: 30-40% discount
  - 3-year commitment: 50-60% discount
  - Apply to: Kubernetes nodes, database, Redis

Spot Instances:
  - API/WS pods: 60-70% discount (use with 1+ on-demand)
  - Monitoring pods: 70-80% discount
  - Non-critical workloads: use spot

Storage Tiering:
  - Hot (SSD): Active data, recent messages
  - Warm (HDD): Messages > 30 days, old attachments
  - Cold (Archive): Messages > 1 year, compliance data

Auto-scaling:
  - Scale down during off-peak hours (2 AM - 6 AM)
  - Pre-warm for peak hours (6 PM - 10 PM)
  - Use scheduled scaling for predictable patterns

CDN Optimization:
  - Cache static assets aggressively (1 year)
  - Compress with Brotli (better than gzip)
  - Use HTTP/3 for faster transfers
  - Edge functions for dynamic content
```

## 12.3 Scaling Cost Tiers

```text
Tier 1: Prototype / Early Access
  - 1-100 concurrent users
  - Single node deployment
  - Managed PostgreSQL (e.g., Supabase, Neon)
  - Managed Redis (e.g., Upstash, Redis Cloud)
  - MinIO single-node
  - Estimated: $50-100/mo

Tier 2: Growth
  - 100-1,000 concurrent users
  - 3-node Kubernetes cluster
  - PostgreSQL primary + 1 replica
  - Redis 3-node cluster
  - MinIO 4-node cluster
  - Estimated: $500-1,000/mo

Tier 3: Scale
  - 1,000-10,000 concurrent users
  - 6-node Kubernetes cluster
  - PostgreSQL primary + 2 replicas
  - Redis 6-node cluster
  - MinIO 4-node cluster with replication
  - CDN included
  - Estimated: $1,500-3,000/mo

Tier 4: Enterprise
  - 10,000-100,000+ concurrent users
  - 12+ node Kubernetes cluster
  - PostgreSQL primary + 3+ replicas
  - Redis 6+ node cluster
  - MinIO 8+ node cluster
  - Multi-region deployment
  - Dedicated support
  - Estimated: $5,000-15,000+/mo
```