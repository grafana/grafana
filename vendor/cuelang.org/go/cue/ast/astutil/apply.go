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

package astutil

import (
	"encoding/hex"
	"fmt"
	"hash/fnv"
	"reflect"

	"cuelang.org/go/cue/ast"
)

// A Cursor describes a node encountered during Apply.
// Information about the node and its parent is available
// from the Node, Parent, and Index methods.
//
// The methods Replace, Delete, InsertBefore, and InsertAfter
// can be used to change the AST without disrupting Apply.
// Delete, InsertBefore, and InsertAfter are only defined for modifying
// a StructLit and will panic in any other context.
type Cursor interface {
	// Node returns the current Node.
	Node() ast.Node

	// Parent returns the parent of the current Node.
	Parent() Cursor

	// Index reports the index >= 0 of the current Node in the slice of Nodes
	// that contains it, or a value < 0 if the current Node is not part of a
	// list.
	Index() int

	// Import reports an opaque identifier that refers to the given package. It
	// may only be called if the input to apply was an ast.File. If the import
	// does not exist, it will be added.
	Import(path string) *ast.Ident

	// Replace replaces the current Node with n.
	// The replacement node is not walked by Apply. Comments of the old node
	// are copied to the new node if it has not yet an comments associated
	// with it.
	Replace(n ast.Node)

	// Delete deletes the current Node from its containing struct.
	// If the current Node is not part of a struct, Delete panics.
	Delete()

	// InsertAfter inserts n after the current Node in its containing struct.
	// If the current Node is not part of a struct, InsertAfter panics.
	// Unless n is wrapped by ApplyRecursively, Apply does not walk n.
	InsertAfter(n ast.Node)

	// InsertBefore inserts n before the current Node in its containing struct.
	// If the current Node is not part of a struct, InsertBefore panics.
	// Unless n is wrapped by ApplyRecursively, Apply does not walk n.
	InsertBefore(n ast.Node)

	self() *cursor
}

// ApplyRecursively indicates that a node inserted with InsertBefore,
// or InsertAfter should be processed recursively.
func ApplyRecursively(n ast.Node) ast.Node {
	return recursive{n}
}

type recursive struct {
	ast.Node
}

type info struct {
	f       *ast.File
	current *declsCursor

	importPatch []*ast.Ident
}

type cursor struct {
	file     *info
	parent   Cursor
	node     ast.Node
	typ      interface{} // the type of the node
	index    int         // position of any of the sub types.
	replaced bool
}

func newCursor(parent Cursor, n ast.Node, typ interface{}) *cursor {
	return &cursor{
		parent: parent,
		typ:    typ,
		node:   n,
		index:  -1,
	}
}

func fileInfo(c Cursor) (info *info) {
	for ; c != nil; c = c.Parent() {
		if i := c.self().file; i != nil {
			return i
		}
	}
	return nil
}

func (c *cursor) self() *cursor  { return c }
func (c *cursor) Parent() Cursor { return c.parent }
func (c *cursor) Index() int     { return c.index }
func (c *cursor) Node() ast.Node { return c.node }

func (c *cursor) Import(importPath string) *ast.Ident {
	info := fileInfo(c)
	if info == nil {
		return nil
	}

	name := ImportPathName(importPath)

	// TODO: come up with something much better.
	// For instance, hoist the uniquer form cue/export.go to
	// here and make export.go use this.
	hash := fnv.New32()
	name += hex.EncodeToString(hash.Sum([]byte(importPath)))[:6]

	spec := insertImport(&info.current.decls, &ast.ImportSpec{
		Name: ast.NewIdent(name),
		Path: ast.NewString(importPath),
	})

	ident := &ast.Ident{Node: spec} // Name is set later.
	info.importPatch = append(info.importPatch, ident)

	ident.Name = name

	return ident
}

func (c *cursor) Replace(n ast.Node) {
	// panic if the value cannot convert to the original type.
	reflect.ValueOf(n).Convert(reflect.TypeOf(c.typ).Elem())
	if ast.Comments(n) != nil {
		CopyComments(n, c.node)
	}
	if r, ok := n.(recursive); ok {
		n = r.Node
	} else {
		c.replaced = true
	}
	c.node = n
}

func (c *cursor) InsertAfter(n ast.Node)  { panic("unsupported") }
func (c *cursor) InsertBefore(n ast.Node) { panic("unsupported") }
func (c *cursor) Delete()                 { panic("unsupported") }

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
// respective node's struct definition.
func Apply(node ast.Node, before, after func(Cursor) bool) ast.Node {
	apply(&applier{before: before, after: after}, nil, &node)
	return node
}

