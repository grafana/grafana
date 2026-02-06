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

package adt

// Comprehension algorithm
//
// Comprehensions are expanded for, if, and let clauses that yield 0 or more
// structs to be embedded in the enclosing list or struct.
//
// CUE allows cascading of insertions, as in:
//
//     a?: int
//     b?: int
//     if a != _|_ {
//         b: 2
//     }
//     if b != _|_ {
//         c: 3
//         d: 4
//     }
//
// even though CUE does not allow the result of a comprehension to depend
// on another comprehension within a single struct. The way this works is that
// for fields with a fixed prefix path in a comprehension value, the
// comprehension is assigned to these respective fields.
//
// More concretely, the above example is rewritten to:
//
//    a?: int
//    b: if a != _|_ { 2 }
//    c: if b != _|_ { 3 }
//    d: if b != _|_ { 4 }
//
// where the fields with if clause are only inserted if their condition
// resolves to true. (Note that this is not valid CUE; it may be in the future.)
//
// With this rewrite, any dependencies in comprehension expressions will follow
// the same rules, more or less, as with normal evaluation.
//
// Note that a singe comprehension may be distributed across multiple fields.
// The evaluator will ensure, however, that a comprehension is only evaluated
// once.
//
//
// Closedness
//
// The comprehension algorithm uses the usual closedness mechanism for marking
// fields that belong to a struct: it adds the StructLit associated with the
// comprehension value to the respective arc.
//
// One noteworthy point is that the fields of a struct are only legitimate for
// actual results. For instance, if an if clause evaluates to false, the
// value is not embedded.
//
// To account for this, the comprehension algorithm relies on the fact that
// the closedness information is computed as a separate step. So even if
// the StructLit is added early, its fields will only count once it is
// initialized, which is only done when at least one result is added.
//

// envComprehension caches the result of a single comprehension.
type envComprehension struct {
	comp *Comprehension
	node *Vertex // The Vertex from which the comprehension originates.

	// runtime-related fields

	err *Bottom

	// envs holds all the environments that define a single "yield" result in
	// combination with the comprehension struct.
	envs []*Environment // nil: unprocessed, non-nil: done.
	done bool           // true once the comprehension has been evaluated

	// StructLits to Init (activate for closedness check)
	// when at least one value is yielded.
	structs []*StructLit
}

// envYield defines a comprehension for a specific field within a comprehension
// value. Multiple envYields can be associated with a single envComprehension.
// An envComprehension only needs to be evaluated once for multiple envYields.
type envYield struct {
	*envComprehension                // The original comprehension.
	leaf              *Comprehension // The leaf Comprehension

	// Values specific to the field corresponsing to this envYield

	// This envYield was added to selfComprehensions
	self bool
	// This envYield was successfully executed and the resulting conjuncts were
	// added.
	inserted bool

	env  *Environment // The adjusted Environment.
	id   CloseInfo    // CloseInfo for the field.
	expr Node         // The adjusted expression.
}

// ValueClause represents a wrapper Environment in a chained clause list
// to account for the unwrapped struct. It is never created by the compiler
// and serves as a dynamic element only.
type ValueClause struct {
	Node

	// The node in which to resolve lookups in the comprehension's value struct.
	arc *Vertex
}

func (v *ValueClause) yield(s *compState) {
	s.yield(s.ctx.spawn(v.arc))
}

// insertComprehension registers a comprehension with a node, possibly pushing
// down its evaluation to the node's children. It will only evaluate one level
// of fields at a time.
func (n *nodeContext) insertComprehension(
	env *Environment,
	c *Comprehension,
	ci CloseInfo,
) {
	// TODO(perf): this implementation causes the parent's clauses
	// to be evaluated for each nested comprehension. It would be
	// possible to simply store the envComprehension of the parent's
	// result and have each subcomprehension reuse those. This would
	// also avoid the below allocation and would probably allow us
	// to get rid of the ValueClause type.

	ec := c.comp
	if ec == nil {
		ec = &envComprehension{
			comp: c,
			node: n.node,

			err:  nil,   // shut up linter
			envs: nil,   // shut up linter
			done: false, // shut up linter
		}
	}

	if ec.done && len(ec.envs) == 0 {
		return
	}

	x := c.Value

	ci = ci.SpawnEmbed(c)
	ci.closeInfo.span |= ComprehensionSpan

	var decls []Decl
	switch v := ToExpr(x).(type) {
	case *StructLit:
		numFixed := 0
		var fields []Decl
		for _, d := range v.Decls {
			switch f := d.(type) {
			case *Field:
				numFixed++

				arc, _ := n.node.GetArc(n.ctx, f.Label, arcVoid)

				// Create partial comprehension
				c := &Comprehension{
					Syntax:  c.Syntax,
					Clauses: c.Clauses,
					Value:   f,

					comp:   ec,
					parent: c,
					arc:    n.node,
				}

				arc.addConjunctUnchecked(MakeConjunct(env, c, ci))
				fields = append(fields, f)
				// TODO: adjust ci to embed?

				// TODO: this also needs to be done for optional fields.

			case *LetField:
				// TODO: consider merging this case with the LetField case.

				numFixed++

				arc, _ := n.node.GetArc(n.ctx, f.Label, arcVoid)
				arc.MultiLet = f.IsMulti

				// Create partial comprehension
				c := &Comprehension{
					Syntax:  c.Syntax,
					Clauses: c.Clauses,
					Value:   f,

					comp:   ec,
					parent: c,
					arc:    n.node,
				}

				arc.addConjunctUnchecked(MakeConjunct(env, c, ci))
				fields = append(fields, f)

			default:
				decls = append(decls, d)
			}
		}

		if len(fields) > 0 {
			// Create a stripped struct that only includes fixed fields.
			// TODO(perf): this StructLit may be inserted more than once in
			// the same vertex: once taking the StructLit of the referred node
			// and once for inserting the Conjunct of the original node.
			// Is this necessary (given closedness rules), and is this posing
			// a performance problem?
			st := v
			if len(fields) < len(v.Decls) {
				st = &StructLit{
					Src:   v.Src,
					Decls: fields,
				}
			}
			n.node.AddStruct(st, env, ci)
			switch {
			case !ec.done:
				ec.structs = append(ec.structs, st)
			case len(ec.envs) > 0:
				st.Init()
			}
		}

		switch numFixed {
		case 0:
			// Add comprehension as is.

		case len(v.Decls):
			// No comprehension to add at this level.
			return

		default:
			// Create a new StructLit with only the fields that need to be
			// added at this level.
			x = &StructLit{Decls: decls}
		}
	}

	n.comprehensions = append(n.comprehensions, envYield{
		envComprehension: ec,
		leaf:             c,
		env:              env,
		id:               ci,
		expr:             x,
	})
}

