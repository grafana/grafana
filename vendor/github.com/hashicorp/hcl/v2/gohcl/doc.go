// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

// Package gohcl allows decoding HCL configurations into Go data structures.
//
// It provides a convenient and concise way of describing the schema for
// configuration and then accessing the resulting data via native Go
// types.
//
// A struct field tag scheme is used, similar to other decoding and
// unmarshalling libraries. The tags are formatted as in the following example:
//
//	ThingType string `hcl:"thing_type,attr"`
//
// Within each tag there are two comma-separated tokens. The first is the
// name of the corresponding construct in configuration, while the second
// is a keyword giving the kind of construct expected. The following
// kind keywords are supported:
//
//	attr (the default) indicates that the value is to be populated from an attribute
//	block indicates that the value is to populated from a block
//	label indicates that the value is to populated from a block label
//	optional is the same as attr, but the field is optional
//	remain indicates that the value is to be populated from the remaining body after populating other fields
//
// "attr" fields may either be of type *hcl.Expression, in which case the raw
// expression is assigned, or of any type accepted by gocty, in which case
// gocty will be used to assign the value to a native Go type.
//
// "block" fields may be a struct that recursively uses the same tags, or a
// slice of such structs, in which case multiple blocks of the corresponding
// type are decoded into the slice.
//
// "body" can be placed on a single field of type hcl.Body to capture
// the full hcl.Body that was decoded for a block. This does not allow leftover
// values like "remain", so a decoding error will still be returned if leftover
// fields are given. If you want to capture the decoding body PLUS leftover
// fields, you must specify a "remain" field as well to prevent errors. The
// body field and the remain field will both contain the leftover fields.
//
// "label" fields are considered only in a struct used as the type of a field
// marked as "block", and are used sequentially to capture the labels of
// the blocks being decoded. In this case, the name token is used (a) as
// an identifier for the label in diagnostic messages and (b) to match the
// which with the equivalent "label_range" field (if it exists).
//
// "optional" fields behave like "attr" fields, but they are optional
// and will not give parsing errors if they are missing.
//
// "remain" can be placed on a single field that may be either of type
// hcl.Body or hcl.Attributes, in which case any remaining body content is
// placed into this field for delayed processing. If no "remain" field is
// present then any attributes or blocks not matched by another valid tag
// will cause an error diagnostic.
//
// "def_range" can be placed on a single field that must be of type hcl.Range.
// This field is only considered in a struct used as the type of a field marked
// as "block", and is used to capture the range of the block's definition.
//
// "type_range" can be placed on a single field that must be of type hcl.Range.
// This field is only considered in a struct used as the type of a field marked
// as "block", and is used to capture the range of the block's type label.
//
// "label_range" can be placed on multiple fields that must be of type
// hcl.Range. This field is only considered in a struct used as the type of a
// field marked as "block", and is used to capture the range of the block's
// labels. The name token is used to match with the equivalent "label" field
// that this range will specify.
//
// "attr_range" can be placed on multiple fields that must be of type hcl.Range.
// This field will be assigned the complete hcl.Range for the attribute with
// the corresponding name. The name token is used to match with the name of the
// attribute that this range will specify.
//
// "attr_name_range" can be placed on multiple fields that must be of type
// hcl.Range. This field will be assigned the hcl.Range for the name of the
// attribute with the corresponding name. The name token is used to match with
// the name of the attribute that this range will specify.
//
// "attr_value_range" can be placed on multiple fields that must be of type
// hcl.Range. This field will be assigned the hcl.Range for the value of the
// attribute with the corresponding name. The name token is used to match with
// the name of the attribute that this range will specify.
//
// Only a subset of this tagging/typing vocabulary is supported for the
// "Encode" family of functions. See the EncodeIntoBody docs for full details
// on the constraints there.
//
// Broadly-speaking this package deals with two types of error. The first is
// errors in the configuration itself, which are returned as diagnostics
// written with the configuration author as the target audience. The second
// is bugs in the calling program, such as invalid struct tags, which are
// surfaced via panics since there can be no useful runtime handling of such
// errors and they should certainly not be returned to the user as diagnostics.
package gohcl
