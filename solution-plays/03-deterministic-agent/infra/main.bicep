targetScope = 'resourceGroup'

// Deterministic Agent — Azure Infrastructure
// SKELETON: Deploys Container App with OpenAI, Content Safety, and guardrail pipeline

@description('Location')
param location string = resourceGroup().location

@description('Environment name')
param environmentName string = 'agent-prod'
