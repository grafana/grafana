// Copyright 2026 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package errguard

import (
	"fmt"
	"runtime/debug"

	"golang.org/x/sync/errgroup"
)

// Go runs |fn| in the errgroup, converting any panic into an error, with
// a stack trace, that is later returned by errgroup.Group.Wait(). The intent
// of this function is to provide a standard function for spawning a goroutine
// in an errgroup that has consistent panic recovery handling.
func Go(g *errgroup.Group, fn func() error) {
	g.Go(func() (err error) {
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("panic recovered: %v\n%s", r, debug.Stack())
			}
		}()
		return fn()
	})
}
