const fs = require('fs');
const path = require('path');
const dir = 'c:/CodeSpace/frootai/skills';

const deploys = {
    'fai-deploy-06-document-intelligence': {
        title: 'Deploy Document Intelligence (Play 06)',
        desc: `Deploy Play 06 Document Intelligence with Azure Document Intelligence, Blob Storage, Cosmos DB, and App Service. Covers OCR model provisioning, document queue setup, extraction accuracy validation, and rollback.`,
        when: [
            'Deploying a Document Intelligence extraction pipeline',
            'Setting up OCR + custom model training environments',
            'Promoting document processing from dev → staging → prod',
            'Validating extraction accuracy before production release'
        ],
        stack: [
            ['Azure Document Intelligence', 'OCR + custom extraction', 'S0'],
            ['Blob Storage', 'Document ingestion queue', 'Standard LRS'],
            ['Cosmos DB', 'Extracted data store', 'Serverless'],
            ['App Service', 'Processing API', 'P1v3'],
            ['Key Vault', 'API keys + connection strings', 'Standard'],
            ['Application Insights', 'Processing telemetry', 'Workspace-based']
        ],
        deploy: `# 1. Deploy infrastructure
az deployment group create \\
  --resource-group rg-docint-prod \\
  --template-file infra/main.bicep \\
  --parameters environment=prod

# 2. Train custom extraction model (if applicable)
az cognitiveservices account deployment create \\
  --resource-group rg-docint-prod \\
  --name cog-docint-prod \\
  --deployment-name custom-invoice-model \\
  --model-name prebuilt-invoice --model-version 2024-02-29

# 3. Deploy processing API
az webapp deploy --resource-group rg-docint-prod \\
  --name app-docint-prod --src-path dist/api.zip

# 4. Run extraction accuracy test
python tests/smoke/test_extraction.py \\
  --endpoint https://app-docint-prod.azurewebsites.net \\
  --sample-dir tests/fixtures/sample-documents \\
  --min-accuracy 0.92`,
        rollback: `# Revert to previous API version
az webapp deployment slot swap \\
  --resource-group rg-docint-prod \\
  --name app-docint-prod \\
  --slot staging --target-slot production

# Revert model version if custom model regressed
az cognitiveservices account deployment create \\
  --resource-group rg-docint-prod \\
  --name cog-docint-prod \\
  --deployment-name custom-invoice-model \\
  --model-name prebuilt-invoice --model-version 2023-07-31`,
        health: `curl -s https://app-docint-prod.azurewebsites.net/health | jq .
# Expected: {"status":"healthy","ocr":"connected","storage":"connected","db":"connected"}`,
        troubleshoot: [
            ['Extraction accuracy below threshold', 'Compare training data distribution vs production documents. Check image quality/DPI. Retrain with representative samples.'],
            ['Queue backpressure causing timeouts', 'Scale App Service plan or add queue-based processing with Service Bus. Set per-document timeout to 30s.'],
            ['Custom model training fails', 'Verify labeled dataset has ≥5 samples per field. Check region availability for Document Intelligence custom models.']
        ]
    },
    'fai-deploy-07-multi-agent-service': {
        title: 'Deploy Multi-Agent Service (Play 07)',
        desc: `Deploy Play 07 Multi-Agent Service with Azure Container Apps, Redis, Cosmos DB, and Azure OpenAI. Covers agent orchestrator provisioning, inter-agent communication, health checks, and rollback.`,
        when: [
            'Deploying a multi-agent orchestration platform',
            'Setting up AutoGen/Semantic Kernel agent teams',
            'Promoting agent service from dev → staging → prod',
            'Validating agent delegation and conflict resolution'
        ],
        stack: [
            ['Azure Container Apps', 'Agent runtime hosting', 'Consumption'],
            ['Azure OpenAI', 'LLM inference for agents', 'S0'],
            ['Redis Cache', 'Agent session state', 'C1'],
            ['Cosmos DB', 'Conversation + task history', 'Serverless'],
            ['Service Bus', 'Inter-agent messaging', 'Standard'],
            ['Application Insights', 'Agent telemetry + traces', 'Workspace-based']
        ],
        deploy: `# 1. Deploy infrastructure
az deployment group create \\
  --resource-group rg-agents-prod \\
  --template-file infra/main.bicep \\
  --parameters environment=prod

# 2. Build and push container image
az acr build --registry cracragentsprod \\
  --image agent-service:$(git rev-parse --short HEAD) .

# 3. Deploy to Container Apps
az containerapp update \\
  --resource-group rg-agents-prod \\
  --name ca-agent-orchestrator \\
  --image cracragentsprod.azurecr.io/agent-service:$(git rev-parse --short HEAD)

# 4. Run agent delegation smoke test
python tests/smoke/test_agent_delegation.py \\
  --endpoint https://ca-agent-orchestrator.azurecontainerapps.io \\
  --scenario builder-reviewer-handoff`,
        rollback: `# Revert to previous container revision
az containerapp revision list \\
  --resource-group rg-agents-prod \\
  --name ca-agent-orchestrator --query "[1].name" -o tsv | \\
  xargs -I {} az containerapp ingress traffic set \\
  --resource-group rg-agents-prod --name ca-agent-orchestrator \\
  --revision-weight {}=100`,
        health: `curl -s https://ca-agent-orchestrator.azurecontainerapps.io/health | jq .
# Expected: {"status":"healthy","agents":3,"redis":"connected","llm":"connected"}`,
        troubleshoot: [
            ['Agent delegation loops infinitely', 'Check max-rounds config in orchestrator. Set explicit termination conditions per agent role. Monitor token usage per round.'],
            ['Inter-agent latency exceeds SLA', 'Use Service Bus sessions for ordered delivery. Scale Redis to Premium tier. Check Container Apps min-replicas.'],
            ['Agent produces inconsistent outputs', 'Pin temperature=0 and seed for deterministic agents. Add structured-output JSON schemas. Enable conversation history truncation.']
        ]
    },
    'fai-deploy-08-copilot-studio-bot': {
        title: 'Deploy Copilot Studio Bot (Play 08)',
        desc: `Deploy Play 08 Copilot Studio Bot with Power Platform, Dataverse, Azure OpenAI, and Teams. Covers bot publishing, environment promotion, conversation testing, and rollback.`,
        when: [
            'Publishing a Copilot Studio bot to Teams or web',
            'Promoting bot from dev → test → production environment',
            'Validating conversation flows and topic routing',
            'Rolling back a misbehaving bot deployment'
        ],
        stack: [
            ['Copilot Studio', 'Bot authoring + topic management', 'Per-tenant'],
            ['Dataverse', 'Bot config + conversation logs', 'Standard'],
            ['Azure OpenAI', 'Generative answers + plugins', 'S0'],
            ['Teams', 'Channel deployment', 'Standard'],
            ['Application Insights', 'Conversation analytics', 'Workspace-based']
        ],
        deploy: `# 1. Export bot solution from dev environment
pac solution export --path bot-solution.zip \\
  --name CopilotStudioBot --environment dev-env-id

# 2. Import to production environment
pac solution import --path bot-solution.zip \\
  --environment prod-env-id --activate-plugins

# 3. Publish bot to Teams channel
pac copilot publish --bot-id $BOT_ID \\
  --environment prod-env-id --channel teams

# 4. Run conversation smoke test
python tests/smoke/test_bot_conversations.py \\
  --bot-url https://directline.botframework.com \\
  --scenarios tests/fixtures/conversation-scripts.json`,
        rollback: `# Revert solution to previous version
pac solution export --path bot-solution-rollback.zip \\
  --name CopilotStudioBot --environment prod-env-id \\
  --include previous

# Re-import previous version
pac solution import --path bot-solution-rollback.zip \\
  --environment prod-env-id --force-overwrite`,
        health: `# Check bot health via Direct Line
curl -s -H "Authorization: Bearer $DL_TOKEN" \\
  https://directline.botframework.com/v3/directline/conversations | jq .status`,
        troubleshoot: [
            ['Bot not responding in Teams', 'Verify Teams channel is published and bot is active. Check Copilot Studio > Channels > Teams status. Republish if stuck.'],
            ['Generative answers returning irrelevant content', 'Check knowledge sources in Copilot Studio. Verify Azure OpenAI endpoint and deployment. Update grounding data.'],
            ['Solution import fails', 'Check environment compatibility. Verify all dependencies are present. Use pac solution check before import.']
        ]
    },
    'fai-deploy-09-ai-search-portal': {
        title: 'Deploy AI Search Portal (Play 09)',
        desc: `Deploy Play 09 AI Search Portal with Azure AI Search, Static Web Apps, Azure OpenAI, and Blob Storage. Covers index provisioning, semantic ranking setup, search UI deployment, and rollback.`,
        when: [
            'Deploying an AI-powered search portal',
            'Setting up Azure AI Search with semantic ranking',
            'Promoting search infrastructure from dev → prod',
            'Validating search relevance before production traffic'
        ],
        stack: [
            ['Azure AI Search', 'Vector + semantic search', 'Standard S1'],
            ['Static Web Apps', 'Search portal UI', 'Standard'],
            ['Azure OpenAI', 'Embeddings + reranking', 'S0'],
            ['Blob Storage', 'Document source', 'Standard LRS'],
            ['Key Vault', 'API keys', 'Standard'],
            ['Application Insights', 'Search analytics', 'Workspace-based']
        ],
        deploy: `# 1. Deploy infrastructure
az deployment group create \\
  --resource-group rg-search-prod \\
  --template-file infra/main.bicep \\
  --parameters environment=prod

# 2. Create/update search index with semantic config
az search index create --resource-group rg-search-prod \\
  --service-name srch-portal-prod \\
  --name docs-index \\
  --fields @infra/search-schema.json

# 3. Run indexer to populate data
az search indexer run --resource-group rg-search-prod \\
  --service-name srch-portal-prod --name blob-indexer

# 4. Deploy search portal UI
az staticwebapp deploy --name swa-search-prod \\
  --app-location ./src --output-location ./dist

# 5. Run search relevance tests
python tests/smoke/test_search_relevance.py \\
  --endpoint https://srch-portal-prod.search.windows.net \\
  --queries tests/fixtures/relevance-queries.json \\
  --min-ndcg 0.78`,
        rollback: `# Revert index to previous schema version
az search index create --resource-group rg-search-prod \\
  --service-name srch-portal-prod \\
  --name docs-index \\
  --fields @infra/search-schema-previous.json

# Revert UI
az staticwebapp deploy --name swa-search-prod \\
  --deployment-token $SWA_TOKEN --app-location ./dist-previous`,
        health: `curl -s "https://srch-portal-prod.search.windows.net/indexes/docs-index/docs?api-version=2024-07-01&search=*&\\$count=true" \\
  -H "api-key: $SEARCH_KEY" | jq '.["@odata.count"]'`,
        troubleshoot: [
            ['Search relevance drops after index update', 'Compare scoring profiles. Verify semantic configuration is enabled. Re-run relevance benchmark with golden queries.'],
            ['Indexer fails or stalls', 'Check Blob Storage connection. Verify skillset configuration. Monitor indexer status with az search indexer status.'],
            ['Embedding dimension mismatch', 'Ensure index vector field dimensions match the embedding model. text-embedding-ada-002=1536, text-embedding-3-small=1536.']
        ]
    },
    'fai-deploy-10-content-moderation': {
        title: 'Deploy Content Moderation (Play 10)',
        desc: `Deploy Play 10 Content Moderation with Azure Content Safety, Azure OpenAI, Functions, and Cosmos DB. Covers safety filter provisioning, severity threshold tuning, and moderation pipeline deployment.`,
        when: [
            'Deploying a content moderation pipeline',
            'Setting up Azure Content Safety with custom categories',
            'Promoting moderation filters from dev → prod',
            'Validating moderation accuracy with test datasets'
        ],
        stack: [
            ['Azure Content Safety', 'Text + image moderation', 'S0'],
            ['Azure OpenAI', 'Prompt Shields + groundedness', 'S0'],
            ['Azure Functions', 'Moderation pipeline API', 'Consumption'],
            ['Cosmos DB', 'Moderation audit log', 'Serverless'],
            ['Key Vault', 'API keys', 'Standard'],
            ['Application Insights', 'Moderation telemetry', 'Workspace-based']
        ],
        deploy: `# 1. Deploy infrastructure
az deployment group create \\
  --resource-group rg-moderation-prod \\
  --template-file infra/main.bicep \\
  --parameters environment=prod

# 2. Configure content safety thresholds
az cognitiveservices account update \\
  --resource-group rg-moderation-prod \\
  --name cs-moderation-prod \\
  --custom-domain cs-moderation-prod

# 3. Deploy moderation Functions
func azure functionapp publish func-moderation-prod

# 4. Run moderation accuracy benchmark
python tests/smoke/test_moderation_pipeline.py \\
  --endpoint https://func-moderation-prod.azurewebsites.net \\
  --test-set tests/fixtures/moderation-samples.jsonl \\
  --min-precision 0.95 --min-recall 0.90`,
        rollback: `# Revert Functions to previous version
az functionapp deployment slot swap \\
  --resource-group rg-moderation-prod \\
  --name func-moderation-prod \\
  --slot staging --target-slot production

# Revert severity thresholds to safe defaults
python scripts/reset-safety-thresholds.py --env prod --preset strict`,
        health: `curl -s https://func-moderation-prod.azurewebsites.net/api/health | jq .
# Expected: {"status":"healthy","contentSafety":"connected","categories":["hate","violence","self-harm","sexual"]}`,
        troubleshoot: [
            ['False positive rate too high', 'Lower severity thresholds from Strict to Medium. Add custom blocklist exceptions for domain terms. Test with representative samples.'],
            ['Moderation latency exceeds 500ms', 'Use async moderation with Service Bus queue. Batch small texts. Check Content Safety region proximity.'],
            ['Prompt Shields blocking legitimate requests', 'Tune jailbreak detection sensitivity. Whitelist known safe prompt patterns. Add fallback to permissive mode for low-risk categories.']
        ]
    },
    'fai-deploy-11-ai-landing-zone-advanced': {
        title: 'Deploy AI Landing Zone Advanced (Play 11)',
        desc: `Deploy Play 11 AI Landing Zone Advanced with hub-spoke networking, private endpoints, Azure Policy, and monitoring. Covers governance guardrails, network isolation, and platform-team handoff.`,
        when: [
            'Deploying enterprise AI landing zone with private networking',
            'Setting up hub-spoke topology for AI workloads',
            'Applying Azure Policy governance guardrails',
            'Promoting landing zone from dev → prod subscription'
        ],
        stack: [
            ['Virtual Network (Hub)', 'Central connectivity + firewall', 'Standard'],
            ['Virtual Network (Spoke)', 'AI workload isolation', 'Standard'],
            ['Private Endpoints', 'OpenAI + Search + Storage', 'Standard'],
            ['Azure Policy', 'Governance guardrails', 'Built-in + custom'],
            ['Azure Monitor', 'Platform diagnostics', 'Workspace-based'],
            ['Key Vault', 'Platform secrets', 'Premium (HSM)']
        ],
        deploy: `# 1. Deploy hub network
az deployment sub create \\
  --location eastus2 \\
  --template-file infra/hub/main.bicep \\
  --parameters infra/hub/main.bicepparam

# 2. Deploy spoke for AI workloads
az deployment group create \\
  --resource-group rg-ai-spoke-prod \\
  --template-file infra/spoke/main.bicep \\
  --parameters environment=prod hubVnetId=$HUB_VNET_ID

# 3. Apply Azure Policy assignments
az policy assignment create \\
  --name ai-governance \\
  --policy-set-definition /providers/Microsoft.Authorization/policySetDefinitions/ai-landing-zone \\
  --scope /subscriptions/$SUB_ID

# 4. Validate private endpoint connectivity
python tests/smoke/test_private_endpoints.py \\
  --resource-group rg-ai-spoke-prod \\
  --endpoints openai,search,storage,keyvault`,
        rollback: `# Remove spoke (preserve hub)
az group delete --name rg-ai-spoke-prod --yes --no-wait

# Remove policy assignments
az policy assignment delete --name ai-governance \\
  --scope /subscriptions/$SUB_ID`,
        health: `# Verify private endpoint resolution
nslookup cog-openai-prod.openai.azure.com
# Expected: 10.x.x.x (private IP, not public)

az network private-endpoint list -g rg-ai-spoke-prod -o table`,
        troubleshoot: [
            ['Private endpoint DNS not resolving', 'Check private DNS zone link to spoke VNet. Verify A record exists. Use az network private-dns record-set a list.'],
            ['Policy blocking legitimate deployments', 'Create exemptions for specific resource groups. Use "Audit" mode before "Deny". Check policy evaluation order.'],
            ['Hub-spoke peering connectivity fails', 'Verify peering status is "Connected" on both sides. Check allow-forwarded-traffic and allow-gateway-transit settings.']
        ]
    },
    'fai-deploy-12-model-serving-aks': {
        title: 'Deploy Model Serving on AKS (Play 12)',
        desc: `Deploy Play 12 Model Serving on AKS with GPU node pools, vLLM, KEDA autoscaling, and Prometheus monitoring. Covers Helm deployment, model loading, throughput validation, and rollback.`,
        when: [
            'Deploying self-hosted LLM inference on AKS',
            'Setting up vLLM or TGI with GPU node pools',
            'Promoting model serving from dev → prod cluster',
            'Validating throughput and latency SLOs'
        ],
        stack: [
            ['AKS', 'Kubernetes cluster', 'Standard + GPU pool'],
            ['GPU Node Pool', 'NVIDIA A100/H100', 'NC-series'],
            ['vLLM', 'Model inference engine', 'Helm chart'],
            ['KEDA', 'Request-based autoscaling', 'Add-on'],
            ['Prometheus + Grafana', 'Inference monitoring', 'Managed'],
            ['ACR', 'Container images', 'Premium']
        ],
        deploy: `# 1. Add GPU node pool
az aks nodepool add \\
  --resource-group rg-aks-prod \\
  --cluster-name aks-inference-prod \\
  --name gpupool --node-count 2 \\
  --node-vm-size Standard_NC24ads_A100_v4 \\
  --labels workload=inference

# 2. Deploy vLLM with Helm
helm upgrade --install vllm charts/vllm \\
  --namespace inference --create-namespace \\
  --set model=meta-llama/Llama-3.3-70B-Instruct \\
  --set gpu.count=2 --set replicas=2

# 3. Deploy KEDA scaler
kubectl apply -f infra/keda-scaler.yaml

# 4. Run throughput benchmark
python tests/smoke/test_inference_throughput.py \\
  --endpoint http://vllm.inference.svc:8000 \\
  --concurrent 50 --min-tps 120 --max-latency-p99 2000`,
        rollback: `# Rollback to previous Helm revision
helm rollback vllm --namespace inference

# Scale down GPU pool if needed
az aks nodepool scale \\
  --resource-group rg-aks-prod \\
  --cluster-name aks-inference-prod \\
  --name gpupool --node-count 0`,
        health: `kubectl get pods -n inference -l app=vllm
curl -s http://vllm.inference.svc:8000/health | jq .
# Expected: {"status":"ready","model":"loaded","gpu_memory_utilization":0.85}`,
        troubleshoot: [
            ['GPU out-of-memory on model load', 'Reduce tensor-parallel-size or use a quantized model (AWQ/GPTQ). Check gpu.count matches allocated GPUs.'],
            ['Throughput below SLO', 'Enable continuous batching. Increase max-num-seqs. Check if KEDA is scaling pods. Monitor GPU utilization with nvidia-smi.'],
            ['Pod stuck in Pending state', 'Check GPU node pool has available capacity. Verify tolerations match GPU node taints. Use kubectl describe pod for events.']
        ]
    },
    'fai-deploy-13-fine-tuning-workflow': {
        title: 'Deploy Fine-Tuning Workflow (Play 13)',
        desc: `Deploy Play 13 Fine-Tuning Workflow with Azure AI Foundry, Blob Storage, and evaluation pipelines. Covers JSONL dataset upload, fine-tuning job submission, model evaluation, and deployment swap.`,
        when: [
            'Deploying a fine-tuned model to production',
            'Setting up fine-tuning CI/CD pipeline',
            'Promoting a fine-tuned model from eval → prod',
            'Rolling back to base model if fine-tuned version regresses'
        ],
        stack: [
            ['Azure AI Foundry', 'Fine-tuning orchestration', 'Hub + Project'],
            ['Azure OpenAI', 'Base model + fine-tuned deployment', 'S0'],
            ['Blob Storage', 'Training data (JSONL)', 'Standard LRS'],
            ['Azure ML', 'Evaluation pipelines', 'Managed compute'],
            ['Application Insights', 'Model telemetry', 'Workspace-based']
        ],
        deploy: `# 1. Upload training dataset
az storage blob upload --account-name stfinetuning \\
  --container-name datasets --name train-v2.jsonl \\
  --file data/train-v2.jsonl

# 2. Submit fine-tuning job
az openai fine-tuning create \\
  --resource-group rg-finetune-prod \\
  --resource-name oai-finetune-prod \\
  --training-file train-v2.jsonl \\
  --model gpt-4o-mini-2024-07-18 \\
  --suffix "domain-v2"

# 3. Deploy fine-tuned model
az openai deployment create \\
  --resource-group rg-finetune-prod \\
  --resource-name oai-finetune-prod \\
  --name ft-domain-v2 \\
  --model ft:gpt-4o-mini-2024-07-18:domain-v2

# 4. Run evaluation benchmark
python evaluation/run_eval.py \\
  --model ft-domain-v2 \\
  --dataset evaluation/golden-set.jsonl \\
  --min-accuracy 0.88 --min-groundedness 0.90`,
        rollback: `# Swap traffic back to base model
az openai deployment update \\
  --resource-group rg-finetune-prod \\
  --resource-name oai-finetune-prod \\
  --name production \\
  --model gpt-4o-mini-2024-07-18

# Delete failed fine-tuned deployment
az openai deployment delete \\
  --resource-group rg-finetune-prod \\
  --resource-name oai-finetune-prod \\
  --name ft-domain-v2`,
        health: `az openai deployment show \\
  --resource-group rg-finetune-prod \\
  --resource-name oai-finetune-prod \\
  --name ft-domain-v2 --query provisioningState`,
        troubleshoot: [
            ['Fine-tuning job fails during training', 'Check JSONL format (valid JSON per line). Verify token counts within limits. Check quota availability in the region.'],
            ['Fine-tuned model regresses on benchmarks', 'Compare eval results against base model. Check for data contamination. Reduce learning rate or epochs.'],
            ['Deployment quota exceeded', 'Delete unused deployments. Request quota increase. Use PAYG instead of PTU for fine-tune deployments.']
        ]
    },
    'fai-deploy-14-cost-optimized-ai-gateway': {
        title: 'Deploy Cost-Optimized AI Gateway (Play 14)',
        desc: `Deploy Play 14 Cost-Optimized AI Gateway with Azure API Management, Azure OpenAI multi-region, Redis cache, and token metering. Covers routing rules, caching layer, budget enforcement, and rollback.`,
        when: [
            'Deploying an AI gateway with model routing',
            'Setting up multi-region Azure OpenAI load balancing',
            'Enabling semantic caching for cost reduction',
            'Enforcing per-team/per-app token budgets'
        ],
        stack: [
            ['API Management', 'Gateway + rate limiting', 'Standard v2'],
            ['Azure OpenAI (multi-region)', 'LLM backends', 'S0 × N regions'],
            ['Redis Cache', 'Semantic response cache', 'Premium P1'],
            ['Cosmos DB', 'Token usage metering', 'Serverless'],
            ['Key Vault', 'Backend API keys', 'Standard'],
            ['Application Insights', 'Gateway analytics', 'Workspace-based']
        ],
        deploy: `# 1. Deploy infrastructure
az deployment group create \\
  --resource-group rg-gateway-prod \\
  --template-file infra/main.bicep \\
  --parameters environment=prod regions="eastus2,westus3,swedencentral"

# 2. Configure APIM policies
az apim api import --resource-group rg-gateway-prod \\
  --service-name apim-gateway-prod \\
  --path /openai --specification-format OpenApiJson \\
  --specification-path infra/openai-api-spec.json

# 3. Deploy routing + caching policies
az apim api policy set --resource-group rg-gateway-prod \\
  --service-name apim-gateway-prod --api-id openai \\
  --xml-policy @infra/policies/routing-cache.xml

# 4. Run cost-optimization validation
python tests/smoke/test_gateway_routing.py \\
  --endpoint https://apim-gateway-prod.azure-api.net \\
  --verify-cache-hits --verify-budget-enforcement \\
  --max-cost-per-1k-tokens 0.015`,
        rollback: `# Revert APIM policies to previous version
az apim api policy set --resource-group rg-gateway-prod \\
  --service-name apim-gateway-prod --api-id openai \\
  --xml-policy @infra/policies/routing-cache-previous.xml

# Flush Redis cache if poisoned
az redis force-reboot --resource-group rg-gateway-prod \\
  --name redis-gateway-prod --reboot-type AllNodes`,
        health: `curl -s https://apim-gateway-prod.azure-api.net/health \\
  -H "Ocp-Apim-Subscription-Key: $APIM_KEY" | jq .
# Expected: {"status":"healthy","backends":3,"cache":"connected","metering":"active"}`,
        troubleshoot: [
            ['All traffic going to one region', 'Check APIM routing policy weight distribution. Verify all backend endpoints are healthy. Check circuit-breaker thresholds.'],
            ['Cache hit rate below 30%', 'Tune semantic similarity threshold (default 0.95). Increase cache TTL for stable queries. Check Redis memory vs eviction policy.'],
            ['Token budget exceeded but not blocking', 'Verify Cosmos DB metering writes are succeeding. Check APIM policy condition for budget check. Verify rate-limit-by-key is active.']
        ]
    },
    'fai-deploy-15-multi-modal-docproc': {
        title: 'Deploy Multi-Modal Document Processing (Play 15)',
        desc: `Deploy Play 15 Multi-Modal Document Processing with GPT-4o Vision, Azure Document Intelligence, Blob Storage, and App Service. Covers vision model deployment, multi-format pipeline, accuracy benchmarks, and rollback.`,
        when: [
            'Deploying a multi-modal document processing pipeline',
            'Setting up GPT-4o Vision for image + PDF analysis',
            'Promoting document pipeline from dev → prod',
            'Validating extraction accuracy across document formats'
        ],
        stack: [
            ['Azure OpenAI (GPT-4o)', 'Vision + text analysis', 'S0'],
            ['Azure Document Intelligence', 'OCR fallback', 'S0'],
            ['Blob Storage', 'Document ingestion', 'Standard LRS'],
            ['App Service', 'Processing API', 'P2v3'],
            ['Cosmos DB', 'Extraction results', 'Serverless'],
            ['Application Insights', 'Processing telemetry', 'Workspace-based']
        ],
        deploy: `# 1. Deploy infrastructure
az deployment group create \\
  --resource-group rg-multimodal-prod \\
  --template-file infra/main.bicep \\
  --parameters environment=prod gptModel=gpt-4o

# 2. Deploy processing API
az webapp deploy --resource-group rg-multimodal-prod \\
  --name app-multimodal-prod --src-path dist/api.zip

# 3. Run multi-format accuracy test
python tests/smoke/test_multimodal_extraction.py \\
  --endpoint https://app-multimodal-prod.azurewebsites.net \\
  --formats pdf,png,jpeg,tiff,docx \\
  --sample-dir tests/fixtures/multi-format-docs \\
  --min-accuracy 0.88

# 4. Validate vision model responses
python tests/smoke/test_vision_quality.py \\
  --endpoint https://oai-multimodal-prod.openai.azure.com \\
  --images tests/fixtures/sample-images \\
  --min-groundedness 0.85`,
        rollback: `# Revert API to previous version
az webapp deployment slot swap \\
  --resource-group rg-multimodal-prod \\
  --name app-multimodal-prod \\
  --slot staging --target-slot production

# Fallback to OCR-only mode
az webapp config appsettings set \\
  --resource-group rg-multimodal-prod \\
  --name app-multimodal-prod \\
  --settings VISION_ENABLED=false OCR_FALLBACK=true`,
        health: `curl -s https://app-multimodal-prod.azurewebsites.net/health | jq .
# Expected: {"status":"healthy","vision":"enabled","ocr":"connected","formats":["pdf","png","jpeg","tiff","docx"]}`,
        troubleshoot: [
            ['Vision model returns hallucinated content', 'Lower temperature to 0. Add structured output schema. Validate against OCR ground truth. Use detail=low for layout analysis.'],
            ['Processing timeout on large documents', 'Split documents into page batches. Set per-page timeout to 15s. Use async processing with Service Bus for documents >20 pages.'],
            ['Format not supported error', 'Check supported formats list. Convert unsupported formats (HEIC→JPEG) in preprocessing. Fallback to OCR for text-heavy documents.']
        ]
    }
};

