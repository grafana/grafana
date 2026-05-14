#!/usr/bin/env python3
"""
Verify Hugo alias redirects against a running docs server.

Hugo aliases are defined in front matter and create redirect pages from old URLs
to the current page URL. This script checks that those redirects work correctly
on a local docs server.

Prerequisites:
  - Python 3.9+
  - A running docs server (start with `make docs` from the repo root, serves on localhost:3002)

Usage:
  # From the repo root
  python test-aliases.py docs/sources/.../user.md

  # Full paths work from anywhere — docs/sources is auto-detected
  python test-aliases.py /home/user/repos/grafana/docs/sources/.../api-legacy/

  # Multiple files
  python test-aliases.py docs/sources/.../user.md docs/sources/.../admin.md

  # All .md files in a directory (recursive)
  python test-aliases.py docs/sources/.../api-legacy/

  # Custom server URL (default: http://localhost:3002)
  python test-aliases.py --server http://localhost:3003 docs/sources/.../api-legacy/

  # Explicit docs source root (overrides auto-detection)
  python test-aliases.py --root /home/user/repos/grafana/docs/sources docs/sources/.../api-legacy/
"""

import argparse
import os
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path
from posixpath import normpath


def parse_aliases(filepath: str) -> list[str]:
    """Extract aliases from YAML front matter."""
    with open(filepath, "r") as f:
        content = f.read()

    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return []

    front_matter = match.group(1)

    aliases = []
    in_aliases = False
    for line in front_matter.splitlines():
        stripped = line.strip()
        if stripped.startswith("aliases:"):
            in_aliases = True
            continue
        if in_aliases:
            if stripped.startswith("- "):
                alias = stripped[2:].split("#")[0].strip()
                aliases.append(alias)
            elif stripped and not stripped.startswith("#"):
                break

    return aliases


def detect_docs_root(filepath: str) -> str:
    """Find docs/sources in the filepath and return the root up to and including it."""
    normalized = os.path.abspath(filepath).replace(os.sep, "/")
    marker = "/docs/sources/"
    idx = normalized.find(marker)
    if idx == -1:
        marker = "docs/sources/"
        if normalized.startswith(marker):
            return marker.rstrip("/")
        return None
    return normalized[: idx + len(marker)].rstrip("/")


def file_to_page_url(filepath: str, docs_root: str) -> str:
    """Convert a source file path to its Hugo page URL path."""
    rel = os.path.relpath(os.path.abspath(filepath), os.path.abspath(docs_root))
    rel = rel.replace(os.sep, "/")

    # docs/sources/foo/bar/baz.md -> /docs/grafana/latest/foo/bar/baz/
    # docs/sources/foo/bar/_index.md -> /docs/grafana/latest/foo/bar/
    # docs/sources/foo/bar/index.md -> /docs/grafana/latest/foo/bar/

    if rel.endswith("/_index.md") or rel.endswith("_index.md"):
        page_path = rel.rsplit("/_index.md", 1)[0] if "/_index.md" in rel else ""
    elif rel.endswith("/index.md") or rel.endswith("index.md"):
        page_path = rel.rsplit("/index.md", 1)[0] if "/index.md" in rel else ""
    elif rel.endswith(".md"):
        page_path = rel[:-3]
    else:
        page_path = rel

    url = f"/docs/grafana/latest/{page_path}/"
    url = url.replace("//", "/")
    return url


def is_index_file(filepath: str) -> bool:
    """Check if this is a branch bundle (_index.md)."""
    return os.path.basename(filepath) == "_index.md"