// A applyVisitor's before method is invoked for each node encountered by Walk.
// If the result applyVisitor w is true, Walk visits each of the children
// of node with the applyVisitor w, followed by a call of w.After.
type applyVisitor interface {
	Before(Cursor) applyVisitor
	After(Cursor) bool
}

// Helper functions for common node lists. They may be empty.

func applyExprList(v applyVisitor, parent Cursor, ptr interface{}, list []ast.Expr) {
	c := newCursor(parent, nil, nil)
	for i, x := range list {
		c.index = i
		c.node = x
		c.typ = &list[i]
		applyCursor(v, c)
		if x != c.node {
			list[i] = c.node.(ast.Expr)
		}
	}
}

type declsCursor struct {
	*cursor
	decls, after, process []ast.Decl
	delete                bool
}

func (c *declsCursor) InsertAfter(n ast.Node) {
	if r, ok := n.(recursive); ok {
		n = r.Node
		c.process = append(c.process, n.(ast.Decl))
	}
	c.after = append(c.after, n.(ast.Decl))
}

func (c *declsCursor) InsertBefore(n ast.Node) {
	if r, ok := n.(recursive); ok {
		n = r.Node
		c.process = append(c.process, n.(ast.Decl))
	}
	c.decls = append(c.decls, n.(ast.Decl))
}

func (c *declsCursor) Delete() { c.delete = true }

func applyDeclList(v applyVisitor, parent Cursor, list []ast.Decl) []ast.Decl {
	c := &declsCursor{
		cursor: newCursor(parent, nil, nil),
		decls:  make([]ast.Decl, 0, len(list)),
	}
	if file, ok := parent.Node().(*ast.File); ok {
		c.cursor.file = &info{f: file, current: c}
	}
	for i, x := range list {
		c.node = x
		c.typ = &list[i]
		applyCursor(v, c)
		if !c.delete {
			c.decls = append(c.decls, c.node.(ast.Decl))
		}
		c.delete = false
		for i := 0; i < len(c.process); i++ {
			x := c.process[i]
			c.node = x
			c.typ = &c.process[i]
			applyCursor(v, c)
			if c.delete {
				panic("cannot delete a node that was added with InsertBefore or InsertAfter")
			}
		}
		c.decls = append(c.decls, c.after...)
		c.after = c.after[:0]
		c.process = c.process[:0]
	}

	// TODO: ultimately, programmatically linked nodes have to be resolved
	// at the end.
	// if info := c.cursor.file; info != nil {
	// 	done := map[*ast.ImportSpec]bool{}
	// 	for _, ident := range info.importPatch {
	// 		spec := ident.Node.(*ast.ImportSpec)
	// 		if done[spec] {
	// 			continue
	// 		}
	// 		done[spec] = true

	// 		path, _ := strconv.Unquote(spec.Path)

	// 		ident.Name =
	// 	}
	// }

	return c.decls
}

func apply(v applyVisitor, parent Cursor, nodePtr interface{}) {
	res := reflect.Indirect(reflect.ValueOf(nodePtr))
	n := res.Interface()
	node := n.(ast.Node)
	c := newCursor(parent, node, nodePtr)
	applyCursor(v, c)
	if node != c.node {
		res.Set(reflect.ValueOf(c.node))
	}
}

