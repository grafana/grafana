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

## Not done yet

- Go `transform` expression command (Phase 2)
- Browser vs sidecar parity tests (Phase 3)
- Alert rule and query API consumers (Phase 4)
- Benchmarks (Phase 5)
