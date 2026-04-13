---
description: "Power Pages standards — Liquid templates, web forms, entity permissions, progressive profiles."
applyTo: "**/*.html, **/*.liquid"
waf:
  - "security"
  - "performance-efficiency"
---

# Power Pages — FAI Standards

## Liquid Template Syntax

- Use `{% %}` for logic (conditionals, loops, assignments), `{{ }}` for output
- Always HTML-encode output with `{{ variable | escape }}` — raw output only when rendering trusted HTML from content snippets
- Prefer `{% include %}` for reusable fragments; use `{% block %}` in web templates for layout inheritance

```html
<!-- Entity list with conditional rendering -->
{% assign products = entities['product'] | where: "statecode", 0 %}
{% for item in products %}
  <div class="card" data-id="{{ item.id }}">
    <h3>{{ item.name | escape }}</h3>
    <p>{{ item.description | strip_html | truncate: 200 }}</p>
    {% if item.price > 0 %}
      <span class="price">${{ item.price | round: 2 }}</span>
    {% endif %}
  </div>
{% endfor %}
```

## Entity Lists & Entity Forms

- Configure entity lists via Portal Management app — set OData filters, pagination, search, and map views declaratively
- Entity forms: bind to a Dataverse table with mode (Insert/Edit/ReadOnly), attach metadata for field validation
- Multistep forms: define step sequence, conditional branching via `{% if request.params.step == '2' %}`, save progress between steps
- Always set `Entity Permissions` before exposing any entity list or form — default-deny

```html
<!-- Custom entity form with client-side validation -->
{% entityform name: 'Support Request Form' %}
<script>
  document.querySelector("form").addEventListener("submit", function (e) {
    const email = document.getElementById("emailaddress").value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.preventDefault();
      alert("Enter a valid email address.");
    }
  });
</script>
```

## Web Templates & Content Snippets

- Web templates = Liquid + HTML stored in Dataverse — use for headers, footers, menus, custom pages
- Content snippets = localizable text/HTML blocks referenced via `{% snippet 'Snippet Name' %}` — use for labels, disclaimers, banners that editors manage without code changes
- Never embed raw business logic in content snippets — keep them presentation-only

## Page Permissions & Web Roles

- **Table-level permissions**: Grant Create/Read/Write/Delete/Append/AppendTo per table per web role
- **Row-level (record) permissions**: Scope via Contact, Account, Parent, Self, or Global — prefer Contact/Account scope over Global
- Always assign permissions to web roles, never directly to contacts
- Test with an unauthenticated user — ensure no data leaks from missing permission records

```html
<!-- Check web role before rendering admin controls -->
{% if user.roles contains 'Administrator' %}
  <a href="/admin/dashboard">Admin Dashboard</a>
{% endif %}
{% if user %}
  <p>Welcome, {{ user.fullname | escape }}</p>
{% else %}
  <a href="/.auth/login/aad">Sign in</a>
{% endif %}
```

## Site Settings

- Store configuration in site settings (`Settings > Site Settings`), not hardcoded in Liquid/JS
- Access via `{% assign val = settings['MyApp/FeatureFlag'] %}` in Liquid or `Microsoft.Portal.Settings` in JS
- Prefix keys by domain: `MyApp/MaxUploadSizeMB`, `MyApp/EnableBetaFeatures`

## Custom JavaScript — Web API

- Use `webapi.safeAjax` wrapper for all Dataverse CRUD — handles anti-forgery tokens and error normalization
- Never call `/api/data/v9.x/` directly — missing CSRF token causes 403 in production

```javascript
// CRUD via webapi.safeAjax — the ONLY safe pattern for Power Pages
webapi.safeAjax({
  type: "POST",
  url: "/_api/incidents",
  contentType: "application/json",
  data: JSON.stringify({
    title: DOMPurify.sanitize(document.getElementById("title").value),
    description: DOMPurify.sanitize(document.getElementById("desc").value),
    "customerid_contact@odata.bind": "/contacts(" + contactId + ")"
  }),
  success: function (data, status, xhr) {
    var newId = xhr.getResponseHeader("entityid");
    window.location.href = "/case/" + newId;
  },
  error: function (xhr) {
    console.error("Create failed:", xhr.status, xhr.responseJSON?.error?.message);
  }
});

// PATCH (update) — always include If-Match for optimistic concurrency
webapi.safeAjax({
  type: "PATCH",
  url: "/_api/incidents(" + recordId + ")",
  contentType: "application/json",
  headers: { "If-Match": "*" },
  data: JSON.stringify({ statuscode: 2 }),
  success: function () { location.reload(); }
});
```

