// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

// Package hclwrite deals with the problem of generating HCL configuration
// and of making specific surgical changes to existing HCL configurations.
//
// It operates at a different level of abstraction than the main HCL parser
// and AST, since details such as the placement of comments and newlines
// are preserved when unchanged.
//
// The hclwrite API follows a similar principle to XML/HTML DOM, allowing nodes
// to be read out, created and inserted, etc. Nodes represent syntax constructs
// rather than semantic concepts.
package hclwrite
