// Copyright 2020-2021 Dolthub, Inc.
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

package transform

import (
	"github.com/dolthub/go-mysql-server/sql"
)

// NodeFunc is a function that given a node will return that node
// as is or transformed, a TreeIdentity to indicate whether the
// node was modified, and an error or nil.
type NodeFunc func(n sql.Node) (sql.Node, TreeIdentity, error)

// ExprFunc is a function that given an expression will return that
// expression as is or transformed, a TreeIdentity to indicate
// whether the expression was modified, and an error or nil.
type ExprFunc func(e sql.Expression) (sql.Expression, TreeIdentity, error)

// Context provides additional metadata to a SelectorFunc about the
// active node in a traversal, including the parent node, and a
// partial prefix schema of sibling nodes in a level order traversal.
type Context struct {
	// Node is the currently visited node which will be transformed.
	Node sql.Node
	// Parent is the current parent of the transforming node.
	Parent sql.Node
	// SchemaPrefix is the concatenation of the Parent's SchemaPrefix with
	// child.Schema() for all child with an index < ChildNum in
	// Parent.Children(). For many Node, this represents the schema of the
	// |row| parameter that is going to be passed to this node by its
	// parent in a RowIter() call. This field is only non-nil if the entire
	// in-order traversal of the tree up to this point is Resolved().
	SchemaPrefix sql.Schema
	// ChildNum is the index of Node in Parent.Children().
	ChildNum int
}

// CtxFunc is a function which will return new sql.Node values for a given
// Context.
type CtxFunc func(Context) (sql.Node, TreeIdentity, error)

// SelectorFunc is a function which will allow NodeWithCtx to not
// traverse past a certain Context. If this function returns |false|
// for a given Context, the subtree is not transformed and the child
// is kept in its existing place in the parent as-is.
type SelectorFunc func(Context) bool

// ExprWithNodeFunc is a function that given an expression and the node
// that contains it, will return that expression as is or transformed
// along with an error, if any.
type ExprWithNodeFunc func(sql.Node, sql.Expression) (sql.Expression, TreeIdentity, error)

// TreeIdentity tracks modifications to node and expression trees.
// Only return SameTree when it is acceptable to return the original
// input and discard the returned result as a performance improvement.
type TreeIdentity bool

const (
	SameTree TreeIdentity = true
	NewTree  TreeIdentity = false
)

// NodeExprsWithNode applies a transformation function to all expressions
// on the given tree from the bottom up.
func NodeExprsWithNode(node sql.Node, f ExprWithNodeFunc) (sql.Node, TreeIdentity, error) {
	return Node(node, func(n sql.Node) (sql.Node, TreeIdentity, error) {
		return OneNodeExprsWithNode(n, f)
	})
}

// NodeExprs applies a transformation function to all expressions
// on the given plan tree from the bottom up.
func NodeExprs(node sql.Node, f ExprFunc) (sql.Node, TreeIdentity, error) {
	return NodeExprsWithNode(node, func(n sql.Node, e sql.Expression) (sql.Expression, TreeIdentity, error) {
		return f(e)
	})
}

// NodeExprsWithNodeWithOpaque applies a transformation function to all expressions
// on the given tree from the bottom up, including through opaque nodes.
func NodeExprsWithNodeWithOpaque(node sql.Node, f ExprWithNodeFunc) (sql.Node, TreeIdentity, error) {
	return NodeWithOpaque(node, func(n sql.Node) (sql.Node, TreeIdentity, error) {
		return OneNodeExprsWithNode(n, f)
	})
}

// NodeExprsWithOpaque applies a transformation function to all expressions
// on the given plan tree from the bottom up, including through opaque nodes.
func NodeExprsWithOpaque(node sql.Node, f ExprFunc) (sql.Node, TreeIdentity, error) {
	return NodeExprsWithNodeWithOpaque(node, func(n sql.Node, e sql.Expression) (sql.Expression, TreeIdentity, error) {
		return f(e)
	})
}

