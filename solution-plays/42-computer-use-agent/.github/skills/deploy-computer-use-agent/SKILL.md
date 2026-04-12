---
name: "deploy-computer-use-agent"
description: "Deploy Computer Use Agent — vision-based desktop/web automation with screenshot→reason→act loop, sandbox VM isolation, accessibility API integration, and action replay."
---

# Deploy Computer Use Agent

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.Compute` (VM for sandbox environment)
  - `Microsoft.CognitiveServices` (Azure OpenAI GPT-4o Vision)
  - `Microsoft.App` (Container Apps for orchestrator)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `pyautogui`, `Pillow`, `mss` packages
- `.env` file with: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `VM_ADMIN_PASSWORD`

## Step 1: Provision Sandbox VM

```bash
# Create resource group
az group create --name rg-frootai-computer-use-agent --location eastus2

# Deploy sandbox VM (isolated environment for agent actions)
az deployment group create \
  --resource-group rg-frootai-computer-use-agent \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters vmAdminPassword="$VM_ADMIN_PASSWORD"
```

Sandbox VM requirements:
- **OS**: Windows 11 or Ubuntu Desktop 22.04 (with GUI)
- **Size**: Standard_D4s_v5 (4 vCPU, 16GB RAM) minimum
- **GPU**: Optional — Standard_NC4as_T4_v3 for faster screenshot processing
- **Network**: VNet-isolated, no internet access by default (whitelist specific URLs)
- **Identity**: System-assigned managed identity for Key Vault access
- **Snapshot**: Take VM snapshot before each automation run for rollback

```bash
# Create VM snapshot for rollback capability
az snapshot create \
  --resource-group rg-frootai-computer-use-agent \
  --name snapshot-pre-automation-$(date +%Y%m%d) \
  --source /subscriptions/$SUB_ID/resourceGroups/rg-frootai-computer-use-agent/providers/Microsoft.Compute/disks/computer-use-os-disk
```

## Step 2: Deploy Vision Model

```bash
# Deploy GPT-4o for screenshot analysis and action planning
az cognitiveservices account deployment create \
  --name openai-computer-use \
  --resource-group rg-frootai-computer-use-agent \
  --deployment-name gpt-4o-vision \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 30 --sku-name Standard

# Store API key in Key Vault
az keyvault secret set --vault-name kv-computer-use \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

Vision model configuration:
- **detail**: `low` for navigation (85 tokens/image), `high` for text reading (1105+ tokens)
- **max_tokens**: 300 for simple actions, 800 for complex multi-step reasoning
- **Temperature**: 0.1 for deterministic action selection

## Step 3: Deploy Agent Orchestrator

```python
# agent_orchestrator.py — core screenshot→reason→act loop
import pyautogui
import mss
from PIL import Image
from openai import AzureOpenAI
import base64, io, json

class ComputerUseAgent:
    def __init__(self, config):
        self.client = AzureOpenAI(
            azure_endpoint=config["endpoint"],
            api_version="2024-08-06",
        )
        self.max_steps = config.get("max_steps", 20)
        self.screenshot_width = config.get("screenshot_width", 1280)
        self.wait_after_action = config.get("wait_seconds", 0.5)
        self.action_history = []
        self.blocked_actions = config.get("blocked_actions", [])

    async def execute_task(self, task: str):
        for step in range(self.max_steps):
            screenshot = self.capture_screenshot()
            action = await self.decide_action(screenshot, task)

            # Safety: check action against blocked list
            if action["type"] in self.blocked_actions:
                return {"status": "blocked", "reason": f"Action {action['type']} is blocked"}

            # Safety: confirm destructive actions
            if action["type"] in ["delete", "format", "uninstall"]:
                if not await self.confirm_destructive(action):
                    continue

            # Loop detection: same action 3 times = stuck
            if self.detect_loop(action):
                return {"status": "stuck", "step": step, "last_action": action}

            self.execute_action(action)
            self.action_history.append(action)
            await asyncio.sleep(self.wait_after_action)

            if action["type"] == "done":
                return {"status": "completed", "steps": step + 1, "result": action.get("result")}

        return {"status": "max_steps_reached", "steps": self.max_steps}
```

## Step 4: Deploy Container Apps Orchestrator

```bash
# Build and deploy orchestrator
az acr build --registry acrComputerUse \
  --image computer-use-agent:latest .

az containerapp create \
  --name computer-use-orchestrator \
  --resource-group rg-frootai-computer-use-agent \
  --environment computer-use-env \
  --image acrComputerUse.azurecr.io/computer-use-agent:latest \
  --target-port 8080 \
  --min-replicas 0 --max-replicas 2 \
  --secrets openai-key=keyvaultref:kv-computer-use/openai-key \
  --env-vars OPENAI_KEY=secretref:openai-key VM_HOST=$VM_IP
```

## Step 5: Configure Security Controls

```json
// config/guardrails.json — security controls
{
  "sandbox": {
    "vm_isolation": true,
    "network_whitelist": ["internal.contoso.com"],
    "no_internet": true,
    "snapshot_before_run": true,
    "auto_rollback_on_failure": true
  },
  "actions": {
    "max_steps": 20,
    "blocked_actions": ["format_disk", "registry_edit", "install_software", "change_password"],
    "require_confirmation": ["delete", "send_email", "submit_form", "make_purchase"],
    "allowed_applications": ["excel.exe", "outlook.exe", "chrome.exe", "notepad.exe"],
    "credential_entry_blocked": true
  },
  "recording": {
    "record_all_actions": true,
    "screenshot_every_step": true,
    "store_action_replay": true,
    "retention_days": 30
  }
}
```

## Step 6: Verify Deployment

```bash
# Health check
curl https://computer-use-orchestrator.azurecontainerapps.io/health

# Test with simple task
curl -X POST https://computer-use-orchestrator.azurecontainerapps.io/api/task \
  -H "Content-Type: application/json" \
  -d '{"task": "Open Notepad and type Hello World", "max_steps": 5}'

# Verify action replay
curl https://computer-use-orchestrator.azurecontainerapps.io/api/replays/latest
```

## Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| Sandbox VM running | `az vm show` | PowerState: running |
| VM snapshot exists | `az snapshot list` | Pre-automation snapshot |
| Network isolation | `az network nsg show` | Only whitelist rules |
| Vision model deployed | OpenAI deployment show | gpt-4o-vision active |
| Orchestrator healthy | `curl /health` | 200 OK |
| Screenshot capture | Test task | Screenshot saved to blob |
| Action execution | Simple automation | Task completed in <20 steps |
| Loop detection | Stuck task | Agent exits with "stuck" status |
| Blocked actions | Try blocked action | Action rejected |
| Action replay | GET /replays | Full history with screenshots |

## Rollback Procedure

```bash
# Restore VM from pre-automation snapshot
az vm deallocate --name computer-use-vm \
  --resource-group rg-frootai-computer-use-agent
az disk swap-os \
  --vm-name computer-use-vm \
  --resource-group rg-frootai-computer-use-agent \
  --ids $SNAPSHOT_DISK_ID
az vm start --name computer-use-vm \
  --resource-group rg-frootai-computer-use-agent
```
