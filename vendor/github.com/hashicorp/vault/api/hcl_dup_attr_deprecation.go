// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"strings"

	"github.com/hashicorp/hcl"
	"github.com/hashicorp/hcl/hcl/ast"
	hclParser "github.com/hashicorp/hcl/hcl/parser"
)

// parseAndCheckForDuplicateHclAttributes parses the input JSON/HCL file and if it is HCL it also checks
// for duplicate keys in the HCL file, allowing callers to handle the issue accordingly. In a future release we'll
// change the behavior to treat duplicate keys as an error and eventually remove this helper altogether.
// TODO (HCL_DUP_KEYS_DEPRECATION): remove once not used anymore
func parseAndCheckForDuplicateHclAttributes(input string) (res *ast.File, duplicate bool, err error) {
	res, err = hcl.Parse(input)
	if err != nil && strings.Contains(err.Error(), "Each argument can only be defined once") {
		duplicate = true
		res, err = hclParser.ParseDontErrorOnDuplicateKeys([]byte(input))
	}
	return res, duplicate, err
}
