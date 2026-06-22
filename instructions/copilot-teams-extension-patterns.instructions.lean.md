---
description: "Play 16 patterns — Teams extension patterns — adaptive cards, message extensions, bot framework, Teams toolkit."
applyTo: "**/*.ts, **/*.json"
waf:
  - "reliability"
  - "security"
---

# Play 16 — Copilot for Teams Extension — FAI Standards

## Message Extensions — Search & Action Commands

```json
// manifest.json — composeExtensions for search + action
{
  "composeExtensions": [{
    "botId": "${{BOT_ID}}",
    "commands": [
      { "id": "searchQuery", "type": "query", "title": "Search KB",
        "parameters": [{ "name": "query", "title": "Search", "inputType": "text" }] },
      { "id": "createTicket", "type": "action", "title": "Create Ticket",
        "fetchTask": true, "context": ["compose", "commandBar", "message"] }
    ]
  }]
}
```

```typescript
// Search command handler — return Adaptive Card previews
async handleTeamsMessagingExtensionQuery(
  context: TurnContext, query: MessagingExtensionQuery
): Promise<MessagingExtensionResponse> {
  const searchText = query.parameters?.[0]?.value ?? "";
  const results = await this.searchService.query(searchText, query.queryOptions?.skip ?? 0, 10);
  return {
    composeExtension: {
      type: "result", attachmentLayout: "list",
      attachments: results.map(r => CardFactory.heroCard(r.title, r.snippet).toMessagingExtensionResponse())
    }
  };
}
```

## Declarative Agent Manifest for M365 Copilot

```json
// declarativeAgent.json — wired into M365 Copilot
{
  "$schema": "https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.0/schema.json",
  "name": "FAI KB Agent", "description": "Enterprise knowledge assistant",
  "instructions": "You answer questions using the connected knowledge base. Cite sources.",
  "capabilities": [
    { "name": "GraphConnectors", "connections": [{ "connection_id": "${{GRAPH_CONNECTOR_ID}}" }] },
    { "name": "OneDriveAndSharePoint", "items_by_url": [{ "url": "https://contoso.sharepoint.com/sites/kb" }] }
  ],
  "actions": [{ "id": "searchKB", "file": "apiSpecificationFile/openapi.yaml" }]
}
```

## Bot Framework — ActivityHandler Pattern

```typescript
export class TeamsBot extends TeamsActivityHandler {
  constructor(private conversationState: ConversationState, private graphClient: Client) {
    super();
    this.onMessage(async (context, next) => {
      await context.sendActivity({ type: "typing" }); // typing indicator
      const response = await this.processWithAI(context.activity.text, context.activity.from.aadObjectId);
      await context.sendActivity(MessageFactory.attachment(this.buildResponseCard(response)));
      await next();
    });
  }
  // Task module fetch for action commands
  async handleTeamsTaskModuleFetch(context: TurnContext, action: TaskModuleRequest): Promise<TaskModuleResponse> {
    return { task: { type: "continue", value: {
      title: "Create Ticket", width: 400, height: 300,
      card: CardFactory.adaptiveCard(this.ticketFormCard())
    }}};
  }
  // Task module submit — process form data
  async handleTeamsTaskModuleSubmit(context: TurnContext, action: TaskModuleRequest): Promise<TaskModuleResponse> {
    const { title, priority } = action.data;
    await this.ticketService.create({ title, priority, reporter: context.activity.from.aadObjectId });
    return { task: { type: "message", value: "Ticket created" } };
  }
}
```

## Adaptive Cards — Actions & Task Modules

```typescript
function buildActionCard(data: KBResult): Attachment {
  return CardFactory.adaptiveCard({
    type: "AdaptiveCard", version: "1.5", "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    body: [
      { type: "TextBlock", text: data.title, size: "Large", weight: "Bolder" },
      { type: "TextBlock", text: data.summary, wrap: true },
      { type: "FactSet", facts: [
        { title: "Confidence", value: `${(data.score * 100).toFixed(0)}%` },
        { title: "Source", value: data.source }
      ]}
    ],
    actions: [
      { type: "Action.OpenUrl", title: "View Source", url: data.url },
      { type: "Action.Execute", title: "Feedback", verb: "submitFeedback",
        data: { resultId: data.id, action: "helpful" } }
    ]
  });
}
```

## SSO — On-Behalf-Of Flow & Token Exchange

```typescript
// Teams SSO via OAuthPrompt + token exchange
async handleTeamsSigninTokenExchange(context: TurnContext, query: SigninStateVerificationQuery): Promise<void> {
  await this.authDialog.run(context, this.dialogState);
}

// OBO flow — exchange Teams token for Graph token
async getGraphTokenOBO(teamsToken: string): Promise<string> {
  const cca = new ConfidentialClientApplication({
    auth: { clientId: process.env.BOT_ID!, clientSecret: process.env.BOT_SECRET!,
            authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}` }
  });
  const result = await cca.acquireTokenOnBehalfOf({
    oboAssertion: teamsToken,
    scopes: ["https://graph.microsoft.com/.default"]
  });
  return result!.accessToken;
}
```

## Graph API Integration

```typescript
// User profile, calendar, and mail via Microsoft Graph
const client = Client.initWithMiddleware({ authProvider: { getAccessToken: () => graphToken } });
const profile = await client.api("/me").select("displayName,mail,jobTitle").get();
const events = await client.api("/me/calendarView")
  .query({ startDateTime: start.toISOString(), endDateTime: end.toISOString() })
  .select("subject,start,end,organizer").top(5).get();
