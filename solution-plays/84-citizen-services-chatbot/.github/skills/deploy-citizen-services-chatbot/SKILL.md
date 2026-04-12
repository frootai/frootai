---
name: "deploy-citizen-services-chatbot"
description: "Deploy Citizen Services Chatbot — multi-lingual government chatbot, WCAG-compliant, form assistance, permit tracking, complaint routing, human escalation."
---

# Deploy Citizen Services Chatbot

## Prerequisites

- Azure CLI authenticated (`az account show`)
- Contributor + User Access Administrator on target subscription
- Government service catalog (departments, services, forms, FAQs)
- Python 3.11+ with `azure-openai`, `azure-ai-translation`

## Step 1: Deploy Infrastructure

```bash
az deployment group create \
  --resource-group rg-frootai-citizen-services \
  --template-file infra/main.bicep \
  --parameters infra/parameters.json \
  --parameters environment=dev
```

Infrastructure components:
| Resource | Purpose | SKU |
|----------|---------|-----|
| Azure OpenAI | Citizen conversation handling (gpt-4o, temp=0) | S0 |
| Azure AI Search | Government knowledge base (services, FAQs, forms) | Standard S1 |
| Azure Translator | Multi-lingual support (50+ languages) | S1 |
| Azure Content Safety | Content moderation for citizen interactions | S0 |
| Cosmos DB | Conversation history, ticket tracking, analytics | Serverless |
| Azure Bot Service | Omni-channel deployment (web, Teams, WhatsApp) | S1 |
| Container Apps | Chatbot API + admin dashboard | Consumption |
| Azure Key Vault | API keys | Standard |

## Step 2: Index Government Knowledge Base

```python
# Government service catalog structure
SERVICE_CATALOG = {
    "departments": [
        {
            "id": "dmv",
            "name": "Department of Motor Vehicles",
            "services": ["driver_license", "vehicle_registration", "title_transfer"],
            "hours": "Mon-Fri 8:00-17:00",
            "phone": "555-DMV-HELP",
            "address": "123 Government Center",
            "online_services": ["license_renewal", "registration_renewal"]
        },
        {
            "id": "permits",
            "name": "Building & Permits Department",
            "services": ["building_permit", "zoning_variance", "occupancy_cert"],
            "hours": "Mon-Fri 8:30-16:30",
            "phone": "555-PERMITS"
        }
    ],
    "forms": [
        {"id": "DL-001", "name": "Driver License Application", "department": "dmv", "url": "/forms/dl-001.pdf"},
        {"id": "BP-100", "name": "Building Permit Application", "department": "permits", "url": "/forms/bp-100.pdf"}
    ],
    "faqs": [
        {"q": "How do I renew my driver license?", "a": "Online: gov.example.com/renew. In-person: any DMV office with ID + $25 fee.", "department": "dmv"},
        {"q": "What do I need for a building permit?", "a": "Submit form BP-100 with site plan, engineering drawings, and $150 fee.", "department": "permits"}
    ]
}

# Index into AI Search
await index_services(SERVICE_CATALOG, index_name="citizen-services")
```

## Step 3: Deploy Multi-Lingual Chatbot Engine

```python
CITIZEN_BOT_SYSTEM_PROMPT = """You are a government citizen services assistant.

CRITICAL RULES:
1. ONLY provide information from the government knowledge base. If you don't know, say "I don't have that information. Please contact [department] at [phone]."
2. NEVER make binding decisions or promises. Say "For official decisions, please contact [department]."
3. Use PLAIN LANGUAGE: 8th grade reading level, short sentences, no jargon.
4. Be NON-PARTISAN: factual information only, no opinions on policy.
5. ALWAYS offer human escalation: "Would you like to speak with a representative?"
6. Include ACCESSIBILITY cues: structured responses, no images-only content.
7. TRANSPARENCY: Start first interaction with "I'm an AI assistant for [jurisdiction]. For official matters, please contact the relevant department."
8. PRIVACY: Don't ask for SSN, date of birth, or financial info in chat. Direct to secure forms.

Current language: {detected_language}
Available services: {service_list}
"""

async def handle_citizen_message(message: str, session: ChatSession) -> str:
    # 1. Detect language
    lang = await translator.detect(message)
    if lang != "en":
        message_en = await translator.translate(message, to="en")
    else:
        message_en = message
    
    # 2. Retrieve relevant service info
    context = await search_services(message_en, top_k=5)
    
    # 3. Generate response (temp=0 for factual accuracy)
    response = await openai.chat.completions.create(
        model="gpt-4o", temperature=0,
        messages=[
            {"role": "system", "content": CITIZEN_BOT_SYSTEM_PROMPT.format(
                detected_language=lang, service_list=context)},
            *session.history,
            {"role": "user", "content": message_en}
        ]
    )
    
    # 4. Translate response back if needed
    response_text = response.choices[0].message.content
    if lang != "en":
        response_text = await translator.translate(response_text, to=lang)
    
    return response_text
```

