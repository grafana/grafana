package middleware

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc/stats"
)

// NewStatsHandler creates handler that can be added to gRPC server options to track received and sent message sizes.
func NewStatsHandler(receivedPayloadSize, sentPayloadSize *prometheus.HistogramVec, inflightRequests *prometheus.GaugeVec) stats.Handler {
	return &grpcStatsHandler{
		receivedPayloadSize: receivedPayloadSize,
		sentPayloadSize:     sentPayloadSize,
		inflightRequests:    inflightRequests,
	}
}

type grpcStatsHandler struct {
	receivedPayloadSize *prometheus.HistogramVec
	sentPayloadSize     *prometheus.HistogramVec
	inflightRequests    *prometheus.GaugeVec
}

// Custom type to hide it from other packages.
type contextKey int

const (
	contextKeyMethodName contextKey = 1
)

func (g *grpcStatsHandler) TagRPC(ctx context.Context, info *stats.RPCTagInfo) context.Context {
	return context.WithValue(ctx, contextKeyMethodName, info.FullMethodName)
}

func (g *grpcStatsHandler) HandleRPC(ctx context.Context, rpcStats stats.RPCStats) {
	// We use full method name from context, because not all RPCStats structs have it.
	fullMethodName, ok := ctx.Value(contextKeyMethodName).(string)
	if !ok {
		return
	}

	switch s := rpcStats.(type) {
	case *stats.Begin:
		g.inflightRequests.WithLabelValues(gRPC, fullMethodName).Inc()
	case *stats.End:
		g.inflightRequests.WithLabelValues(gRPC, fullMethodName).Dec()
	case *stats.InHeader:
		// Ignore incoming headers.
	case *stats.InPayload:
		g.receivedPayloadSize.WithLabelValues(gRPC, fullMethodName).Observe(float64(s.WireLength))
	case *stats.InTrailer:
		// Ignore incoming trailers.
	case *stats.OutHeader:
		// Ignore outgoing headers.
	case *stats.OutPayload:
		g.sentPayloadSize.WithLabelValues(gRPC, fullMethodName).Observe(float64(s.WireLength))
	case *stats.OutTrailer:
		// Ignore outgoing trailers. OutTrailer doesn't have valid WireLength (there is a deprecated field, always set to 0).
	}
}

func (g *grpcStatsHandler) TagConn(ctx context.Context, _ *stats.ConnTagInfo) context.Context {
	return ctx
}

func (g *grpcStatsHandler) HandleConn(_ context.Context, _ stats.ConnStats) {
	// Not interested.
}
