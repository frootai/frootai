---
description: "Localization standards — i18n key management, RTL support, pluralization, date/number formatting."
applyTo: "**/*.ts, **/*.json"
waf:
  - "responsible-ai"
  - "operational-excellence"
---

# Localization & i18n — FAI Standards

## String Externalization

Zero hardcoded user-facing text. Every visible string lives in a translation file.

```typescript
// ❌ NEVER
const label = "No results found";
const msg = "Hello " + user.name + ", you have " + count + " items";

// ✅ ALWAYS — use message keys with ICU placeholders
import { useTranslation } from "react-i18next";
const { t } = useTranslation("search");
const label = t("search:noResults");
const msg = t("greeting", { name: user.name, count });
```

```python
# ✅ Python — gettext or message catalogs
from babel.support import Translations
trans = Translations.load("locales", [locale])
_ = trans.gettext
label = _("No results found")
```

## ICU Message Format

Use ICU MessageFormat for plurals, gender select, and number/date formatting. Never build plural logic in code.

```typescript
// locales/en/messages.json
{
  "itemCount": "{count, plural, =0 {No items} one {# item} other {# items}}",
  "greeting": "{gender, select, male {He} female {She} other {They}} liked your post",
  "price": "Total: {amount, number, ::currency/USD compact-short}",
  "deadline": "Due {date, date, medium}"
}
```

```typescript
// i18next with ICU plugin
import i18next from "i18next";
import ICU from "i18next-icu";
i18next.use(ICU).init({
  fallbackLng: "en",
  ns: ["common", "search", "errors"],
  defaultNS: "common",
});
// react-intl alternative
import { FormattedMessage } from "react-intl";
<FormattedMessage id="itemCount" values={{ count: items.length }} />
```

## Translation File Structure

Namespace by feature domain. Flat keys with dot notation — no deep nesting beyond 2 levels.

```
locales/
├── en/
│   ├── common.json      # shared: buttons, labels, nav
│   ├── errors.json      # error messages, validation
│   ├── search.json      # search feature strings
│   └── dashboard.json   # dashboard-specific
├── ar/                   # RTL language
├── ja/
└── pseudo/               # pseudo-locale for testing
    └── common.json
```

```json
// locales/en/errors.json — flat keys, translator context via _description
{
  "validation.emailInvalid": "Enter a valid email address",
  "validation.emailInvalid_description": "Shown below email field on signup form",
  "api.rateLimited": "Too many requests. Try again in {seconds, number} {seconds, plural, one {second} other {seconds}}.",
  "api.rateLimited_description": "Toast notification when user hits rate limit"
}
```

## Locale Detection & Fallback Chains

```typescript
// Fallback: user preference → browser → Accept-Language → default
const fallbackChain: string[] = [
  userProfile?.locale,                        // stored preference
  navigator.language,                         // browser locale
  navigator.languages?.[0],                   // secondary
].filter(Boolean) as string[];

i18next.init({
  fallbackLng: { "zh-Hant": ["zh-TW", "zh", "en"], default: ["en"] },
  load: "currentOnly",  // load "fr-CA" not "fr-CA" + "fr" + "en"
  detection: { order: ["querystring", "cookie", "navigator", "htmlTag"] },
});
```

```python
# Python — locale negotiation
from babel import negotiate_locale
available = ["en", "fr", "de", "ja", "ar"]
user_prefs = ["fr-CA", "fr", "en"]
locale = negotiate_locale(user_prefs, available, sep="-") or "en"
```

## Date, Time & Number Formatting

Never format dates/numbers manually. Use `Intl` APIs (JS) or `babel`/`zoneinfo` (Python).

```typescript
// Dates — always pass locale, never hardcode format strings
const fmt = new Intl.DateTimeFormat(locale, {
  dateStyle: "medium", timeStyle: "short", timeZone: user.tz,
});
const display = fmt.format(new Date(timestamp));

// Numbers & currency
new Intl.NumberFormat(locale, { style: "currency", currency: "JPY" }).format(price);
new Intl.NumberFormat(locale, { notation: "compact" }).format(1_500_000); // "1.5M" or "150万"

// Relative time — "3 days ago", "in 2 hours"
new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-3, "day");
```

```python
# Python — babel for locale-aware formatting, zoneinfo for timezones
from babel.dates import format_datetime
from babel.numbers import format_currency
from zoneinfo import ZoneInfo  # stdlib ≥3.9, NOT pytz

dt = datetime.now(ZoneInfo(user_tz))
format_datetime(dt, format="medium", locale=locale)  # "Apr 13, 2026, 3:45 PM"
format_currency(29.99, "EUR", locale="de_DE")         # "29,99 €"
```