const messages = await client.api("/me/messages").filter("isRead eq false").top(10)
  .select("subject,from,receivedDateTime,bodyPreview").get();
```

## Meeting Extensions

```typescript
// Side panel — render in-meeting tab with meeting context
async handleTeamsTabFetch(context: TurnContext, tabRequest: TabRequest): Promise<TabResponse> {
  const meetingId = context.activity.channelData?.meeting?.id;
  return { tab: { type: "continue", value: {
    cards: [{ card: CardFactory.adaptiveCard(this.meetingAgendaCard(meetingId)) }]
  }}};
}
// In-meeting notification via targetedBubble
async sendMeetingNotification(meetingId: string, message: string, participantId: string): Promise<void> {
  await this.botAdapter.continueConversationAsync(process.env.BOT_ID!, {
    channelId: "msteams", serviceUrl: this.serviceUrl,
    conversation: { id: meetingId, conversationType: "channel" }
  }, async (ctx) => {
    await ctx.sendActivity({ type: "message", text: message,
      channelData: { notification: { alertInMeeting: true, externalResourceUrl: `${this.appUrl}/meeting/${meetingId}` }}
    });
  });
}
```

## Tab SSO

```typescript
// Tab SSO — getAuthToken() client-side, exchange server-side
// Client: const token = await microsoftTeams.authentication.getAuthToken();
app.post("/api/tab/token", async (req, res) => {
  const ssoToken = req.headers.authorization?.split(" ")[1];
  if (!ssoToken) return res.status(401).json({ error: "Missing token" });
  const graphToken = await getGraphTokenOBO(ssoToken);
  res.json({ graphToken });
});
```

## Deployment — Teams Toolkit & Manifest

- Use Teams Toolkit (`teamsapp.yml`) for provision + deploy lifecycle — `teamsapp provision` then `teamsapp deploy`
- `manifest.json` versioning: bump `version` on every release, use `${{PLACEHOLDER}}` for environment values
- Bot registration via `botFramework/create` action in `teamsapp.yml` — never manual portal registration
- Publish to org catalog via `teamsapp publish` — admin approval gates production rollout
- Azure Bot Service channel registration must specify `msTeams` + `m365extensions` for M365 Copilot

## Testing

- Teams Developer Portal: validate manifest, test message extensions in "Manage your apps"
- Dev Tunnels (`devtunnel host --allow-anonymous`) over ngrok — integrated into Teams Toolkit
- Test cards with Adaptive Card Designer before wiring into bot responses
- `BotFrameworkAdapter` test harness: `TestAdapter` from `botbuilder-testing` for unit tests
- Validate SSO flow in Teams desktop, web, AND mobile — token lifetimes differ per platform

## Proactive Messaging

```typescript
// Store conversation references on install, send proactively later
const conversationRefs = new Map<string, Partial<ConversationReference>>();
this.onConversationUpdate(async (ctx, next) => {
  if (ctx.activity.membersAdded?.some(m => m.id !== ctx.activity.recipient.id)) {
    conversationRefs.set(ctx.activity.from.aadObjectId!, TurnContext.getConversationReference(ctx.activity));
  }
  await next();
});
// Trigger proactive message (e.g., from webhook or timer)
async function notifyUser(userId: string, card: Attachment): Promise<void> {
  const ref = conversationRefs.get(userId);
  if (!ref) return;
  await adapter.continueConversationAsync(process.env.BOT_ID!, ref, async (ctx) => {
    await ctx.sendActivity(MessageFactory.attachment(card));
  });
}
```

## Rate Limiting Compliance

- Teams bot: max 1 reply per second per conversation, burst of 30 messages then throttle
- Proactive messages: max 1 message per second across all conversations per bot
- Respect `Retry-After` headers — exponential backoff with jitter on 429s
- Adaptive Card refresh: `refresh.userIds` limits auto-refresh to relevant users — never broadcast

## Anti-Patterns

- ❌ Storing conversation references in-memory only — lost on restart; use Cosmos DB or Blob Storage
- ❌ Calling Graph without OBO — using app-only permissions for user-context operations
- ❌ Skipping `teamsapp.yml` — manual bot registrations cause env drift across dev/staging/prod
- ❌ Hardcoding tenant ID — blocks multi-tenant deployment; use `common` authority + tenant validation
- ❌ Ignoring card version constraints — Teams mobile caps at Adaptive Card 1.3 features
- ❌ `fetchTask: false` with no static card — action commands require either fetch or inline card
- ❌ Proactive messages without opt-in — users must install the app before bot can message them
- ❌ Logging Teams tokens or Graph tokens — even in debug mode, tokens are PII

## WAF Alignment

| Pillar | Play 16 Implementation |
| --- | --- |
| **Security** | SSO via OBO flow, token exchange validation, tenant restriction, Key Vault for bot secrets |
| **Reliability** | ConversationState persistence to Cosmos DB, retry on Graph 429/503, graceful card fallbacks |
| **Cost** | Cache Graph responses (user profile 5min TTL), batch Graph calls with `$batch`, right-size Bot Service SKU |
| **Ops Excellence** | Teams Toolkit CI/CD, App Insights bot telemetry, manifest version tracking, Dev Tunnels for debugging |
| **Performance** | Typing indicator before async work, card streaming via `Activity.replace`, pagination on search results |
| **Responsible AI** | Content Safety on AI-generated card content, citation of sources in responses, user feedback actions |
