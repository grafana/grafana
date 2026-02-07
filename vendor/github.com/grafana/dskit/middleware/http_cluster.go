package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/dskit/clusterutil"
	"github.com/grafana/dskit/tracing"
	"github.com/grafana/dskit/user"
)

type clusterValidationError struct {
	ClusterValidationErrorMessage string `json:"cluster_validation_error_message"`
	Route                         string `json:"route"`
}

// writeAsJSON writes this error as JSON to the HTTP response.
func (e *clusterValidationError) writeAsJSON(w http.ResponseWriter) {
	data, err := json.Marshal(e)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNetworkAuthenticationRequired)
	// We ignore errors here, because we cannot do anything about them.
	// Write will trigger sending Status code, so we cannot send a different status code afterwards.
	// Also, this isn't internal error, but error communicating with client.
	_, _ = w.Write(data)
}

func ClusterValidationRoundTripper(cluster string, invalidClusterValidationReporter InvalidClusterValidationReporter, next http.RoundTripper) RoundTripperFunc {
	validateClusterValidationRoundTripperInputParameters(cluster, invalidClusterValidationReporter)
	return func(req *http.Request) (*http.Response, error) {
		clusterutil.PutClusterIntoHeader(req, cluster)
		resp, err := next.RoundTrip(req)
		if err != nil {
			return nil, err
		}
		if resp.StatusCode != http.StatusNetworkAuthenticationRequired {
			return resp, nil
		}
		if resp.Header.Get("Content-Type") != "application/json" {
			return resp, nil
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, err
		}
		var clusterValidationErr clusterValidationError
		err = json.Unmarshal(body, &clusterValidationErr)
		if err != nil {
			resp.Body = io.NopCloser(bytes.NewReader(body))
			return resp, nil
		}
		msg := fmt.Sprintf("request rejected by the server: %s", clusterValidationErr.ClusterValidationErrorMessage)
		invalidClusterValidationReporter(msg, clusterValidationErr.Route)
		return nil, errors.New(msg)
	}
}

func validateClusterValidationRoundTripperInputParameters(cluster string, invalidClusterValidationReporter InvalidClusterValidationReporter) {
	if cluster == "" {
		panic("no cluster label provided")
	}
	if invalidClusterValidationReporter == nil {
		panic("no InvalidClusterValidationReporter provided")
	}
}

// ClusterValidationMiddleware validates that requests have the correct cluster validation label.
// If empty cluster labels or nil logger are provided, ClusterValidationMiddleware panics.
// The check is ignored if the request's path belongs to the list of excluded paths or if the User-Agent matches any of the excluded user agents.
// If the softValidation parameter is true, errors related to the cluster label validation are logged, but not returned.
// Otherwise, an error is returned.
func ClusterValidationMiddleware(
	clusters []string, cfg clusterutil.ClusterValidationProtocolConfigForHTTP, invalidClusterRequests *prometheus.CounterVec, logger log.Logger,
) Interface {
	validateClusterValidationMiddlewareInputParameters(clusters, logger)
	var reB strings.Builder
	// Allow for a potential path prefix being configured.
	reB.WriteString(".*/(metrics|debug/pprof.*|ready")
	for _, path := range cfg.ExcludedPaths {
		reB.WriteString("|" + regexp.QuoteMeta(path))
	}
	reB.WriteString(")")
	reExcludedPath := regexp.MustCompile(reB.String())

	// Build user agent regex similar to excluded paths
	var reExcludedUserAgent *regexp.Regexp
	if len(cfg.ExcludedUserAgents) > 0 {
		var uaB strings.Builder
		uaB.WriteString("(")
		for i, userAgent := range cfg.ExcludedUserAgents {
			if i > 0 {
				uaB.WriteString("|")
			}
			uaB.WriteString(userAgent)
		}
		uaB.WriteString(")")
		reExcludedUserAgent = regexp.MustCompile(uaB.String())
	}

	return Func(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			route := ExtractRouteName(r.Context())
			if route == "" {
				route = "<unknown-route>"
			}
			if err := checkClusterFromRequest(r, clusters, route, cfg.SoftValidation, reExcludedPath, reExcludedUserAgent, invalidClusterRequests, logger); err != nil {
				clusterValidationErr := clusterValidationError{
					ClusterValidationErrorMessage: err.Error(),
					Route:                         route,
				}
				clusterValidationErr.writeAsJSON(w)
				return
			}
			next.ServeHTTP(w, r)
		})
	})
}

