# Phase 5 — Verification

> Status: **shipped — 60 field widget + 3 chrome components live; sale.order mock on page 07**
> Phase: [`PHASED_BUILDOUT.md`](../PHASED_BUILDOUT.md) → Phase 5 (Form view + field widgets)

## What this proves

Phase 5 promotes 12 Odoo field widget types and 3 form-chrome surfaces to Penpot library components
on page "07 — Backend Templates" of the canonical design-system file, and places a composed
`sale.order` mock on the same page.

Bullet truth:

- **60 field widget components** (`Form / Fields`) — 12 widget types × 5 state variants
  (Empty / Filled / Focused / Error / Readonly), grouped as 12 variant-sets with `State` axis.
- **3 chrome components** (`Form / Chrome`) — `Sheet`, `FieldGroup`, `NotebookTab` — single
  default variants, wide (1440 px) structural surfaces.
- **474 `__phase5.*` shapes** on page "07 — Backend Templates" — 0 on any other page.
- **sale.order mock** (`__phase5.mock.sale-order.*`) — 39 shapes composing a full Odoo form view:
  Navbar + ControlPanel + StatusBar chrome, FieldGroup header, three field inputs, NotebookTab,
  and a two-row Order Lines list.
- Every component's `mainInstanceId` points at a `:frame` shape (not a leaf).
- All children correctly parented to their frames; 0 orphans.

## OWL source traceability

| Component | Penpot path | OWL source |
|---|---|---|
| `CharInput` | `Form / Fields` | `addons/web/static/src/views/form/fields/char/char_field.js:CharField` |
| `TextField` | `Form / Fields` | `addons/web/static/src/views/form/fields/text/text_field.js:TextField` |
| `IntegerInput` | `Form / Fields` | `addons/web/static/src/views/form/fields/integer/integer_field.js:IntegerField` |
| `MonetaryInput` | `Form / Fields` | `addons/web/static/src/views/form/fields/monetary/monetary_field.js:MonetaryField` |
| `DateInput` | `Form / Fields` | `addons/web/static/src/views/form/fields/date/date_field.js:DateField` |
| `DateTimeInput` | `Form / Fields` | `addons/web/static/src/views/form/fields/datetime/datetime_field.js:DateTimeField` |
| `SelectionField` | `Form / Fields` | `addons/web/static/src/views/form/fields/selection/selection_field.js:SelectionField` |
| `Many2OneField` | `Form / Fields` | `addons/web/static/src/views/form/fields/many2one/many2one_field.js:Many2OneField` |
| `Many2ManyTags` | `Form / Fields` | `addons/web/static/src/views/form/fields/many2many_tags/many2many_tags_field.js` |
| `One2ManyField` | `Form / Fields` | `addons/web/static/src/views/form/fields/one2many/one2many_field.js:One2ManyField` |
| `BooleanToggle` | `Form / Fields` | `addons/web/static/src/views/form/fields/boolean/boolean_field.js:BooleanField` |
| `ImageField` | `Form / Fields` | `addons/web/static/src/views/form/fields/image/image_field.js:ImageField` |
| `Sheet` | `Form / Chrome` | `addons/web/static/src/views/form/form_renderer.js:FormRenderer` |
| `FieldGroup` | `Form / Chrome` | `addons/web/static/src/views/form/form_renderer.js:FieldGroup` |
| `NotebookTab` | `Form / Chrome` | `addons/web/static/src/core/notebook/notebook.js:Notebook` |

## Automated checks (CI green)

```sh
PENPOT_TOKEN=… pnpm run test
```

`tests/form-widgets.test.mjs` asserts (119/119 green):

