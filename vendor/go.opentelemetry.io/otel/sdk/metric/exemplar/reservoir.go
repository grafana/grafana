// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package exemplar // import "go.opentelemetry.io/otel/sdk/metric/exemplar"

import (
	"context"
	"time"

	"go.opentelemetry.io/otel/attribute"
)

// Reservoir holds the sampled exemplar of measurements made.
type Reservoir interface {
	// Offer accepts the parameters associated with a measurement. The
	// parameters will be stored as an exemplar if the Reservoir decides to
	// sample the measurement.
	//
	// The passed ctx needs to contain any baggage or span that were active
	// when the measurement was made. This information may be used by the
	// Reservoir in making a sampling decision.
	//
	// The time t is the time when the measurement was made. The val and attr
	// parameters are the value and dropped (filtered) attributes of the
	// measurement respectively.
	Offer(ctx context.Context, t time.Time, val Value, attr []attribute.KeyValue)

	// Collect returns all the held exemplars.
	//
	// The Reservoir state is preserved after this call.
	Collect(dest *[]Exemplar)
}

// ReservoirProvider creates new [Reservoir]s.
//
// The attributes provided are attributes which are kept by the aggregation, and
// are exclusive with attributes passed to Offer. The combination of these
// attributes and the attributes passed to Offer is the complete set of
// attributes a measurement was made with.
type ReservoirProvider func(attr attribute.Set) Reservoir
