#!/usr/bin/env python3
"""Verify all ClashPerk-related statistics survived a SQL COPY backup restore.

This only connects to an ISOLATED, already-restored PostgreSQL instance.
The script prints no player data, clan tags or hashes and never writes to DB.
It compares exact PostgreSQL COPY text for each table, not merely row counts.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
import subprocess
from pathlib import Path

TABLES = ("cwl_stat_wars", "cwl_stat_attacks", "cwl_stat_missed")
HEADER = re.compile(
    r'^COPY\s+(?:"?public"?\.)"?([A-Za-z_]\w*)"?'
    r'\s+\(([^)]*)\)\s+FROM\s+stdin;\s*$',
    re.I,
)
SAFE_COLS = re.compile(r'^\s*"?[A-Za-z_]\w*"?(?:\s*,\s*"?[A-Za-z_]\w*"?)*\s*$')


def extract_sections(path: Path) -> dict[str, tuple[str, list[str]]]:
    sections = {}
    active = None
    with path.open(encoding="utf-8", newline="") as stream:
        for line in stream:
            if active is not None:
                table, columns, rows = active
                if line.rstrip("\r\n") == r"\.":
                    sections[table] = (columns, rows)
                    active = None
                else:
                    rows.append(line)
                continue
            match = HEADER.match(line)
            if not match:
                continue
            table = match.group(1).lower()
            if table not in TABLES:
                continue
            if table in sections:
                raise ValueError(f"Repeated COPY block for public.{table}")
            columns = match.group(2)
            if not SAFE_COLS.fullmatch(columns):
                raise ValueError(f"Unexpected COPY columns for public.{table}")
            active = (table, columns, [])
    if active is not None:
        raise ValueError("Truncated statistics COPY block")
    return sections


def fingerprint(lines: list[str]) -> str:
    digest = hashlib.sha256()
    for row in sorted(lines):
        digest.update(row.encode("utf-8"))
    return digest.hexdigest()


def compare(source_dump: Path) -> None:
    blocks = extract_sections(source_dump)
    for table in TABLES:
        if table not in blocks:
            raise ValueError(f"Backup does not contain public.{table}")
        columns, raw_rows = blocks[table]
        query = f"COPY (SELECT {columns} FROM public.{table}) TO STDOUT;"
        # No real database URLs are permitted; connection variables point to
        # the local restore container, not the production Supabase instance.
        cmd = [
            "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
            "-h", os.environ.get("PGHOST", "127.0.0.1"),
            "-p", os.environ.get("PGPORT", "54322"),
            "-U", os.environ.get("PGUSER", "postgres"),
            "-d", os.environ.get("PGDATABASE", "postgres"),
            "-c", query,
        ]
        result = subprocess.run(cmd, text=True, capture_output=True, check=False)
        if result.returncode:
            raise RuntimeError(f"Unable to read restored public.{table}")
        restored_rows = result.stdout.splitlines(keepends=True)
        if len(restored_rows) != len(raw_rows):
            raise ValueError(
                f"public.{table} row count mismatch: "
                f"expected {len(raw_rows)}, actual {len(restored_rows)}"
            )
        if fingerprint(restored_rows) != fingerprint(raw_rows):
            raise ValueError(
                f"public.{table} content differs from encrypted backup"
            )
        # The primary historical stats tables must remain RLS-enabled.
        rls = subprocess.run(
            cmd[:-2] + [
                "-c",
                "SELECT relrowsecurity FROM pg_catalog.pg_class "
                "WHERE oid='public." + table + "'::regclass;",
            ],
            text=True, capture_output=True, check=False,
        )
        if rls.returncode or rls.stdout.strip() != "t":
            raise ValueError(f"RLS not enabled after restore for public.{table}")
        print(f"public.{table}: {len(raw_rows)} rows, exact COPY content and RLS verified")
    print("PASS: ClashPerk historical wars, attacks and missed evidence restored exactly.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("data_dump", type=Path)
    args = parser.parse_args()
    if not args.data_dump.is_file():
        parser.error("Data dump not found")
    try:
        compare(args.data_dump)
    except (OSError, RuntimeError, ValueError) as exc:
        parser.exit(1, f"::error::{exc}\n")


if __name__ == "__main__":
    main()
