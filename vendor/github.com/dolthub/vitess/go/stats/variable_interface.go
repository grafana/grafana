/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package stats

// Variable is the minimal interface which each type in this "stats" package
// must implement.
// When integrating the Vitess stats types ("variables") with the different
// monitoring systems, you can rely on this interface.
type Variable interface {
	// Help returns the description of the variable.
	Help() string

	// String must implement String() from the expvar.Var interface.
	String() string
}
