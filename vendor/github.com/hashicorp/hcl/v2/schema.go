// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

// BlockHeaderSchema represents the shape of a block header, and is
// used for matching blocks within bodies.
type BlockHeaderSchema struct {
	Type       string
	LabelNames []string
}

// AttributeSchema represents the requirements for an attribute, and is used
// for matching attributes within bodies.
type AttributeSchema struct {
	Name     string
	Required bool
}

// BodySchema represents the desired shallow structure of a body.
type BodySchema struct {
	Attributes []AttributeSchema
	Blocks     []BlockHeaderSchema
}
