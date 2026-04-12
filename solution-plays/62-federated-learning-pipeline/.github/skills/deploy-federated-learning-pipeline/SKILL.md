---
name: "deploy-federated-learning-pipeline"
description: "Deploy Federated Learning Pipeline — FedAvg server, client local training, differential privacy, secure aggregation via Confidential Computing, convergence monitoring, non-IID handling."
---

# Deploy Federated Learning Pipeline

## Prerequisites

- Azure CLI authenticated (`az login`)
- Azure subscription with these resource providers:
  - `Microsoft.MachineLearningServices` (Azure ML for training orchestration)
  - `Microsoft.Compute` (VMs for client nodes / Confidential Computing for aggregation)
  - `Microsoft.App` (Container Apps for federated server)
  - `Microsoft.KeyVault` (secret management)
- Python 3.11+ with `flwr` (Flower), `torch`, `opacus` (DP), `azure-ai-ml` packages
- `.env` file with: `AZURE_ML_WORKSPACE`, `AZURE_ML_RESOURCE_GROUP`, `AZURE_OPENAI_KEY`

## Step 1: Provision Infrastructure

```bash
az group create --name rg-frootai-federated-learning --location eastus2

az deployment group create \
  --resource-group rg-frootai-federated-learning \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=prod

az keyvault secret set --vault-name kv-federated \
  --name openai-key --value "$AZURE_OPENAI_KEY"
```

## Step 2: Deploy Federated Server

```python
# federated_server.py — central aggregation server (NO data access)
import flwr as fl
from flwr.server.strategy import FedAvg

class FrootAIFedServer:
    def __init__(self, config):
        self.min_clients = config.get("min_clients_per_round", 3)
        self.max_rounds = config.get("max_rounds", 100)
        self.convergence_threshold = config.get("convergence_threshold", 0.001)
        self.dp_config = config.get("differential_privacy", {})

    def start(self, server_address: str = "[::]:8080"):
        strategy = FedAvg(
            min_fit_clients=self.min_clients,
            min_evaluate_clients=self.min_clients,
            min_available_clients=self.min_clients,
            evaluate_metrics_aggregation_fn=self.aggregate_metrics,
            on_fit_config_fn=self.get_fit_config,
        )

        fl.server.start_server(
            server_address=server_address,
            config=fl.server.ServerConfig(num_rounds=self.max_rounds),
            strategy=strategy,
        )

    def get_fit_config(self, server_round: int) -> dict:
        """Per-round configuration sent to clients."""
        return {
            "epochs": 3,
            "learning_rate": 0.01 * (0.99 ** server_round),  # LR decay
            "batch_size": 32,
            "dp_epsilon": self.dp_config.get("epsilon", 1.0),
            "dp_delta": self.dp_config.get("delta", 1e-5),
            "dp_max_grad_norm": self.dp_config.get("max_grad_norm", 1.0),
        }
```

Server architecture:
| Component | Role | Data Access |
|-----------|------|-------------|
| Federated Server | Aggregation + orchestration | **NO data access** — only model weights |
| Client Nodes | Local training on private data | **Local data ONLY — never leaves node** |
| Secure Aggregator | Confidential enclave | Model updates only, encrypted |

## Step 3: Deploy Client Training Node

```python
# federated_client.py — trains locally, never shares raw data
import flwr as fl
from opacus import PrivacyEngine

class FrootAIFedClient(fl.client.NumPyClient):
    def __init__(self, model, train_data, config):
        self.model = model
        self.train_data = train_data  # LOCAL data — never leaves this node
        self.privacy_engine = None

    def fit(self, parameters, config):
        # 1. Set model weights from server
        self.set_parameters(parameters)

        # 2. Apply differential privacy to optimizer
        if config.get("dp_epsilon"):
            self.privacy_engine = PrivacyEngine()
            self.model, optimizer, self.train_loader = self.privacy_engine.make_private(
                module=self.model,
                optimizer=optimizer,
                data_loader=self.train_loader,
                noise_multiplier=self._compute_noise(config["dp_epsilon"], config["dp_delta"]),
                max_grad_norm=config["dp_max_grad_norm"],
            )

        # 3. Train locally (data NEVER leaves this node)
        for epoch in range(config["epochs"]):
            for batch in self.train_loader:
                loss = self._train_step(batch)

        # 4. Return ONLY model weight updates (not data)
        return self.get_parameters(), len(self.train_data), {"loss": loss}
```

