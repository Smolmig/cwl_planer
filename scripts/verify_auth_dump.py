#!/usr/bin/env python3
"""Validate that a Supabase auth SQL dump contains actual auth.users rows.

Only a row count is printed; never display exported account data in CI logs.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

AUTH_USERS_COPY = re.compile(r'^COPY\s+(?:"auth"|auth)\.(?:"users"|users)\s*\(', re.IGNORECASE)


def count_auth_users(path: Path) -> int:
    in_users = False
    found_header = False
    count = 0
    found_terminator = False

    with path.open("r", encoding="utf-8") as stream:
        for raw in stream:
            line = raw.rstrip("\r\n")
            if not in_users:
                if AUTH_USERS_COPY.match(line):
                    in_users = True
                    found_header = True
                continue
            if line == r"\.":
                found_terminator = True
                break
            # Empty fields in a COPY data line are separated by tabs; such a
            # line still represents a user row and should be counted.
            count += 1

    if not found_header or not found_terminator or count < 1:
        raise ValueError(
            "The auth SQL dump has no complete, nonempty auth.users COPY section."
        )
    return count


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: verify_auth_dump.py <auth-data.sql>", file=sys.stderr)
        return 2
    try:
        count = count_auth_users(Path(sys.argv[1]))
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"::error::Auth backup verification failed: {exc}", file=sys.stderr)
        return 1
    print(f"Auth backup verified: {count} user row(s) present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
