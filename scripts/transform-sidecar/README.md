# Transform sidecar (PoC)

A throwaway spike: a Node service that runs Grafana's frontend transformations, so a backend consumer (alert rules, Assistant, the query API) could use the same code the browser uses instead of a Go port.

It runs the 29 transformations that live in `@grafana/data`. The ones in `public/app/features/transformers` (heatmap, regression, geo, and others) are not included yet.

## Run

```sh
cd scripts/transform-sidecar
node build.mjs              # bundles src/ with esbuild into dist/
node dist/server.cjs        # listens on 127.0.0.1:8095
node --test test/pool.test.ts test/server.test.ts
```

The build bundles `packages/grafana-data/src` directly. Do not use `packages/grafana-data/dist`: it may be stale, and an old build needed jsdom globals to load.

## API

`POST /transform`

```json
{
  "frames": [
    {
      "schema": {
        "fields": [
          { "name": "svc", "type": "string" },
          { "name": "v", "type": "number" }
        ]
      },
      "data": {
        "values": [
          ["a", "a", "b"],
          [1, 3, 5]
        ]
      }
    }
  ],
  "transformations": [
    {
      "id": "groupBy",
      "options": {
        "fields": {
          "svc": { "operation": "groupby", "aggregations": [] },
          "v": { "operation": "aggregate", "aggregations": ["mean"] }
        }
      }
    }
  ],
  "timezone": "utc",
  "vars": { "service": "api" }
}
```

Frames use the same data frame JSON that `/api/ds/query` returns, so Go can send `data.FrameToJSON` output unchanged.

| Status | Meaning                                                                                    |
| ------ | ------------------------------------------------------------------------------------------ |
| 200    | `{ "frames": [...] }`                                                                      |
| 400    | Invalid request, or a transformation id the sidecar does not support                       |
| 413    | Body larger than `TRANSFORM_SIDECAR_MAX_BODY_BYTES`                                        |
| 422    | A transformation threw                                                                     |
| 503    | All workers busy and the queue is full                                                     |
| 504    | A transformation ran longer than `TRANSFORM_SIDECAR_TIMEOUT_MS`; its worker was terminated |

`GET /transformations` lists supported ids, for capability detection. `GET /health` returns pool usage.

## Grafana `transform` expression

Grafana calls the sidecar through a `transform` server-side expression (`pkg/expr/transform_command.go`). Enable it in `conf/custom.ini`:

```ini
[expressions]
transform_sidecar_url = http://127.0.0.1:8095
transform_sidecar_timeout = 15s
```

Add it to a query request next to the data source queries it reads:

```json
{
  "refId": "T",
  "datasource": { "type": "__expr__", "uid": "__expr__" },
  "type": "transform",
  "inputs": ["A", "B"],
  "transformations": [{ "id": "joinByField", "options": { "mode": "outer" } }],
  "timezone": "utc"
}
```

- **Inputs.** Frames from each input are sent in the order of `inputs`, stamped with their refId.
- **Raw frames.** A data source query used as an input skips Grafana's series/number conversion, so labels, field config, and metadata reach the sidecar unchanged. Because of that, it can't also be an input to a math, reduce, or SQL expression; the request is rejected.
- **Outputs.** The output frames come back as table data under the expression's refId.
- **Disabled by default.** With no `transform_sidecar_url` set, transform expressions are rejected.

### In an alert rule

Set `"format": "alerting"` to return one labeled number per row instead of table data. The rules are the same as for SQL expressions in alerting:

- each output frame has exactly one numeric field
- string fields become labels
- label sets must be unique

The output can then feed a threshold or math expression. `pkg/services/ngalert/eval/transform_eval_test.go` evaluates such a rule through the alerting evaluator, the same call the scheduler makes, with no panel involved. The rule is query → `transform` (groupBy mean, `format: alerting`) → threshold > 100:

| Service               | Mean latency | State                                                      |
| --------------------- | ------------ | ---------------------------------------------------------- |
| api                   | 180          | Alerting                                                   |
| worker                | 40           | Normal                                                     |
| idle                  | null → NaN   | Normal                                                     |
| (sidecar unreachable) | none         | Error, `calling transform sidecar: ... connection refused` |

