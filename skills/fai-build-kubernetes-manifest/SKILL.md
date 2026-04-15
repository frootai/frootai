---
name: fai-build-kubernetes-manifest
description: |
  Generate Kubernetes manifests with resource limits, health probes, secrets via
  CSI driver, HPA autoscaling, and rollout strategies. Use when deploying AI
  workloads to AKS or Kubernetes.
---

# Kubernetes Manifest Patterns

Generate production manifests with limits, probes, secrets, and rollout strategies.

## When to Use

- Deploying AI inference services to AKS
- Setting up GPU workloads for model serving
- Configuring autoscaling for variable AI traffic
- Implementing rolling updates with health checks

---

## Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-api
spec:
  replicas: 2
  selector: { matchLabels: { app: ai-api } }
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  template:
    metadata: { labels: { app: ai-api } }
    spec:
      containers:
        - name: api
          image: myacr.azurecr.io/ai-api:v1.2.0
          ports: [{ containerPort: 8000 }]
          resources:
            requests: { cpu: "500m", memory: "512Mi" }
            limits: { cpu: "2", memory: "2Gi" }
          env:
            - name: AZURE_OPENAI_ENDPOINT
              valueFrom: { secretKeyRef: { name: ai-secrets, key: endpoint } }
          livenessProbe:
            httpGet: { path: /health, port: 8000 }
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet: { path: /ready, port: 8000 }
            initialDelaySeconds: 5
            periodSeconds: 10
```

## HPA Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: ai-api-hpa }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: ai-api }
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
```

## Service + Ingress

```yaml
apiVersion: v1
kind: Service
metadata: { name: ai-api }
spec:
  selector: { app: ai-api }
  ports: [{ port: 80, targetPort: 8000 }]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ai-api
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls: [{ hosts: [api.example.com], secretName: tls-cert }]
  rules:
    - host: api.example.com
      http:
        paths: [{ path: /, pathType: Prefix,
                  backend: { service: { name: ai-api, port: { number: 80 } } } }]
```

## Secrets with Azure Key Vault CSI

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata: { name: ai-secrets-provider }
spec:
  provider: azure
  parameters:
    useVMManagedIdentity: "true"
    keyvaultName: kv-prod
    objects: |
      array:
        - objectName: openai-endpoint
          objectType: secret
    tenantId: "your-tenant-id"
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| CrashLoopBackOff | Startup probe too aggressive | Increase failureThreshold |
| OOMKilled | Memory limit too low | Increase limit, profile actual usage |
| HPA not scaling | metrics-server missing | Install metrics-server or KEDA |
| Secret mount empty | CSI driver not installed | Install secrets-store-csi-driver |
