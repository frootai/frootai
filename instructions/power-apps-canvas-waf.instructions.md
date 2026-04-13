---
description: "Power Apps Canvas standards — delegation, collections, component libraries."
applyTo: "**/*.msapp"
waf:
  - "performance-efficiency"
---

# Power Apps Canvas — FAI Standards

## Naming Conventions

Every control name uses a 3-letter prefix matching its type. Never use default names like `Button1`.

| Prefix | Control | Example |
|--------|---------|---------|
| `lbl` | Label | `lblOrderTotal` |
| `btn` | Button | `btnSubmitForm` |
| `txt` | Text Input | `txtSearchQuery` |
| `gal` | Gallery | `galEmployeeList` |
| `drp` | Dropdown | `drpDepartment` |
| `icn` | Icon | `icnRefresh` |
| `img` | Image | `imgProfilePhoto` |
| `tgl` | Toggle | `tglDarkMode` |
| `chk` | Checkbox | `chkAgreeTerms` |
| `cmp` | Component | `cmpHeaderNav` |

Screens: `scrHome`, `scrOrderDetail`, `scrSettings`. Variables: `varCurrentUser`, `locSelectedItem` (global vs local scope).

## Screen Organization

- Maximum 15-20 screens per app — split into sub-apps with deep links beyond that
- Group screens by domain: `scrInv_List`, `scrInv_Detail`, `scrInv_Edit` for inventory
- Use `App.StartScreen` instead of `OnStart` navigation — avoids hidden redirect logic
- Place one-time initialization in `App.OnStart`; use `App.StartScreen` for routing

```
// App.StartScreen (preferred over Navigate in OnStart)
If(
    Param("screen") = "detail",
    scrOrderDetail,
    scrHome
)
```

## Responsive Containers

Use horizontal/vertical containers instead of absolute positioning:

```
// Container layout — never hardcode X/Y coordinates
Container.LayoutDirection: Vertical
Container.LayoutAlignItems: Stretch
Container.LayoutGap: 16
// Child controls use flexible width:
lblTitle.Width: Parent.Width
galItems.Height: Parent.Height - lblTitle.Height - 64
```

- Set `App.Width` and `App.Height` with `Max(App.Width, 1024)` for responsive breakpoints
- Use `Parent.Width` references — never hardcode pixel values for layout

## Component Libraries

Extract reusable UI into component libraries shared across apps:

- `cmpSearchBar` — text input + filter icon + clear button, exposes `SearchText` output property
- `cmpConfirmDialog` — modal overlay with configurable title, message, confirm/cancel actions
- `cmpStatusBadge` — colored badge driven by `Status` custom input property
- Publish libraries to an environment for cross-app reuse via `Import components`

## Delegation and Data Limits

Delegation determines whether a query runs on the server or client. Non-delegable queries silently truncate at **500 rows** (default) or **2000 rows** (max setting).

```
// ❌ Non-delegable — silently truncates results
Filter(Orders, Year(CreatedDate) = 2026)

// ✅ Delegable — pushes filter to data source
Filter(Orders, CreatedDate >= Date(2026, 1, 1) && CreatedDate < Date(2027, 1, 1))
```

Non-delegable functions: `Search()`, `Len()`, `Left()`, `Trim()`, `IsBlank()` on SQL/SharePoint. Check the blue dotted underline warning in the formula bar — never ignore it.

### Collection vs Data Source Patterns

```
// Cache a small lookup table at startup (< 2000 rows)
ClearCollect(colDepartments, Departments);

// For large data — query the source directly with delegable filters
Filter(Orders, Status = drpStatus.Selected.Value && CustomerID = varCurrentCustomer)

// Paginated loading for galleries over delegation limit
ClearCollect(
    colPagedOrders,
    FirstN(
        Filter(Orders, Status = "Active"),
        100
    )
)
```

- Collections (`Collect`/`ClearCollect`): local copies, good for lookups < 2000 rows
- Data sources: always delegable queries, no local copy, uses server-side filtering
- Never `ClearCollect` an entire table with 10K+ rows — it will silently truncate

## Error Handling

