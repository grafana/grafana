// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"github.com/hashicorp/hcl/v2"
)

// setDiagEvalContext is an internal helper that will impose a particular
// EvalContext on a set of diagnostics in-place, for any diagnostic that
// does not already have an EvalContext set.
//
// We generally expect diagnostics to be immutable, but this is safe to use
// on any Diagnostics where none of the contained Diagnostic objects have yet
// been seen by a caller. Its purpose is to apply additional context to a
// set of diagnostics produced by a "deeper" component as the stack unwinds
// during expression evaluation.
func setDiagEvalContext(diags hcl.Diagnostics, expr hcl.Expression, ctx *hcl.EvalContext) {
	for _, diag := range diags {
		if diag.Expression == nil {
			diag.Expression = expr
			diag.EvalContext = ctx
		}
	}
}
