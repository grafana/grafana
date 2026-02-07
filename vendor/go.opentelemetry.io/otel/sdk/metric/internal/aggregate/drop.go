// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package aggregate // import "go.opentelemetry.io/otel/sdk/metric/internal/aggregate"

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/metric/exemplar"
)

// dropReservoir returns a [FilteredReservoir] that drops all measurements it is offered.
func dropReservoir[N int64 | float64](attribute.Set) FilteredExemplarReservoir[N] {
	return &dropRes[N]{}
}

type dropRes[N int64 | float64] struct{}

// Offer does nothing, all measurements offered will be dropped.
func (*dropRes[N]) Offer(context.Context, N, []attribute.KeyValue) {}

// Collect resets dest. No exemplars will ever be returned.
func (*dropRes[N]) Collect(dest *[]exemplar.Exemplar) {
	clear(*dest) // Erase elements to let GC collect objects
	*dest = (*dest)[:0]
}