type compState struct {
	ctx   *OpContext
	comp  *Comprehension
	i     int
	f     YieldFunc
	state VertexStatus
}

// yield evaluates a Comprehension within the given Environment and and calls
// f for each result.
func (c *OpContext) yield(
	node *Vertex, // errors are associated with this node
	env *Environment, // env for field for which this yield is called
	comp *Comprehension,
	state VertexStatus,
	f YieldFunc, // called for every result
) *Bottom {
	s := &compState{
		ctx:   c,
		comp:  comp,
		f:     f,
		state: state,
	}
	y := comp.Clauses[0]

	saved := c.PushState(env, y.Source())
	if node != nil {
		defer c.PopArc(c.PushArc(node))
	}

	s.i++
	y.yield(s)
	s.i--

	return c.PopState(saved)
}

func (s *compState) yield(env *Environment) (ok bool) {
	c := s.ctx
	if s.i >= len(s.comp.Clauses) {
		s.f(env)
		return true
	}
	dst := s.comp.Clauses[s.i]
	saved := c.PushState(env, dst.Source())

	s.i++
	dst.yield(s)
	s.i--

	if b := c.PopState(saved); b != nil {
		c.AddBottom(b)
		return false
	}
	return !c.HasErr()
}

// injectComprehension evaluates and inserts embeddings. It first evaluates all
// embeddings before inserting the results to ensure that the order of
// evaluation does not matter.
func (n *nodeContext) injectComprehensions(allP *[]envYield, allowCycle bool, state VertexStatus) (progress bool) {
	ctx := n.ctx

	all := *allP
	workRemaining := false

	// We use variables, instead of range, as the list may grow dynamically.
	for i := 0; i < len(*allP); i++ {
		all = *allP // update list as long as it is non-empty.
		d := all[i]

		if d.self && allowCycle {
			continue
		}

		// Compute environments, if needed.
		if !d.done {
			var envs []*Environment
			f := func(env *Environment) {
				envs = append(envs, env)
			}

			if err := ctx.yield(d.node, d.env, d.comp, state, f); err != nil {
				if err.IsIncomplete() {
					// TODO:  Detect that the nodes are actually equal
					if allowCycle && err.ForCycle && err.Value == n.node {
						n.selfComprehensions = append(n.selfComprehensions, d)
						progress = true
						all[i].self = true
						continue
					}
					d.err = err
					workRemaining = true

					// TODO: add this when it can be done without breaking other
					// things.
					//
					// // Add comprehension to ensure incomplete error is inserted.
					// // This ensures that the error is reported in the Vertex
					// // where the comprehension was defined, and not just in the
					// // node below. This, in turn, is necessary to support
					// // certain logic, like export, that expects to be able to
					// // detect an "incomplete" error at the first level where it
					// // is necessary.
					// n := d.node.getNodeContext(ctx)
					// n.addBottom(err)

				} else {
					// continue to collect other errors.
					d.node.state.addBottom(err)
					d.done = true
					progress = true
				}
				if d.node != nil {
					ctx.PopArc(d.node)
				}
				continue
			}

			d.envs = envs

			if len(d.envs) > 0 {
				for _, s := range d.structs {
					s.Init()
				}
			}
			d.structs = nil
			d.done = true
		}

		if all[i].inserted {
			continue
		}
		all[i].inserted = true

		progress = true

		if len(d.envs) == 0 {
			continue
		}

		v := n.node
		for c := d.leaf; c.parent != nil; c = c.parent {
			v.arcType = arcMember
			v = c.arc
		}

		id := d.id

		for _, env := range d.envs {
			env = linkChildren(env, d.leaf)
			n.addExprConjunct(Conjunct{env, d.expr, id}, state)
		}
	}

	if !workRemaining {
		*allP = all[:0] // Signal that all work is done.
	}
	return progress
}

// linkChildren adds environments for the chain of vertices to a result
// environment.
func linkChildren(env *Environment, c *Comprehension) *Environment {
	if c.parent != nil {
		env = linkChildren(env, c.parent)
		env = spawn(env, c.arc)
	}
	return env
}
