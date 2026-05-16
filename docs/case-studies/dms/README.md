# DMS — Case study

> A field guide to migrating the OCA `dms` module from 18.0 to 19.0 and giving it
> a coherent visual layer. Before, after, why, and what's still on the table.

| | |
| --- | --- |
| **Module** | `dms` (Document Management System) |
| **PR**     | [ledoent/dms#1](https://github.com/ledoent/dms/pull/1), based on [OCA/dms#475](https://github.com/OCA/dms/pull/475) |
| **Surfaces touched** | Directory kanban · File kanban · Form hero · Portal grid · Searchpanel · Drop-zone |
| **Aesthetic direction** | "Field guide for documents" — editorial, data-density, archival |
| **Single-variable contract** | `--ods-accent` |
| **Asset bundle delta** | dms: −400 lines net after adopting `odoo_design_system` |

This is the case study companion for the design-system Penpot project at
[`design.hz.ledoweb.com`](https://design.hz.ledoweb.com). Each surface below
is documented with its before/after state, the rationale, and the next
move. Surfaces map 1:1 onto Penpot frames; see
[`surfaces.json`](./surfaces.json) for the manifest the
[bootstrap script](./scripts/) reads when seeding a fresh Penpot project.

---

## Aesthetic direction

The migration committed to **"Field guide for documents"** — an editorial /
archival voice rather than Odoo's default purple chrome.

| Axis | Choice | Rationale |
| --- | --- | --- |
| Tone | Editorial, technical, archival | Documents are evidence. Treat them like museum specimens. |
| Type | System sans body + monospace for technical metadata | Tabular numerals for sizes, FA glyphs for chips. |
| Color | One hash-keyed accent per identity (`--ods-accent`) | Per-file-extension for files, per-name-hash for directories. |
| Density | Tight body, generous chip-row | Lets a user scan a long file list quickly. |
| Motion | One micro-move on hover (1px lift + 4px shadow) | Earned attention; not jittery. |
| Chrome | 3px accent spine + soft tile gradient | Reads as a "container," not a chip. |

---

## Surfaces

### 1. Directory kanban

The 18.0 OCA `dms` directory kanban has a generic folder icon, a name, tags,
and a footer with text-and-icon counts. No tinting, no hover, footer markup
renders `"5Directories"` without spacing because the `&nbsp;` token was a
literal in the original markup.

**Before** — the migration carried the OCA 18.0 design forward without
visual changes:

![Directory kanban — before](https://storage.googleapis.com/ledo-pr-assets/dms/pr-1/before-directories-kanban.png)

**After** — `o_dms_card o_dms_dir_card` chrome with a 56 px `o_dms_card_tile`
on the left, name + tags + relative time in the body, and a footer chip row
(directory count, file count, human size, last-writer initials):

![Directory kanban — after](https://storage.googleapis.com/ledo-pr-assets/dms/pr-1/after-directories-kanban.png)

**Why**
- The directory was the lowest-information card in the previous design.
  Reusing the file-kanban chip vocabulary for directory metadata makes the
  two views read as siblings.
- Hash-tinted spine + tile (keyed off `data-initial="<first letter of
  name>"`) gives each directory a stable, distinct identity without per-
  record color picking.
- The footer-chip pattern surfaces the same metadata that previously
  required a hover or a form-view trip.

**Next**
- The folder glyph is still the upstream `dms/static/icons/folder.svg`;
  consider an `OdsCardTile` accent-`initial` variant that renders a styled
  monogram instead of an icon when the directory has no children. Lower
  density, more identity.
- Color-picker integration with `--ods-accent` so a user-set kanban color
  overrides the hash-bucket tint.

---

### 2. File kanban

`[19.0][MIG]` brought over the OCA file kanban with its image-thumbnail-or-
icon pattern. Our `[19.0][IMP]` pass layered the unified card chrome on top:
spine, hover lift, tinted extension chip via `data-ext`, monospaced
extension label, locked-by-me success chip.

![File kanban — after](https://storage.googleapis.com/ledo-pr-assets/dms/pr-1/after-files-kanban.png)

**Why**
- Mimetype + extension is what users sort by; surfacing them as the
  card's accent makes scanning a 500-file directory tractable.
- Image previews drop the chrome treatment (`o_dms_card_tile_preview`) so
  photos read as photos, not as decorated tiles.
- The extension chip strips its leading dot (`PDF`, not `.PDF`) — small,
  but kept consistent across kanban + form + portal.

**Next**
- Drag-to-reorder (currently kanban groups by directory only — no manual
  reordering within a group).
- Multi-select chip strip at the top of the kanban when ≥1 record is
  checked: aggregate size + extension breakdown + bulk-action drop-down.
  Mirrors the file-list bulk-actions UX inside the kanban for touch users.
- "Recently opened" smart-filter pinned to the searchpanel.

---

### 3. Form-view hero (directory + file)

Before: the form view dropped the user into a chrome-less header with the
name as an `<h1>` and a `<notebook>` carrying everything else. To see the
size, you had to expand the **Subdirectories** + **Files** tabs and count.

![Directory form — before](https://storage.googleapis.com/ledo-pr-assets/dms/pr-1/before-directory-form.png)

After: an `o_dms_dir_hero` block at the top with a tinted 28×28 hero icon
(`o_dms_hero_icon`), the name, a metadata pill row (size, root-pill,
elements count), and the path breadcrumb. No tab-clicking required to read
the essentials.

![Directory form — after](https://storage.googleapis.com/ledo-pr-assets/dms/pr-1/after-directory-form.png)

**Why**
- The form hero answers the four questions a user asks 90 % of the time:
  what is this, how big, what's inside, where is it? Surface them.
- Directory hero pins `--ods-accent` to amber (`#f08c00`), matching the
  default kanban tile so navigating kanban → form keeps a visual
  through-line.
- File hero stays neutral gray because per-extension tinting requires
  evaluating `record.extension.raw_value` in the form arch, which Odoo's
  static XML can't do — out-of-scope for this PR.

**Next**
- Make the file hero per-extension-tinted via a tiny field widget that
  renders the `<OdsCardTile>` component (OWL can read the record's
  extension field at runtime).
- Inline "share" action in the hero (currently buried in the Actions
  menu).
- Versioning chip when `dms_version` add-on is installed.

---

### 4. Portal `/my/dms`

The 18.0 portal rendered the docs as a flat `<ul>` of links — accurate but
flat. The new portal grid lays each directory and file as a card with a
tinted left stripe (per-extension for files, amber for directories), a
soft top-edge gradient, and a hover lift identical to the backend kanban.
Extension shows as a monospaced badge.

![Portal — directory grid](https://storage.googleapis.com/ledo-pr-assets/dms/pr-1/after-portal-grid.png)

![Portal — mixed grid](https://storage.googleapis.com/ledo-pr-assets/dms/pr-1/after-portal-mixed.png)

**Why**
- Portal users are typically less technical than backend users — visual
  hierarchy matters more. Cards beat list items for scannability.
- Same accent system as backend means a customer-portal user sees the
  same color for a PDF that an internal user sees in the kanban. Reduces
  cognitive load when the two surfaces are referenced side by side
  ("see the red one in your portal").
- Top-edge gradient is `color-mix(in srgb, var(--ods-accent) 6%, white)`
  — derived, not declared. Adding a new extension tints the gradient
  automatically.

**Next**
- Mobile portrait: drop the side-by-side info; stack the badge above the
  body and tighten line-height.
- Empty-state illustration with a Lucide icon at scale instead of the
  current `alert-warning` "Not results" message.
- Inline preview-on-hover for image/PDF files (the desktop pattern; mobile
  taps through as before).

---

### 5. Searchpanel

Compact monospaced section headers, dimmed counters, tabular numerals so
column-of-counts align. Functional but understated.

**Why**
- Searchpanel labels are repeated UI furniture; a smaller, monospaced
  treatment gets out of the way so the items themselves dominate.
- Tabular numerals matter on long lists where counts vary from 1 to 999.

**Next**
- "Recently opened" smart filter (would also serve File Kanban — see
  surface 2 roadmap).
- Saved-search chips persisted per-user (currently lost on logout).
- Hierarchy collapse-state persisted (Odoo loses it across navigation).

---

### 6. Drop-zone overlay

`o_dms_dropzone` — animated marching-dashed border + bobbing cloud-upload
icon, fires when a file is dragged onto the file kanban.

**Why**
- File ingestion is the module's hot path. Making the drop target
  unambiguous reduces the "where do I drop?" fumble.
- Marching dashes + bob = motion that **describes the action** (this is
  an active target) rather than decorative.

**Next**
- Drop-on-directory-card to upload directly into that directory (today's
  drop-zone is module-wide; the directory under the cursor is ignored).
- File-type-aware overlay copy: "drop 3 files (2 images, 1 PDF)" once a
  drag enters the page; uses the dragged FileList preview.
- Progress feedback during upload (currently silent; the file just
  appears).

---

## Roadmap

Concrete, ranked. Each item lists the surface it touches, the impact, the
effort, and any cross-dependency.

| # | Item | Surface | Impact | Effort | Dependency |
| --- | --- | --- | --- | --- | --- |
| 1 | **Per-extension tinted file form hero** (replace static `o_dms_hero_icon` with `<OdsCardTile>` that reads `record.extension`) | Form hero (file) | Medium | Small (~½ day) | `odoo_design_system` (already merged on `19.0`) |
| 2 | **Drop-on-directory-card** to upload into the targeted directory | Drop-zone + directory kanban | High | Medium (~1–2 days) | Existing `dms_file_upload.esm.js` extension |
| 3 | **Multi-select chip strip** with bulk actions on the file kanban | File kanban | High | Medium (~2 days) | Odoo 19 kanban multi-select API |
| 4 | **Mobile portrait portal**: stack badge + tighten leading | Portal | Medium | Small (~½ day) | Pure SCSS pass |
| 5 | **Empty-state illustration** for `/my/dms` "no results" | Portal | Medium | Small (~½ day) | unDraw / Storyset CC0 asset import |
| 6 | **Versioning chip** in the file hero when `dms_version` is installed | Form hero (file) | Medium | Small (~1 day) | Optional `dms_version` addon |
| 7 | **Saved-search chips** persisted per user across sessions | Searchpanel | Medium | Medium (~1 day) | `ir.filters` polish |
| 8 | **Drag-to-reorder** files within a kanban group | File kanban | Low | Medium (~1–2 days) | Manual-sort field on `dms.file` |
| 9 | **Inline preview-on-hover** for image/PDF on the portal | Portal | Medium | Medium (~2 days) | `web/static/lib/pdfjs` reuse |
| 10 | **`OdsTokens` JS export** so OWL code can read the bucket palette without re-declaring | Cross-cutting | Low | Small (~½ day) | Pure addition to `odoo_design_system` |

**Ranking principle.** Items 1 and 2 are highest impact for the same effort
because they close a known visual+functional gap with the rest of the
module. Item 5 is the "no extra cost" win — purely a swap of one alert
banner for one CC0 illustration.

---

## Token contract (single source of truth)

Every visual in this case study reads from the seven tokens declared in
`design.hz.ledoweb.com` → **Ledo Design System** → **Tokens** → `color/`
and `size/`:

| Token | Value | Where it lives in code |
| --- | --- | --- |
| `color.brand.primary`        | `#D97706` | `$o-brand-primary` (Sass) → `--o-brand-primary` (CSS) |
| `color.brand.primary-hover`  | `#B45309` | `--o-brand-primary-hover` |
| `color.brand.primary-active` | `#92400E` | `--o-brand-primary-active` |
| `color.brand.secondary`      | `#F59E0B` | `--o-brand-secondary` |
| `color.bucket.{1..8}`        | 8 hash-keyed tints | `$ods-bucket-palette` |
| `color.ext.{family}`         | per-file-family accents | `$ods-extension-accents` |
| `size.tile`                  | `56px` | `--ods-tile-size` |
| `size.avatar`                | `22px` | `--ods-avatar-size` |
| `size.spine`                 | `3px`  | `--ods-spine-width` |

The chain — DTCG JSON in Penpot → `pnpm run tokens` → `_tokens.generated.scss`
→ Odoo `web.assets_*` bundle — is documented in
[`odoo_design_system/readme/USAGE.md`](../../../odoo_design_system/readme/USAGE.md).
PR [#2](https://github.com/ledoent/odoo-design-system/pull/2) wires
style-dictionary. PR [!48 on `ledoent/erp`](https://gitlab.com/ledoent/erp/-/merge_requests/48)
closes the chain through to the brand logo's inline-SVG fills.

---

## Penpot setup

The Penpot project this case study describes maps to one project, one
file, and one page per major surface:

```
Project "Ledo Design System"
└── File   "DMS — Migration & Modernization"
    ├── Page  "1 · Directory Kanban"   — before / after / annotations / next
    ├── Page  "2 · File Kanban"
    ├── Page  "3 · Form Hero"
    ├── Page  "4 · Portal Grid"
    ├── Page  "5 · Searchpanel"
    ├── Page  "6 · Drop-zone"
    └── Page  "7 · Roadmap"
```

The frame manifest lives in [`surfaces.json`](./surfaces.json) — each entry
gives a frame name, the GCS-hosted image URLs to embed, and the annotation
text from the corresponding section above.

The roadmap data lives in [`roadmap.json`](./roadmap.json) — keep the
markdown table above and that JSON file in sync; the same items render in
the Penpot "7 · Roadmap" page as a card stack ranked by impact ÷ effort.

### Seeding the project

Until the Penpot MCP server is wired into Claude (see
[`infra/deployments/penpot/README.md`](https://gitlab.com/ledoent/infra/-/tree/main/deployments/penpot)),
project creation is semi-automated:

```bash
# Get a Penpot access token: design.hz.ledoweb.com → Profile → Access tokens
export PENPOT_TOKEN=…

# Create the project + file + pages, upload all screenshots as media,
# and lay out one frame per surface with its annotation text.
node docs/case-studies/dms/scripts/bootstrap-penpot.mjs
```

The script is documented in
[`scripts/README.md`](./scripts/README.md). It creates the skeleton;
final layout polish stays a designer task.