## Step 4: Deploy Form Assistance Engine

```python
async def assist_with_form(form_id: str, citizen_data: dict) -> FormAssistance:
    """Guide citizens through government form filling."""
    form = await get_form_template(form_id)
    
    # Field-by-field guidance
    guidance = []
    for field in form.fields:
        if field.required and field.id not in citizen_data:
            guidance.append({
                "field": field.label,
                "hint": field.help_text,
                "example": field.example,
                "format": field.format_pattern  # e.g., "MM/DD/YYYY"
            })
    
    # Required documents checklist
    docs_needed = form.required_documents  # ["Photo ID", "Proof of residence"]
    
    return FormAssistance(
        form_name=form.name,
        missing_fields=guidance,
        required_documents=docs_needed,
        submission_options=form.submission_methods,  # ["online", "in_person", "mail"]
        fee=form.fee,
        processing_time=form.processing_days
    )
```

## Step 5: Deploy Complaint Routing & Tracking

```python
DEPARTMENT_ROUTING = {
    "pothole": {"dept": "public_works", "priority": "medium", "sla_days": 7},
    "water_quality": {"dept": "utilities", "priority": "high", "sla_days": 2},
    "noise_complaint": {"dept": "code_enforcement", "priority": "low", "sla_days": 14},
    "streetlight_out": {"dept": "public_works", "priority": "medium", "sla_days": 10},
    "trash_missed": {"dept": "sanitation", "priority": "medium", "sla_days": 3},
    "building_violation": {"dept": "code_enforcement", "priority": "high", "sla_days": 5},
    "park_maintenance": {"dept": "parks_rec", "priority": "low", "sla_days": 14}
}

async def route_complaint(complaint_text: str, location: str) -> Ticket:
    """Classify and route citizen complaint to correct department."""
    category = await classify_complaint(complaint_text)
    routing = DEPARTMENT_ROUTING[category]
    
    ticket = await create_ticket(
        category=category,
        description=complaint_text,
        location=location,
        department=routing["dept"],
        priority=routing["priority"],
        sla_days=routing["sla_days"]
    )
    return ticket
```

## Step 6: Deploy Accessibility & Channel Configuration

```bash
# WCAG 2.2 AA compliance checklist
# - Keyboard navigation: full Tab/Enter/Escape support
# - Screen reader: ARIA labels, logical reading order
# - Color contrast: 4.5:1 minimum
# - Text resize: up to 200% without loss
# - Plain language: Flesch-Kincaid Grade Level ≤ 8
# - No CAPTCHA (accessible alternative)
# - Skip to content link

# Deploy to multiple channels
az bot directline create --name citizen-bot --resource-group rg-frootai-citizen
az bot msteams create --name citizen-bot --resource-group rg-frootai-citizen
# WhatsApp via Twilio webhook integration
```

## Step 7: Smoke Test

```bash
# Test citizen query
curl -s https://api-citizen.azurewebsites.net/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "How do I renew my driver license?", "language": "en"}' | jq '.response'

# Test multi-lingual
curl -s https://api-citizen.azurewebsites.net/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "¿Cómo renuevo mi licencia de conducir?", "language": "es"}' | jq '.response'

# Submit complaint
curl -s https://api-citizen.azurewebsites.net/api/complaint \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text": "There is a large pothole on Main St near 5th Ave", "location": "Main St & 5th Ave"}' | jq '.ticket_id, .department, .sla_days'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Bot gives wrong department info | Knowledge base outdated | Refresh service catalog index weekly |
| Translation quality poor | Rare language pair | Use custom glossary for government terms |
| Citizens frustrated with AI | No clear human escalation | Add "Talk to a person" button at all times |
| Accessibility audit fails | WCAG violations in chat widget | Use pre-certified accessible widget (Azure Bot Web Chat v4) |
| Privacy concern | Logging PII in conversations | Mask PII in logs, set retention < 30 days |
