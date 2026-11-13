#!/usr/bin/env python3
"""Summarize retained profiling artifacts without loading them into editor output."""
import collections
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RESULTS = ROOT / "local/shard1-profile/results"


def read(file):
    return json.loads(gzip.decompress(file.read_bytes()) if file.suffix == ".gz" else file.read_text())


def allocation_summary(profile):
    groups = collections.Counter()
    functions = collections.Counter()

    def walk(node, parent_url=""):
        frame = node["callFrame"]
        url = frame.get("url") or parent_url
        short = url.split("/node_modules/")[-1]
        if "/node_modules/" in url:
            group = "/".join(short.split("/")[:2]) if short.startswith("@") else short.split("/")[0]
        elif "/grafana/" in url:
            group = "source:" + url.split("/grafana/")[-1].split("/")[0]
        else:
            group = url or "native"
        groups[group] += node["selfSize"]
        functions[(frame.get("functionName"), short)] += node["selfSize"]
        for child in node.get("children", []):
            walk(child, url)

    walk(profile["head"])
    return {
        "estimatedBytes": sum(groups.values()),
        "sampleCount": len(profile["samples"]),
        "groups": dict(groups.most_common()),
        "topFunctions": [{"function": key[0], "file": key[1], "bytes": size} for key, size in functions.most_common(25)],
    }


summary = {"shards": {}, "cpu": {}, "allocations": {}}
for directory in RESULTS.glob("shard-*"):
    result_file = directory / "jest-results.json"
    if not result_file.exists():
        continue
    result = read(result_file)
    rows = [json.loads(line) for line in (directory / "phases.jsonl").read_text().splitlines()]
    totals = collections.Counter()
    collected = 0
    for row in rows:
        points = {p["phase"]: p for p in row["points"]}
        if "run_start" not in points or "run_finish" not in points:
            continue
        collected += 1
        totals["beforeTestsMs"] += points["run_start"]["ms"] - row["start"]
        totals["testsAndHooksMs"] += points["run_finish"]["ms"] - points["run_start"]["ms"]
        totals["afterTestsMs"] += row["end"] - points["run_finish"]["ms"]
        totals["testBodiesMs"] += sum(t["ms"] for t in row["tests"])
        totals["hooksMs"] += sum(h["ms"] for h in row["hooks"].values())
    summary["shards"][directory.name] = {
        "run": {k: v for k, v in read(directory / "run.json").items() if k != "selected"},
        "counts": {k: v for k, v in result.items() if k.startswith("num") or k == "success"},
        "phaseLogs": len(rows), "collectedPhaseLogs": collected,
        "workerPids": len({r["pid"] for r in rows}), "phases": dict(totals),
        "topSuites": [
            {"path": str(Path(r["name"]).relative_to(ROOT)), "ms": r["endTime"] - r["startTime"], "status": r["status"]}
            for r in sorted(result["testResults"], key=lambda r: r["endTime"] - r["startTime"], reverse=True)[:20]
        ],
    }
for run_file in RESULTS.glob("*/suite-*/run.json"):
    summary["cpu"][str(run_file.parent.relative_to(RESULTS))] = read(run_file)
for directory in RESULTS.glob("alloc-*"):
    if not (directory / "run.json").exists():
        continue
    summary["allocations"][directory.name] = {
        "run": read(directory / "run.json"),
        "profiles": {f.name: allocation_summary(read(f)) for f in sorted(directory.glob("*.heapprofile.gz"))},
        "retention": {f.name: read(f) for f in sorted(directory.glob("*.retention.json"))},
    }
output = RESULTS / "summary.json"
output.write_text(json.dumps(summary, indent=2) + "\n")
print(f"Saved {output.relative_to(ROOT)}: {len(summary['shards'])} shard runs, {len(summary['cpu'])} CPU pairs, {len(summary['allocations'])} allocation pairs")
