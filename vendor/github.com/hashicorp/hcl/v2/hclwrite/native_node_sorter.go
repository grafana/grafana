// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclwrite

import (
	"github.com/hashicorp/hcl/v2/hclsyntax"
)

type nativeNodeSorter struct {
	Nodes []hclsyntax.Node
}

func (s nativeNodeSorter) Len() int {
	return len(s.Nodes)
}

func (s nativeNodeSorter) Less(i, j int) bool {
	rangeI := s.Nodes[i].Range()
	rangeJ := s.Nodes[j].Range()
	return rangeI.Start.Byte < rangeJ.Start.Byte
}

func (s nativeNodeSorter) Swap(i, j int) {
	s.Nodes[i], s.Nodes[j] = s.Nodes[j], s.Nodes[i]
}