```
// IfError pattern for data operations
IfError(
    Patch(Orders, Defaults(Orders), {Title: txtTitle.Text, Amount: Value(txtAmount.Text)}),
    Notify("Failed to save order: " & FirstError.Message, NotificationType.Error)
);

// Validate before submit
If(
    IsBlank(txtTitle.Text),
    Notify("Title is required", NotificationType.Warning);
    Set(varTitleError, true),
    Set(varTitleError, false);
    SubmitForm(frmOrder)
)
```

- Wrap every `Patch`, `Remove`, `SubmitForm` in `IfError`
- Use `Notify()` with appropriate `NotificationType` (Success/Warning/Error/Information)
- Set `varIsLoading` before/after long operations for spinner UX

## Theming and Accessibility

- Define colors once in a `colTheme` collection or component library — never hardcode `RGBA` per control
- Minimum 4.5:1 contrast ratio for text (WCAG AA) — test with Accessibility Checker
- Set `AccessibleLabel` on every icon and image control
- Tab order: set `TabIndex` sequentially per screen — test keyboard-only navigation
- `FocusBorderThickness: 2` on interactive controls for visible focus indicators

## App Checker and Performance

Run App Checker (`File → App checker`) before every publish — zero errors, zero accessibility warnings.

```
// ✅ Concurrent calls — parallel instead of sequential
Concurrent(
    ClearCollect(colOrders, Filter(Orders, Status = "Active")),
    ClearCollect(colCustomers, Customers),
    Set(varConfig, LookUp(AppConfig, Key = "Settings"))
);

// ✅ Cache expensive lookups with Set/Collect — don't recalculate in every control
// OnStart:
Set(varUserProfile, Office365Users.MyProfile());
Set(varUserPhoto, Office365Users.UserPhotoV2(varUserProfile.Id));
// Then reference varUserProfile.DisplayName — not Office365Users.MyProfile().DisplayName
```

- Use `Concurrent()` for parallel data loads — cuts startup time by 50%+
- Cache user profile, config, and lookup tables in `OnStart` with `Set`/`ClearCollect`
- Avoid `CountRows(Filter(...))` in gallery templates — pre-calculate into a collection
- Gallery `DelayItemLoading: true` for galleries with 100+ items

## Connection References and ALM

- Use connection references (not embedded connections) for environment portability
- Package apps in Dataverse solutions for ALM — never export/import `.msapp` files directly
- Solution layering: publisher prefix `fai_` for all custom tables and components
- Environment variables for API URLs, feature flags, tenant-specific values
- CI/CD: Power Platform CLI (`pac solution export/import`) in GitHub Actions pipelines

## Testing

- **Test Studio**: record UI tests for critical paths (submit form, navigation, CRUD operations)
- **Monitor tool**: trace network calls, delegation warnings, slow operations in real time
- **App Checker**: zero errors + zero accessibility violations before any publish
- Test with delegation limit set to minimum (50 rows) to catch non-delegable queries early
- Validate on both tablet and phone form factors if `App.ResponsiveLayout` is enabled

## Anti-Patterns

- ❌ Using `OnStart` for `Navigate()` — use `App.StartScreen` property instead
- ❌ Ignoring delegation warnings (blue underline) — data silently truncates
- ❌ `ClearCollect` on tables with 10K+ rows — hits 2000-row cap without error
- ❌ Default control names (`Button1`, `Label3`) — unreadable, unmaintainable
- ❌ Hardcoding colors per control — use theme collections or component properties
- ❌ Embedding connections instead of connection references — breaks environment promotion
- ❌ Nesting `LookUp` inside gallery templates — O(n×m) performance, pre-join with `AddColumns`
- ❌ Using `UpdateContext` for cross-screen state — use `Set()` for global, `Navigate` params for context
- ❌ Skipping `IfError` on `Patch`/`Remove` — users see no feedback on silent failures

## WAF Alignment

| Pillar | Power Apps Canvas Practice |
|--------|---------------------------|
| **Performance** | `Concurrent()` loads, `DelayItemLoading`, delegable queries only, collection caching |
| **Reliability** | `IfError` on all writes, `Notify` for user feedback, offline `LoadData`/`SaveData` |
| **Security** | Connection references via solution, row-level security in Dataverse, no embedded secrets |
| **Cost** | Premium connectors only when needed, batch calls to reduce API consumption |
| **Operational Excellence** | Solution-based ALM, Power Platform CLI CI/CD, App Checker gates |
| **Responsible AI** | Accessible labels, WCAG contrast, keyboard navigation, screen reader testing |
