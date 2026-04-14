export interface ScalePricing {
  small: number;
  medium: number;
  large: number;
}

export const SVC_PRICING: Record<string, ScalePricing> = {
  "Azure OpenAI (GPT-4o)": { small: 50, medium: 200, large: 800 },
  "Azure OpenAI (GPT-4o-mini)": { small: 10, medium: 50, large: 200 },
  "Azure AI Search (Basic)": { small: 75, medium: 75, large: 75 },
  "Azure AI Search (Standard)": { small: 250, medium: 250, large: 750 },
  "App Service (B1)": { small: 13, medium: 13, large: 13 },
  "App Service (P1v3)": { small: 80, medium: 80, large: 160 },
  "Cosmos DB (Serverless)": { small: 5, medium: 25, large: 100 },
  "Azure Functions (Consumption)": { small: 0, medium: 5, large: 20 },
  "Azure Storage (Blob)": { small: 2, medium: 10, large: 50 },
  "Application Insights": { small: 0, medium: 10, large: 50 },
  "Azure Key Vault": { small: 1, medium: 1, large: 3 },
  "API Management (Consumption)": { small: 3, medium: 3, large: 3 },
  "API Management (Standard)": { small: 680, medium: 680, large: 1360 },
  "Container Apps": { small: 10, medium: 50, large: 200 },
  "AKS (System)": { small: 0, medium: 0, large: 0 },
  "AKS (D4s node)": { small: 140, medium: 280, large: 560 },
  "Azure SQL (Basic)": { small: 5, medium: 5, large: 5 },
  "Azure SQL (Standard S1)": { small: 30, medium: 30, large: 60 },
  "Virtual Network": { small: 0, medium: 0, large: 0 },
  "Azure Front Door": { small: 35, medium: 35, large: 108 },
  "Azure Communication Services": { small: 5, medium: 20, large: 100 },
  "Speech Services": { small: 10, medium: 50, large: 200 },
  "Content Safety": { small: 0, medium: 15, large: 75 },
  "Document Intelligence": { small: 10, medium: 50, large: 200 },
  "Logic Apps": { small: 5, medium: 25, large: 100 },
};

export const PLAY_SERVICES: Record<number, string[]> = {
  1: ["Azure OpenAI (GPT-4o)", "Azure AI Search (Basic)", "App Service (B1)", "Azure Storage (Blob)", "Application Insights", "Azure Key Vault"],
  2: ["Virtual Network", "Azure Key Vault", "Application Insights", "Azure Storage (Blob)"],
  3: ["Azure OpenAI (GPT-4o-mini)", "Azure Functions (Consumption)", "Azure Key Vault", "Application Insights"],
  4: ["Azure OpenAI (GPT-4o)", "Speech Services", "Azure Communication Services", "App Service (B1)", "Application Insights"],
  5: ["Azure OpenAI (GPT-4o-mini)", "Azure Functions (Consumption)", "Logic Apps", "Azure Storage (Blob)", "Application Insights"],
  6: ["Document Intelligence", "Azure OpenAI (GPT-4o)", "Azure Storage (Blob)", "Cosmos DB (Serverless)", "Application Insights"],
  7: ["Azure OpenAI (GPT-4o)", "Container Apps", "Cosmos DB (Serverless)", "Azure Key Vault", "Application Insights"],
  8: ["Azure OpenAI (GPT-4o-mini)", "App Service (B1)", "Azure Storage (Blob)", "Application Insights"],
  9: ["Azure AI Search (Standard)", "Azure OpenAI (GPT-4o)", "App Service (P1v3)", "Azure Storage (Blob)", "Application Insights"],
  10: ["Content Safety", "Azure OpenAI (GPT-4o-mini)", "Azure Functions (Consumption)", "Application Insights"],
  11: ["Virtual Network", "Azure Key Vault", "Application Insights", "Azure Storage (Blob)", "Azure Front Door"],
  12: ["AKS (System)", "AKS (D4s node)", "Container Apps", "Azure Key Vault", "Application Insights"],
  13: ["Azure OpenAI (GPT-4o)", "Azure Storage (Blob)", "Azure Functions (Consumption)", "Application Insights"],
  14: ["API Management (Consumption)", "Azure OpenAI (GPT-4o)", "Azure Key Vault", "Application Insights"],
  15: ["Document Intelligence", "Azure OpenAI (GPT-4o)", "Azure Storage (Blob)", "Cosmos DB (Serverless)", "Application Insights"],
  16: ["Azure OpenAI (GPT-4o-mini)", "App Service (B1)", "Azure Storage (Blob)", "Application Insights"],
  17: ["Application Insights", "Azure Functions (Consumption)", "Azure Storage (Blob)", "Cosmos DB (Serverless)"],
  18: ["Azure OpenAI (GPT-4o-mini)", "Cosmos DB (Serverless)", "Azure Functions (Consumption)", "Application Insights"],
  19: ["Azure OpenAI (GPT-4o-mini)", "Container Apps", "Azure Storage (Blob)", "Application Insights"],
  20: ["Azure OpenAI (GPT-4o)", "Azure Functions (Consumption)", "Cosmos DB (Serverless)", "Application Insights"],
};