// applyCursor traverses an AST in depth-first order: It starts by calling
// v.Visit(node); node must not be nil. If the visitor w returned by
// v.Visit(node) is not nil, apply is invoked recursively with visitor
// w for each of the non-nil children of node, followed by a call of
// w.Visit(nil).
func applyCursor(v applyVisitor, c Cursor) {
	if v = v.Before(c); v == nil {
		return
	}

	node := c.Node()

	// TODO: record the comment groups and interleave with the values like for
	// parsing and printing?
	comments := node.Comments()
	for _, cm := range comments {
		apply(v, c, &cm)
	}

	// apply children
	// (the order of the cases matches the order
	// of the corresponding node types in go)
	switch n := node.(type) {
	// Comments and fields
	case *ast.Comment:
		// nothing to do

	case *ast.CommentGroup:
		for _, cg := range n.List {
			apply(v, c, &cg)
		}

	case *ast.Attribute:
		// nothing to do

	case *ast.Field:
		apply(v, c, &n.Label)
		if n.Value != nil {
			apply(v, c, &n.Value)
		}
		for _, a := range n.Attrs {
			apply(v, c, &a)
		}

	case *ast.StructLit:
		n.Elts = applyDeclList(v, c, n.Elts)

	// Expressions
	case *ast.BottomLit, *ast.BadExpr, *ast.Ident, *ast.BasicLit:
		// nothing to do

	case *ast.Interpolation:
		applyExprList(v, c, &n, n.Elts)

	case *ast.ListLit:
		applyExprList(v, c, &n, n.Elts)

	case *ast.Ellipsis:
		if n.Type != nil {
			apply(v, c, &n.Type)
		}

	case *ast.ParenExpr:
		apply(v, c, &n.X)

	case *ast.SelectorExpr:
		apply(v, c, &n.X)
		apply(v, c, &n.Sel)

	case *ast.IndexExpr:
		apply(v, c, &n.X)
		apply(v, c, &n.Index)

	case *ast.SliceExpr:
		apply(v, c, &n.X)
		if n.Low != nil {
			apply(v, c, &n.Low)
		}
		if n.High != nil {
			apply(v, c, &n.High)
		}

	case *ast.CallExpr:
		apply(v, c, &n.Fun)
		applyExprList(v, c, &n, n.Args)

	case *ast.UnaryExpr:
		apply(v, c, &n.X)

	case *ast.BinaryExpr:
		apply(v, c, &n.X)
		apply(v, c, &n.Y)

	// Declarations
	case *ast.ImportSpec:
		if n.Name != nil {
			apply(v, c, &n.Name)
		}
		apply(v, c, &n.Path)

	case *ast.BadDecl:
		// nothing to do

	case *ast.ImportDecl:
		for _, s := range n.Specs {
			apply(v, c, &s)
		}

	case *ast.EmbedDecl:
		apply(v, c, &n.Expr)

	case *ast.LetClause:
		apply(v, c, &n.Ident)
		apply(v, c, &n.Expr)

	case *ast.Alias:
		apply(v, c, &n.Ident)
		apply(v, c, &n.Expr)

	case *ast.Comprehension:
		clauses := n.Clauses
		for i := range n.Clauses {
			apply(v, c, &clauses[i])
		}
		apply(v, c, &n.Value)

	// Files and packages
	case *ast.File:
		n.Decls = applyDeclList(v, c, n.Decls)

	case *ast.Package:
		apply(v, c, &n.Name)

	case *ast.ForClause:
		if n.Key != nil {
			apply(v, c, &n.Key)
		}
		apply(v, c, &n.Value)
		apply(v, c, &n.Source)

	case *ast.IfClause:
		apply(v, c, &n.Condition)

	default:
		panic(fmt.Sprintf("Walk: unexpected node type %T", n))
	}

	v.After(c)
}

type applier struct {
	before func(Cursor) bool
	after  func(Cursor) bool

	commentStack []commentFrame
	current      commentFrame
}

type commentFrame struct {
	cg  []*ast.CommentGroup
	pos int8
}

func (f *applier) Before(c Cursor) applyVisitor {
	node := c.Node()
	if f.before == nil || (f.before(c) && node == c.Node()) {
		f.commentStack = append(f.commentStack, f.current)
		f.current = commentFrame{cg: node.Comments()}
		f.visitComments(c, f.current.pos)
		return f
	}
	return nil
}

func (f *applier) After(c Cursor) bool {
	f.visitComments(c, 127)
	p := len(f.commentStack) - 1
	f.current = f.commentStack[p]
	f.commentStack = f.commentStack[:p]
	f.current.pos++
	if f.after != nil {
		f.after(c)
	}
	return true
}

func (f *applier) visitComments(p Cursor, pos int8) {
	c := &f.current
	for i := 0; i < len(c.cg); i++ {
		cg := c.cg[i]
		if cg.Position == pos {
			continue
		}
		cursor := newCursor(p, cg, cg)
		if f.before == nil || (f.before(cursor) && !cursor.replaced) {
			for j, c := range cg.List {
				cursor := newCursor(p, c, &c)
				if f.before == nil || (f.before(cursor) && !cursor.replaced) {
					if f.after != nil {
						f.after(cursor)
					}
				}
				cg.List[j] = cursor.node.(*ast.Comment)
			}
			if f.after != nil {
				f.after(cursor)
			}
		}
		c.cg[i] = cursor.node.(*ast.CommentGroup)
	}
}