1. **Component counts**: 60 `Form / Fields` + 3 `Form / Chrome` = 63 total.
2. **Per-widget count**: each of the 12 widget types has exactly 5 state components.
3. **Chrome presence**: Sheet, FieldGroup, NotebookTab each exist in `Form / Chrome`.
4. **Variant-id grouping**: all 5 state variants of each widget share one `variantId`.
5. **State variant properties**: each widget exposes all 5 labels (Empty / Filled / Focused / Error / Readonly).
6. **Main-instance shape types**: every `mainInstanceId` resolves to `:frame`.
7. **Shape count**: exactly 474 `__phase5.*` shapes on page 07; 0 on any other page.
8. **Mock count**: 39 `__phase5.mock.*` shapes (1 frame + 38 children).
9. **Orphan check**: 0 orphaned main frames; all children parented to their frame.

Full run output (condensed):

```
=== Phase 5 — Form Widgets contract tests ===

1. Component counts
  ✓ total Form / Fields components = 60
  ✓ total Form / Chrome components = 3
  ✓ CharInput has 5 components
  ... (12 widgets)
  ✓ Sheet / FieldGroup / NotebookTab exist in Form / Chrome

2. Variant-id grouping
  ✓ CharInput: all 5 variants share one variant-id
  ... (12 widgets)

3. State variant properties
  ✓ CharInput: variant properties cover all 5 states
  ... (12 widgets)

4. Main-instance shape types
  ✓ [63 components × :frame check]

5. Phase 5 shapes on correct page
  ✓ 474 __phase5.* shapes (spec predicts 474)
  ✓ no __phase5.* shapes leaked to [11 other pages]

6. Mock shape count
  ✓ 39 __phase5.mock.* shapes (spec: 39)

7. Orphan check
  ✓ no orphaned __phase5.*.main frames (64 main frames)
  ✓ all children correctly parented to their frames

119 passed, 0 failed.
```

## Visual evidence

Screenshots captured by [`scripts/penpot-capture-phase-5.mjs`](../../../scripts/penpot-capture-phase-5.mjs).

| Capture | URL |
|---|---|
| Full page overview (all 12 widgets + chrome + mock) | [overview.png](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-5/overview.png) |
| sale.order mock close-up | [mock-sale-order.png](https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/phase-5/mock-sale-order.png) |

## Design decisions

### State-only variants, light theme

Phase 5 uses `State` as the single variant axis (Empty / Filled / Focused / Error / Readonly) with
hardcoded Bootstrap-5 colors for the light theme. Dark / high-contrast theme variants are deferred
to Phase 5b, following the same pattern as Phase 4's deferred token-driven color bindings.

### Layout

- Chrome surfaces (1440 px wide): stacked vertically, one variant each, below Phase 4 content.
- Field widgets (160–260 px wide): 5 state variants laid out horizontally per row, starting at x=0
  so 5 × (maxWidth + 32 gap) = 1428 px fits within the 1440 px page width.
- sale.order mock: single 1440 × 740 frame below all widget rows.

### sale.order mock

The mock is a visual composition using regular shapes (not true Penpot component instances). This
captures the form view layout accurately for design reference. True component-instance wiring
(using Penpot's `component-id` / `shape-ref` API fields) is deferred to Phase 5b.

## Verdict

- [x] **60 `Form / Fields` components** — 12 widget types × 5 states. In Assets panel under
  `Form / Fields`; each widget shows a `State` property dropdown with 5 variants.
- [x] **3 `Form / Chrome` components** — Sheet, FieldGroup, NotebookTab in Assets panel.
- [x] **sale.order mock on page 07** — 39 shapes, all named `__phase5.mock.*`.
- [x] **Idempotent build** — second run reports `nothing to do`.
- [x] **474 shapes on page 07; 0 orphans; 0 leaks to other pages**.
- [x] **2 GCS screenshots** at `gs://ledo-pr-assets/odoo-design-system/phase-5/`.

### Deferred to Phase 5b

- [ ] **Dark / high-contrast theme variants** for all 12 field widgets.
- [ ] **Token-driven color bindings** — bind fills to `color.*` tokens instead of hardcoded hex.
- [ ] **True component instance wiring** in the sale.order mock (Penpot `component-id` / `shape-ref` fields).

**Run by:** Claude (auto mode, 2026-05-20 UTC)