## Authentication

- **Azure AD B2C**: preferred for external portals — configure via `Authentication/OpenIdConnect/*` site settings
- Custom providers (SAML, OAuth2): register in Portal Management app → Identity Providers
- Enforce session timeout via `Authentication/ApplicationCookie/ExpireTimeSpan`; enable MFA for admin roles

## Progressive Web App (PWA)

- Enable PWA via Site Settings: `PWA/Enabled = true`, configure `PWA/Name`, `PWA/ShortName`, `PWA/ThemeColor`
- Service worker is auto-generated — define offline fallback page via `PWA/OfflinePath`

## Performance

- Enable CDN via `Site Settings > CDN/Enabled` — caches static assets (CSS, JS, images) at edge
- Set `Header/OutputCache` durations per page template — 300s for static pages, 0 for user-specific
- Minimize Liquid `fetchxml` calls — use `{% fetchxml %}` with `top="50"` and indexed filters, never unbounded
- Lazy-load images: `<img loading="lazy" src="{{ img_url }}" alt="{{ alt | escape }}">`

## SEO

- Set `<meta>` tags per page via Page properties (Title, Description) or web template `<head>`:
```html
<meta name="description" content="{{ page.description | escape | truncate: 160 }}">
<meta name="robots" content="{% if page.excludefromsearch %}noindex{% else %}index, follow{% endif %}">
<link rel="canonical" href="{{ request.url | split: '?' | first }}">
```
- Auto-sitemap: enable via `Search/Sitemap/Enabled = true` — exclude draft/private pages via `Exclude From Sitemap` flag
- Use semantic HTML (`<main>`, `<article>`, `<nav>`) in web templates — not just `<div>` soup

## Accessibility

- Entity forms auto-generate labels — verify `aria-required="true"` on mandatory fields
- Custom web templates: WCAG 2.1 AA — focus management, contrast ≥ 4.5:1, keyboard nav

## Deployment

- Use Portal Management app (model-driven) for dev/test changes — export as Dataverse Solutions for ALM
- Solution transport: Dev → UAT → Prod via managed solutions; never edit production directly
- Use Power Platform CLI: `pac paportal download --path ./portal-export` for source-controlling templates and snippets

## Multistep Forms

- Define each step as a separate Form Step record linked to the parent Multistep Form
- Use condition rules (Dataverse column values) for branching — not client-side JS redirects
- Save partial progress: set `Auto Save = true` on each step; user can resume via session
- Final step: attach workflow/Power Automate flow for post-submission processing (email, approval)

## Anti-Patterns

- ❌ Using `{{ variable }}` without `| escape` — XSS via Dataverse field values
- ❌ Calling `/_api/` directly without `webapi.safeAjax` — CSRF token missing, 403 in production
- ❌ Setting Global scope on table permissions — exposes all rows to all authenticated users
- ❌ Embedding secrets (API keys, connection strings) in site settings visible to JS — use server-side plugins
- ❌ Unbounded `{% fetchxml %}` without `top` — performance cliff on large tables
- ❌ Skipping entity permissions on entity lists — data exposed to anonymous users by default
- ❌ Editing web templates directly in production — no rollback, no audit trail
- ❌ Using `document.write` or inline `onclick` handlers — CSP violations, accessibility failures

## WAF Alignment

| Pillar | Power Pages Practice |
|---|---|
| **Security** | Table + row-level permissions, web roles (least privilege), Azure AD B2C + MFA, `webapi.safeAjax` CSRF protection, `escape` filter on all output, CSP headers |
| **Reliability** | Managed solution ALM (dev→UAT→prod), server-side cache invalidation after deploy, multistep form auto-save for session recovery |
| **Cost Optimization** | CDN for static assets, output caching per template, `top` limits on fetchxml, PWA offline reduces server round-trips |
| **Operational Excellence** | `pac paportal download` for source control, Portal Management app for config, Power Automate for post-submission workflows |
| **Performance Efficiency** | CDN + output cache, lazy-load images, bounded fetchxml queries, minimize Liquid includes per page |
| **Responsible AI** | Content snippets for editor-managed copy (no code deploys for text), accessibility (WCAG 2.1 AA), SEO meta for discoverability |
