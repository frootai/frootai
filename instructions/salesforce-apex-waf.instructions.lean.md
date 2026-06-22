---
description: "Salesforce Apex standards — bulkification, governor limits, trigger patterns, and testing."
applyTo: "**/*.cls, **/*.trigger"
waf:
  - "reliability"
  - "security"
---

# Salesforce Apex — FAI Standards

## Governor Limits — Know the Walls

| Limit | Synchronous | Async (Batch/Future) |
| --- | --- | --- |
| SOQL queries | 100 | 200 |
| DML statements | 150 | 150 |
| CPU time | 10,000 ms | 60,000 ms |
| Heap size | 6 MB | 12 MB |
| Callouts | 100 | 100 |
| Query rows | 50,000 | 50,000 |

- Check `Limits.getQueries()` / `Limits.getDmlStatements()` in long transactions
- Never assume headroom — design for worst-case bulk (200 records per trigger batch)

## Bulk Patterns

### Trigger Handler Pattern
One trigger per object. All logic in a handler class:
```apex
// AccountTrigger.trigger
trigger AccountTrigger on Account (before insert, before update, after insert, after update) {
    AccountTriggerHandler.execute(Trigger.operationType, Trigger.new, Trigger.oldMap);
}
```
```apex
// AccountTriggerHandler.cls
public with sharing class AccountTriggerHandler {
    public static void execute(
        System.TriggerOperation op, List<Account> newList, Map<Id, Account> oldMap
    ) {
        switch on op {
            when BEFORE_INSERT { validateAccounts(newList); }
            when AFTER_UPDATE  { syncToExternal(newList, oldMap); }
        }
    }
    private static void validateAccounts(List<Account> accounts) {
        for (Account acc : accounts) {
            if (String.isBlank(acc.Industry)) acc.addError('Industry is required');
        }
    }
}
```

### Bulkification — Collect, Query, Update
```apex
// ❌ SOQL in loop — hits 100-query limit at 100 records
for (Opportunity opp : Trigger.new) {
    Account a = [SELECT Name FROM Account WHERE Id = :opp.AccountId];
}

// ✅ Bulkified — 1 query regardless of batch size
Set<Id> accountIds = new Set<Id>();
for (Opportunity opp : Trigger.new) { accountIds.add(opp.AccountId); }
Map<Id, Account> accountMap = new Map<Id, Account>(
    [SELECT Id, Name FROM Account WHERE Id IN :accountIds]
);
```

## SOQL Best Practices

- Always filter on indexed fields (`Id`, `Name`, `CreatedDate`, `RecordTypeId`, custom indexes)
- Use relationship queries to reduce query count:
  ```apex
  List<Account> accs = [
      SELECT Name, (SELECT LastName, Email FROM Contacts WHERE IsActive__c = true)
      FROM Account WHERE Industry = 'Technology' LIMIT 200
  ];
  ```
- Never `SELECT *` — list explicit fields. Use `fields(standard)` only in dynamic SOQL when needed
- No SOQL/DML inside loops — collect IDs, query once, process in-memory
- Use `LIMIT` on all exploratory or UI-bound queries
- Use `Database.query()` for dynamic SOQL — sanitize inputs via `String.escapeSingleQuotes()`

## Security

### Enforce Sharing and Field-Level Security
```apex
// Always declare sharing — default is 'without sharing' (dangerous)
public with sharing class OpportunityService {
    public static List<Opportunity> getByStage(String stage) {
        SObjectAccessDecision decision = Security.stripInaccessible(
            AccessType.READABLE,
            [SELECT Name, Amount, StageName FROM Opportunity WHERE StageName = :stage]
        );
        return (List<Opportunity>) decision.getRecords();
    }

    public static void updateAmounts(List<Opportunity> opps) {
        SObjectAccessDecision decision = Security.stripInaccessible(
            AccessType.UPDATABLE, opps
        );
        update decision.getRecords();
    }
}
```
- Use `with sharing` unless you have a documented reason for `without sharing` (system jobs, platform events)
- Use `Security.stripInaccessible()` over manual `Schema.SObjectType` checks — cleaner and handles polymorphic fields
- Never trust client-side input — validate, sanitize, escape

## Test Classes

```apex
@IsTest
private class OpportunityServiceTest {
    @TestSetup
    static void setup() {
        Account acc = new Account(Name = 'Test Corp', Industry = 'Technology');
        insert acc;
        List<Opportunity> opps = new List<Opportunity>();
        for (Integer i = 0; i < 200; i++) {
            opps.add(new Opportunity(
                Name = 'Opp ' + i, AccountId = acc.Id,
                StageName = 'Prospecting', CloseDate = Date.today().addDays(30)
            ));
        }
        insert opps;
    }

    @IsTest
    static void testGetByStage_returnsFiltered() {
        Test.startTest();
        List<Opportunity> results = OpportunityService.getByStage('Prospecting');
        Test.stopTest();
        System.assertEquals(200, results.size(), 'Should return all test opportunities');
        System.assertNotEquals(null, results[0].Name, 'Name should be accessible');
    }
}
```
- 75% coverage minimum (aim for 90%+). Every `if` branch covered
- `Test.startTest()` / `Test.stopTest()` resets governor limits — test bulk in fresh context
- Use `@TestSetup` to share data across test methods (runs once per class)
- Use `System.assert`, `System.assertEquals`, `System.assertNotEquals` with messages
- Test bulk (200+ records), negative cases, and permission scenarios
- Never use `SeeAllData=true` — create all test data explicitly

