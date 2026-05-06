// Copyright 2021 DeepMap, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
package runtime

// Binder is the interface implemented by types that can be bound to a query string or a parameter string
// The input can be assumed to be a valid string.  If you define a Bind method you are responsible for all
// data being completely bound to the type.
//
// By convention, to approximate the behavior of Bind functions themselves,
// Binder implements Bind("") as a no-op.
type Binder interface {
	Bind(src string) error
}
