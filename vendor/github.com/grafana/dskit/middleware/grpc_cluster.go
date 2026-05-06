package middleware

import (
	"context"
	"fmt"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc/peer"

	"github.com/grafana/dskit/clusterutil"
	"github.com/grafana/dskit/grpcutil"
	"github.com/grafana/dskit/tracing"
	"github.com/grafana/dskit/user"

	"github.com/pkg/errors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

// InvalidClusterValidationReporter is called by ClusterUnaryClientInterceptor to report the cluster validation issues
// back to the caller. Its parameters are the error message explaining the reason for a bad cluster validation, and
// the method that triggered the validation.
type InvalidClusterValidationReporter func(errorMsg string, method string)

// NoOpInvalidClusterValidationReporter in an InvalidClusterValidationReporter that reports nothing.
var NoOpInvalidClusterValidationReporter InvalidClusterValidationReporter = func(string, string) {}

// ClusterUnaryClientInterceptor propagates the given cluster label to gRPC metadata, before calling the next invoker.
// If an empty cluster label, or a nil InvalidClusterValidationReporter are provided, ClusterUnaryClientInterceptor panics.
// In case of an error related to the cluster label validation, InvalidClusterValidationReporter is called, and the error
// is returned.
func ClusterUnaryClientInterceptor(cluster string, invalidClusterValidationReporter InvalidClusterValidationReporter) grpc.UnaryClientInterceptor {
	validateClusterClientInterceptorInputParameters(cluster, invalidClusterValidationReporter)
	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		ctx = clusterutil.PutClusterIntoOutgoingContext(ctx, cluster)
		return handleClusterValidationError(invoker(ctx, method, req, reply, cc, opts...), method, invalidClusterValidationReporter)
	}
}

func validateClusterClientInterceptorInputParameters(cluster string, invalidClusterValidationReporter InvalidClusterValidationReporter) {
	if cluster == "" {
		panic("no cluster label provided")
	}
	if invalidClusterValidationReporter == nil {
		panic("no InvalidClusterValidationReporter provided")
	}
}

func handleClusterValidationError(err error, method string, invalidClusterValidationReporter InvalidClusterValidationReporter) error {
	if err == nil {
		return nil
	}
	if stat, ok := grpcutil.ErrorToStatus(err); ok {
		details := stat.Details()
		if len(details) == 1 {
			if errDetails, ok := details[0].(*grpcutil.ErrorDetails); ok {
				if errDetails.GetCause() == grpcutil.WRONG_CLUSTER_VALIDATION_LABEL {
					msg := fmt.Sprintf("request rejected by the server: %s", stat.Message())
					invalidClusterValidationReporter(msg, method)
					return grpcutil.Status(codes.Internal, msg).Err()
				}
			}
		}
	}
	return err
}

// ClusterUnaryServerInterceptor checks if the incoming gRPC metadata contains any cluster label and if so, checks if
// the latter corresponds to the given cluster label. If it is the case, the request is further propagated.
// If an empty cluster label or nil logger are provided, ClusterUnaryServerInterceptor panics.
// If the softValidation parameter is true, errors related to the cluster label validation are logged, but not returned.
// Otherwise, an error is returned.
func ClusterUnaryServerInterceptor(cluster string, softValidation bool, invalidClusterRequests *prometheus.CounterVec, logger log.Logger) grpc.UnaryServerInterceptor {
	validateClusterServerInterceptorInputParameters(cluster, logger)
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		// We skip the gRPC health check.
		if _, ok := info.Server.(healthpb.HealthServer); ok {
			return handler(ctx, req)
		}

		if err := checkClusterFromIncomingContext(ctx, info.FullMethod, cluster, softValidation, invalidClusterRequests, logger); err != nil {
			stat := grpcutil.Status(codes.FailedPrecondition, err.Error(), &grpcutil.ErrorDetails{Cause: grpcutil.WRONG_CLUSTER_VALIDATION_LABEL})
			return nil, stat.Err()
		}
		return handler(ctx, req)
	}
}

func validateClusterServerInterceptorInputParameters(cluster string, logger log.Logger) {
	if cluster == "" {
		panic("no cluster label provided")
	}
	if logger == nil {
		panic("no logger provided")
	}
}

func checkClusterFromIncomingContext(
	ctx context.Context, method string, expectedCluster string, softValidationEnabled bool,
	invalidClusterRequests *prometheus.CounterVec, logger log.Logger,
) error {
	reqCluster, err := clusterutil.GetClusterFromIncomingContext(ctx)
	if err == nil && reqCluster == expectedCluster {
		return nil
	}

	logger = log.With(
		logger,
		"method", method,
		"cluster_validation_label", expectedCluster,
		"soft_validation", softValidationEnabled,
	)
	if tenantID, err := user.ExtractOrgID(ctx); err == nil {
		logger = log.With(logger, "tenant", tenantID)
	}
	if p, ok := peer.FromContext(ctx); ok {
		logger = log.With(logger, "client_address", p.Addr.String())
	}
	if traceID, ok := tracing.ExtractSampledTraceID(ctx); ok {
		logger = log.With(logger, "trace_id", traceID)
	}

	if err == nil {
		// No error, but request's and server's cluster validation labels didn't match.
		var wrongClusterErr error
		if !softValidationEnabled {
			wrongClusterErr = fmt.Errorf("rejected request with wrong cluster validation label %q - it should be %q", reqCluster, expectedCluster)
		}

		invalidClusterRequests.WithLabelValues("grpc", method, expectedCluster, reqCluster).Inc()
		level.Warn(logger).Log("msg", "request with wrong cluster validation label", "request_cluster_validation_label", reqCluster)
		return wrongClusterErr
	}

	if errors.Is(err, clusterutil.ErrNoClusterValidationLabel) {
		var emptyClusterErr error
		if !softValidationEnabled {
			emptyClusterErr = fmt.Errorf("rejected request with empty cluster validation label - it should be %q", expectedCluster)
		}

		invalidClusterRequests.WithLabelValues("grpc", method, expectedCluster, "").Inc()
		level.Warn(logger).Log("msg", "request with no cluster validation label")
		return emptyClusterErr
	}

	var rejectedRequestErr error
	if !softValidationEnabled {
		rejectedRequestErr = fmt.Errorf("rejected request: %w", err)
	}

	invalidClusterRequests.WithLabelValues("grpc", method, expectedCluster, "").Inc()
	level.Warn(logger).Log("msg", "detected error during cluster validation label extraction", "err", err)
	return rejectedRequestErr
}
