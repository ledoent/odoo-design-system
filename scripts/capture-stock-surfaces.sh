#!/usr/bin/env bash
# Copyright 2026 Ledo / Subteno.
# License LGPL-3.0 or later.
#
# Capture screenshots of stock Odoo 19.0 surfaces and upload them to
# GCS for use in the Penpot reference file *Odoo 19.0 Design System*.
#
# Pre-flight:
#   - docker compose stack is running with odoo-prod-19 on :8169
#   - $PENPOT_TOKEN env var is set (used by populate-penpot.py later)
#   - browse skill daemon is running (~/projects/ledoent/skills/browse/dist/browse)
#   - gcloud is authenticated against the kendall-ledo project
#
# Output:
#   - PNGs in gs://ledo-pr-assets/odoo-design-system/stock-19.0/
#   - Public URLs at https://storage.googleapis.com/ledo-pr-assets/...
#
# Re-run is idempotent (overwrites existing PNGs).

set -euo pipefail

BROWSE="${HOME}/projects/ledoent/skills/browse/dist/browse"
BUCKET="gs://ledo-pr-assets/odoo-design-system/stock-19.0"
DB="${ODOO_DEMO_DB:-odoo_19_review}"
USER="${ODOO_DEMO_USER:-admin}"
PW="${ODOO_DEMO_PW:-admin}"

# Standard reference viewport — fixed so screenshots stay comparable across runs.
$BROWSE viewport 1440 900 >/dev/null

login() {
    $BROWSE goto "http://localhost:8169/web/login?db=$DB&redirect=%2Fodoo" >/dev/null
    sleep 3
    $BROWSE js "
        document.querySelector('input[name=login]').value = '$USER';
        document.querySelector('input[name=password]').value = '$PW';
        document.querySelector('button[type=submit]').click();
        'submitted'
    " >/dev/null
    sleep 5
}

capture() {
    local route="$1"  surface="$2"
    $BROWSE goto "http://localhost:8169$route" >/dev/null
    sleep 4
    local tmp="/tmp/odoo19-${surface}.png"
    $BROWSE screenshot "$tmp" >/dev/null
    gcloud storage cp "$tmp" "$BUCKET/${surface}.png" 2>/dev/null
    echo "✓ ${surface}  →  $BUCKET/${surface}.png"
}

main() {
    login
    # Surface map — keep in sync with the Penpot pages in *Odoo 19.0 Design System*.
    capture /odoo/apps                       apps-grid
    capture /odoo/contacts                   contacts-list
    capture /odoo/contacts/new               contacts-form-new
    capture /odoo/action-base.action_partner_form  contacts-form-edit  || true
    capture /odoo/crm                        crm-pipeline-kanban
    capture /odoo/sales                      sales-orders-list
    capture /odoo/calendar                   calendar-month
    capture /odoo/discuss                    discuss-inbox
    capture /odoo/settings                   settings-general
    echo
    echo "Done. Public URLs are at https://storage.googleapis.com/ledo-pr-assets/odoo-design-system/stock-19.0/<surface>.png"
}

main "$@"