`idle` is **Normal, not NoData**. The table-to-number conversion shared with SQL expressions reads a null value as NaN, and `NaN > 100` is false. DataPro's prototype reported NoData for the same input. This needs a decision either way, and it applies to SQL expressions in alert rules too.

Without `format: alerting`, a reduce over the transform's output fails with `can only reduce type series`, because reduce doesn't accept table data.

### From the query API

This is the path an Assistant tool would use. It is the same pipeline, so nothing extra is needed. With `transform_sidecar_url` set, restart the backend (ini changes are read at startup) and run:

```sh
curl -s -u admin:admin -H 'Content-Type: application/json' http://localhost:3000/api/ds/query -d '{
  "from": "now-1h", "to": "now",
  "queries": [
    {"refId": "A", "datasource": {"type": "grafana-testdata-datasource"}, "scenarioId": "csv_content",
     "csvContent": "service,latency\napi,100\napi,260\nworker,40\nidle,"},
    {"refId": "T", "datasource": {"type": "__expr__", "uid": "__expr__"}, "type": "transform", "inputs": ["A"],
     "transformations": [{"id": "groupBy", "options": {"fields": {
       "service": {"operation": "groupby", "aggregations": []},
       "latency": {"operation": "aggregate", "aggregations": ["mean"]}}}}]}
  ]}'
```

Run the end-to-end Go test against a running sidecar:

```sh
TRANSFORM_SIDECAR_URL=http://127.0.0.1:8095 go test ./pkg/expr -run TestTransformCommand
```

## Parity with the browser

`parity/run.sh` checks whether a panel would see the same frames from the sidecar as it does today:

- **Browser path:** Go frame JSON → `dataFrameFromJSON` → `transformDataFrame`, run in-process.
- **Sidecar path:** the same Go frames → `transform` expression → sidecar → Go → frame JSON → `dataFrameFromJSON`.

```sh
scripts/transform-sidecar/parity/run.sh [output dir]
```

- **Where things live.** Fixtures are defined in Go (`pkg/expr/transform_parity_test.go`), so `int64`, NaN, ±Inf, nullable values, and frame meta are built exactly as a data source would build them.
- **Comparison.** The comparer (`parity/compare.ts`) dumps frames losslessly: `undefined`, NaN, and ±Inf are tagged, not turned into `null`. It ignores frame refIds, because the expression's refId replaces them by design. It also treats Go's default `typeVersion` [0, 0] as no version.
- **Caveat.** The browser path runs in Node, not a real browser. It's the same `@grafana/data` code, minus the browser timezone.

### Results: 38 fixtures, all 29 transformations

34 fixtures match. The 4 differences:

| Fixture                                         | Difference                                                             | Cause                                                                                                                                                | Fix                                                                                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `joinByField-outer-misaligned`, `ensureColumns` | Missing points are `undefined` in the browser, `null` from the sidecar | Go has no `undefined`. The JS wire format has an `Undef` entity, but the Go SDK ignores it                                                           | **Contract change:** SDK support for `Undef`. This affects panels, because the time series panel connects across `undefined` but breaks at `null` unless `spanNulls` is set. Alerting is unaffected |
| `groupToNestedTable`                            | Nested-frames field type becomes `other` (values match)                | Go has no nested-frames field type. It stores the field as `json.RawMessage`, which encodes as `other`                                               | **Contract change:** an SDK field type for nested frames, or carrying the JS type through. As it stands, the table panel would not render the nested rows                                           |
| `groupingToMatrix`                              | 3 number fields become `other` (values match)                          | The transform fills empty cells of number fields with `""`. The sidecar sends mixed-type fields as raw JSON, because Go can't decode them as numbers | **Fixable in the transform:** default empty cells to `null`. Before the fallback, this crashed Go decoding                                                                                          |

### Found and fixed by the parity run

