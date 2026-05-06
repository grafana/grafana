// Copyright 2018 The CUE Authors
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

package cue

import (
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/core/compile"
	"cuelang.org/go/internal/core/runtime"
)

// An InstanceOrValue is implemented by Value and *Instance.
//
// This is a placeholder type that is used to allow Instance-based APIs to
// transition to Value-based APIs. The goals is to get rid of the Instance
// type before v1.0.0.
type InstanceOrValue interface {
	Value() Value

	internal()
}

func (Value) internal()     {}
func (*Instance) internal() {}

// Value implements value.Instance.
func (v hiddenValue) Value() Value { return v }

// An Instance defines a single configuration based on a collection of
// underlying CUE files.
type Instance struct {
	index *runtime.Runtime

	root *adt.Vertex

	ImportPath  string
	Dir         string
	PkgName     string
	DisplayName string

	Incomplete bool         // true if Pkg and all its dependencies are free of errors
	Err        errors.Error // non-nil if the package had errors

	inst *build.Instance
}

type hiddenInstance = Instance

func addInst(x *runtime.Runtime, p *Instance) *Instance {
	if p.inst == nil {
		p.inst = &build.Instance{
			ImportPath: p.ImportPath,
			PkgName:    p.PkgName,
		}
	}
	x.AddInst(p.ImportPath, p.root, p.inst)
	x.SetBuildData(p.inst, p)
	p.index = x
	return p
}

func lookupInstance(x *runtime.Runtime, p *build.Instance) *Instance {
	if x, ok := x.BuildData(p); ok {
		return x.(*Instance)
	}
	return nil
}

func getImportFromBuild(x *runtime.Runtime, p *build.Instance, v *adt.Vertex) *Instance {
	inst := lookupInstance(x, p)

	if inst != nil {
		return inst
	}

	inst = &Instance{
		ImportPath:  p.ImportPath,
		Dir:         p.Dir,
		PkgName:     p.PkgName,
		DisplayName: p.ImportPath,
		root:        v,
		inst:        p,
		index:       x,
	}
	if p.Err != nil {
		inst.setListOrError(p.Err)
	}

	x.SetBuildData(p, inst)

	return inst
}

func getImportFromNode(x *runtime.Runtime, v *adt.Vertex) *Instance {
	p := x.GetInstanceFromNode(v)
	if p == nil {
		return nil
	}

	return getImportFromBuild(x, p, v)
}

func getImportFromPath(x *runtime.Runtime, id string) *Instance {
	node := x.LoadImport(id)
	if node == nil {
		return nil
	}
	b := x.GetInstanceFromNode(node)
	inst := lookupInstance(x, b)
	if inst == nil {
		inst = &Instance{
			ImportPath: b.ImportPath,
			PkgName:    b.PkgName,
			root:       node,
			inst:       b,
			index:      x,
		}
	}
	return inst
}

func init() {
	internal.MakeInstance = func(value interface{}) interface{} {
		v := value.(Value)
		x := v.eval(v.ctx())
		st, ok := x.(*adt.Vertex)
		if !ok {
			st = &adt.Vertex{}
			st.AddConjunct(adt.MakeRootConjunct(nil, x))
		}
		return addInst(v.idx, &Instance{
			root: st,
		})
	}
}

// newInstance creates a new instance. Use Insert to populate the instance.
func newInstance(x *runtime.Runtime, p *build.Instance, v *adt.Vertex) *Instance {
	// TODO: associate root source with structLit.
	inst := &Instance{
		root: v,
		inst: p,
	}
	if p != nil {
		inst.ImportPath = p.ImportPath
		inst.Dir = p.Dir
		inst.PkgName = p.PkgName
		inst.DisplayName = p.ImportPath
		if p.Err != nil {
			inst.setListOrError(p.Err)
		}
	}

	x.AddInst(p.ImportPath, v, p)
	x.SetBuildData(p, inst)
	inst.index = x
	return inst
}

func (inst *Instance) setListOrError(err errors.Error) {
	inst.Incomplete = true
	inst.Err = errors.Append(inst.Err, err)
}

func (inst *Instance) setError(err errors.Error) {
	inst.Incomplete = true
	inst.Err = errors.Append(inst.Err, err)
}

func (inst *Instance) eval(ctx *adt.OpContext) adt.Value {
	// TODO: remove manifest here?
	v := manifest(ctx, inst.root)
	return v
}

// ID returns the package identifier that uniquely qualifies module and
// package name.
func (inst *Instance) ID() string {
	if inst == nil || inst.inst == nil {
		return ""
	}
	return inst.inst.ID()
}

// Doc returns the package comments for this instance.
//
// Deprecated: use inst.Value().Doc()
func (inst *hiddenInstance) Doc() []*ast.CommentGroup {
	return inst.Value().Doc()
}

