---
description: "Kubernetes standards — pod security, resource limits, health probes, and production deployment patterns."
applyTo: "**/*.yaml, **/*.yml"
waf:
  - "security"
  - "reliability"
  - "performance-efficiency"
---

# Kubernetes — FAI Standards

## Pod Security Standards

Enforce the `restricted` Pod Security Standard at the namespace level. Never run containers as root.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ai-workloads
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

All pods must set a non-root security context:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 65534
  runAsGroup: 65534
  fsGroup: 65534
  seccompProfile:
    type: RuntimeDefault
containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
```

## Resource Requests and Limits

Every container must declare CPU and memory requests AND limits. GPU workloads use `nvidia.com/gpu`.

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "2"
    memory: "2Gi"
# GPU inference pod:
resources:
  requests:
    cpu: "4"
    memory: "16Gi"
    nvidia.com/gpu: "1"
  limits:
    cpu: "8"
    memory: "32Gi"
    nvidia.com/gpu: "1"
```

- Never omit requests — scheduler can't bin-pack without them
- Set limits ≥ requests — limits < requests is invalid
- Memory limits prevent OOMKill cascades across nodes
- Use LimitRange per namespace to enforce defaults

## Health Probes

All long-running pods must define liveness, readiness, and startup probes:

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30
  periodSeconds: 5
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 20
  failureThreshold: 3
```

- Startup probe gates liveness — prevents restart loops for slow-starting AI models
- Readiness controls Service traffic — remove pod from endpoints when overloaded
- Liveness detects deadlocks — restart only when truly stuck, not during load spikes

## Autoscaling

### HPA (CPU/memory-based)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: inference-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: inference
  minReplicas: 2
  maxReplicas: 20
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### KEDA (event-driven)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: queue-processor
spec:
  scaleTargetRef:
    name: queue-worker
  minReplicaCount: 0
  maxReplicaCount: 50
  cooldownPeriod: 120
  triggers:
    - type: azure-servicebus
      metadata:
        queueName: inference-requests
        messageCount: "5"
```

- KEDA for queue-driven scale-to-zero (Service Bus, Event Hubs, Kafka)
- HPA `scaleDown.stabilizationWindowSeconds: 300` prevents flapping
- Never set `maxReplicas` without cluster resource headroom validation

## Network Policies

Default-deny ingress per namespace, then allow explicitly:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: ai-workloads
spec:
  podSelector: {}
  policyTypes: ["Ingress"]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-inference
  namespace: ai-workloads
spec:
  podSelector:
    matchLabels:
      app: inference
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-gateway
      ports:
        - port: 8080
          protocol: TCP
```

## RBAC and ServiceAccounts

One ServiceAccount per workload. Never use `default`. Bind least-privilege roles.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: inference-sa
  namespace: ai-workloads
  annotations:
    azure.workload.identity/client-id: "<managed-identity-client-id>"
automountServiceAccountToken: false
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: inference-role
  namespace: ai-workloads
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "watch"]
    resourceNames: ["inference-config"]
```

- `automountServiceAccountToken: false` unless the pod needs API server access
- Use Azure Workload Identity — never mount static credentials
- Bind to `Role` (namespaced), not `ClusterRole`, unless cross-namespace access is required

## Secrets Management

Use `external-secrets-operator` syncing from Azure Key Vault. Never store sensitive data in native k8s Secrets for production.

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: openai-credentials
  namespace: ai-workloads
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: azure-keyvault
    kind: ClusterSecretStore
  target:
    name: openai-credentials
  data:
    - secretKey: AZURE_OPENAI_KEY
      remoteRef:
        key: openai-api-key
```

## Disruption Budgets

Every production Deployment needs a PDB:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: inference-pdb
spec:
  minAvailable: "50%"
  selector:
    matchLabels:
      app: inference
```

## Topology and GPU Scheduling

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app: inference
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: accelerator
              operator: In
              values: ["nvidia-a100", "nvidia-t4"]
tolerations:
  - key: "nvidia.com/gpu"
    operator: "Exists"
    effect: "NoSchedule"
```

- Zone-spread critical workloads with `maxSkew: 1` + `DoNotSchedule`
- Taint GPU nodes with `nvidia.com/gpu:NoSchedule` — only GPU pods tolerate
- Use `nodeAffinity` to pin inference to specific GPU SKUs

## Namespace and Labeling Conventions

```yaml
metadata:
  namespace: ai-workloads
  labels:
    app.kubernetes.io/name: inference
    app.kubernetes.io/component: model-serving
    app.kubernetes.io/part-of: rag-pipeline
    app.kubernetes.io/version: "1.4.2"
    app.kubernetes.io/managed-by: helm
  annotations:
    fai.dev/play: "01-enterprise-rag"
    fai.dev/waf: "reliability,security"
```

- Use `app.kubernetes.io/*` standard labels on every resource
- Namespace per environment: `ai-dev`, `ai-staging`, `ai-prod`
- Annotations for non-identifying metadata (play ID, WAF pillars, cost center)

## Helm and Kustomize

- Helm: pin chart versions in `Chart.lock`, use `.helmignore`, template all environment-specific values
- Kustomize: base + overlays per environment, use `configMapGenerator` with `behavior: merge`
- Never use `helm install` without `--atomic` — failed releases auto-rollback
- Store Helm values in Git, not `--set` flags — reproducibility over convenience

## Anti-Patterns

- ❌ Running containers as root or with `privileged: true`
- ❌ Omitting resource requests/limits — causes noisy-neighbor evictions
- ❌ Using `latest` image tag — breaks reproducibility, defeats rollback
- ❌ Storing API keys in ConfigMaps or native Secrets without external-secrets-operator
- ❌ Single replica with no PDB — node drain kills your service
- ❌ Liveness probe hitting a dependency (DB, external API) — cascading restarts
- ❌ `ClusterRoleBinding` to `cluster-admin` for application ServiceAccounts
- ❌ No network policies — any pod can reach any pod (flat network)
- ❌ GPU nodes without taints — non-GPU pods scheduled on expensive GPU VMs

## WAF Alignment

| Pillar | Kubernetes Practice |
| --- | --- |
| **Security** | Restricted PSS, non-root, drop ALL caps, RBAC least-privilege, Workload Identity, external-secrets-operator, NetworkPolicy default-deny |
| **Reliability** | PDBs, topology spread across zones, startup/readiness/liveness probes, graceful shutdown (preStop + terminationGracePeriodSeconds) |
| **Performance** | GPU node affinity, KEDA scale-to-zero, HPA with stabilization window, resource requests for scheduler bin-packing |
| **Cost** | Scale-to-zero with KEDA, right-sized requests (not over-provisioned), spot/preemptible nodes for batch, GPU taints prevent waste |
| **Operations** | Helm atomic deploys, kustomize overlays, standard labels, namespace isolation, GitOps with Flux/ArgoCD |
| **Responsible AI** | Content Safety as sidecar or init container, audit logging via Falco, workload isolation for PII-processing pods |
