#!/usr/bin/env python3
"""Fail-closed recovery audit for private-origin receipts in encrypted DB dumps.

This NEVER publishes a private row. Capture/prepare files are stored ONLY inside
the pre-encryption workspace and the decrypted, disposable restore workspace.
It proves the plaintext rows of the independently dumped private schema are
actually recoverable from the encrypted offsite artifact, not that a simple
user-provided JSON SHA is a cryptographic server signature.

Usage:
  python3 scripts/verify_portable_witness_archive.py capture DIR
  python3 scripts/verify_portable_witness_archive.py prepare DIR
  python3 scripts/verify_portable_witness_archive.py verify-db DIR

Legacy archives without a manifest must be handled by the workflow's explicit
legacy-only path, NEVER as full portable-origin disaster provenance.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

MANIFEST = "portable-origin-offsite-manifest.json"
REQUIRED = (
    "private.cwl_portable_backup_witnesses",
    "private.cwl_portable_fresh_clan_recovery_checkpoints",
    "private.cwl_portable_history_recovery_checkpoints",
    "private.cwl_portable_multi_clan_recovery_sessions",
    "private.cwl_portable_plan_apply_checkpoints",
)
IDENT = r'"?[A-Za-z_][A-Za-z_0-9]*"?'
COPY_RE = re.compile(
    r"^COPY\s+(" + IDENT + r"\." + IDENT + r")\s*\(([^)]*)\)\s+FROM\s+stdin;\s*$",
    re.I,
)
CREATE_RE = re.compile(
    r"^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(" +
    IDENT + r"\." + IDENT + r")\s*\(", re.I,
)
SAFE_IDENT = re.compile(r"^[a-z_][a-z_0-9]*$")
MANIFEST_VERSION = 1


class AuditError(Exception):
    pass


def fail(message):
    raise AuditError(message)


def table_name(raw):
    return raw.replace('"', "").lower()


def schema_tables(path):
    result = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        match = CREATE_RE.match(line.strip())
        if match:
            result.add(table_name(match.group(1)))
    return result


def copy_sections(path):
    """Parse COPY text sections with exact multiplicities (never print rows)."""
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    found = {}
    i = 0
    while i < len(lines):
        match = COPY_RE.match(lines[i].rstrip("\r\n"))
        if not match:
            i += 1
            continue
        table = table_name(match.group(1))
        columns = [c.strip().replace('"', "").lower()
                   for c in match.group(2).split(",")]
        if not columns or not all(SAFE_IDENT.fullmatch(c) for c in columns):
            fail("Invalid COPY column projection")
        if table in found:
            fail("Repeated COPY table section in one SQL dump")
        header = lines[i]
        i += 1
        row_lines = []
        while i < len(lines) and lines[i].rstrip("\r\n") != r"\.":
            row_lines.append(lines[i].rstrip("\r\n"))
            i += 1
        if i == len(lines):
            fail("Truncated COPY block in protected SQL dump")
        terminator = lines[i]
        i += 1
        found[table] = {
            "columns": columns,
            "rows": row_lines,
            "sql": header + "".join(row + "\n" for row in row_lines) + terminator,
        }
    return found


def fingerprint(columns, rows):
    # COPY string representation is PostgreSQL's own serialization. Sorting
    # prevents false mismatches from changed heap order on the recovered DB.
    data = "columns:" + ",".join(columns) + "\n"
    data += "".join(row + "\n" for row in sorted(rows))
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def sha_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def paths(root):
    return {n: root / n for n in (
        "schema.sql", "data.sql", "auth-data.sql",
        "private-schema.sql", "private-data.sql", MANIFEST,
        "private-schema-local.sql", "private-data-local.sql",
    )}


def inventory(root):
    files = paths(root)
    for required in ("schema.sql", "data.sql", "auth-data.sql",
                     "private-schema.sql", "private-data.sql"):
        if not files[required].is_file() or not files[required].stat().st_size:
            fail("Missing sealed-backup prerequisite: " + required)
    private_schema = schema_tables(files["private-schema.sql"])
    primary_schema = schema_tables(files["schema.sql"])
    if not set(REQUIRED).issubset(private_schema):
        fail("Explicit private schema dump has no complete witness/recovery definitions")
    extra = copy_sections(files["private-data.sql"])
    primary = copy_sections(files["data.sql"])
    if not set(REQUIRED).issubset(extra):
        fail("Explicit private data dump is missing a required zero-or-more-row COPY table")
    if any(not k.startswith("private.") for k in extra):
        fail("Private-only data export contains other tenant schemas")
    if any(k.startswith("private.") and k not in extra for k in primary):
        fail("Primary dump carries unexpected unprotected private data sections")
    # A source schema containing only some of the private tables is dangerous:
    # replaying all definitions from the explicit dump could clobber objects.
    present = private_schema & primary_schema
    if present and present != private_schema:
        fail("Partial private schema in default dump cannot be safely merged")
    schema_source = "default" if present else "explicit"
    selected = {table: primary.get(table, section) for table, section in extra.items()}
    table_details = {}
    for table, section in sorted(selected.items()):
        source = "default" if table in primary else "explicit"
        table_details[table] = {
            "source": source,
            "columns": section["columns"],
            "rows": len(section["rows"]),
            "sha256": fingerprint(section["columns"], section["rows"]),
        }
    return files, primary_schema, private_schema, primary, extra, selected, {
        "format": "cwl-private-origin-offsite-audit",
        "version": MANIFEST_VERSION,
        "schema_source": schema_source,
        "private_schema_sha256": sha_file(files["private-schema.sql"]),
        "private_data_sha256": sha_file(files["private-data.sql"]),
        "tables": table_details,
        "origin_witness_rows":
            table_details["private.cwl_portable_backup_witnesses"]["rows"],
    }


def capture(root):
    files, *rest = inventory(root)
    manifest = rest[-1]
    files[MANIFEST].write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    # The manifest is sensitive audit material and never uploaded unencrypted.
    try:
        files[MANIFEST].chmod(0o600)
    except OSError:
        pass
    print("OFFSITE-ORIGIN CAPTURE: protected table projections and sorted-row "
          "digests sealed inside encrypted backup; witness rows: " +
          str(manifest["origin_witness_rows"]))
    if manifest["origin_witness_rows"] == 0:
        print("::warning::No original portable witness has been issued yet. "
              "A total DB-loss recovery point cannot certify a future file "
              "until its original receipt is included in a later successful archive.")


def validated_manifest(root):
    files, primary_schema, private_schema, primary, extra, selected, fresh = inventory(root)
    if not files[MANIFEST].is_file():
        fail("No encrypted offsite witness manifest; this is a legacy DR archive")
    try:
        sealed = json.loads(files[MANIFEST].read_text(encoding="utf-8"))
    except (ValueError, UnicodeError):
        fail("Malformed encrypted witness manifest")
    if sealed != fresh or sealed.get("version") != MANIFEST_VERSION:
        fail("Protected private dump or its witness inventory changed since encryption")
    return files, primary_schema, private_schema, primary, extra, selected, sealed


def prepare(root):
    files, primary_schema, private_schema, primary, extra, selected, manifest = validated_manifest(root)
    if manifest["schema_source"] == "default":
        schema_sql = "-- private schema is already in the primary SQL archive\n"
    else:
        schema_sql = files["private-schema.sql"].read_text(encoding="utf-8")
        # A different schema could have created private without its tables.
        schema_sql = re.sub(r"(?m)^CREATE SCHEMA private;",
                            "CREATE SCHEMA IF NOT EXISTS private;", schema_sql)
    missing_data = [x["sql"] for name, x in sorted(extra.items()) if name not in primary]
    data_sql = "".join(missing_data) or "-- private rows already exist in the primary SQL archive\n"
    files["private-schema-local.sql"].write_text(schema_sql, encoding="utf-8")
    files["private-data-local.sql"].write_text(data_sql, encoding="utf-8")
    print("OFFSITE-ORIGIN PREPARE: sealed manifest verified; fallback private data "
          "sections: " + str(len(missing_data)))


def read_restored_rows(table, columns):
    if not table.startswith("private.") or not all(SAFE_IDENT.fullmatch(c) for c in columns):
        fail("Unsafe private SQL comparison identifiers")
    if not all(SAFE_IDENT.fullmatch(part) for part in table.split(".")):
        fail("Unsafe private SQL table identifier")
    command = ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
               "-c", "COPY " + table + " (" + ",".join(columns) + ") TO STDOUT;"]
    env = os.environ.copy()
    env["PGOPTIONS"] = env.get("PGOPTIONS", "") + " -c TimeZone=UTC -c DateStyle=ISO,MDY -c IntervalStyle=postgres"
    try:
        result = subprocess.run(command, capture_output=True, text=True,
                                check=False, env=env, timeout=70)
    except (OSError, subprocess.TimeoutExpired):
        fail("Disposable PostgreSQL witness check did not run")
    if result.returncode:
        fail("Restored private table is unavailable or has incompatible columns")
    return result.stdout.splitlines()


def verify_db(root):
    files, _, _, _, _, _, manifest = validated_manifest(root)
    if not files["private-schema-local.sql"].is_file() or not files["private-data-local.sql"].is_file():
        fail("Private-schema/data restoration was never prepared")
    for table, expected in sorted(manifest["tables"].items()):
        rows = read_restored_rows(table, expected["columns"])
        if len(rows) != expected["rows"] or fingerprint(expected["columns"], rows) != expected["sha256"]:
            fail("Recovered private table rows differ from sealed offsite copy: " + table)
    for table in REQUIRED:
        if read_restored_rows(table, manifest["tables"][table]["columns"]) is None:
            fail("Missing protected witness and recovery relation")
    print("PASS: independent encrypted offsite artifact restored EVERY private "
          "table byte-for-byte (order-independent), including original receipt "
          "and multi-clan recovery checkpoints; witness rows: " +
          str(manifest["origin_witness_rows"]))


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 2 or argv[0] not in ("capture", "prepare", "verify-db"):
        print("Usage: verify_portable_witness_archive.py capture|prepare|verify-db DIR",
              file=sys.stderr)
        return 2
    try:
        root = Path(argv[1])
        if argv[0] == "capture":
            capture(root)
        elif argv[0] == "prepare":
            prepare(root)
        else:
            verify_db(root)
    except AuditError as exc:
        print("::error::Protected origin backup validation failed: " + str(exc),
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
