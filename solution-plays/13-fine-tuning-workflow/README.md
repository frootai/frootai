# Play 13 — Fine-Tuning Workflow 🔬

> End-to-end fine-tuning with data prep, LoRA training, evaluation, and deployment.

Curate training data, configure LoRA parameters, train on Azure ML or Azure OpenAI, evaluate with automated metrics, then deploy the fine-tuned model. MLflow tracks experiments. Handles data validation, train/val splitting, hyperparameter sweeps, and model versioning.

## Quick Start
```bash
cd solution-plays/13-fine-tuning-workflow

# Provision Azure ML workspace
az ml workspace create --name $WORKSPACE --resource-group $RG

# Prepare and validate training data
python scripts/validate_data.py --input data/training.jsonl

code .  # Use @builder for data prep/training, @reviewer for quality audit, @tuner for hyperparams
```

## Architecture
| Service | Purpose |
|---------|---------|
| Azure ML Workspace | Experiment tracking, compute management |
| GPU Compute (NC/ND series) | LoRA training compute |
| Azure OpenAI | Fine-tuning API (gpt-4o-mini, gpt-4o) |
| MLflow | Experiment tracking, model versioning |
| Azure Storage | Training data, model artifacts |

## Key Training Parameters
| Parameter | Default | Range |
|-----------|---------|-------|
| LoRA rank | 16 | 4-128 |
| Learning rate | 1e-4 | 1e-5 to 5e-4 |
| Epochs | 3 | 1-10 |
| Batch size | 4 | 1-32 |

## DevKit (ML Engineering-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (data prep + training), Reviewer (overfitting + quality), Tuner (hyperparams + cost) |
| 3 skills | Deploy (111 lines), Evaluate (100 lines), Tune (120 lines) |
| 4 prompts | `/deploy` (ML workspace), `/test` (pipeline), `/review` (data quality), `/evaluate` (base vs fine-tuned) |

**Note:** This is an MLOps/training play. TuneKit covers LoRA hyperparameters, data quality optimization, compute selection (GPU sizing), and cost per training run — not inference-time parameters.

## Cost
| Component | Estimate |
|-----------|----------|
| gpt-4o-mini fine-tune (500 samples, 3 epochs) | ~$4.50 |
| gpt-4o fine-tune (500 samples, 3 epochs) | ~$37.50 |
| Azure ML LoRA on 7B (NC6s, 2 hrs) | ~$6.12 |
| Azure ML LoRA on 70B (A100, 4 hrs) | ~$14.68 |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/13-fine-tuning-workflow](https://frootai.dev/solution-plays/13-fine-tuning-workflow)
