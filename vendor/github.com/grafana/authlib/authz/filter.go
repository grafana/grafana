package authz

import (
	"context"
	"fmt"
	"iter"
	"strconv"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/authlib/types"
)

// BatchCheckItem represents an item that needs batch authorization.
type BatchCheckItem struct {
	Name      string
	Folder    string
	Group     string
	Resource  string
	Verb      string
	Namespace string
	// FreshnessTimestamp is when the resource was last modified.
	// If provided, the server will skip cache for this item if the cached result
	// is older than this timestamp.
	FreshnessTimestamp time.Time
}

// FilterOptions configures the behavior of FilterAuthorized.
type FilterOptions struct {
	Tracer trace.Tracer
}

// FilterOption is a function that configures FilterOptions.
type FilterOption func(*FilterOptions)

// WithTracer sets the tracer for FilterAuthorized.
func WithTracer(tracer trace.Tracer) FilterOption {
	return func(o *FilterOptions) {
		o.Tracer = tracer
	}
}

// FilterAuthorized returns an iterator that yields only authorized items.
// User is extracted from context. Items are batched internally for efficient authorization checks.
// Yields (item, nil) for authorized items, (zero, err) on error.
func FilterAuthorized[T any](
	ctx context.Context,
	access types.AccessClient,
	items iter.Seq[T],
	extractFn func(T) BatchCheckItem,
	opts ...FilterOption,
) iter.Seq2[T, error] {
	options := &FilterOptions{
		Tracer: noop.Tracer{},
	}
	for _, opt := range opts {
		opt(options)
	}

	return func(yield func(T, error) bool) {
		ctx, span := options.Tracer.Start(ctx, "FilterAuthorized")
		defer span.End()

		user, ok := types.AuthInfoFrom(ctx)
		if !ok {
			var zero T
			span.SetAttributes(attribute.Bool("error.missing_auth", true))
			yield(zero, fmt.Errorf("%w: in context", ErrMissingAuthInfo))
			return
		}

		batchItems := make([]T, 0, types.MaxBatchCheckItems)
		batchChecks := make([]types.BatchCheckItem, 0, types.MaxBatchCheckItems)
		var currentNamespace string

		flush := func() bool {
			if len(batchChecks) == 0 {
				return true
			}

			batchResp, err := access.BatchCheck(ctx, user, types.BatchCheckRequest{
				Namespace: currentNamespace,
				Checks:    batchChecks,
			})
			if err != nil {
				span.RecordError(err)
				var zero T
				yield(zero, err)
				return false
			}

			for i, check := range batchChecks {
				if result, ok := batchResp.Results[check.CorrelationID]; ok && result.Allowed {
					if !yield(batchItems[i], nil) {
						return false
					}
				}
			}

			batchItems = batchItems[:0]
			batchChecks = batchChecks[:0]
			return true
		}

		for item := range items {
			info := extractFn(item)

			// Flush batch if namespace changes to ensure each batch has a single namespace
			if len(batchChecks) > 0 && info.Namespace != currentNamespace {
				if !flush() {
					return
				}
			}

			currentNamespace = info.Namespace
			batchItems = append(batchItems, item)
			batchChecks = append(batchChecks, types.BatchCheckItem{
				CorrelationID:      strconv.Itoa(len(batchChecks)),
				Verb:               info.Verb,
				Group:              info.Group,
				Resource:           info.Resource,
				Name:               info.Name,
				Folder:             info.Folder,
				FreshnessTimestamp: info.FreshnessTimestamp,
			})

			if len(batchChecks) >= types.MaxBatchCheckItems {
				if !flush() {
					return
				}
			}
		}

		flush()
	}
}
