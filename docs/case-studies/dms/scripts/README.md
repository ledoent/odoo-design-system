# DMS case-study — Penpot bootstrap

Seed the [`design.hz.ledoweb.com`](https://design.hz.ledoweb.com) instance
with a project, file, and pages mirroring the surfaces in
[`../surfaces.json`](../surfaces.json). Designed so a designer can take
over from a skeleton instead of building from blank.

## Why semi-automated

[Penpot ships an MCP server](https://github.com/penpot/penpot-mcp).
Wiring it into Claude is a separate piece of infra work (see
[`infra/deployments/penpot/README.md`](https://gitlab.com/ledoent/infra/-/tree/main/deployments/penpot)
→ "How Claude reaches the designs"). Until that ships, this script
provides the bare-minimum REST-API shim:

- creates the project + file
- creates one page per surface from `surfaces.json`
- uploads each frame's source PNG as a media object
- creates one `image` shape per uploaded frame, laid out left-to-right
- creates one `text` shape carrying the annotation under each frame
- creates one card per roadmap item on the "Roadmap" page

It does **not** do layout polish — designer takes over from there.

## Prerequisites

1. **Log in** to `design.hz.ledoweb.com` via Google (ledoweb.com only).
2. **Generate an access token**: avatar (top-right) → **Account settings**
   → **Access tokens** → **Create token**. Copy the secret immediately.
3. **Find your team ID**: open any project; the URL is
   `https://design.hz.ledoweb.com/#/dashboard/team/<TEAM_ID>/projects`.
   Copy the UUID.

## Run

```bash
cd docs/case-studies/dms/scripts/

export PENPOT_TOKEN='access-token-from-step-2'
export PENPOT_TEAM_ID='team-uuid-from-step-3'

# Optional: override the Penpot host (defaults to design.hz.ledoweb.com)
# export PENPOT_HOST='https://design.hz.ledoweb.com'

node bootstrap-penpot.mjs
```

Output: project URL + file URL on stdout. Open them in the browser to
arrange the frames. The pages are created in `surfaces.json` order;
the script keeps PNG URLs alongside annotations so a designer can
read each shape's metadata in Penpot's right-hand panel and know which
prose paragraph to cite when leaving comments.

## Idempotency

Running the script twice creates a second project — Penpot's REST API
doesn't expose a "create-or-update" by name. Either delete the existing
project from the Penpot UI before re-running, or pass `--dry-run` to
just print what would happen.

## Limitations

- **Layout** is done by Penpot's default flow positioning. Designer
  refines.
- **Annotations** are plain `<text>` shapes, not Penpot's "comments"
  feature — they live in the canvas, not the comments panel.
- **Roadmap cards** are plain rectangles + text; no auto-layout.
- The REST API surface has changed across Penpot versions. This script
  targets Penpot 2.x (the version `design.hz.ledoweb.com` runs).

When the MCP integration lands, this script gets superseded by a
declarative `surfaces.json → MCP` translator that's idempotent and
layout-aware.