- **NaN and ±Inf were lost.** `dataFrameToJSON` never writes `entities`, and it deletes existing ones, so `JSON.stringify` turned these values into `null`. The sidecar now writes NaN/Inf/NegInf entities, which Go reads.
- **Mixed-type fields broke Go decoding.** `groupingToMatrix` returned a 200 that Go couldn't decode. The sidecar now sends such fields as raw JSON.

### Behaviors to know (the same in both paths)

- **`sortBy` and other field matchers use the display name.** A field with `config.displayName: "Latency"` is matched by `Latency`, not `latency`.
- **`int64` values above 2^53 lose precision when the browser parses the JSON,** before any transformation runs.

## Benchmarks

```sh
scripts/transform-sidecar/bench/run.sh [output dir] [iterations]
```

The runner does three things:

1. **Go side.** `TestTransformSidecarBenchmark` in `pkg/expr/transform_bench_test.go` times each stage of a sidecar call. It also times the full transform pipeline and a Go-native expression for the same result, where one exists.
2. **Browser baseline.** `bench/browser.ts` times what a panel does today: parse the response, decode the frames, run the transformations. It also times what the panel would do with a backend transform: parse and decode the smaller result.
3. **Report.** It merges both into `report.md`.

Each figure is the median of 5 runs after 1 warm-up run. Setup: Apple M4 Pro (14 cores, 48 GB), localhost, 4 sidecar workers. These are spike numbers from one machine, not capacity planning.

### Results (median ms)

| Workload                                             | Browser today: parse + decode + transform | Server with sidecar: full pipeline | Browser with sidecar | Native Go expression | Payload today → with sidecar |
| ---------------------------------------------------- | ----------------------------------------- | ---------------------------------- | -------------------- | -------------------- | ---------------------------- |
| 1k series × 1k points, `reduce` mean                 | 41                                        | 161                                | 0.1                  | 23 (SSE reduce)      | 18.1 MB → 0.05 MB            |
| 1k series × 1k points, `joinByField` outer (aligned) | 39                                        | 240                                | 14                   | —                    | 18.1 MB → 4.6 MB             |
| 1k misaligned series, `joinByField` outer            | 67                                        | 271                                | 22                   | —                    | 18.1 MB → 4.6 MB             |
| 50k log lines, `filterByValue` + `sortBy`            | 14                                        | 48                                 | 1.2                  | 22 (SQL expression)  | 6.0 MB → 1.2 MB              |
| 100k rows, `groupBy` mean                            | 14                                        | 27                                 | 0.0                  | 24 (SQL expression)  | 1.3 MB → 0.002 MB            |

Sidecar call breakdown (median ms):

| Workload                        | Go encode | Node `JSON.parse` | transform | encode + stringify | Go decode | HTTP total |
| ------------------------------- | --------- | ----------------- | --------- | ------------------ | --------- | ---------- |
| 1k × 1k `reduce`                | 109       | 33                | 8.7       | 0.2                | 0.3       | 55         |
| 1k × 1k `joinByField` (aligned) | 111       | 36                | 1.3       | 34                 | 35        | 94         |
| 1k misaligned `joinByField`     | 110       | 33                | 30        | 41                 | 35        | 126        |
| 50k logs                        | 21        | 5.8               | 4.7       | 3.0                | 5.0       | 22         |
| 100k `groupBy`                  | 10        | 2.9               | 11        | 0.0                | 0.0       | 16         |

Under load, 10 parallel requests × 3 rounds each: p50 36–283 ms and p99 58–404 ms, depending on the workload, with no failures. **Peak sidecar memory (RSS) was 1.9–2.5 GB.**

### What the numbers say

