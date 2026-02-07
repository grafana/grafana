//  Copyright (c) 2020 Couchbase, Inc.
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

package index

// Optimizable represents an optional interface that implementable by
// optimizable resources (e.g., TermFieldReaders, Searchers).  These
// optimizable resources are provided the same OptimizableContext
// instance, so that they can coordinate via dynamic interface
// casting.
type Optimizable interface {
	Optimize(kind string, octx OptimizableContext) (OptimizableContext, error)
}

// Represents a result of optimization -- see the Finish() method.
type Optimized interface{}

type OptimizableContext interface {
	// Once all the optimzable resources have been provided the same
	// OptimizableContext instance, the optimization preparations are
	// finished or completed via the Finish() method.
	//
	// Depending on the optimization being performed, the Finish()
	// method might return a non-nil Optimized instance.  For example,
	// the Optimized instance might represent an optimized
	// TermFieldReader instance.
	Finish() (Optimized, error)
}
