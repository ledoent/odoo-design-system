## Using the tokens

Once the addon is installed, every module in the same `web.assets_backend`
or `web.assets_frontend` bundle can read these CSS custom properties:

| Variable | Default | Purpose |
| --- | --- | --- |
| `--oca-accent` | `var(--o-gray-500, #adb5bd)` | Per-identity tint. Set it on any element via inline style or by adding a `data-*` attribute the mixins recognise (see below). |
| `--oca-card-radius` | `6px` | Standard card / tile radius. Matches Bootstrap `$border-radius`. |
| `--oca-card-shadow` | `0 1px 3px rgba(0,0,0,0.08)` | Resting card shadow. |
| `--oca-card-shadow-hover` | `0 4px 18px rgba(0,0,0,0.08)` | Hover-lift shadow used by the card chrome mixin. |
| `--oca-chip-radius` | `999px` | Pill radius. |

Sass mixins (consume by prefixing your own selector):

```scss
@include oca-extension-vars(".my_file_card");   // sets --oca-accent per data-ext
@include oca-initial-vars(".my_initials_chip"); // sets --oca-accent per data-initial
@include oca-card-chrome(".my_card");           // accent spine + hover lift
```

## Using the components

```xml
<!-- OWL component imports happen automatically through the assets bundle. -->
<OcaChip variant="ext" label="PDF"/>
<OcaChip variant="size" label="2.4 MB"/>
<OcaInitialsAvatar name="Mitchell Admin"/>
<OcaCardTile accent="ext" data-ext="pdf">
    <img src="/dms/static/icons/file_pdf.svg" alt="PDF"/>
</OcaCardTile>
```

## Living docs

Backend menu **Design System** (`oca_design_system.action_showcase`)
renders every component live with the source snippet next to it. Use
this as the canonical reference when contributing UI to any OCA
module — copy the snippet, adjust the props, and the result will read
visually consistent with every other OCA module in the same series.
