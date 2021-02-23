package middleware

import (
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	grpcUtils "github.com/weaveworks/common/grpc"
	"github.com/weaveworks/common/httpgrpc"
	"golang.org/x/net/context"
	"google.golang.org/grpc"
)

func observe(hist *prometheus.HistogramVec, method string, err error, duration time.Duration) {
	respStatus := "success"
	if err != nil {
		if errResp, ok := httpgrpc.HTTPResponseFromError(err); ok {
			respStatus = strconv.Itoa(int(errResp.Code))
		} else if grpcUtils.IsCanceled(err) {
			respStatus = "cancel"
		} else {
			respStatus = "error"
		}
	}
	hist.WithLabelValues(gRPC, method, respStatus, "false").Observe(duration.Seconds())
}

// UnaryServerInstrumentInterceptor instruments gRPC requests for errors and latency.
func UnaryServerInstrumentInterceptor(hist *prometheus.HistogramVec) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		begin := time.Now()
		resp, err := handler(ctx, req)
		observe(hist, info.FullMethod, err, time.Since(begin))
		return resp, err
	}
}

// StreamServerInstrumentInterceptor instruments gRPC requests for errors and latency.
func StreamServerInstrumentInterceptor(hist *prometheus.HistogramVec) grpc.StreamServerInterceptor {
	return func(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		begin := time.Now()
		err := handler(srv, ss)
		observe(hist, info.FullMethod, err, time.Since(begin))
		return err
	}
}