// Value returns the root value of the configuration. If the configuration
// defines in emit value, it will be that value. Otherwise it will be all
// top-level values.
func (inst *Instance) Value() Value {
	ctx := newContext(inst.index)
	inst.root.Finalize(ctx)
	// TODO: consider including these statistics as well. Right now, this only
	// seems to be used in cue cmd for "auxiliary" evaluations, like filetypes.
	// These arguably skew the actual statistics for the cue command line, so
	// it is convenient to not include these.
	// adt.AddStats(ctx)
	return newVertexRoot(inst.index, ctx, inst.root)
}

// Eval evaluates an expression within an existing instance.
//
// Expressions may refer to builtin packages if they can be uniquely identified.
//
// Deprecated: use
// inst.Value().Context().BuildExpr(expr, Scope(inst.Value), InferBuiltins(true))
func (inst *hiddenInstance) Eval(expr ast.Expr) Value {
	v := inst.Value()
	return v.Context().BuildExpr(expr, Scope(v), InferBuiltins(true))
}

// DO NOT USE.
//
// Deprecated: do not use.
func Merge(inst ...*Instance) *Instance {
	v := &adt.Vertex{}

	i := inst[0]
	ctx := newContext(i.index)

	// TODO: interesting test: use actual unification and then on K8s corpus.

	for _, i := range inst {
		w := i.Value()
		v.AddConjunct(adt.MakeRootConjunct(nil, w.v.ToDataAll(ctx)))
	}
	v.Finalize(ctx)

	p := addInst(i.index, &Instance{
		root: v,
	})
	return p
}

// Build creates a new instance from the build instances, allowing unbound
// identifier to bind to the top-level field in inst. The top-level fields in
// inst take precedence over predeclared identifier and builtin functions.
//
// Deprecated: use Context.Build
func (inst *hiddenInstance) Build(p *build.Instance) *Instance {
	p.Complete()

	idx := inst.index
	r := inst.index

	rErr := r.ResolveFiles(p)

	cfg := &compile.Config{Scope: valueScope(Value{idx: r, v: inst.root})}
	v, err := compile.Files(cfg, r, p.ID(), p.Files...)

	v.AddConjunct(adt.MakeRootConjunct(nil, inst.root))

	i := newInstance(idx, p, v)
	if rErr != nil {
		i.setListOrError(rErr)
	}
	if i.Err != nil {
		i.setListOrError(i.Err)
	}

	if err != nil {
		i.setListOrError(err)
	}

	return i
}

func (inst *Instance) value() Value {
	return newVertexRoot(inst.index, newContext(inst.index), inst.root)
}

// Lookup reports the value at a path starting from the top level struct. The
// Exists method of the returned value will report false if the path did not
// exist. The Err method reports if any error occurred during evaluation. The
// empty path returns the top-level configuration struct. Use LookupDef for definitions or LookupField for
// any kind of field.
//
// Deprecated: use Value.LookupPath
func (inst *hiddenInstance) Lookup(path ...string) Value {
	return inst.value().Lookup(path...)
}

// LookupDef reports the definition with the given name within struct v. The
// Exists method of the returned value will report false if the definition did
// not exist. The Err method reports if any error occurred during evaluation.
//
// Deprecated: use Value.LookupPath
func (inst *hiddenInstance) LookupDef(path string) Value {
	return inst.value().LookupDef(path)
}

// LookupField reports a Field at a path starting from v, or an error if the
// path is not. The empty path returns v itself.
//
// It cannot look up hidden or unexported fields.
//
// Deprecated: this API does not work with new-style definitions. Use
// FieldByName defined on inst.Value().
//
// Deprecated: use Value.LookupPath
func (inst *hiddenInstance) LookupField(path ...string) (f FieldInfo, err error) {
	v := inst.value()
	for _, k := range path {
		s, err := v.Struct()
		if err != nil {
			return f, err
		}

		f, err = s.FieldByName(k, true)
		if err != nil {
			return f, err
		}
		if f.IsHidden {
			return f, errNotFound
		}
		v = f.Value
	}
	return f, err
}

// Fill creates a new instance with the values of the old instance unified with
// the given value. It is not possible to update the emit value.
//
// Values may be any Go value that can be converted to CUE, an ast.Expr or
// a Value. In the latter case, it will panic if the Value is not from the same
// Runtime.
//
// Deprecated: use Value.FillPath()
func (inst *hiddenInstance) Fill(x interface{}, path ...string) (*Instance, error) {
	v := inst.Value().Fill(x, path...)

	inst = addInst(inst.index, &Instance{
		root: v.v,
		inst: nil,

		// Omit ImportPath to indicate this is not an importable package.
		Dir:        inst.Dir,
		PkgName:    inst.PkgName,
		Incomplete: inst.Incomplete,
	})
	return inst, nil
}
