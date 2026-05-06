// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package gohcl

import (
	"reflect"

	"github.com/hashicorp/hcl/v2"
)

var victimExpr hcl.Expression
var victimBody hcl.Body

var exprType = reflect.TypeOf(&victimExpr).Elem()
var bodyType = reflect.TypeOf(&victimBody).Elem()
var blockType = reflect.TypeOf((*hcl.Block)(nil))
var attrType = reflect.TypeOf((*hcl.Attribute)(nil))
var attrsType = reflect.TypeOf(hcl.Attributes(nil))
