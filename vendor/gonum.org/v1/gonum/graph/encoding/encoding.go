// Copyright ©2017 The Gonum Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package encoding

import "gonum.org/v1/gonum/graph"

// Builder is a graph that can have user-defined nodes and edges added.
type Builder interface {
	graph.Graph
	graph.Builder
}

// MultiBuilder is a graph that can have user-defined nodes and edges added.
type MultiBuilder interface {
	graph.Multigraph
	graph.MultigraphBuilder
}

// AttributeSetter is implemented by types that can set an encoded graph
// attribute.
type AttributeSetter interface {
	SetAttribute(Attribute) error
}

// Attributer defines graph.Node or graph.Edge values that can
// specify graph attributes.
type Attributer interface {
	Attributes() []Attribute
}

// Attribute is an encoded key value attribute pair use in graph encoding.
type Attribute struct {
	Key, Value string
}

// Attributes is a helper type providing simple attribute handling.
type Attributes []Attribute

// Attributes returns all of the receiver's attributes.
func (a *Attributes) Attributes() []Attribute {
	return *a
}

// SetAttribute sets attr in the receiver. Calling SetAttribute with an
// Attribute with a Key that is in the collection replaces the existing
// value and calling with an empty Value removes the attribute from the
// collection if it exists. SetAttribute always returns nil.
func (a *Attributes) SetAttribute(attr Attribute) error {
	if attr.Key == "" {
		return nil
	}
	for i, v := range *a {
		if v.Key == attr.Key {
			if attr.Value == "" {
				(*a)[i] = (*a)[len(*a)-1]
				*a = (*a)[:len(*a)-1]
				return nil
			}
			(*a)[i].Value = attr.Value
			return nil
		}
	}
	if attr.Value != "" {
		*a = append(*a, attr)
	}
	return nil
}
