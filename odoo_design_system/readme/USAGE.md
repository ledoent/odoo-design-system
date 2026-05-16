## Using the tokens

Once the addon is installed, every module in the same `web.assets_backend`
or `web.assets_frontend` bundle can read these CSS custom properties:

| Variable | Default | Purpose |
| --- | --- | --- |
| `--ods-accent` | `var(--o-gray-500, #adb5bd)` | Per-identity tint. Set it on any element via inline style or by adding a `data-*` attribute the mixins recognise (see below). |
| `--ods-card-radius` | `6px` | Standard card / tile radius. Matches Bootstrap `$border-radius`. |
| `--ods-card-shadow` | `0 1px 3px rgba(0,0,0,0.08)` | Resting card shadow. |
| `--ods-card-shadow-hover` | `0 4px 18px rgba(0,0,0,0.08)` | Hover-lift shadow used by the card chrome mixin. |
| `--ods-chip-radius` | `999px` | Pill radius. |

Sass mixins (consume by prefixing your own selector):

```scss
@include ods-extension-vars(".my_file_card");   // sets --ods-accent per data-ext
@include ods-initial-vars(".my_initials_chip"); // sets --ods-accent per data-initial
@include ods-card-chrome(".my_card");           // accent spine + hover lift
```

## Using the components

```xml
<!-- OWL component imports happen automatically through the assets bundle. -->
<OdsChip variant="ext" label="PDF"/>
<OdsChip variant="size" label="2.4 MB"/>
<OdsInitialsAvatar name="Mitchell Admin"/>
<OdsCardTile accent="ext" data-ext="pdf">
    <img src="/dms/static/icons/file_pdf.svg" alt="PDF"/>
</OdsCardTile>
<OdsIcon name="folder-open" set="lucide" size="20"/>
<OdsIcon name="document-text" set="heroicons"/>
```

## Bundled icon sets

| Set | Count | License | Path |
| --- | --- | --- | --- |
| `lucide` (default) | 1700+ line icons, 24×24 source | ISC | `static/icons/lucide/` |
| `heroicons` | 324 outline icons, 24×24 | MIT (Tailwind Labs) | `static/icons/heroicons/outline/` |
| `heroicons-solid` | 324 solid icons, 24×24 | MIT | `static/icons/heroicons/solid/` |
| `heroicons-mini` | 324 micro-solid icons, 20×20 | MIT | `static/icons/heroicons/mini/` |

Each set ships with its upstream `LICENSE` file in the same directory.
No runtime attribution is required by either license, but the LICENSE
files are kept alongside the assets per OSS hygiene.

To use icons outside `<OdsIcon>` (e.g. as a CSS `background-image`),
reference them by their static path:

```scss
.my_button::before {
    content: "";
    background-image: url("/odoo_design_system/static/icons/lucide/upload.svg");
}
```

## Design-tool source (Penpot / Figma)

The same tokens also ship as a [W3C Design Tokens Community Group](https://design-tokens.github.io/community-group/format/) JSON file at
`static/src/tokens/design-system.dtcg.json`. This is the file designers
import into Penpot (Tools → Design Tokens → Import) or any other tool
that speaks DTCG.

Today the JSON and `_tokens.scss` are hand-mirrored: change one, update
the other in the same commit. A follow-up will add a `style-dictionary`
build step that regenerates the SCSS from the JSON automatically (see
ROADMAP).

## Living docs

Backend menu **Design System** (`odoo_design_system.action_showcase`)
renders every component live with the source snippet next to it. Use
this as the canonical reference when contributing UI to any OCA
module — copy the snippet, adjust the props, and the result will read
visually consistent with every other OCA module in the same series.
