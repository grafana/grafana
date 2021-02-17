package internal

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/metric"
)

var (
	// WritesCounter is a count of write commands performed.
	WritesCounter metric.Int64Counter
	// NewConnectionsCounter is a count of new connections.
	NewConnectionsCounter metric.Int64Counter
)

func init() {
	defer func() {
		if r := recover(); r != nil {
			Logger.Printf(context.Background(), "Error creating meter github.com/go-redis/redis for Instruments", r)
		}
	}()

	meter := metric.Must(otel.Meter("github.com/go-redis/redis"))

	WritesCounter = meter.NewInt64Counter("redis.writes",
		metric.WithDescription("the number of writes initiated"),
	)

	NewConnectionsCounter = meter.NewInt64Counter("redis.new_connections",
		metric.WithDescription("the number of connections created"),
	)
}