function generateSkill(key, data) {
    const stackRows = data.stack.map(([svc, purpose, sku]) =>
        `| ${svc} | ${purpose} | ${sku} |`
    ).join('\n');

    const whenItems = data.when.map(w => `- ${w}`).join('\n');

    const troubleRows = data.troubleshoot.map(([issue, fix]) =>
        `### ${issue}\n\n${fix}`
    ).join('\n\n');

    return `---
name: ${key}
description: |
  ${data.desc}
---

# ${data.title}

Production deployment workflow for this solution play.

## When to Use

${whenItems}

---

## Infrastructure Stack

| Service | Purpose | SKU |
|---------|---------|-----|
${stackRows}

## Deployment Steps

\`\`\`bash
${data.deploy}
\`\`\`

## Rollback Procedure

\`\`\`bash
${data.rollback}
\`\`\`

## Health Check

\`\`\`bash
${data.health}
\`\`\`

## Troubleshooting

${troubleRows}

## Post-Deploy Checklist

- [ ] All infrastructure resources provisioned and healthy
- [ ] Application deployed and responding on all endpoints
- [ ] Smoke tests passing with expected thresholds
- [ ] Monitoring dashboards showing baseline metrics
- [ ] Alerts configured for error rate, latency, and cost
- [ ] Rollback procedure tested and documented
- [ ] Incident ownership and escalation path confirmed
- [ ] Post-deploy review scheduled within 24 hours

## Definition of Done

Deployment is complete when infrastructure is provisioned, application is serving traffic, smoke tests pass, monitoring is active, and another engineer can reproduce the process from this skill alone.
`;
}

// Write all 10 deploy skills
for (const [key, data] of Object.entries(deploys)) {
    const p = path.join(dir, key, 'SKILL.md');
    const content = generateSkill(key, data);
    fs.writeFileSync(p, content, 'utf8');
    const lines = content.split('\n').length;
    const hasFence = content.includes('```');
    const hasGeneric = content.includes('Confirm business outcome');
    console.log(`Wrote ${key}: ${lines}L fence=${hasFence} generic=${hasGeneric}`);
}

console.log('\nAll 10 deploy skills rewritten with domain-specific content.');