## RTL Support

Support bidirectional text for Arabic, Hebrew, Urdu, Farsi. Use CSS logical properties — never `left`/`right` for layout.

```html
<!-- Auto-detect direction from content -->
<html lang={locale} dir={isRTL(locale) ? "rtl" : "ltr"}>
<p dir="auto">{userGeneratedContent}</p>
```

```css
/* ❌ NEVER — breaks in RTL */
.sidebar { margin-left: 16px; padding-right: 8px; text-align: left; }

/* ✅ ALWAYS — CSS logical properties */
.sidebar { margin-inline-start: 16px; padding-inline-end: 8px; text-align: start; }
.icon { inset-inline-start: 0; }  /* not "left: 0" */
```

```typescript
// RTL detection utility
const RTL_LOCALES = new Set(["ar", "he", "fa", "ur", "ps", "sd", "yi"]);
const isRTL = (locale: string): boolean => RTL_LOCALES.has(locale.split("-")[0]);
```

## Pseudo-Localization for Testing

Generate pseudo-locale to catch truncation, hardcoded strings, and layout issues before real translation.

```typescript
// pseudo-locale transforms: accents + expansion + brackets
// "Save" → "[Šàààvé~~~~~~]" — exposes: untranslated strings, truncation, concatenation
function pseudoLocalize(str: string): string {
  const accents: Record<string, string> = { a: "à", e: "é", i: "ì", o: "ó", u: "ù", s: "š" };
  const accented = str.replace(/[aeious]/gi, (c) => accents[c.toLowerCase()] || c);
  const padLen = Math.ceil(str.length * 0.3); // 30% expansion for German/Finnish
  return `[${accented}${"~".repeat(padLen)}]`;
}
```

Add `pseudo` as a locale in development builds and visually audit every screen.

## Translator Context & String Quality

- Add `_description` suffix keys or use `i18next` context feature for translator notes
- Never split sentences across multiple keys — translators need full sentence context
- Avoid string concatenation — word order differs across languages
- Use named placeholders (`{userName}`) not positional (`{0}`) — reorderable by translators
- Keep one concept per key — don't reuse "Save" for both "Save file" and "Save money"
- Maximum string length hints: `"saveButton_maxLength": 12` for UI-constrained elements

## Accessibility for Translations

```typescript
// Screen readers need locale-tagged content for correct pronunciation
<span lang="ja">東京</span>  // even inside English page
<time dateTime={iso}>{localizedDate}</time>  // machine-readable + localized display
// aria-label must also be translated
<button aria-label={t("common:closeDialog")}><CloseIcon /></button>
```

## Anti-Patterns

- ❌ String concatenation for sentences: `"Hello " + name` — word order breaks in Japanese, Arabic
- ❌ Hardcoded date formats: `MM/DD/YYYY` — most of the world uses DD/MM/YYYY or YYYY-MM-DD
- ❌ `new Date().toLocaleDateString()` without explicit locale — inconsistent across Node versions
- ❌ Pluralizing with ternary: `count === 1 ? "item" : "items"` — fails for Arabic (6 plural forms), Polish (3)
- ❌ Embedding HTML in translation strings: `"Click <b>here</b>"` — use Trans component or ICU markup
- ❌ Using `pytz` — deprecated, use `zoneinfo` (stdlib) or `dateutil.tz`
- ❌ Sorting with `Array.sort()` — use `Intl.Collator` for locale-aware alphabetical ordering
- ❌ Assuming LTR layout — CSS `left`/`right` instead of `inline-start`/`inline-end`
- ❌ Flag icons for language selectors — flags represent countries, not languages (Swiss speak 4 languages)
- ❌ Storing translated text in database — store keys, translate at render time

## WAF Alignment

| Pillar | Localization Practice |
| --- | --- |
| **Responsible AI** | Inclusive language review per locale, cultural sensitivity checks, bias-free translations, accessible `lang` attributes |
| **Operational Excellence** | CI lint for missing keys (`i18next-parser`), pseudo-locale in staging, translation coverage metrics in dashboards |
| **Reliability** | Fallback chains prevent blank UI on missing translations, graceful degradation to base language |
| **Performance** | Lazy-load namespaces per route, split locale bundles (only ship active locale), CDN for translation files |
| **Security** | Sanitize interpolated values in translations (XSS via `{userName}`), CSP-safe rendering, no `dangerouslySetInnerHTML` for translated strings |
| **Cost** | Translation memory (TM) reuse across versions, machine translation + human review workflow, shared glossaries reduce per-word cost |
