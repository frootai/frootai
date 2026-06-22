---
description: "Salesforce Lightning Web Components standards — reactive properties, wire adapters, and accessibility."
applyTo: "**/*.js, **/*.html"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Salesforce LWC — FAI Standards

## Component Structure

Four co-located files per component (`.html`, `.js`, `.css`, `.js-meta.xml`). Keep JS under 300 lines.

```html
<template>
  <lightning-card title={cardTitle} icon-name="standard:account">
    <template if:true={account.data}>
      <p class="slds-p-horizontal_small">{accountName}</p>
    </template>
    <template if:true={account.error}>
      <c-error-panel errors={account.error}></c-error-panel>
    </template>
  </lightning-card>
</template>
```

```xml
<!-- .js-meta.xml — expose to App Builder with design attributes -->
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>62.0</apiVersion><isExposed>true</isExposed>
  <targets><target>lightning__RecordPage</target><target>lightning__AppPage</target></targets>
  <targetConfigs><targetConfig targets="lightning__RecordPage">
    <property name="showDetails" type="Boolean" default="true" label="Show Details"/>
  </targetConfig></targetConfigs>
</LightningComponentBundle>
```

## Reactive Properties and Wire Service

```javascript
import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import getContacts from '@salesforce/apex/ContactController.getContacts';
import updateContact from '@salesforce/apex/ContactController.updateContact';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import NAME_FIELD from '@salesforce/schema/Account.Name';

export default class AccountCard extends LightningElement {
  @api recordId;            // Public — set by parent or record page, never mutate internally
  @api showDetails = true;  // Public with default — matches meta XML property
  searchTerm = '';           // Reactive (tracked by default since API 59)

  @wire(getRecord, { recordId: '$recordId', fields: [NAME_FIELD] })
  account;                  // Wire for reads — auto-refreshes, caches results

  @wire(getContacts, { accountId: '$recordId' })
  contacts;

  get accountName() { return getFieldValue(this.account.data, NAME_FIELD) ?? 'Account'; }

  // Imperative Apex for DML — wire is read-only
  async handleSave(event) {
    try {
      await updateContact({ contactId: event.detail.id, fields: event.detail.fields });
      await refreshApex(this.contacts); // Re-fetch wired cache after mutation
      this.dispatchEvent(new ShowToastEvent({ title: 'Success', variant: 'success' }));
    } catch (error) {
      this.dispatchEvent(new ShowToastEvent({
        title: 'Error', message: error.body?.message ?? 'Unknown error', variant: 'error'
      }));
    }
  }
}
```

Use `@wire` for read operations. Imperative calls for DML or conditional fetches. Always `refreshApex` after mutations. Import specific fields, not entire objects.

## Event Handling and Communication

```javascript
// Child dispatches — bubbles:false, composed:false by default (direct parent only)
this.dispatchEvent(new CustomEvent('select', { detail: { contactId: this.contact.Id } }));

// Parent listens: <c-contact-tile onselect={handleContactSelect}></c-contact-tile>

// Cross-DOM via Lightning Message Service (sibling/unrelated components)
import { publish, MessageContext } from 'lightning/messageService';
import RECORD_SELECTED from '@salesforce/messageChannel/RecordSelected__c';
@wire(MessageContext) messageContext;
handleSelect(event) {
  publish(this.messageContext, RECORD_SELECTED, { recordId: event.detail.contactId });
}
```

Props down (`@api`), events up (`CustomEvent`). Sibling/unrelated: use LMS. Never `document.querySelector` across shadow boundaries — use `this.template.querySelector`.

## CSS and Accessibility

```css
:host { display: block; --tile-bg: var(--lwc-colorBackground, #fff); }
.tile { background: var(--tile-bg); border: 1px solid var(--lwc-colorBorder, #e5e5e5); padding: var(--lwc-spacingMedium, 1rem); }
```

Use SLDS tokens (`var(--lwc-*)`) for theming. Never `!important` — shadow DOM handles encapsulation. Use `slds-*` classes for layout, custom CSS for behavior. Accessibility: `aria-label` on interactive elements, `aria-live="polite"` for dynamic regions, focus management after async ops, keyboard Enter/Space on all clickable elements.

## Testing with Jest

```javascript
import { createElement } from 'lwc';
import AccountCard from 'c/accountCard';
import { getRecord } from 'lightning/uiRecordApi';

describe('c-account-card', () => {
  afterEach(() => { while (document.body.firstChild) document.body.removeChild(document.body.firstChild); });

  it('renders name from wired record', async () => {
    const el = createElement('c-account-card', { is: AccountCard });
    el.recordId = '001FAKEID';
    document.body.appendChild(el);
    getRecord.emit({ fields: { Name: { value: 'Acme Corp' } } });
    await Promise.resolve();
    expect(el.shadowRoot.querySelector('lightning-card').title).toBe('Acme Corp');
  });
});
```

Use `@salesforce/sfdx-lwc-jest` adapters (`emit`/`emitError`). Always DOM cleanup in `afterEach`. Flush microtasks with `await Promise.resolve()` after state changes. CI: `sfdx-lwc-jest --coverage` at 80%+.

## Anti-Patterns

- ❌ Mutating `@api` properties internally — breaks one-way data flow
- ❌ `document.querySelector` — cannot cross shadow DOM, use `this.template.querySelector`
- ❌ `@wire` for DML — imperative only for create/update/delete
- ❌ Missing `refreshApex` after mutations — stale data
- ❌ `bubbles: true, composed: true` on all events — leaks across boundaries
- ❌ Inline styles over SLDS tokens — breaks theming
- ❌ Apex without try/catch — unhandled errors crash UI
- ❌ `@salesforce/schema/Account` instead of fields — excess metadata
- ❌ Skipping `afterEach` DOM cleanup in Jest — cross-spec test pollution

## WAF Alignment

| Pillar | LWC Practice |
|--------|-------------|
| **Performance** | Lazy-load with `lwc:if` / dynamic imports. Combine fields in single `getRecord`. `@wire` caching over repeated imperative fetches. Debounce search inputs (300ms). |
| **Reliability** | Try/catch every imperative Apex call. `c-error-panel` on wire errors. Null-safe access via `getFieldValue`. Graceful fallback when FLS blocks `@wire`. |
| **Security** | `lightning/navigation` for URLs — never `window.location`. `lightning-formatted-rich-text` for dynamic HTML. `WITH SECURITY_ENFORCED` in Apex SOQL. Server-side record ID validation. |
| **Op. Excellence** | Error logging via platform events. camelCase JS, kebab-case HTML. Meta XML pinned to org API version. CI with `sfdx-lwc-jest --coverage` at 80%+. |
| **Responsible AI** | Content Safety before rendering AI text. Bias-aware prompts when surfacing AI recommendations. |
| **Cost** | Client-side filtering on wired data to reduce Apex calls. Cache static picklists. `refreshApex` only after confirmed DML. |