// OneNodeExprsWithNode applies a transformation function to all expressions
// on the specified node. It does not traverse the children of the specified node.
func OneNodeExprsWithNode(n sql.Node, f ExprWithNodeFunc) (sql.Node, TreeIdentity, error) {
	ne, ok := n.(sql.Expressioner)
	if !ok {
		return n, SameTree, nil
	}

	exprs := ne.Expressions()
	if len(exprs) == 0 {
		return n, SameTree, nil
	}

	var (
		newExprs []sql.Expression
		err      error
	)

	for i := range exprs {
		e := exprs[i]
		e, same, err := ExprWithNode(n, e, f)
		if err != nil {
			return nil, SameTree, err
		}
		if !same {
			if newExprs == nil {
				newExprs = make([]sql.Expression, len(exprs))
				copy(newExprs, exprs)
			}
			newExprs[i] = e
		}
	}

	if len(newExprs) > 0 {
		n, err = ne.WithExpressions(newExprs...)
		if err != nil {
			return nil, SameTree, err
		}
		return n, NewTree, nil
	}
	return n, SameTree, nil
}

// OneNodeExpressions applies a transformation function to all expressions
// on the specified node. It does not traverse the children of the specified node.
func OneNodeExpressions(n sql.Node, f ExprFunc) (sql.Node, TreeIdentity, error) {
	e, ok := n.(sql.Expressioner)
	if !ok {
		return n, SameTree, nil
	}

	exprs := e.Expressions()
	if len(exprs) == 0 {
		return n, SameTree, nil
	}

	var newExprs []sql.Expression
	for i := range exprs {
		expr := exprs[i]
		expr, same, err := Expr(expr, f)
		if err != nil {
			return nil, SameTree, err
		}
		if !same {
			if newExprs == nil {
				newExprs = make([]sql.Expression, len(exprs))
				copy(newExprs, exprs)
			}
			newExprs[i] = expr
		}
	}
	if len(newExprs) > 0 {
		n, err := e.WithExpressions(newExprs...)
		if err != nil {
			return nil, SameTree, err
		}
		return n, NewTree, nil
	}
	return n, SameTree, nil
}

// NodeWithCtx transforms |n| from the bottom up, left to right, by passing
// each node to |f|. If |s| is non-nil, does not descend into children where
// |s| returns false.
func NodeWithCtx(n sql.Node, s SelectorFunc, f CtxFunc) (sql.Node, TreeIdentity, error) {
	return nodeWithCtxHelper(Context{Node: n, SchemaPrefix: sql.Schema{}, ChildNum: -1}, s, f)
}

func nodeWithCtxHelper(c Context, s SelectorFunc, f CtxFunc) (sql.Node, TreeIdentity, error) {
	node := c.Node
	_, ok := node.(sql.OpaqueNode)
	if ok {
		return f(c)
	}

	children := node.Children()
	if len(children) == 0 {
		return f(c)
	}

	var (
		newChildren []sql.Node
		err         error
	)
	for i := range children {
		child := children[i]
		cc := Context{Node: child, Parent: node, ChildNum: i}
		if s == nil || s(cc) {
			child, same, err := nodeWithCtxHelper(cc, s, f)
			if err != nil {
				return nil, SameTree, err
			}
			if !same {
				if newChildren == nil {
					newChildren = make([]sql.Node, len(children))
					copy(newChildren, children)
				}
				newChildren[i] = child
			}
		}
	}

	sameC := SameTree
	if len(newChildren) > 0 {
		sameC = NewTree
		node, err = node.WithChildren(newChildren...)
		if err != nil {
			return nil, SameTree, err
		}
	}

	node, sameN, err := f(Context{Node: node, Parent: c.Parent, SchemaPrefix: c.SchemaPrefix, ChildNum: c.ChildNum})
	if err != nil {
		return nil, SameTree, err
	}
	return node, sameC && sameN, nil
}

// NodeWithPrefixSchema transforms |n| from the bottom up, left to right, by passing
// each node to |f|. If |s| is non-nil, does not descend into children where
// |s| returns false.
func NodeWithPrefixSchema(n sql.Node, s SelectorFunc, f CtxFunc) (sql.Node, TreeIdentity, error) {
	return transformUpWithPrefixSchemaHelper(Context{Node: n, SchemaPrefix: sql.Schema{}, ChildNum: -1}, s, f)
}

