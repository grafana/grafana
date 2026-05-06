## Important: Repository Mirroring

**This project is primarily developed on GitLab.** The repository you are currently viewing might be a mirror. Please review the guidelines below based on where you are viewing this:

| Platform | Role | Contributing Guidelines |
| :--- | :--- | :--- |
| **GitLab** | **Primary Source** | This is the canonical repository (`cznic/sqlite`). CI pipelines and main development happen here. |
| **GitHub** | **Mirror** | This is a mirror (`modernc-org/sqlite`). We **do accept** Issues and Pull Requests here for your convenience! <br> *Note: PRs submitted here will be manually merged into the GitLab source, so please allow extra time for processing.* |

[![Go Reference](https://pkg.go.dev/badge/modernc.org/sqlite.svg)](https://pkg.go.dev/modernc.org/sqlite)
[![LiberaPay](https://liberapay.com/assets/widgets/donate.svg)](https://liberapay.com/jnml/donate)
[![receives](https://img.shields.io/liberapay/receives/jnml.svg?logo=liberapay)](https://liberapay.com/jnml/donate)
[![patrons](https://img.shields.io/liberapay/patrons/jnml.svg?logo=liberapay)](https://liberapay.com/jnml/donate)

---

### Enterprise Infrastructure Tier Sponsor

[Tailscale](https://tailscale.com/)

### Startup / Small Business Tier Sponsor

[<img src="sponsors/octoberswimmer.png">](http://www.octoberswimmer.com/)

---

[The SQLite Drivers Benchmarks Game]

[The SQLite Drivers Benchmarks Game]: https://pkg.go.dev/modernc.org/sqlite-bench#readme-tl-dr-scorecard

Virtual Tables (vtab)
---------------------

The driver exposes a Go API to implement SQLite virtual table modules in pure Go via the `modernc.org/sqlite/vtab` package. This lets you back SQL tables with arbitrary data sources (e.g., vector indexes, CSV files, remote APIs) and integrate with SQLite’s planner.

- Register: `vtab.RegisterModule(db, name, module)`. Registration applies to new connections only.
- Schema declaration: Call `ctx.Declare("CREATE TABLE <name>(<cols...>)")` within `Create` or `Connect`. The driver does not auto-declare schemas, enabling dynamic schemas.
- Module arguments: `args []string` passed to `Create/Connect` are configuration parsed from `USING module(...)`. They are not treated as columns unless your module chooses to.
- Planning (BestIndex):
  - Inspect `info.Constraints` (with `Column`, `Op`, `Usable`, 0-based `ArgIndex`, and `Omit`), `info.OrderBy`, and `info.ColUsed` (bitmask of referenced columns).
  - Set `ArgIndex` (0-based) to populate `Filter`’s `vals` in the chosen order; set `Omit` to ask SQLite not to re-check a constraint you fully handle.
- Execution: `Cursor.Filter(idxNum, idxStr, vals)` receives arguments in the order implied by `ArgIndex`.
- Operators: Common SQLite operators map to `ConstraintOp` (EQ/NE/GT/GE/LT/LE/MATCH/IS/ISNOT/ISNULL/ISNOTNULL/LIKE/GLOB/REGEXP/FUNCTION/LIMIT/OFFSET). Unknown operators map to `OpUnknown`.
- Errors: Returning an error from vtab methods surfaces a descriptive message to SQLite (e.g., `zErrMsg` for xCreate/xConnect/xBestIndex/xFilter; `sqlite3_result_error` for xColumn).

Examples
--------

- Vector search (sqlite-vec style):
  - `CREATE VIRTUAL TABLE vec_docs USING vec(dim=128, metric="cosine")`
  - Module reads args (e.g., `dim`, `metric`), calls `ctx.Declare("CREATE TABLE vec_docs(id, embedding, content HIDDEN)")`, and implements search via `BestIndex`/`Filter`.

- CSV loader:
  - `CREATE VIRTUAL TABLE csv_users USING csv(filename="/tmp/users.csv", delimiter=",", header=true)`
  - Module reads the file header to compute columns, declares them via `ctx.Declare("CREATE TABLE csv_users(name, email, ...)")`, and streams rows via a cursor.

See `vtab` package docs for full API details.
