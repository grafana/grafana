// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package dstutil

import (
	"fmt"

	"reflect"
	"sort"

	"github.com/dave/dst"
)

// An ApplyFunc is invoked by Apply for each node n, even if n is nil,
// before and/or after the node's children, using a Cursor describing
// the current node and providing operations on it.
//
// The return value of ApplyFunc controls the syntax tree traversal.
// See Apply for details.
type ApplyFunc func(*Cursor) bool

// Apply traverses a syntax tree recursively, starting with root,
// and calling pre and post for each node as described below.
// Apply returns the syntax tree, possibly modified.
//
// If pre is not nil, it is called for each node before the node's
// children are traversed (pre-order). If pre returns false, no
// children are traversed, and post is not called for that node.
//
// If post is not nil, and a prior call of pre didn't return false,
// post is called for each node after its children are traversed
// (post-order). If post returns false, traversal is terminated and
// Apply returns immediately.
//
// Only fields that refer to AST nodes are considered children;
// i.e., token.Pos, Scopes, Objects, and fields of basic types
// (strings, etc.) are ignored.
//
// Children are traversed in the order in which they appear in the
// respective node's struct definition. A package's files are
// traversed in the filenames' alphabetical order.
//
func Apply(root dst.Node, pre, post ApplyFunc) (result dst.Node) {
	parent := &struct{ dst.Node }{root}
	defer func() {
		if r := recover(); r != nil && r != abort {
			panic(r)
		}
		result = parent.Node
	}()
	a := &application{pre: pre, post: post}
	a.apply(parent, "Node", nil, root)
	return
}

var abort = new(int) // singleton, to signal termination of Apply

// A Cursor describes a node encountered during Apply.
// Information about the node and its parent is available
// from the Node, Parent, Name, and Index methods.
//
// If p is a variable of type and value of the current parent node
// c.Parent(), and f is the field identifier with name c.Name(),
// the following invariants hold:
//
//   p.f            == c.Node()  if c.Index() <  0
//   p.f[c.Index()] == c.Node()  if c.Index() >= 0
//
// The methods Replace, Delete, InsertBefore, and InsertAfter
// can be used to change the AST without disrupting Apply.
type Cursor struct {
	parent dst.Node
	name   string
	iter   *iterator // valid if non-nil
	node   dst.Node
}

// Node returns the current Node.
func (c *Cursor) Node() dst.Node { return c.node }

// Parent returns the parent of the current Node.
func (c *Cursor) Parent() dst.Node { return c.parent }

// Name returns the name of the parent Node field that contains the current Node.
// If the parent is a *dst.Package and the current Node is a *dst.File, Name returns
// the filename for the current Node.
func (c *Cursor) Name() string { return c.name }

// Index reports the index >= 0 of the current Node in the slice of Nodes that
// contains it, or a value < 0 if the current Node is not part of a slice.
// The index of the current node changes if InsertBefore is called while
// processing the current node.
func (c *Cursor) Index() int {
	if c.iter != nil {
		return c.iter.index
	}
	return -1
}

// field returns the current node's parent field value.
func (c *Cursor) field() reflect.Value {
	return reflect.Indirect(reflect.ValueOf(c.parent)).FieldByName(c.name)
}

// Replace replaces the current Node with n.
// The replacement node is not walked by Apply.
func (c *Cursor) Replace(n dst.Node) {
	if _, ok := c.node.(*dst.File); ok {
		file, ok := n.(*dst.File)
		if !ok {
			panic("attempt to replace *dst.File with non-*dst.File")
		}
		c.parent.(*dst.Package).Files[c.name] = file
		return
	}

	v := c.field()
	if i := c.Index(); i >= 0 {
		v = v.Index(i)
	}
	v.Set(reflect.ValueOf(n))
}

// Delete deletes the current Node from its containing slice.
// If the current Node is not part of a slice, Delete panics.
// As a special case, if the current node is a package file,
// Delete removes it from the package's Files map.
func (c *Cursor) Delete() {
	if _, ok := c.node.(*dst.File); ok {
		delete(c.parent.(*dst.Package).Files, c.name)
		return
	}

	i := c.Index()
	if i < 0 {
		panic("Delete node not contained in slice")
	}
	v := c.field()
	l := v.Len()
	reflect.Copy(v.Slice(i, l), v.Slice(i+1, l))
	v.Index(l - 1).Set(reflect.Zero(v.Type().Elem()))
	v.SetLen(l - 1)
	c.iter.step--
}

// InsertAfter inserts n after the current Node in its containing slice.
// If the current Node is not part of a slice, InsertAfter panics.
// Apply does not walk n.
func (c *Cursor) InsertAfter(n dst.Node) {
	i := c.Index()
	if i < 0 {
		panic("InsertAfter node not contained in slice")
	}
	v := c.field()
	v.Set(reflect.Append(v, reflect.Zero(v.Type().Elem())))
	l := v.Len()
	reflect.Copy(v.Slice(i+2, l), v.Slice(i+1, l))
	v.Index(i + 1).Set(reflect.ValueOf(n))
	c.iter.step++
}

