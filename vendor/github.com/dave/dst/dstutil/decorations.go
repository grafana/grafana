package dstutil

import "github.com/dave/dst"

// Decorations returns information about all the decoration attachment points associated with a node
func Decorations(n dst.Node) (before, after dst.SpaceType, info []DecorationPoint) {
	return decorations(n)
}

// DecorationPoint contains the name of the decoration attachment point and a list of decorations attached there
type DecorationPoint struct {
	Name string
	Decs []string
}