func transformUpWithPrefixSchemaHelper(c Context, s SelectorFunc, f CtxFunc) (sql.Node, TreeIdentity, error) {
	node := c.Node
	_, ok := node.(sql.OpaqueNode)
	if ok {
		return f(c)
	}

	children := node.Children()
	if len(children) == 0 {
		return f(c)
	}

	var (
		newChildren []sql.Node
		err         error
	)

	childPrefix := append(sql.Schema{}, c.SchemaPrefix...)
	for i := range children {
		child := children[i]
		cc := Context{Node: child, Parent: node, SchemaPrefix: childPrefix, ChildNum: i}
		if s == nil || s(cc) {
			child, same, err := transformUpWithPrefixSchemaHelper(cc, s, f)
			if err != nil {
				return nil, SameTree, err
			}
			if !same {
				if newChildren == nil {
					newChildren = make([]sql.Node, len(children))
					copy(newChildren, children)
				}
				newChildren[i] = child
			}
			if child.Resolved() && childPrefix != nil {
				cs := child.Schema()
				childPrefix = append(childPrefix, cs...)
			} else {
				childPrefix = nil
			}
		}
	}

	sameC := SameTree
	if len(newChildren) > 0 {
		sameC = NewTree
		node, err = node.WithChildren(newChildren...)
		if err != nil {
			return nil, SameTree, err
		}
	}

	node, sameN, err := f(Context{Node: node, Parent: c.Parent, SchemaPrefix: c.SchemaPrefix, ChildNum: c.ChildNum})
	if err != nil {
		return nil, SameTree, err
	}
	return node, sameC && sameN, nil
}

// Node applies a transformation function to the given tree from the
// bottom up.
func Node(node sql.Node, f NodeFunc) (sql.Node, TreeIdentity, error) {
	_, ok := node.(sql.OpaqueNode)
	if ok {
		return f(node)
	}

	children := node.Children()
	if len(children) == 0 {
		return f(node)
	}

	var (
		newChildren []sql.Node
		child       sql.Node
	)

	for i := range children {
		child = children[i]
		child, same, err := Node(child, f)
		if err != nil {
			return nil, SameTree, err
		}
		if !same {
			if newChildren == nil {
				newChildren = make([]sql.Node, len(children))
				copy(newChildren, children)
			}
			newChildren[i] = child
		}
	}

	var err error
	sameC := SameTree
	if len(newChildren) > 0 {
		sameC = NewTree
		node, err = node.WithChildren(newChildren...)
		if err != nil {
			return nil, SameTree, err
		}
	}

	node, sameN, err := f(node)
	if err != nil {
		return nil, SameTree, err
	}
	return node, sameC && sameN, nil
}

// NodeWithOpaque applies a transformation function to the given tree from the bottom up, including through
// opaque nodes. This method is generally not safe to use for a transformation. Opaque nodes need to be considered in
// isolation except for very specific exceptions.
func NodeWithOpaque(node sql.Node, f NodeFunc) (sql.Node, TreeIdentity, error) {
	children := node.Children()
	if len(children) == 0 {
		return f(node)
	}

	var (
		newChildren []sql.Node
		err         error
	)

	for i := range children {
		c := children[i]
		c, same, err := NodeWithOpaque(c, f)
		if err != nil {
			return nil, SameTree, err
		}
		if !same {
			if newChildren == nil {
				newChildren = make([]sql.Node, len(children))
				copy(newChildren, children)
			}
			newChildren[i] = c
		}
	}

	sameC := SameTree
	if len(newChildren) > 0 {
		sameC = NewTree
		node, err = node.WithChildren(newChildren...)
		if err != nil {
			return nil, SameTree, err
		}
	}
	node, sameN, err := f(node)
	if err != nil {
		return nil, SameTree, err
	}
	return node, sameC && sameN, nil
}

// NodeChildren applies a transformation function to the given node's children.
func NodeChildren(node sql.Node, f NodeFunc) (sql.Node, TreeIdentity, error) {
	children := node.Children()
	if len(children) == 0 {
		return node, SameTree, nil
	}

	var (
		newChildren []sql.Node
		child       sql.Node
	)

	for i := range children {
		child = children[i]
		child, same, err := f(child)
		if err != nil {
			return nil, SameTree, err
		}
		if !same {
			if newChildren == nil {
				newChildren = make([]sql.Node, len(children))
				copy(newChildren, children)
			}
			newChildren[i] = child
		}
	}

	var err error
	if len(newChildren) > 0 {
		node, err = node.WithChildren(newChildren...)
		return node, NewTree, err
	}
	return node, SameTree, nil
}
