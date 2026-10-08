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

Run the end-to-end Go test against a running sidecar:

```sh
TRANSFORM_SIDECAR_URL=http://127.0.0.1:8095 go test ./pkg/expr -run TestTransformCommand
```

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

- Browser vs sidecar parity tests (Phase 3)
- Alert rule and query API consumers (Phase 4)
- Benchmarks (Phase 5)
