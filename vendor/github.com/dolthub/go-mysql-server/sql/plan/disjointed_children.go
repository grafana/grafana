package plan

import "github.com/dolthub/go-mysql-server/sql"

// DisjointedChildrenNode is a sql.Node that contains multiple, disjointed groupings of child nodes. This is a highly
// specialized node that will not be applicable to the majority, as most nodes will return all children in the Children()
// function. For those nodes that do not return all of their children in the Children() function (such as InsertInto),
// operations such as stored procedures require the implementation of this interface so that those unexposed children
// may be accessed.
type DisjointedChildrenNode interface {
	sql.Node
	// DisjointedChildren returns multiple groupings of child nodes, with each group being unrelated to the other groups.
	DisjointedChildren() [][]sql.Node
	// WithDisjointedChildren returns a copy of the node with all child groups replaced.
	// Returns an error if the number of children in each group is different than the current number of children in each
	// group. They must be given in the same order as they are returned by DisjointedChildren.
	WithDisjointedChildren(children [][]sql.Node) (sql.Node, error)
}