Privacy guarantees:
| Layer | Protection | Implementation |
|-------|-----------|---------------|
| Data | Never leaves client node | Client trains locally, sends only gradients |
| Gradients | Differential privacy noise | Opacus PrivacyEngine with configurable ε |
| Aggregation | Secure enclave | Azure Confidential Computing (optional) |
| Communication | Encrypted channel | TLS 1.3 between client and server |

## Step 4: Deploy Secure Aggregation (Optional)

```bash
# Deploy Azure Confidential Computing for secure aggregation
az vm create \
  --name cc-aggregator \
  --resource-group rg-frootai-federated-learning \
  --image Canonical:0001-com-ubuntu-confidential-vm-jammy:22_04-lts-cvm:latest \
  --size Standard_DC4s_v3 \
  --security-type ConfidentialVM \
  --enable-secure-boot true --enable-vtpm true
```

Secure aggregation ensures:
- Model updates encrypted in transit and at processing
- Aggregation happens inside hardware enclave (SGX/SEV)
- Server cannot inspect individual client updates

## Step 5: Deploy Convergence Monitor

```python
# convergence.py — track global model quality per round
class ConvergenceMonitor:
    def __init__(self, threshold=0.001, patience=5):
        self.threshold = threshold
        self.patience = patience
        self.history = []

    def check(self, round_metrics: dict) -> dict:
        self.history.append(round_metrics["loss"])

        if len(self.history) < self.patience:
            return {"converged": False, "status": "warming_up"}

        # Check if improvement < threshold for `patience` rounds
        recent = self.history[-self.patience:]
        improvement = recent[0] - recent[-1]

        if improvement < self.threshold:
            return {"converged": True, "status": "converged", "rounds": len(self.history)}
        if recent[-1] > recent[0]:
            return {"converged": False, "status": "diverging", "alert": True}

        return {"converged": False, "status": "improving", "improvement": improvement}
```

## Step 6: Handle Non-IID Data

```python
# fedprox.py — handles heterogeneous client data distributions
class FedProxStrategy(FedAvg):
    """FedProx: adds proximal term to handle non-IID data across clients."""
    def __init__(self, mu=0.01, **kwargs):
        super().__init__(**kwargs)
        self.mu = mu  # Proximal term weight

    def get_fit_config(self, server_round):
        config = super().get_fit_config(server_round)
        config["proximal_mu"] = self.mu  # Client adds ||w - w_global||² penalty
        return config
```

Non-IID handling strategies:
| Strategy | When to Use | Trade-off |
|----------|------------|-----------|
| FedAvg | IID data across clients | Fast convergence, fails on non-IID |
| FedProx | Mild non-IID (label skew) | Slightly slower, much more stable |
| SCAFFOLD | Severe non-IID | Most stable, highest communication cost |
| Per-client fine-tune | Very heterogeneous | Best per-client, no global model |

## Step 7: Deploy and Verify

```bash
# Deploy server
az containerapp create \
  --name fed-server \
  --resource-group rg-frootai-federated-learning \
  --environment fed-env \
  --image acrFederated.azurecr.io/fed-server:latest \
  --target-port 8080 --min-replicas 1

# Start federated training
python -c "
from federated_server import FrootAIFedServer
import json
config = json.load(open('config/openai.json'))
server = FrootAIFedServer(config)
server.start()
"

# Monitor convergence
curl https://fed-server.azurecontainerapps.io/api/status
```

## Verification Checklist

| Check | Method | Expected |
|-------|--------|----------|
| Server running | Health check | 200 OK |
| Client connects | Start client | Connected to server |
| Local training | Run round | Loss decreasing per client |
| Aggregation | Check global model | Weights updated |
| DP noise applied | Check Opacus logs | Noise multiplier active |
| Convergence tracking | Check /status | Loss trend decreasing |
| Data isolation | Network audit | No data transferred, only gradients |
| Secure aggregation | Enclave attestation | Aggregation in enclave |
| Non-IID handling | FedProx active | Proximal term in client training |

## Rollback Procedure

```bash
# Stop training and revert to previous global model
curl -X POST https://fed-server.azurecontainerapps.io/api/rollback \
  -d '{"target_round": "previous"}'

az containerapp revision list --name fed-server \
  --resource-group rg-frootai-federated-learning
```
