// Copyright 2021 CUE Authors
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

package openapi

import (
	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/dep"
	"cuelang.org/go/internal/core/eval"
	internalvalue "cuelang.org/go/internal/value"
)

func (b *builder) pushNode(v cue.Value) {
	_, n := internalvalue.ToInternal(v)
	b.ctx.cycleNodes = append(b.ctx.cycleNodes, n)
	b.ctx.evalDepth++
}

func (b *builder) popNode() {
	b.ctx.cycleNodes = b.ctx.cycleNodes[:len(b.ctx.cycleNodes)-1]
	b.ctx.evalDepth--
}

func (b *builder) checkCycle(v cue.Value) bool {
	if !b.ctx.expandRefs {
		return true
	}

	if b.ctx.maxCycleDepth > 0 && b.ctx.evalDepth > b.ctx.maxCycleDepth {
		return false
	}

	r, n := internalvalue.ToInternal(v)
	ctx := eval.NewContext(r, n)

	err := dep.Visit(ctx, n, func(d dep.Dependency) error {
		for _, m := range b.ctx.cycleNodes {
			if m == d.Node {
				var p token.Pos
				if src := d.Node.Source(); src != nil {
					p = src.Pos()
				}
				err := errors.Newf(p,
					"cycle in reference at %v: cyclic structures not allowed when reference expansion is requested", v.Path())
				b.ctx.errs = errors.Append(b.ctx.errs, err)
				return err
			}
		}
		return nil
	})

	return err == nil
}
