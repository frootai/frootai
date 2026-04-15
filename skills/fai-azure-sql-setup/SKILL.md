---
name: fai-azure-sql-setup
description: |
  Provision Azure SQL Database with AAD-only auth, private networking, backup policies,
  and workload performance tuning. Use when setting up relational storage for AI
  application metadata, conversation history, or evaluation results.
---

# Azure SQL Database Setup

Provision and harden Azure SQL with AAD auth, networking, backup, and performance tuning.

## When to Use

- Setting up relational storage for AI application data
- Storing conversation history, evaluation results, or user metadata
- Migrating from SQL Server to Azure SQL
- Hardening existing SQL databases for production

---

## Bicep Provisioning

```bicep
resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    administratorLogin: null              // AAD-only
    administrators: {
      azureADOnlyAuthentication: true
      login: adminGroupName
      principalType: 'Group'
      sid: adminGroupObjectId
      tenantId: subscription().tenantId
    }
    publicNetworkAccess: 'Disabled'
    minimalTlsVersion: '1.2'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  name: dbName
  parent: sqlServer
  location: location
  sku: { name: 'GP_S_Gen5_2', tier: 'GeneralPurpose' }  // Serverless
  properties: {
    autoPauseDelay: 60                    // Pause after 60 min idle
    minCapacity: '0.5'                    // Min 0.5 vCores
    zoneRedundant: true
    backupStorageRedundancy: 'Geo'
    requestedBackupStorageRedundancy: 'Geo'
  }
}
```

## Private Endpoint

```bicep
resource sqlPe 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${sqlServerName}-pe'
  location: location
  properties: {
    subnet: { id: subnetId }
    privateLinkServiceConnections: [{
      name: 'sql-link'
      properties: {
        privateLinkServiceId: sqlServer.id
        groupIds: ['sqlServer']
      }
    }]
  }
}
```

## Python Connection with MI

```python
import pyodbc
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
token = credential.get_token("https://database.windows.net/.default")

conn = pyodbc.connect(
    f"Driver={{ODBC Driver 18 for SQL Server}};"
    f"Server=tcp:{server_name}.database.windows.net,1433;"
    f"Database={db_name};"
    f"Encrypt=yes;TrustServerCertificate=no;",
    attrs_before={1256: token.token.encode("utf-16-le")},  # SQL_COPT_SS_ACCESS_TOKEN
)

cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM conversations")
print(cursor.fetchone()[0])
```

## Performance Tuning

```sql
-- Enable Query Store for performance tracking
ALTER DATABASE [appdb] SET QUERY_STORE = ON;
ALTER DATABASE [appdb] SET QUERY_STORE (
    OPERATION_MODE = READ_WRITE,
    DATA_FLUSH_INTERVAL_SECONDS = 900,
    QUERY_CAPTURE_MODE = AUTO
);

-- Find top resource-consuming queries
SELECT TOP 10
    qs.query_id,
    qt.query_sql_text,
    rs.avg_duration / 1000 AS avg_ms,
    rs.count_executions,
    rs.avg_cpu_time / 1000 AS avg_cpu_ms
FROM sys.query_store_runtime_stats rs
JOIN sys.query_store_plan qp ON rs.plan_id = qp.plan_id
JOIN sys.query_store_query qs ON qp.query_id = qs.query_id
JOIN sys.query_store_query_text qt ON qs.query_text_id = qt.query_text_id
ORDER BY rs.avg_duration DESC;
```

## SKU Selection Guide

| Workload | SKU | Cost | Notes |
|----------|-----|------|-------|
| Dev/test | GP_S_Gen5_1 (Serverless) | $$ | Auto-pause saves cost |
| Low-traffic prod | GP_S_Gen5_2 (Serverless) | $$ | Good for bursty AI workloads |
| Steady prod | GP_Gen5_2 (Provisioned) | $$$ | Predictable performance |
| High throughput | BC_Gen5_4 (Business Critical) | $$$$ | Local SSD, zone redundant |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Slow query spikes | Missing indexes | Enable Query Store, apply index recommendations |
| Connection timeout | Serverless auto-paused | Set autoPauseDelay=-1 or increase min vCores |
| AAD auth fails | MI not added as SQL user | Run `CREATE USER [mi-name] FROM EXTERNAL PROVIDER` |
| Private endpoint DNS fails | Zone not linked to VNet | Link privatelink.database.windows.net to app VNet |
