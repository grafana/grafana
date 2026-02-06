//  Copyright (c) 2023 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build vectors
// +build vectors

package index

import "context"

// VectorOptimizable represents an optional interface that implementable by
// optimizable resources (e.g., VectorReaders, Searchers).  These
// optimizable resources are provided the same OptimizableContext
// instance, so that they can coordinate via dynamic interface
// casting.
// To avoid KNNSearchers' OptimizableContext being casted to ones used for
// TFRs, term searchers, etc.
type VectorOptimizable interface {
	VectorOptimize(ctx context.Context, octx VectorOptimizableContext) (VectorOptimizableContext, error)
}

type VectorOptimizableContext interface {
	// Once all the optimzable resources have been provided the same
	// OptimizableContext instance, the optimization preparations are
	// finished or completed via the Finish() method.
	Finish() error
}