def resolve_alias(page_url: str, alias: str, is_index: bool) -> str:
    """
    Resolve a relative alias to an absolute URL path.

    For Hugo aliases:
    - '.' refers to the parent directory of the current page's URL
    - '..' refers to the grandparent
    This applies to both _index.md and regular .md files.
    """
    if alias.startswith("/"):
        return alias

    parent = page_url.rstrip("/").rsplit("/", 1)[0] + "/"
    combined = parent + alias
    resolved = normpath(combined)

    if not resolved.endswith("/") and not alias.rstrip("/").endswith(alias.rstrip("/")):
        resolved += "/"
    if alias.endswith("/") and not resolved.endswith("/"):
        resolved += "/"

    return resolved


def check_redirect(server: str, from_url: str, expected_dest_url: str) -> tuple[bool, str]:
    """
    Check that from_url redirects to expected_dest_url on the server.
    Returns (passed, detail_message).
    """
    full_url = f"{server}{from_url}"
    expected_full = f"{server}{expected_dest_url}"

    try:
        req = urllib.request.Request(full_url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except Exception as e:
        return False, f"Error: {e}"

    dest_match = re.search(r'destination="([^"]*)"', body)
    if dest_match:
        actual_dest = dest_match.group(1)
        if actual_dest == expected_full:
            return True, "redirect OK"
        else:
            actual_path = actual_dest.replace(server, "")
            return False, f"redirects to {actual_path} (expected {expected_dest_url})"

    if f"<h1" in body.lower():
        return True, "direct page (no redirect needed)"

    return False, "no redirect found and not a content page"


def collect_files(targets: list[str]) -> list[str]:
    """Collect .md files from a mix of file paths and directories."""
    files = []
    for target in targets:
        if os.path.isfile(target) and target.endswith(".md"):
            files.append(target)
        elif os.path.isdir(target):
            for root, _, filenames in os.walk(target):
                for fn in sorted(filenames):
                    if fn.endswith(".md"):
                        files.append(os.path.join(root, fn))
        else:
            print(f"WARNING: Skipping {target} (not a .md file or directory)")
    return files


def main():
    parser = argparse.ArgumentParser(
        description="Verify Hugo alias redirects against a running docs server."
    )
    parser.add_argument(
        "targets",
        nargs="+",
        help="One or more .md files or directories to check",
    )
    parser.add_argument(
        "--server",
        default="http://localhost:3002",
        help="Docs server base URL (default: http://localhost:3002)",
    )
    parser.add_argument(
        "--root",
        default=None,
        help="Docs source root directory (auto-detected from paths if not set)",
    )
    args = parser.parse_args()

    files = collect_files(args.targets)
    if not files:
        print("No .md files found.")
        sys.exit(1)

    docs_root = args.root
    if docs_root is None:
        docs_root = detect_docs_root(files[0])
        if docs_root is None:
            print("ERROR: Could not find 'docs/sources' in the target paths.")
            print("       Use --root to specify the docs source root directory.")
            sys.exit(1)
        print(f"Auto-detected docs root: {docs_root}")

    total_pass = 0
    total_fail = 0
    total_skip = 0
    failures = []

    for filepath in files:
        aliases = parse_aliases(filepath)
        if not aliases:
            continue

        page_url = file_to_page_url(filepath, docs_root)
        is_idx = is_index_file(filepath)
        short_name = os.path.relpath(filepath)

        print(f"\n--- {short_name} ---")
        print(f"    page URL: {page_url}")

        for alias in aliases:
            from_url = resolve_alias(page_url, alias, is_idx)
            passed, detail = check_redirect(args.server, from_url, page_url)

            if passed:
                total_pass += 1
                print(f"  PASS: {from_url}")
            else:
                total_fail += 1
                print(f"  FAIL: {from_url} -> {detail}")
                failures.append((short_name, from_url, detail))

    print(f"\n{'=' * 60}")
    print(f"RESULTS: {total_pass} passed, {total_fail} failed")

    if failures:
        print(f"\nFAILURES:")
        for filename, from_url, detail in failures:
            print(f"  [{filename}] {from_url} -> {detail}")

    sys.exit(1 if total_fail > 0 else 0)


if __name__ == "__main__":
    main()