// InsertBefore inserts n before the current Node in its containing slice.
// If the current Node is not part of a slice, InsertBefore panics.
// Apply will not walk n.
func (c *Cursor) InsertBefore(n dst.Node) {
	i := c.Index()
	if i < 0 {
		panic("InsertBefore node not contained in slice")
	}
	v := c.field()
	v.Set(reflect.Append(v, reflect.Zero(v.Type().Elem())))
	l := v.Len()
	reflect.Copy(v.Slice(i+1, l), v.Slice(i, l))
	v.Index(i).Set(reflect.ValueOf(n))
	c.iter.index++
}

// application carries all the shared data so we can pass it around cheaply.
type application struct {
	pre, post ApplyFunc
	cursor    Cursor
	iter      iterator
}

func (a *application) apply(parent dst.Node, name string, iter *iterator, n dst.Node) {
	// convert typed nil into untyped nil
	if v := reflect.ValueOf(n); v.Kind() == reflect.Ptr && v.IsNil() {
		n = nil
	}

	// avoid heap-allocating a new cursor for each apply call; reuse a.cursor instead
	saved := a.cursor
	a.cursor.parent = parent
	a.cursor.name = name
	a.cursor.iter = iter
	a.cursor.node = n

	if a.pre != nil && !a.pre(&a.cursor) {
		a.cursor = saved
		return
	}

	// walk children
	// (the order of the cases matches the order of the corresponding node types in go/ast)
	switch n := n.(type) {
	case nil:
		// nothing to do

	case *dst.Field:
		a.applyList(n, "Names")
		a.apply(n, "Type", nil, n.Type)
		a.apply(n, "Tag", nil, n.Tag)

	case *dst.FieldList:
		a.applyList(n, "List")

	// Expressions
	case *dst.BadExpr, *dst.Ident, *dst.BasicLit:
		// nothing to do

	case *dst.Ellipsis:
		a.apply(n, "Elt", nil, n.Elt)

	case *dst.FuncLit:
		a.apply(n, "Type", nil, n.Type)
		a.apply(n, "Body", nil, n.Body)

	case *dst.CompositeLit:
		a.apply(n, "Type", nil, n.Type)
		a.applyList(n, "Elts")

	case *dst.ParenExpr:
		a.apply(n, "X", nil, n.X)

	case *dst.SelectorExpr:
		a.apply(n, "X", nil, n.X)
		a.apply(n, "Sel", nil, n.Sel)

	case *dst.IndexExpr:
		a.apply(n, "X", nil, n.X)
		a.apply(n, "Index", nil, n.Index)

	case *dst.IndexListExpr:
		a.apply(n, "X", nil, n.X)
		a.applyList(n, "Indices")

	case *dst.SliceExpr:
		a.apply(n, "X", nil, n.X)
		a.apply(n, "Low", nil, n.Low)
		a.apply(n, "High", nil, n.High)
		a.apply(n, "Max", nil, n.Max)

	case *dst.TypeAssertExpr:
		a.apply(n, "X", nil, n.X)
		a.apply(n, "Type", nil, n.Type)

	case *dst.CallExpr:
		a.apply(n, "Fun", nil, n.Fun)
		a.applyList(n, "Args")

	case *dst.StarExpr:
		a.apply(n, "X", nil, n.X)

	case *dst.UnaryExpr:
		a.apply(n, "X", nil, n.X)

	case *dst.BinaryExpr:
		a.apply(n, "X", nil, n.X)
		a.apply(n, "Y", nil, n.Y)

	case *dst.KeyValueExpr:
		a.apply(n, "Key", nil, n.Key)
		a.apply(n, "Value", nil, n.Value)

	// Types
	case *dst.ArrayType:
		a.apply(n, "Len", nil, n.Len)
		a.apply(n, "Elt", nil, n.Elt)

	case *dst.StructType:
		a.apply(n, "Fields", nil, n.Fields)

	case *dst.FuncType:
		a.apply(n, "TypeParams", nil, n.TypeParams)
		a.apply(n, "Params", nil, n.Params)
		a.apply(n, "Results", nil, n.Results)

	case *dst.InterfaceType:
		a.apply(n, "Methods", nil, n.Methods)

	case *dst.MapType:
		a.apply(n, "Key", nil, n.Key)
		a.apply(n, "Value", nil, n.Value)

	case *dst.ChanType:
		a.apply(n, "Value", nil, n.Value)

	// Statements
	case *dst.BadStmt:
		// nothing to do

	case *dst.DeclStmt:
		a.apply(n, "Decl", nil, n.Decl)

	case *dst.EmptyStmt:
		// nothing to do

	case *dst.LabeledStmt:
		a.apply(n, "Label", nil, n.Label)
		a.apply(n, "Stmt", nil, n.Stmt)

	case *dst.ExprStmt:
		a.apply(n, "X", nil, n.X)

	case *dst.SendStmt:
		a.apply(n, "Chan", nil, n.Chan)
		a.apply(n, "Value", nil, n.Value)

	case *dst.IncDecStmt:
		a.apply(n, "X", nil, n.X)

	case *dst.AssignStmt:
		a.applyList(n, "Lhs")
		a.applyList(n, "Rhs")

	case *dst.GoStmt:
		a.apply(n, "Call", nil, n.Call)

	case *dst.DeferStmt:
		a.apply(n, "Call", nil, n.Call)

	case *dst.ReturnStmt:
		a.applyList(n, "Results")

	case *dst.BranchStmt:
		a.apply(n, "Label", nil, n.Label)

	case *dst.BlockStmt:
		a.applyList(n, "List")

	case *dst.IfStmt:
		a.apply(n, "Init", nil, n.Init)
		a.apply(n, "Cond", nil, n.Cond)
		a.apply(n, "Body", nil, n.Body)
		a.apply(n, "Else", nil, n.Else)

	case *dst.CaseClause:
		a.applyList(n, "List")
		a.applyList(n, "Body")

	case *dst.SwitchStmt:
		a.apply(n, "Init", nil, n.Init)
		a.apply(n, "Tag", nil, n.Tag)
		a.apply(n, "Body", nil, n.Body)

	case *dst.TypeSwitchStmt:
		a.apply(n, "Init", nil, n.Init)
		a.apply(n, "Assign", nil, n.Assign)
		a.apply(n, "Body", nil, n.Body)

	case *dst.CommClause:
		a.apply(n, "Comm", nil, n.Comm)
		a.applyList(n, "Body")

	case *dst.SelectStmt:
		a.apply(n, "Body", nil, n.Body)

	case *dst.ForStmt:
		a.apply(n, "Init", nil, n.Init)
		a.apply(n, "Cond", nil, n.Cond)
		a.apply(n, "Post", nil, n.Post)
		a.apply(n, "Body", nil, n.Body)

	case *dst.RangeStmt:
		a.apply(n, "Key", nil, n.Key)
		a.apply(n, "Value", nil, n.Value)
		a.apply(n, "X", nil, n.X)
		a.apply(n, "Body", nil, n.Body)

	// Declarations
	case *dst.ImportSpec:
		a.apply(n, "Name", nil, n.Name)
		a.apply(n, "Path", nil, n.Path)

	case *dst.ValueSpec:
		a.applyList(n, "Names")
		a.apply(n, "Type", nil, n.Type)
		a.applyList(n, "Values")

	case *dst.TypeSpec:
		a.apply(n, "Name", nil, n.Name)
		a.apply(n, "TypeParams", nil, n.TypeParams)
		a.apply(n, "Type", nil, n.Type)

	case *dst.BadDecl:
		// nothing to do

	case *dst.GenDecl:
		a.applyList(n, "Specs")

	case *dst.FuncDecl:
		a.apply(n, "Recv", nil, n.Recv)
		a.apply(n, "Name", nil, n.Name)
		a.apply(n, "Type", nil, n.Type)
		a.apply(n, "Body", nil, n.Body)

	// Files and packages
	case *dst.File:
		a.apply(n, "Name", nil, n.Name)
		a.applyList(n, "Decls")
		// Don't walk n.Comments; they have either been walked already if
		// they are Doc comments, or they can be easily walked explicitly.

	case *dst.Package:
		// collect and sort names for reproducible behavior
		var names []string
		for name := range n.Files {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			a.apply(n, name, nil, n.Files[name])
		}

	default:
		panic(fmt.Sprintf("Apply: unexpected node type %T", n))
	}

	if a.post != nil && !a.post(&a.cursor) {
		panic(abort)
	}

	a.cursor = saved
}

// An iterator controls iteration over a slice of nodes.
type iterator struct {
	index, step int
}

func (a *application) applyList(parent dst.Node, name string) {
	// avoid heap-allocating a new iterator for each applyList call; reuse a.iter instead
	saved := a.iter
	a.iter.index = 0
	for {
		// must reload parent.name each time, since cursor modifications might change it
		v := reflect.Indirect(reflect.ValueOf(parent)).FieldByName(name)
		if a.iter.index >= v.Len() {
			break
		}

		// element x may be nil in a bad AST - be cautious
		var x dst.Node
		if e := v.Index(a.iter.index); e.IsValid() {
			x = e.Interface().(dst.Node)
		}

		a.iter.step = 1
		a.apply(parent, name, &a.iter, x)
		a.iter.index += a.iter.step
	}
	a.iter = saved
}
