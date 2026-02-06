// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package reservoir // import "go.opentelemetry.io/otel/sdk/metric/internal/reservoir"

// ConcurrentSafe is an interface that can be embedded in an
// exemplar.Reservoir to indicate to the SDK that it is safe to invoke its
// methods concurrently. If this interface is not embedded, the SDK assumes it
// is not safe to call concurrently and locks around Reservoir methods. This
// is currently only used by the built-in reservoirs.
type ConcurrentSafe interface{ concurrentSafe() }
