# line-protocol

[![Go Reference](https://pkg.go.dev/badge/github.com/influxdata/line-protocol/v2.svg)](https://pkg.go.dev/github.com/influxdata/line-protocol/v2)

This is an encoder for the influx [line protocol.](https://docs.influxdata.com/influxdb/latest/reference/syntax/line-protocol/)

It has an interface similar to the standard library's `json.Encoder`.


### some caveats.
- It is not concurrency-safe.  If you want to make multiple calls to `Encoder.Encode` concurrently you have to manage the concurrency yourself.
- It can only encode values that are uint64, int64, int, float32, float64, string, or bool. 
- Ints are converted to int64, float32's to float64.
- If UintSupport is not set, uint64s are converted to int64's and if they are larger than the max int64, they get truncated to the max int64 instead of overflowing.


### Example:
```go
buf := &bytes.Buffer{}
serializer := protocol.NewEncoder(buf)
serializer.SetMaxLineBytes(1024)
serializer.SetFieldTypeSupport(UintSupport)
serializer.Encode(e) // where e is something that implements the protocol.Metric interface
```