## Async Patterns

| Pattern | Use Case | Limits |
| --- | --- | --- |
| `@future` | Simple callouts, fire-and-forget | No chaining, no `getJobId()`, 50 calls/txn |
| `Queueable` | Chained async, complex logic | `System.enqueueJob()`, 1 chain depth in test |
| `Batch` | 10K+ records, long-running | `Database.Batchable`, 5 concurrent batches |
| `Schedulable` | Recurring jobs (hourly/daily) | `System.schedule()`, cron expression |

```apex
public class AccountSyncQueueable implements Queueable, Database.AllowsCallouts {
    private List<Id> accountIds;
    public AccountSyncQueueable(List<Id> ids) { this.accountIds = ids; }
    public void execute(QueueableContext ctx) {
        List<Account> accounts = [SELECT Name, BillingCity FROM Account WHERE Id IN :accountIds];
        HttpResponse res = ExternalService.sync(JSON.serialize(accounts));
        if (res.getStatusCode() != 200) {
            System.enqueueJob(new AccountSyncQueueable(accountIds)); // chain retry
        }
    }
}
```

## Custom Metadata & Platform Events

- Use **Custom Metadata Types** (`__mdt`) for config — deployable, queryable, no DML limits
  ```apex
  Integration_Setting__mdt setting = Integration_Setting__mdt.getInstance('ERP_Sync');
  String endpoint = setting.Endpoint__c;
  Integer timeout = (Integer) setting.Timeout_Ms__c;
  ```
- Use **Platform Events** for decoupled async communication and audit trails
- Subscribe via triggers or Apex `EventBus.publish()` — guaranteed delivery with replay

## Exception Handling

```apex
public with sharing class IntegrationService {
    public static void syncRecords(List<SObject> records) {
        Savepoint sp = Database.setSavepoint();
        try {
            List<Database.SaveResult> results = Database.update(records, false);
            for (Database.SaveResult sr : results) {
                if (!sr.isSuccess()) {
                    for (Database.Error err : sr.getErrors())
                        Logger.error('Update failed: ' + err.getMessage() + ' on ' + sr.getId());
                }
            }
        } catch (DmlException e) {
            Database.rollback(sp);
            Logger.error('DML rollback: ' + e.getMessage());
            throw new IntegrationException('Sync failed — rolled back', e);
        }
    }
    public class IntegrationException extends Exception {}
}
```
- Use `Database.insert(records, false)` for partial success in batch operations
- Always log error details before rethrowing — include record IDs and field names
- Custom exception classes per domain — `IntegrationException`, `ValidationException`

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Class | PascalCase + suffix | `AccountTriggerHandler`, `OrderService` |
| Trigger | `{Object}Trigger` | `OpportunityTrigger` |
| Test class | `{Class}Test` | `AccountTriggerHandlerTest` |
| Method | camelCase, verb-first | `getActiveContacts()`, `validateInput()` |
| Constant | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Custom field | PascalCase + `__c` | `External_Id__c` |

## Code Review Checklist

- [ ] No SOQL/DML inside loops
- [ ] All classes declare `with sharing` or `without sharing` explicitly
- [ ] `Security.stripInaccessible()` on all user-facing queries and DML
- [ ] Tests cover bulk (200+ records), negatives, and permission edge cases
- [ ] Governor limit headroom validated (`Limits.*` checks or load test)
- [ ] No hardcoded IDs — use Custom Metadata or Custom Labels
- [ ] Trigger has one per object, all logic in handler class
- [ ] Async pattern matches use case (Queueable > @future for new code)

## Anti-Patterns

- ❌ SOQL or DML inside `for` loops — governor limit bomb
- ❌ Hardcoded IDs (`'001xxx...'`) — break across orgs/sandboxes
- ❌ Trigger logic without handler class — untestable spaghetti
- ❌ `without sharing` by default — data exposure risk
- ❌ `SeeAllData=true` in tests — flaky, org-dependent
- ❌ Catching generic `Exception` and swallowing it silently
- ❌ Recursive triggers without static flag guard
- ❌ Schema describes in loops (`Schema.getGlobalDescribe()` is expensive)

## WAF Alignment

| Pillar | Salesforce Apex Practice |
| --- | --- |
| **Reliability** | Bulkified triggers, `Database.Savepoint` rollback, partial DML with `allOrNone=false`, governor limit monitoring |
| **Security** | `with sharing` default, `Security.stripInaccessible()` for CRUD/FLS, `String.escapeSingleQuotes()` for dynamic SOQL |
| **Cost Optimization** | Selective SOQL (indexed filters), Custom Metadata over custom settings (no DML), batch sizing tuned to data volume |
| **Operational Excellence** | One trigger per object, handler class pattern, structured logging, `@TestSetup` for consistent test data |
| **Performance Efficiency** | Collect-Query-Update pattern, relationship subqueries, async offload for callouts, `LIMIT` on all queries |
| **Responsible AI** | Sanitize LLM inputs via `String.escapeSingleQuotes()`, validate AI-generated field values before DML, audit Platform Events for AI actions |
