"""No network or production DB: synthetic tests for sealed offsite CWL receipts."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/verify_portable_witness_archive.py"
spec = importlib.util.spec_from_file_location("verify_origin", SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def schema(tables):
    return "\n".join("CREATE TABLE " + t + " (id uuid);"
                     for t in tables) + "\n"


def copy(tables, *, witness_rows=0):
    blocks = []
    for table in tables:
        columns = ("id,owner_user_id,source_clan_ids,source_clash_tags,"
                   "payload_sha256,snapshot_at,created_at"
                   if table.endswith("backup_witnesses") else "id")
        rows = ("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\t"
                "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb\t"
                "{cccccccc-cccc-4ccc-8ccc-cccccccccccc}\t"
                '[\"#P8Y2\"]\t' + "a" * 64 +
                "\t2026-11-22T01:00Z\t2026-11-22 01:00:00+00\n"
                if table.endswith("backup_witnesses") and witness_rows else "")
        blocks.append("COPY " + table + " (" + columns + ") FROM stdin;\n" +
                      rows + "\\.\n")
    return "".join(blocks)


class OffsiteOriginSafety(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.required = list(audit.REQUIRED)
        (self.root / "schema.sql").write_text("CREATE TABLE public.cwl_cloud_profiles (id uuid);\n")
        (self.root / "data.sql").write_text("COPY public.cwl_cloud_profiles (id) FROM stdin;\n\\.\n")
        (self.root / "auth-data.sql").write_text("COPY auth.users (id) FROM stdin;\n123\n\\.\n")
        (self.root / "private-schema.sql").write_text(schema(self.required))
        (self.root / "private-data.sql").write_text(copy(self.required))

    def test_full_fallback_keeps_private_schema_and_data(self):
        audit.capture(self.root)
        audit.prepare(self.root)
        self.assertIn("CREATE TABLE private.cwl_portable_backup_witnesses",
                      (self.root / "private-schema-local.sql").read_text())
        self.assertIn("COPY private.cwl_portable_backup_witnesses",
                      (self.root / "private-data-local.sql").read_text())
        self.assertEqual(audit.validated_manifest(self.root)[-1]["origin_witness_rows"], 0)
        with mock.patch.object(audit, "read_restored_rows", return_value=[]), \
             mock.patch.object(audit, "verify_private_rls", return_value=None):
            audit.verify_db(self.root)

    def test_restored_private_rlless_table_is_denied(self):
        audit.capture(self.root)
        audit.prepare(self.root)
        with mock.patch.object(audit, "read_restored_rows", return_value=[]), \
             mock.patch.object(audit, "verify_private_rls",
                               side_effect=audit.AuditError("RLS disabled")):
            with self.assertRaisesRegex(audit.AuditError, "RLS disabled"):
                audit.verify_db(self.root)

    def test_primary_contains_private_tables_no_double_import(self):
        (self.root / "schema.sql").write_text(schema(self.required))
        (self.root / "data.sql").write_text(copy(self.required))
        audit.capture(self.root)
        audit.prepare(self.root)
        self.assertNotIn("CREATE TABLE private.",
                         (self.root / "private-schema-local.sql").read_text())
        self.assertNotIn("COPY private.",
                         (self.root / "private-data-local.sql").read_text())
        self.assertEqual(audit.validated_manifest(self.root)[-1]["schema_source"], "default")

    def test_missing_explicit_witness_copy_fails_closed_even_with_zero_rows(self):
        (self.root / "private-data.sql").write_text(copy(self.required[1:]))
        with self.assertRaisesRegex(audit.AuditError, "required zero-or-more"):
            audit.capture(self.root)

    def test_missing_private_schema_fails_closed(self):
        (self.root / "private-schema.sql").write_text(schema(self.required[:-1]))
        with self.assertRaisesRegex(audit.AuditError, "complete witness"):
            audit.capture(self.root)

    def test_truncated_copy_and_duplicate_sections_block_backup(self):
        (self.root / "private-data.sql").write_text(
            copy(self.required) + "COPY private.extra (id) FROM stdin;\n")
        with self.assertRaisesRegex(audit.AuditError, "Truncated"):
            audit.capture(self.root)
        (self.root / "private-data.sql").write_text(
            copy(self.required) + copy([self.required[0]]))
        with self.assertRaisesRegex(audit.AuditError, "Repeated"):
            audit.capture(self.root)

    def test_tampered_encrypted_manifest_or_private_data_refused(self):
        audit.capture(self.root)
        (self.root / "private-data.sql").write_text(copy(self.required, witness_rows=1))
        with self.assertRaisesRegex(audit.AuditError, "changed since encryption"):
            audit.prepare(self.root)

    def test_one_real_receipt_and_restored_comparison_detects_missing_row(self):
        (self.root / "private-data.sql").write_text(copy(self.required, witness_rows=1))
        audit.capture(self.root)
        audit.prepare(self.root)
        witness = "private.cwl_portable_backup_witnesses"
        expected = audit.validated_manifest(self.root)[-1]["tables"][witness]
        self.assertEqual(expected["rows"], 1)
        with mock.patch.object(audit, "read_restored_rows",
                               side_effect=lambda name, cols: []):
            with self.assertRaisesRegex(audit.AuditError, "Recovered private table rows differ"):
                audit.verify_db(self.root)

    def test_private_schema_partial_primary_fails_instead_of_unsafe_merge(self):
        (self.root / "schema.sql").write_text(schema(self.required[:1]))
        with self.assertRaisesRegex(audit.AuditError, "Partial private schema"):
            audit.capture(self.root)

    def test_primary_and_explicit_data_reconcile_without_double_inserting(self):
        (self.root / "schema.sql").write_text(schema(self.required))
        (self.root / "data.sql").write_text(copy(self.required[:2]))
        audit.capture(self.root)
        audit.prepare(self.root)
        new_rows = (self.root / "private-data-local.sql").read_text()
        self.assertNotIn("COPY " + self.required[0], new_rows)
        self.assertNotIn("COPY " + self.required[1], new_rows)
        for t in self.required[2:]:
            self.assertIn("COPY " + t, new_rows)


if __name__ == "__main__":
    unittest.main()
