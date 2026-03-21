// Enterprise RAG — Azure Infrastructure
//
// SKELETON: This Bicep template deploys the complete RAG infrastructure.
// The AI agent will fill implementation details.
//
// Resources deployed:
//   - Azure AI Search (Standard S1, private endpoint)
//   - Azure OpenAI (GPT-4o deployment, private endpoint)
//   - Azure Blob Storage (document store, private endpoint)
//   - Azure Container Apps (API backend, auto-scale 0-20)
//   - Azure Key Vault (secrets management)
//   - Managed Identity (passwordless auth)
//   - Application Insights (observability)
//   - Content Safety (input/output filtering)
//
// Deploy: az deployment group create --template-file main.bicep --parameters parameters.json

targetScope = 'resourceGroup'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name prefix')
param environmentName string = 'rag-prod'

@description('OpenAI model to deploy')
param openaiModel string = 'gpt-4o'

// SKELETON: Resource definitions go here
// The AI agent will generate the full Bicep implementation