func validateClusterValidationMiddlewareInputParameters(clusters []string, logger log.Logger) {
	if len(clusters) == 0 {
		panic("no cluster labels provided")
	}
	if logger == nil {
		panic("no logger provided")
	}
}

func checkClusterFromRequest(
	r *http.Request, expectedClusters []string, route string, softValidationEnabled bool, reExcludedPath *regexp.Regexp, reExcludedUserAgent *regexp.Regexp,
	invalidClusterRequests *prometheus.CounterVec, logger log.Logger,
) error {
	if reExcludedPath != nil && reExcludedPath.MatchString(r.URL.Path) {
		return nil
	}

	// Check if User-Agent matches excluded user agent pattern
	if reExcludedUserAgent != nil {
		userAgent := r.Header.Get("User-Agent")
		if reExcludedUserAgent.MatchString(userAgent) {
			return nil
		}
	}

	reqCluster, err := clusterutil.GetClusterFromRequest(r)
	if err == nil && clusterutil.IsClusterAllowed(reqCluster, expectedClusters) {
		return nil
	}

	logger = log.With(
		logger,
		"path", r.URL.Path,
		"method", r.Method,
		"cluster_validation_labels", fmt.Sprintf("%v", expectedClusters),
		"soft_validation", softValidationEnabled,
		"tenant", r.Header.Get(user.OrgIDHeaderName),
		"user_agent", r.Header.Get("User-Agent"),
		"host", r.Host,
		"client_address", r.RemoteAddr,
	)
	if traceID, ok := tracing.ExtractSampledTraceID(r.Context()); ok {
		logger = log.With(logger, "trace_id", traceID)
	}

	if err == nil {
		// No error, but request's and server's cluster validation labels didn't match.
		var wrongClusterErr error
		if !softValidationEnabled {
			wrongClusterErr = fmt.Errorf("rejected request with wrong cluster validation label %q - it should be one of %v", reqCluster, expectedClusters)
		}

		// Use first expected cluster for metrics compatibility
		expectedClusterForMetrics := expectedClusters[0]
		invalidClusterRequests.WithLabelValues("http", route, expectedClusterForMetrics, reqCluster).Inc()
		level.Warn(logger).Log("msg", "request with wrong cluster validation label", "request_cluster_validation_label", reqCluster)
		return wrongClusterErr
	}

	if errors.Is(err, clusterutil.ErrNoClusterValidationLabelInHeader) {
		var emptyClusterErr error
		if !softValidationEnabled {
			emptyClusterErr = fmt.Errorf("rejected request with empty cluster validation label - it should be one of %v", expectedClusters)
		}

		// Use first expected cluster for metrics compatibility
		expectedClusterForMetrics := expectedClusters[0]
		invalidClusterRequests.WithLabelValues("http", route, expectedClusterForMetrics, "").Inc()
		level.Warn(logger).Log("msg", "request with no cluster validation label")
		return emptyClusterErr
	}

	var rejectedRequestErr error
	if !softValidationEnabled {
		rejectedRequestErr = fmt.Errorf("rejected request: %w", err)
	}

	// Use first expected cluster for metrics compatibility
	expectedClusterForMetrics := expectedClusters[0]
	invalidClusterRequests.WithLabelValues("http", route, expectedClusterForMetrics, "").Inc()
	level.Warn(logger).Log("msg", "detected error during cluster validation label extraction", "err", err)
	return rejectedRequestErr
}
