# eagle

Package eagle provides a functionality to export Prometheus metrics aggregated over configured time interval. This can be useful when you want to use Prometheus library to instrument your code but still want to periodically export metrics to non Prometheus monitoring systems.

At moment only Counters, Gauges and Summaries are supported.

[Godoc](https://godoc.org/github.com/FZambia/eagle)
