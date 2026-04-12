---
name: evaluate-edge-ai-deployment
description: "Evaluate Edge AI Deployment — measure fleet deployment success, device compatibility, rollout health, offline resilience, rollback capability. Use when: evaluate, test fleet deployment."
---

# Evaluate Edge AI Deployment

## When to Use
- Validate fleet-wide deployment success rate
- Test device compatibility across hardware types
- Measure rollout health during staged deployment
- Verify offline operation and reconnection
- Test rollback capability end-to-end

## Fleet Deployment Metrics & Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Deployment success rate | ≥ 98% | Modules running / devices targeted |
| Container pull time | < 2 minutes | Image pull to running state |
| Inference availability | ≥ 99.5% | Module uptime on device |
| Rollback success | 100% | Revert completes on all devices |
| Offline inference | 100% | Works with no network |
| Fleet health after rollout | ≥ 98% | Devices reporting healthy |
| Canary error rate | 0% | No errors on canary subset |
| Telemetry sync latency | < 5 min after reconnect | Queued data delivered |

## Step 1: Test Single Device Deployment
```bash
# Deploy to test device
az iot edge set-modules --device-id test-device --hub-name $IOT_HUB --content deployment.json
# Verify module running
az iot hub module-identity show --device-id test-device --module-id ai-inference --hub-name $IOT_HUB
```

## Step 2: Test Canary Rollout
- Deploy to 5% of fleet (canary ring)
- Monitor for 24 hours: error rate, inference latency, device health
- If canary healthy → proceed to 25% → 50% → 100%
- If canary unhealthy → automatic rollback to previous version

## Step 3: Test Cross-Architecture Compatibility
| Architecture | Device Example | Container Base |
|-------------|---------------|----------------|
| x64 | Intel NUC, Azure Stack Edge | amd64 |
| ARM64 | NVIDIA Jetson, RPi 4/5 | arm64v8 |
| ARM32 | Older IoT gateways | arm32v7 |

Build multi-arch images: `docker manifest create` with platform-specific tags.

## Step 4: Test Offline Resilience
1. Deploy model to device
2. Disconnect network
3. Run 100 inference requests → all should succeed
4. Reconnect network
5. Verify: queued telemetry syncs within 5 minutes

## Step 5: Test Rollback
```bash
# Deploy v2 (new version)
az iot edge deployment create --deployment-id prod-v2 --content deployment-v2.json
# Simulate failure → rollback to v1
az iot edge deployment create --deployment-id rollback-v1 --content deployment-v1.json --priority 20
# Verify: all devices running v1 again
```

## Step 6: Generate Report
```bash
python evaluation/eval.py --all --output evaluation/fleet-report.json --ci-gate
```

### Quality Gate Decision
| Result | Action |
|--------|--------|
| All PASS | Proceed with full fleet rollout |
| Deploy success < 95% | Check device connectivity, ACR auth |
| Canary errors | Investigate logs, do NOT proceed to broader rollout |
| Offline fails | Fix cloud dependencies in inference code |
| Rollback fails | Fix deployment priority ordering |

## Evaluation Cadence
- **Pre-rollout**: Single device → canary → staged validation
- **During rollout**: Real-time fleet health monitoring
- **Post-rollout**: 24h stability check, telemetry verification
- **Monthly**: Offline resilience re-test, rollback drill

## Common Failure Patterns

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Module CrashLoopBackOff | OOM or missing dependency | Increase memory limit, check deps |
| Deployment stuck at 50% | Some devices offline | Wait for reconnect, set timeout policy |
| Wrong architecture pulled | No multi-arch manifest | Build with `docker buildx` multi-platform |
| Telemetry gaps after update | Module restart clears buffer | Persist telemetry queue to disk |
| Rollback deploys old config | Config layer not reverted | Version config layer with model layer |
| Canary looks healthy but isn't | Insufficient test traffic | Route more traffic to canary during validation |

## CI/CD Quality Gates
```yaml
- name: Fleet Deployment Gate
  run: python evaluation/eval.py --metrics fleet_health --ci-gate --threshold 0.98
- name: Canary Health Gate
  run: python evaluation/eval.py --metrics canary --ci-gate --error-rate 0
- name: Offline Resilience Gate
  run: python evaluation/test_offline.py --device test-device --verify
```
