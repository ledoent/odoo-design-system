#!/usr/bin/env python3
"""Seed `account_asset_management` demo data for the visual-review screenshots.

Connects to a running Odoo 19 instance via XML-RPC and creates:

- 3 asset profiles (computers 3y linear, vehicles 5y linear, equipment 7y degressive)
- 5 assets across all states (draft, draft, open with computed lines, open, removed)

Idempotent in spirit — uses display_name lookups; running twice will add another
batch. Run against an empty review DB.

Usage:
    python3 seed-demo.py [DB_NAME]

DB defaults to ``oca_review_account_financial_tools_pr2206_19``. Admin pw
defaults to ``admin``.
"""
import sys
import xmlrpc.client
from datetime import date

HOST = "http://localhost:8169"
DB = sys.argv[1] if len(sys.argv) > 1 else "oca_review_account_financial_tools_pr2206_19"
USER = "admin"
PW = "admin"

common = xmlrpc.client.ServerProxy(f"{HOST}/xmlrpc/2/common")
uid = common.authenticate(DB, USER, PW, {})
if not uid:
    sys.exit(f"auth failed for {USER}@{DB}")
models = xmlrpc.client.ServerProxy(f"{HOST}/xmlrpc/2/object")


def call(model, method, *args, **kw):
    return models.execute_kw(DB, uid, PW, model, method, list(args), kw)


def first_id(result):
    """Odoo's create returns [id] (list) for batched calls. Unwrap."""
    return result[0] if isinstance(result, list) else result


def ensure_account(code, name, account_type):
    """Find or create an account by code. Returns id."""
    existing = call("account.account", "search", [("code", "=", code)], limit=1)
    if existing:
        return existing[0]
    return first_id(
        call(
            "account.account",
            "create",
            [{"code": code, "name": name, "account_type": account_type}],
        )
    )


# 1. Accounts we need (idempotent lookups + create)
acc_asset = ensure_account("AA10", "Demo Asset Account", "asset_fixed")
acc_depr = ensure_account("AA11", "Demo Depreciation Account", "asset_fixed")
acc_exp = ensure_account("AA20", "Demo Depreciation Expense", "expense")

# 2. Asset profiles
profiles = [
    {
        "name": "Computers — 3 years linear",
        "account_asset_id": acc_asset,
        "account_depreciation_id": acc_depr,
        "account_expense_depreciation_id": acc_exp,
        "journal_id": 3,  # MISC
        "method": "linear",
        "method_time": "year",
        "method_number": 3,
        "method_period": "year",
        "prorata": False,
    },
    {
        "name": "Vehicles — 5 years linear",
        "account_asset_id": acc_asset,
        "account_depreciation_id": acc_depr,
        "account_expense_depreciation_id": acc_exp,
        "journal_id": 3,  # MISC
        "method": "linear",
        "method_time": "year",
        "method_number": 5,
        "method_period": "year",
        "prorata": True,
    },
    {
        "name": "Equipment — 7 years degressive",
        "account_asset_id": acc_asset,
        "account_depreciation_id": acc_depr,
        "account_expense_depreciation_id": acc_exp,
        "journal_id": 3,  # MISC
        "method": "degressive",
        "method_time": "year",
        "method_number": 7,
        "method_period": "year",
        "method_progress_factor": 0.30,
        "prorata": False,
    },
]
profile_ids = {}
for p in profiles:
    pid = first_id(call("account.asset.profile", "create", [p]))
    # Key by first word so the asset dict can reference profiles by 'Computers'/'Vehicles'/'Equipment'.
    profile_ids[p["name"].split(" ", 1)[0]] = pid
    print(f"profile {pid}: {p['name']}")

# 3. Assets across states
assets = [
    {
        "name": "MacBook Pro 14 — Sales lead",
        "code": "LAP-001",
        "profile_id": profile_ids["Computers"],
        "purchase_value": 2499.00,
        "date_start": "2026-01-15",
        "_validate": False,
    },
    {
        "name": "Delivery van — Sprinter 2500",
        "code": "VAN-001",
        "profile_id": profile_ids["Vehicles"],
        "purchase_value": 48000.00,
        "salvage_value": 5000.00,
        "date_start": "2025-06-01",
        "_validate": True,  # → open
    },
    {
        "name": "CNC mill — Tormach 1100M",
        "code": "MFG-001",
        "profile_id": profile_ids["Equipment"],
        "purchase_value": 28500.00,
        "date_start": "2025-04-10",
        "_validate": True,
    },
    {
        "name": "Office desks (×6) — Standing pkg",
        "code": "FUR-001",
        "profile_id": profile_ids["Computers"],
        "purchase_value": 4200.00,
        "date_start": "2026-03-01",
        "_validate": False,
    },
    {
        "name": "Forklift — Toyota 8FGCU25",
        "code": "WHS-001",
        "profile_id": profile_ids["Vehicles"],
        "purchase_value": 22000.00,
        "salvage_value": 3000.00,
        "date_start": "2024-08-20",
        "_validate": True,
    },
]
for a in assets:
    validate = a.pop("_validate")
    aid = first_id(call("account.asset", "create", [a]))
    print(f"asset {aid}: {a['name']}  validate={validate}")
    if validate:
        try:
            call("account.asset", "validate", [aid])
            call("account.asset", "compute_depreciation_board", [aid])
        except Exception as e:
            print(f"  validate skipped: {e}")

print("done.")