1. **The transform itself costs the same as in the browser,** because it's the same code on V8 (for example, 8.7 vs 7.5 ms for `reduce`, 11 vs 12 ms for `groupBy`). The extra server time is all serialization: Go JSON-encodes the input (109 ms for 18 MB) and Node parses it (33 ms). An Arrow IPC wire format, instead of JSON, is the obvious next experiment.
2. **On a fast connection the sidecar is slower end to end; on a real network, transforms that shrink data win clearly.** Today the server also encodes the 18 MB for the browser, then sends it over the network. With the sidecar, that encode happens once toward the sidecar, and only the result is sent. Estimated totals at 50 Mbps: server encode + transfer + browser work, versus pipeline + transfer of the result.

   | Workload                    | Today, est. at 50 Mbps | With sidecar, est. at 50 Mbps                              |
   | --------------------------- | ---------------------- | ---------------------------------------------------------- |
   | 1k × 1k `reduce`            | ~3.2 s                 | ~0.17 s                                                    |
   | 1k misaligned `joinByField` | ~3.2 s                 | ~1.1 s (plus Go encode of the 4.6 MB result, not measured) |
   | 50k logs                    | ~1.0 s                 | ~0.25 s                                                    |
   | 100k `groupBy`              | ~0.24 s                | ~0.03 s                                                    |

   On localhost, with no network cost, the sidecar is slower in every workload: 170–293 ms versus 24–177 ms. Transforms that keep the data size, such as joins, organize, and rename, gain little from moving.

3. **Native Go is faster where it exists.** SSE reduce takes 23 ms versus 161 ms through the sidecar. For `groupBy`, SQL expressions and the sidecar cost about the same (24 vs 27 ms). For logs, SQL is faster (22 vs 48 ms).
4. **Memory is the production risk.** Peak RSS of 2–2.5 GB came from 10 concurrent 18 MB requests across 4 workers. Each worker holds the payload string, the parsed objects, and the output. Any production setup would need per-request size limits well below the 64 MB default, and memory-based admission control.

## Configuration

| Variable                           | Default                        |
| ---------------------------------- | ------------------------------ |
| `TRANSFORM_SIDECAR_HOST`           | `127.0.0.1`                    |
| `TRANSFORM_SIDECAR_PORT`           | `8095` (`0` picks a free port) |
| `TRANSFORM_SIDECAR_WORKERS`        | `min(4, CPUs)`                 |
| `TRANSFORM_SIDECAR_QUEUE_LIMIT`    | `64`                           |
| `TRANSFORM_SIDECAR_TIMEOUT_MS`     | `10000`                        |
| `TRANSFORM_SIDECAR_MAX_BODY_BYTES` | `67108864`                     |

## Behavior that differs from the browser

- **Unknown transformation ids fail.** The browser skips them silently. A backend consumer would get untransformed data with no error.
- **The timezone defaults to UTC.** The browser default would resolve to the sidecar host's zone.
- **Variables use simple substitution.** `$var`, `${var}` and `[[var]]` are replaced from `vars`, and format suffixes are ignored. Multi-value variables and formats are not supported.

## Findings so far

1. **The transform core runs headless.** When bundled from source it needs no DOM shims. The only browser global is `window.__grafanaSceneContext`, and the build replaces it with `undefined`.
2. **`standardTransformers` lists `seriesToColumns` as an alias of `joinByField`.** Registering both throws a duplicate-key error, so ids are deduplicated.
3. **`null` and `undefined` merge on the wire.** An outer `joinByField` over misaligned series returns `null` for missing points. Frame JSON can't carry `undefined`, so a backend consumer sees "missing" and "null" as the same value. The browser keeps them apart.
4. **Renames live in field config.** `organize` and `rename` set `config.displayName` and leave `name` unchanged. Consumers must keep field config, or renames disappear.
5. **The frontend does not write Go type information.** `dataFrameToJSON` leaves out `typeInfo`, and the Go SDK's `Frame.UnmarshalJSON` panics when it's missing; it doesn't return an error. The sidecar adds `typeInfo` to every output field, and Go recovers from the panic in case it doesn't.
6. **Integer widths are lost.** JS numbers have no width, so an `int64` field returns as nullable `float64`. Values above 2^53 already lose precision in the browser.
7. **The PoC matches DataPro's prototype result.** For a group/mean over api, worker, and idle, Go → Node → Go returns api 180, worker 40, idle null. These are the same values as DataPro's E1 evidence.

## Not done yet
