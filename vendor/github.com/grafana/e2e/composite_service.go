package e2e

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/pkg/errors"
)

// CompositeHTTPService abstract an higher-level service composed, under the hood,
// by 2+ HTTPService.
type CompositeHTTPService struct {
	services []*HTTPService

	// Generic retry backoff.
	retryBackoff *backoff.Backoff
}

func NewCompositeHTTPService(services ...*HTTPService) *CompositeHTTPService {
	return &CompositeHTTPService{
		services: services,
		retryBackoff: backoff.New(context.Background(), backoff.Config{
			MinBackoff: 300 * time.Millisecond,
			MaxBackoff: 600 * time.Millisecond,
			MaxRetries: 50, // Sometimes the CI is slow ¯\_(ツ)_/¯
		}),
	}
}

func (s *CompositeHTTPService) NumInstances() int {
	return len(s.services)
}

func (s *CompositeHTTPService) Instances() []*HTTPService {
	return s.services
}

// WaitSumMetrics waits for at least one instance of each given metric names to be present and their sums, returning true
// when passed to given isExpected(...).
func (s *CompositeHTTPService) WaitSumMetrics(isExpected func(sums ...float64) bool, metricNames ...string) error {
	return s.WaitSumMetricsWithOptions(isExpected, metricNames)
}

func (s *CompositeHTTPService) WaitSumMetricsWithOptions(isExpected func(sums ...float64) bool, metricNames []string, opts ...MetricsOption) error {
	var (
		sums    []float64
		err     error
		options = buildMetricsOptions(opts)
	)

	for s.retryBackoff.Reset(); s.retryBackoff.Ongoing(); {
		sums, err = s.SumMetrics(metricNames, opts...)
		if options.WaitMissingMetrics && errors.Is(err, errMissingMetric) {
			continue
		}
		if err != nil {
			return err
		}

		if isExpected(sums...) {
			return nil
		}

		s.retryBackoff.Wait()
	}

	return fmt.Errorf("unable to find metrics %s with expected values. Last error: %v. Last values: %v", metricNames, err, sums)
}

// SumMetrics returns the sum of the values of each given metric names.
func (s *CompositeHTTPService) SumMetrics(metricNames []string, opts ...MetricsOption) ([]float64, error) {
	sums := make([]float64, len(metricNames))

	for _, service := range s.services {
		partials, err := service.SumMetrics(metricNames, opts...)
		if err != nil {
			return nil, err
		}

		if len(partials) != len(sums) {
			return nil, fmt.Errorf("unexpected mismatching sum metrics results (got %d, expected %d)", len(partials), len(sums))
		}

		for i := 0; i < len(sums); i++ {
			sums[i] += partials[i]
		}
	}

	return sums, nil
}
