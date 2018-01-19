package compiler

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/constant"
	"go/token"
	"go/types"
	"sort"
	"strconv"
	"strings"

	"github.com/gopherjs/gopherjs/compiler/analysis"
	"github.com/gopherjs/gopherjs/compiler/astutil"
	"github.com/gopherjs/gopherjs/compiler/typesutil"
)

type expression struct {
	str    string
	parens bool
}

func (e *expression) String() string {
	return e.str
}

func (e *expression) StringWithParens() string {
	if e.parens {
		return "(" + e.str + ")"
	}
	return e.str
}

func (c *funcContext) translateExpr(expr ast.Expr) *expression {
	exprType := c.p.TypeOf(expr)
	if value := c.p.Types[expr].Value; value != nil {
		basic := exprType.Underlying().(*types.Basic)
		switch {
		case isBoolean(basic):
			return c.formatExpr("%s", strconv.FormatBool(constant.BoolVal(value)))
		case isInteger(basic):
			if is64Bit(basic) {
				if basic.Kind() == types.Int64 {
					d, ok := constant.Int64Val(constant.ToInt(value))
					if !ok {
						panic("could not get exact uint")
					}
					return c.formatExpr("new %s(%s, %s)", c.typeName(exprType), strconv.FormatInt(d>>32, 10), strconv.FormatUint(uint64(d)&(1<<32-1), 10))
				}
				d, ok := constant.Uint64Val(constant.ToInt(value))
				if !ok {
					panic("could not get exact uint")
				}
				return c.formatExpr("new %s(%s, %s)", c.typeName(exprType), strconv.FormatUint(d>>32, 10), strconv.FormatUint(d&(1<<32-1), 10))
			}
			d, ok := constant.Int64Val(constant.ToInt(value))
			if !ok {
				panic("could not get exact int")
			}
			return c.formatExpr("%s", strconv.FormatInt(d, 10))
		case isFloat(basic):
			f, _ := constant.Float64Val(value)
			return c.formatExpr("%s", strconv.FormatFloat(f, 'g', -1, 64))
		case isComplex(basic):
			r, _ := constant.Float64Val(constant.Real(value))
			i, _ := constant.Float64Val(constant.Imag(value))
			if basic.Kind() == types.UntypedComplex {
				exprType = types.Typ[types.Complex128]
			}
			return c.formatExpr("new %s(%s, %s)", c.typeName(exprType), strconv.FormatFloat(r, 'g', -1, 64), strconv.FormatFloat(i, 'g', -1, 64))
		case isString(basic):
			return c.formatExpr("%s", encodeString(constant.StringVal(value)))
		default:
			panic("Unhandled constant type: " + basic.String())
		}
	}

	var obj types.Object
	switch e := expr.(type) {
	case *ast.SelectorExpr:
		obj = c.p.Uses[e.Sel]
	case *ast.Ident:
		obj = c.p.Defs[e]
		if obj == nil {
			obj = c.p.Uses[e]
		}
	}

	if obj != nil && typesutil.IsJsPackage(obj.Pkg()) {
		switch obj.Name() {
		case "Global":
			return c.formatExpr("$global")
		case "Module":
			return c.formatExpr("$module")
		case "Undefined":
			return c.formatExpr("undefined")
		}
	}

	switch e := expr.(type) {
	case *ast.CompositeLit:
		if ptrType, isPointer := exprType.(*types.Pointer); isPointer {
			exprType = ptrType.Elem()
		}

		collectIndexedElements := func(elementType types.Type) []string {
			var elements []string
			i := 0
			zero := c.translateExpr(c.zeroValue(elementType)).String()
			for _, element := range e.Elts {
				if kve, isKve := element.(*ast.KeyValueExpr); isKve {
					key, ok := constant.Int64Val(constant.ToInt(c.p.Types[kve.Key].Value))
					if !ok {
						panic("could not get exact int")
					}
					i = int(key)
					element = kve.Value
				}
				for len(elements) <= i {
					elements = append(elements, zero)
				}
				elements[i] = c.translateImplicitConversionWithCloning(element, elementType).String()
				i++
			}
			return elements
		}

		switch t := exprType.Underlying().(type) {
		case *types.Array:
			elements := collectIndexedElements(t.Elem())
			if len(elements) == 0 {
				return c.formatExpr("%s.zero()", c.typeName(t))
			}
			zero := c.translateExpr(c.zeroValue(t.Elem())).String()
			for len(elements) < int(t.Len()) {
				elements = append(elements, zero)
			}
			return c.formatExpr(`$toNativeArray(%s, [%s])`, typeKind(t.Elem()), strings.Join(elements, ", "))
		case *types.Slice:
			return c.formatExpr("new %s([%s])", c.typeName(exprType), strings.Join(collectIndexedElements(t.Elem()), ", "))
		case *types.Map:
			entries := make([]string, len(e.Elts))
			for i, element := range e.Elts {
				kve := element.(*ast.KeyValueExpr)
				entries[i] = fmt.Sprintf("{ k: %s, v: %s }", c.translateImplicitConversionWithCloning(kve.Key, t.Key()), c.translateImplicitConversionWithCloning(kve.Value, t.Elem()))
			}
			return c.formatExpr("$makeMap(%s.keyFor, [%s])", c.typeName(t.Key()), strings.Join(entries, ", "))
		case *types.Struct:
			elements := make([]string, t.NumFields())
			isKeyValue := true
			if len(e.Elts) != 0 {
				_, isKeyValue = e.Elts[0].(*ast.KeyValueExpr)
			}
			if !isKeyValue {
				for i, element := range e.Elts {
					elements[i] = c.translateImplicitConversionWithCloning(element, t.Field(i).Type()).String()
				}
			}
			if isKeyValue {
				for i := range elements {
					elements[i] = c.translateExpr(c.zeroValue(t.Field(i).Type())).String()
				}
				for _, element := range e.Elts {
					kve := element.(*ast.KeyValueExpr)
					for j := range elements {
						if kve.Key.(*ast.Ident).Name == t.Field(j).Name() {
							elements[j] = c.translateImplicitConversionWithCloning(kve.Value, t.Field(j).Type()).String()
							break
						}
					}
				}
			}
			return c.formatExpr("new %s.ptr(%s)", c.typeName(exprType), strings.Join(elements, ", "))
		default:
			panic(fmt.Sprintf("Unhandled CompositeLit type: %T\n", t))
		}

	case *ast.FuncLit:
		_, fun := translateFunction(e.Type, nil, e.Body, c, exprType.(*types.Signature), c.p.FuncLitInfos[e], "")
		if len(c.p.escapingVars) != 0 {
			names := make([]string, 0, len(c.p.escapingVars))
			for obj := range c.p.escapingVars {
				names = append(names, c.p.objectNames[obj])
			}
			sort.Strings(names)
			list := strings.Join(names, ", ")
			return c.formatExpr("(function(%s) { return %s; })(%s)", list, fun, list)
		}
		return c.formatExpr("(%s)", fun)

	case *ast.UnaryExpr:
		t := c.p.TypeOf(e.X)
		switch e.Op {
		case token.AND:
			if typesutil.IsJsObject(exprType) {
				return c.formatExpr("%e.object", e.X)
			}

			switch t.Underlying().(type) {
			case *types.Struct, *types.Array:
				return c.translateExpr(e.X)
			}

			switch x := astutil.RemoveParens(e.X).(type) {
			case *ast.CompositeLit:
				return c.formatExpr("$newDataPointer(%e, %s)", x, c.typeName(c.p.TypeOf(e)))
			case *ast.Ident:
				obj := c.p.Uses[x].(*types.Var)
				if c.p.escapingVars[obj] {
					return c.formatExpr("(%1s.$ptr || (%1s.$ptr = new %2s(function() { return this.$target[0]; }, function($v) { this.$target[0] = $v; }, %1s)))", c.p.objectNames[obj], c.typeName(exprType))
				}
				return c.formatExpr(`(%1s || (%1s = new %2s(function() { return %3s; }, function($v) { %4s })))`, c.varPtrName(obj), c.typeName(exprType), c.objectName(obj), c.translateAssign(x, c.newIdent("$v", exprType), false))
			case *ast.SelectorExpr:
				sel, ok := c.p.SelectionOf(x)
				if !ok {
					// qualified identifier
					obj := c.p.Uses[x.Sel].(*types.Var)
					return c.formatExpr(`(%1s || (%1s = new %2s(function() { return %3s; }, function($v) { %4s })))`, c.varPtrName(obj), c.typeName(exprType), c.objectName(obj), c.translateAssign(x, c.newIdent("$v", exprType), false))
				}
				newSel := &ast.SelectorExpr{X: c.newIdent("this.$target", c.p.TypeOf(x.X)), Sel: x.Sel}
				c.setType(newSel, exprType)
				c.p.additionalSelections[newSel] = sel
				return c.formatExpr("(%1e.$ptr_%2s || (%1e.$ptr_%2s = new %3s(function() { return %4e; }, function($v) { %5s }, %1e)))", x.X, x.Sel.Name, c.typeName(exprType), newSel, c.translateAssign(newSel, c.newIdent("$v", exprType), false))
			case *ast.IndexExpr:
				if _, ok := c.p.TypeOf(x.X).Underlying().(*types.Slice); ok {
					return c.formatExpr("$indexPtr(%1e.$array, %1e.$offset + %2e, %3s)", x.X, x.Index, c.typeName(exprType))
				}
				return c.formatExpr("$indexPtr(%e, %e, %s)", x.X, x.Index, c.typeName(exprType))
			case *ast.StarExpr:
				return c.translateExpr(x.X)
			default:
				panic(fmt.Sprintf("Unhandled: %T\n", x))
			}

		case token.ARROW:
			call := &ast.CallExpr{
				Fun:  c.newIdent("$recv", types.NewSignature(nil, types.NewTuple(types.NewVar(0, nil, "", t)), types.NewTuple(types.NewVar(0, nil, "", exprType), types.NewVar(0, nil, "", types.Typ[types.Bool])), false)),
				Args: []ast.Expr{e.X},
			}
			c.Blocking[call] = true
			if _, isTuple := exprType.(*types.Tuple); isTuple {
				return c.formatExpr("%e", call)
			}
			return c.formatExpr("%e[0]", call)
		}

		basic := t.Underlying().(*types.Basic)
		switch e.Op {
		case token.ADD:
			return c.translateExpr(e.X)
		case token.SUB:
			switch {
			case is64Bit(basic):
				return c.formatExpr("new %1s(-%2h, -%2l)", c.typeName(t), e.X)
			case isComplex(basic):
				return c.formatExpr("new %1s(-%2r, -%2i)", c.typeName(t), e.X)
			case isUnsigned(basic):
				return c.fixNumber(c.formatExpr("-%e", e.X), basic)
			default:
				return c.formatExpr("-%e", e.X)
			}
		case token.XOR:
			if is64Bit(basic) {
				return c.formatExpr("new %1s(~%2h, ~%2l >>> 0)", c.typeName(t), e.X)
			}
			return c.fixNumber(c.formatExpr("~%e", e.X), basic)
		case token.NOT:
			return c.formatExpr("!%e", e.X)
		default:
			panic(e.Op)
		}

	case *ast.BinaryExpr:
		if e.Op == token.NEQ {
			return c.formatExpr("!(%s)", c.translateExpr(&ast.BinaryExpr{
				X:  e.X,
				Op: token.EQL,
				Y:  e.Y,
			}))
		}

		t := c.p.TypeOf(e.X)
		t2 := c.p.TypeOf(e.Y)
		_, isInterface := t2.Underlying().(*types.Interface)
		if isInterface || types.Identical(t, types.Typ[types.UntypedNil]) {
			t = t2
		}

		if basic, isBasic := t.Underlying().(*types.Basic); isBasic && isNumeric(basic) {
			if is64Bit(basic) {
				switch e.Op {
				case token.MUL:
					return c.formatExpr("$mul64(%e, %e)", e.X, e.Y)
				case token.QUO:
					return c.formatExpr("$div64(%e, %e, false)", e.X, e.Y)
				case token.REM:
					return c.formatExpr("$div64(%e, %e, true)", e.X, e.Y)
				case token.SHL:
					return c.formatExpr("$shiftLeft64(%e, %f)", e.X, e.Y)
				case token.SHR:
					return c.formatExpr("$shiftRight%s(%e, %f)", toJavaScriptType(basic), e.X, e.Y)
				case token.EQL:
					return c.formatExpr("(%1h === %2h && %1l === %2l)", e.X, e.Y)
				case token.LSS:
					return c.formatExpr("(%1h < %2h || (%1h === %2h && %1l < %2l))", e.X, e.Y)
				case token.LEQ:
					return c.formatExpr("(%1h < %2h || (%1h === %2h && %1l <= %2l))", e.X, e.Y)
				case token.GTR:
					return c.formatExpr("(%1h > %2h || (%1h === %2h && %1l > %2l))", e.X, e.Y)
				case token.GEQ:
					return c.formatExpr("(%1h > %2h || (%1h === %2h && %1l >= %2l))", e.X, e.Y)
				case token.ADD, token.SUB:
					return c.formatExpr("new %3s(%1h %4t %2h, %1l %4t %2l)", e.X, e.Y, c.typeName(t), e.Op)
				case token.AND, token.OR, token.XOR:
					return c.formatExpr("new %3s(%1h %4t %2h, (%1l %4t %2l) >>> 0)", e.X, e.Y, c.typeName(t), e.Op)
				case token.AND_NOT:
					return c.formatExpr("new %3s(%1h & ~%2h, (%1l & ~%2l) >>> 0)", e.X, e.Y, c.typeName(t))
				default:
					panic(e.Op)
				}
			}

			if isComplex(basic) {
				switch e.Op {
				case token.EQL:
					return c.formatExpr("(%1r === %2r && %1i === %2i)", e.X, e.Y)
				case token.ADD, token.SUB:
					return c.formatExpr("new %3s(%1r %4t %2r, %1i %4t %2i)", e.X, e.Y, c.typeName(t), e.Op)
				case token.MUL:
					return c.formatExpr("new %3s(%1r * %2r - %1i * %2i, %1r * %2i + %1i * %2r)", e.X, e.Y, c.typeName(t))
				case token.QUO:
					return c.formatExpr("$divComplex(%e, %e)", e.X, e.Y)
				default:
					panic(e.Op)
				}
			}

			switch e.Op {
			case token.EQL:
				return c.formatParenExpr("%e === %e", e.X, e.Y)
			case token.LSS, token.LEQ, token.GTR, token.GEQ:
				return c.formatExpr("%e %t %e", e.X, e.Op, e.Y)
			case token.ADD, token.SUB:
				return c.fixNumber(c.formatExpr("%e %t %e", e.X, e.Op, e.Y), basic)
			case token.MUL:
				switch basic.Kind() {
				case types.Int32, types.Int:
					return c.formatParenExpr("$imul(%e, %e)", e.X, e.Y)
				case types.Uint32, types.Uintptr:
					return c.formatParenExpr("$imul(%e, %e) >>> 0", e.X, e.Y)
				}
				return c.fixNumber(c.formatExpr("%e * %e", e.X, e.Y), basic)
			case token.QUO:
				if isInteger(basic) {
					// cut off decimals
					shift := ">>"
					if isUnsigned(basic) {
						shift = ">>>"
					}
					return c.formatExpr(`(%1s = %2e / %3e, (%1s === %1s && %1s !== 1/0 && %1s !== -1/0) ? %1s %4s 0 : $throwRuntimeError("integer divide by zero"))`, c.newVariable("_q"), e.X, e.Y, shift)
				}
				if basic.Kind() == types.Float32 {
					return c.fixNumber(c.formatExpr("%e / %e", e.X, e.Y), basic)
				}
				return c.formatExpr("%e / %e", e.X, e.Y)
			case token.REM:
				return c.formatExpr(`(%1s = %2e %% %3e, %1s === %1s ? %1s : $throwRuntimeError("integer divide by zero"))`, c.newVariable("_r"), e.X, e.Y)
			case token.SHL, token.SHR:
				op := e.Op.String()
				if e.Op == token.SHR && isUnsigned(basic) {
					op = ">>>"
				}
				if v := c.p.Types[e.Y].Value; v != nil {
					i, _ := constant.Uint64Val(constant.ToInt(v))
					if i >= 32 {
						return c.formatExpr("0")
					}
					return c.fixNumber(c.formatExpr("%e %s %s", e.X, op, strconv.FormatUint(i, 10)), basic)
				}
				if e.Op == token.SHR && !isUnsigned(basic) {
					return c.fixNumber(c.formatParenExpr("%e >> $min(%f, 31)", e.X, e.Y), basic)
				}
				y := c.newVariable("y")
				return c.fixNumber(c.formatExpr("(%s = %f, %s < 32 ? (%e %s %s) : 0)", y, e.Y, y, e.X, op, y), basic)
			case token.AND, token.OR:
				if isUnsigned(basic) {
					return c.formatParenExpr("(%e %t %e) >>> 0", e.X, e.Op, e.Y)
				}
				return c.formatParenExpr("%e %t %e", e.X, e.Op, e.Y)
			case token.AND_NOT:
				return c.fixNumber(c.formatParenExpr("%e & ~%e", e.X, e.Y), basic)
			case token.XOR:
				return c.fixNumber(c.formatParenExpr("%e ^ %e", e.X, e.Y), basic)
			default:
				panic(e.Op)
			}
		}

		switch e.Op {
		case token.ADD, token.LSS, token.LEQ, token.GTR, token.GEQ:
			return c.formatExpr("%e %t %e", e.X, e.Op, e.Y)
		case token.LAND:
			if c.Blocking[e.Y] {
				skipCase := c.caseCounter
				c.caseCounter++
				resultVar := c.newVariable("_v")
				c.Printf("if (!(%s)) { %s = false; $s = %d; continue s; }", c.translateExpr(e.X), resultVar, skipCase)
				c.Printf("%s = %s; case %d:", resultVar, c.translateExpr(e.Y), skipCase)
				return c.formatExpr("%s", resultVar)
			}
			return c.formatExpr("%e && %e", e.X, e.Y)
		case token.LOR:
			if c.Blocking[e.Y] {
				skipCase := c.caseCounter
				c.caseCounter++
				resultVar := c.newVariable("_v")
				c.Printf("if (%s) { %s = true; $s = %d; continue s; }", c.translateExpr(e.X), resultVar, skipCase)
				c.Printf("%s = %s; case %d:", resultVar, c.translateExpr(e.Y), skipCase)
				return c.formatExpr("%s", resultVar)
			}
			return c.formatExpr("%e || %e", e.X, e.Y)
		case token.EQL:
			switch u := t.Underlying().(type) {
			case *types.Array, *types.Struct:
				return c.formatExpr("$equal(%e, %e, %s)", e.X, e.Y, c.typeName(t))
			case *types.Interface:
				return c.formatExpr("$interfaceIsEqual(%s, %s)", c.translateImplicitConversion(e.X, t), c.translateImplicitConversion(e.Y, t))
			case *types.Pointer:
				if _, ok := u.Elem().Underlying().(*types.Array); ok {
					return c.formatExpr("$equal(%s, %s, %s)", c.translateImplicitConversion(e.X, t), c.translateImplicitConversion(e.Y, t), c.typeName(u.Elem()))
				}
			case *types.Basic:
				if isBoolean(u) {
					if b, ok := analysis.BoolValue(e.X, c.p.Info.Info); ok && b {
						return c.translateExpr(e.Y)
					}
					if b, ok := analysis.BoolValue(e.Y, c.p.Info.Info); ok && b {
						return c.translateExpr(e.X)
					}
				}
			}
			return c.formatExpr("%s === %s", c.translateImplicitConversion(e.X, t), c.translateImplicitConversion(e.Y, t))
		default:
			panic(e.Op)
		}

	case *ast.ParenExpr:
		return c.formatParenExpr("%e", e.X)

	case *ast.IndexExpr:
		switch t := c.p.TypeOf(e.X).Underlying().(type) {
		case *types.Array, *types.Pointer:
			pattern := rangeCheck("%1e[%2f]", c.p.Types[e.Index].Value != nil, true)
			if _, ok := t.(*types.Pointer); ok { // check pointer for nix (attribute getter causes a panic)
				pattern = `(%1e.nilCheck, ` + pattern + `)`
			}
			return c.formatExpr(pattern, e.X, e.Index)
		case *types.Slice:
			return c.formatExpr(rangeCheck("%1e.$array[%1e.$offset + %2f]", c.p.Types[e.Index].Value != nil, false), e.X, e.Index)
		case *types.Map:
			if typesutil.IsJsObject(c.p.TypeOf(e.Index)) {
				c.p.errList = append(c.p.errList, types.Error{Fset: c.p.fileSet, Pos: e.Index.Pos(), Msg: "cannot use js.Object as map key"})
			}
			key := fmt.Sprintf("%s.keyFor(%s)", c.typeName(t.Key()), c.translateImplicitConversion(e.Index, t.Key()))
			if _, isTuple := exprType.(*types.Tuple); isTuple {
				return c.formatExpr(`(%1s = %2e[%3s], %1s !== undefined ? [%1s.v, true] : [%4e, false])`, c.newVariable("_entry"), e.X, key, c.zeroValue(t.Elem()))
			}
			return c.formatExpr(`(%1s = %2e[%3s], %1s !== undefined ? %1s.v : %4e)`, c.newVariable("_entry"), e.X, key, c.zeroValue(t.Elem()))
		case *types.Basic:
			return c.formatExpr("%e.charCodeAt(%f)", e.X, e.Index)
		default:
			panic(fmt.Sprintf("Unhandled IndexExpr: %T\n", t))
		}

	case *ast.SliceExpr:
		if b, isBasic := c.p.TypeOf(e.X).Underlying().(*types.Basic); isBasic && isString(b) {
			switch {
			case e.Low == nil && e.High == nil:
				return c.translateExpr(e.X)
			case e.Low == nil:
				return c.formatExpr("$substring(%e, 0, %f)", e.X, e.High)
			case e.High == nil:
				return c.formatExpr("$substring(%e, %f)", e.X, e.Low)
			default:
				return c.formatExpr("$substring(%e, %f, %f)", e.X, e.Low, e.High)
			}
		}
		slice := c.translateConversionToSlice(e.X, exprType)
		switch {
		case e.Low == nil && e.High == nil:
			return c.formatExpr("%s", slice)
		case e.Low == nil:
			if e.Max != nil {
				return c.formatExpr("$subslice(%s, 0, %f, %f)", slice, e.High, e.Max)
			}
			return c.formatExpr("$subslice(%s, 0, %f)", slice, e.High)
		case e.High == nil:
			return c.formatExpr("$subslice(%s, %f)", slice, e.Low)
		default:
			if e.Max != nil {
				return c.formatExpr("$subslice(%s, %f, %f, %f)", slice, e.Low, e.High, e.Max)
			}
			return c.formatExpr("$subslice(%s, %f, %f)", slice, e.Low, e.High)
		}

	case *ast.SelectorExpr:
		sel, ok := c.p.SelectionOf(e)
		if !ok {
			// qualified identifier
			return c.formatExpr("%s", c.objectName(obj))
		}

		switch sel.Kind() {
		case types.FieldVal:
			fields, jsTag := c.translateSelection(sel, e.Pos())
			if jsTag != "" {
				if _, ok := sel.Type().(*types.Signature); ok {
					return c.formatExpr("$internalize(%1e.%2s.%3s, %4s, %1e.%2s)", e.X, strings.Join(fields, "."), jsTag, c.typeName(sel.Type()))
				}
				return c.internalize(c.formatExpr("%e.%s.%s", e.X, strings.Join(fields, "."), jsTag), sel.Type())
			}
			return c.formatExpr("%e.%s", e.X, strings.Join(fields, "."))
		case types.MethodVal:
			return c.formatExpr(`$methodVal(%s, "%s")`, c.makeReceiver(e), sel.Obj().(*types.Func).Name())
		case types.MethodExpr:
			if !sel.Obj().Exported() {
				c.p.dependencies[sel.Obj()] = true
			}
			if _, ok := sel.Recv().Underlying().(*types.Interface); ok {
				return c.formatExpr(`$ifaceMethodExpr("%s")`, sel.Obj().(*types.Func).Name())
			}
			return c.formatExpr(`$methodExpr(%s, "%s")`, c.typeName(sel.Recv()), sel.Obj().(*types.Func).Name())
		default:
			panic(fmt.Sprintf("unexpected sel.Kind(): %T", sel.Kind()))
		}

	case *ast.CallExpr:
		plainFun := astutil.RemoveParens(e.Fun)

		if astutil.IsTypeExpr(plainFun, c.p.Info.Info) {
			return c.formatExpr("(%s)", c.translateConversion(e.Args[0], c.p.TypeOf(plainFun)))
		}

		sig := c.p.TypeOf(plainFun).Underlying().(*types.Signature)

		switch f := plainFun.(type) {
		case *ast.Ident:
			obj := c.p.Uses[f]
			if o, ok := obj.(*types.Builtin); ok {
				return c.translateBuiltin(o.Name(), sig, e.Args, e.Ellipsis.IsValid())
			}
			if typesutil.IsJsPackage(obj.Pkg()) && obj.Name() == "InternalObject" {
				return c.translateExpr(e.Args[0])
			}
			return c.translateCall(e, sig, c.translateExpr(f))

		case *ast.SelectorExpr:
			sel, ok := c.p.SelectionOf(f)
			if !ok {
				// qualified identifier
				obj := c.p.Uses[f.Sel]
				if typesutil.IsJsPackage(obj.Pkg()) {
					switch obj.Name() {
					case "Debugger":
						return c.formatExpr("debugger")
					case "InternalObject":
						return c.translateExpr(e.Args[0])
					}
				}
				return c.translateCall(e, sig, c.translateExpr(f))
			}

			externalizeExpr := func(e ast.Expr) string {
				t := c.p.TypeOf(e)
				if types.Identical(t, types.Typ[types.UntypedNil]) {
					return "null"
				}
				return c.externalize(c.translateExpr(e).String(), t)
			}
			externalizeArgs := func(args []ast.Expr) string {
				s := make([]string, len(args))
				for i, arg := range args {
					s[i] = externalizeExpr(arg)
				}
				return strings.Join(s, ", ")
			}

			switch sel.Kind() {
			case types.MethodVal:
				recv := c.makeReceiver(f)
				declaredFuncRecv := sel.Obj().(*types.Func).Type().(*types.Signature).Recv().Type()
				if typesutil.IsJsObject(declaredFuncRecv) {
					globalRef := func(id string) string {
						if recv.String() == "$global" && id[0] == '$' && len(id) > 1 {
							return id
						}
						return recv.String() + "." + id
					}
					switch sel.Obj().Name() {
					case "Get":
						if id, ok := c.identifierConstant(e.Args[0]); ok {
							return c.formatExpr("%s", globalRef(id))
						}
						return c.formatExpr("%s[$externalize(%e, $String)]", recv, e.Args[0])
					case "Set":
						if id, ok := c.identifierConstant(e.Args[0]); ok {
							return c.formatExpr("%s = %s", globalRef(id), externalizeExpr(e.Args[1]))
						}
						return c.formatExpr("%s[$externalize(%e, $String)] = %s", recv, e.Args[0], externalizeExpr(e.Args[1]))
					case "Delete":
						return c.formatExpr("delete %s[$externalize(%e, $String)]", recv, e.Args[0])
					case "Length":
						return c.formatExpr("$parseInt(%s.length)", recv)
					case "Index":
						return c.formatExpr("%s[%e]", recv, e.Args[0])
					case "SetIndex":
						return c.formatExpr("%s[%e] = %s", recv, e.Args[0], externalizeExpr(e.Args[1]))
					case "Call":
						if id, ok := c.identifierConstant(e.Args[0]); ok {
							if e.Ellipsis.IsValid() {
								objVar := c.newVariable("obj")
								return c.formatExpr("(%s = %s, %s.%s.apply(%s, %s))", objVar, recv, objVar, id, objVar, externalizeExpr(e.Args[1]))
							}
							return c.formatExpr("%s(%s)", globalRef(id), externalizeArgs(e.Args[1:]))
						}
						if e.Ellipsis.IsValid() {
							objVar := c.newVariable("obj")
							return c.formatExpr("(%s = %s, %s[$externalize(%e, $String)].apply(%s, %s))", objVar, recv, objVar, e.Args[0], objVar, externalizeExpr(e.Args[1]))
						}
						return c.formatExpr("%s[$externalize(%e, $String)](%s)", recv, e.Args[0], externalizeArgs(e.Args[1:]))
					case "Invoke":
						if e.Ellipsis.IsValid() {
							return c.formatExpr("%s.apply(undefined, %s)", recv, externalizeExpr(e.Args[0]))
						}
						return c.formatExpr("%s(%s)", recv, externalizeArgs(e.Args))
					case "New":
						if e.Ellipsis.IsValid() {
							return c.formatExpr("new ($global.Function.prototype.bind.apply(%s, [undefined].concat(%s)))", recv, externalizeExpr(e.Args[0]))
						}
						return c.formatExpr("new (%s)(%s)", recv, externalizeArgs(e.Args))
					case "Bool":
						return c.internalize(recv, types.Typ[types.Bool])
					case "String":
						return c.internalize(recv, types.Typ[types.String])
					case "Int":
						return c.internalize(recv, types.Typ[types.Int])
					case "Int64":
						return c.internalize(recv, types.Typ[types.Int64])
					case "Uint64":
						return c.internalize(recv, types.Typ[types.Uint64])
					case "Float":
						return c.internalize(recv, types.Typ[types.Float64])
					case "Interface":
						return c.internalize(recv, types.NewInterface(nil, nil))
					case "Unsafe":
						return recv
					default:
						panic("Invalid js package object: " + sel.Obj().Name())
					}
				}

				methodName := sel.Obj().Name()
				if reservedKeywords[methodName] {
					methodName += "$"
				}
				return c.translateCall(e, sig, c.formatExpr("%s.%s", recv, methodName))

			case types.FieldVal:
				fields, jsTag := c.translateSelection(sel, f.Pos())
				if jsTag != "" {
					call := c.formatExpr("%e.%s.%s(%s)", f.X, strings.Join(fields, "."), jsTag, externalizeArgs(e.Args))
					switch sig.Results().Len() {
					case 0:
						return call
					case 1:
						return c.internalize(call, sig.Results().At(0).Type())
					default:
						c.p.errList = append(c.p.errList, types.Error{Fset: c.p.fileSet, Pos: f.Pos(), Msg: "field with js tag can not have func type with multiple results"})
					}
				}
				return c.translateCall(e, sig, c.formatExpr("%e.%s", f.X, strings.Join(fields, ".")))

			case types.MethodExpr:
				return c.translateCall(e, sig, c.translateExpr(f))

			default:
				panic(fmt.Sprintf("unexpected sel.Kind(): %T", sel.Kind()))
			}
		default:
			return c.translateCall(e, sig, c.translateExpr(plainFun))
		}

	case *ast.StarExpr:
		if typesutil.IsJsObject(c.p.TypeOf(e.X)) {
			return c.formatExpr("new $jsObjectPtr(%e)", e.X)
		}
		if c1, isCall := e.X.(*ast.CallExpr); isCall && len(c1.Args) == 1 {
			if c2, isCall := c1.Args[0].(*ast.CallExpr); isCall && len(c2.Args) == 1 && types.Identical(c.p.TypeOf(c2.Fun), types.Typ[types.UnsafePointer]) {
				if unary, isUnary := c2.Args[0].(*ast.UnaryExpr); isUnary && unary.Op == token.AND {
					return c.translateExpr(unary.X) // unsafe conversion
				}
			}
		}
		switch exprType.Underlying().(type) {
		case *types.Struct, *types.Array:
			return c.translateExpr(e.X)
		}
		return c.formatExpr("%e.$get()", e.X)

	case *ast.TypeAssertExpr:
		if e.Type == nil {
			return c.translateExpr(e.X)
		}
		t := c.p.TypeOf(e.Type)
		if _, isTuple := exprType.(*types.Tuple); isTuple {
			return c.formatExpr("$assertType(%e, %s, true)", e.X, c.typeName(t))
		}
		return c.formatExpr("$assertType(%e, %s)", e.X, c.typeName(t))

	case *ast.Ident:
		if e.Name == "_" {
			panic("Tried to translate underscore identifier.")
		}
		switch o := obj.(type) {
		case *types.Var, *types.Const:
			return c.formatExpr("%s", c.objectName(o))
		case *types.Func:
			return c.formatExpr("%s", c.objectName(o))
		case *types.TypeName:
			return c.formatExpr("%s", c.typeName(o.Type()))
		case *types.Nil:
			if typesutil.IsJsObject(exprType) {
				return c.formatExpr("null")
			}
			switch t := exprType.Underlying().(type) {
			case *types.Basic:
				if t.Kind() != types.UnsafePointer {
					panic("unexpected basic type")
				}
				return c.formatExpr("0")
			case *types.Slice, *types.Pointer:
				return c.formatExpr("%s.nil", c.typeName(exprType))
			case *types.Chan:
				return c.formatExpr("$chanNil")
			case *types.Map:
				return c.formatExpr("false")
			case *types.Interface:
				return c.formatExpr("$ifaceNil")
			case *types.Signature:
				return c.formatExpr("$throwNilPointerError")
			default:
				panic(fmt.Sprintf("unexpected type: %T", t))
			}
		default:
			panic(fmt.Sprintf("Unhandled object: %T\n", o))
		}

	case nil:
		return c.formatExpr("")

	default:
		panic(fmt.Sprintf("Unhandled expression: %T\n", e))

	}
}

func (c *funcContext) translateCall(e *ast.CallExpr, sig *types.Signature, fun *expression) *expression {
	args := c.translateArgs(sig, e.Args, e.Ellipsis.IsValid())
	if c.Blocking[e] {
		resumeCase := c.caseCounter
		c.caseCounter++
		returnVar := "$r"
		if sig.Results().Len() != 0 {
			returnVar = c.newVariable("_r")
		}
		c.Printf("%[1]s = %[2]s(%[3]s); /* */ $s = %[4]d; case %[4]d: if($c) { $c = false; %[1]s = %[1]s.$blk(); } if (%[1]s && %[1]s.$blk !== undefined) { break s; }", returnVar, fun, strings.Join(args, ", "), resumeCase)
		if sig.Results().Len() != 0 {
			return c.formatExpr("%s", returnVar)
		}
		return c.formatExpr("")
	}
	return c.formatExpr("%s(%s)", fun, strings.Join(args, ", "))
}

func (c *funcContext) makeReceiver(e *ast.SelectorExpr) *expression {
	sel, _ := c.p.SelectionOf(e)
	if !sel.Obj().Exported() {
		c.p.dependencies[sel.Obj()] = true
	}

	x := e.X
	recvType := sel.Recv()
	if len(sel.Index()) > 1 {
		for _, index := range sel.Index()[:len(sel.Index())-1] {
			if ptr, isPtr := recvType.(*types.Pointer); isPtr {
				recvType = ptr.Elem()
			}
			s := recvType.Underlying().(*types.Struct)
			recvType = s.Field(index).Type()
		}

		fakeSel := &ast.SelectorExpr{X: x, Sel: ast.NewIdent("o")}
		c.p.additionalSelections[fakeSel] = &fakeSelection{
			kind:  types.FieldVal,
			recv:  sel.Recv(),
			index: sel.Index()[:len(sel.Index())-1],
			typ:   recvType,
		}
		x = c.setType(fakeSel, recvType)
	}

	_, isPointer := recvType.Underlying().(*types.Pointer)
	methodsRecvType := sel.Obj().Type().(*types.Signature).Recv().Type()
	_, pointerExpected := methodsRecvType.(*types.Pointer)
	if !isPointer && pointerExpected {
		recvType = types.NewPointer(recvType)
		x = c.setType(&ast.UnaryExpr{Op: token.AND, X: x}, recvType)
	}
	if isPointer && !pointerExpected {
		x = c.setType(x, methodsRecvType)
	}

	recv := c.translateImplicitConversionWithCloning(x, methodsRecvType)
	if isWrapped(recvType) {
		recv = c.formatExpr("new %s(%s)", c.typeName(methodsRecvType), recv)
	}
	return recv
}

func (c *funcContext) translateBuiltin(name string, sig *types.Signature, args []ast.Expr, ellipsis bool) *expression {
	switch name {
	case "new":
		t := sig.Results().At(0).Type().(*types.Pointer)
		if c.p.Pkg.Path() == "syscall" && types.Identical(t.Elem().Underlying(), types.Typ[types.Uintptr]) {
			return c.formatExpr("new Uint8Array(8)")
		}
		switch t.Elem().Underlying().(type) {
		case *types.Struct, *types.Array:
			return c.formatExpr("%e", c.zeroValue(t.Elem()))
		default:
			return c.formatExpr("$newDataPointer(%e, %s)", c.zeroValue(t.Elem()), c.typeName(t))
		}
	case "make":
		switch argType := c.p.TypeOf(args[0]).Underlying().(type) {
		case *types.Slice:
			t := c.typeName(c.p.TypeOf(args[0]))
			if len(args) == 3 {
				return c.formatExpr("$makeSlice(%s, %f, %f)", t, args[1], args[2])
			}
			return c.formatExpr("$makeSlice(%s, %f)", t, args[1])
		case *types.Map:
			if len(args) == 2 && c.p.Types[args[1]].Value == nil {
				return c.formatExpr(`((%1f < 0 || %1f > 2147483647) ? $throwRuntimeError("makemap: size out of range") : {})`, args[1])
			}
			return c.formatExpr("{}")
		case *types.Chan:
			length := "0"
			if len(args) == 2 {
				length = c.formatExpr("%f", args[1]).String()
			}
			return c.formatExpr("new $Chan(%s, %s)", c.typeName(c.p.TypeOf(args[0]).Underlying().(*types.Chan).Elem()), length)
		default:
			panic(fmt.Sprintf("Unhandled make type: %T\n", argType))
		}
	case "len":
		switch argType := c.p.TypeOf(args[0]).Underlying().(type) {
		case *types.Basic:
			return c.formatExpr("%e.length", args[0])
		case *types.Slice:
			return c.formatExpr("%e.$length", args[0])
		case *types.Pointer:
			return c.formatExpr("(%e, %d)", args[0], argType.Elem().(*types.Array).Len())
		case *types.Map:
			return c.formatExpr("$keys(%e).length", args[0])
		case *types.Chan:
			return c.formatExpr("%e.$buffer.length", args[0])
		// length of array is constant
		default:
			panic(fmt.Sprintf("Unhandled len type: %T\n", argType))
		}
	case "cap":
		switch argType := c.p.TypeOf(args[0]).Underlying().(type) {
		case *types.Slice, *types.Chan:
			return c.formatExpr("%e.$capacity", args[0])
		case *types.Pointer:
			return c.formatExpr("(%e, %d)", args[0], argType.Elem().(*types.Array).Len())
		// capacity of array is constant
		default:
			panic(fmt.Sprintf("Unhandled cap type: %T\n", argType))
		}
	case "panic":
		return c.formatExpr("$panic(%s)", c.translateImplicitConversion(args[0], types.NewInterface(nil, nil)))
	case "append":
		if ellipsis || len(args) == 1 {
			argStr := c.translateArgs(sig, args, ellipsis)
			return c.formatExpr("$appendSlice(%s, %s)", argStr[0], argStr[1])
		}
		sliceType := sig.Results().At(0).Type().Underlying().(*types.Slice)
		return c.formatExpr("$append(%e, %s)", args[0], strings.Join(c.translateExprSlice(args[1:], sliceType.Elem()), ", "))
	case "delete":
		keyType := c.p.TypeOf(args[0]).Underlying().(*types.Map).Key()
		return c.formatExpr(`delete %e[%s.keyFor(%s)]`, args[0], c.typeName(keyType), c.translateImplicitConversion(args[1], keyType))
	case "copy":
		if basic, isBasic := c.p.TypeOf(args[1]).Underlying().(*types.Basic); isBasic && isString(basic) {
			return c.formatExpr("$copyString(%e, %e)", args[0], args[1])
		}
		return c.formatExpr("$copySlice(%e, %e)", args[0], args[1])
	case "print", "println":
		return c.formatExpr("console.log(%s)", strings.Join(c.translateExprSlice(args, nil), ", "))
	case "complex":
		argStr := c.translateArgs(sig, args, ellipsis)
		return c.formatExpr("new %s(%s, %s)", c.typeName(sig.Results().At(0).Type()), argStr[0], argStr[1])
	case "real":
		return c.formatExpr("%e.$real", args[0])
	case "imag":
		return c.formatExpr("%e.$imag", args[0])
	case "recover":
		return c.formatExpr("$recover()")
	case "close":
		return c.formatExpr(`$close(%e)`, args[0])
	default:
		panic(fmt.Sprintf("Unhandled builtin: %s\n", name))
	}
}

func (c *funcContext) identifierConstant(expr ast.Expr) (string, bool) {
	val := c.p.Types[expr].Value
	if val == nil {
		return "", false
	}
	s := constant.StringVal(val)
	if len(s) == 0 {
		return "", false
	}
	for i, c := range s {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (i > 0 && c >= '0' && c <= '9') || c == '_' || c == '$') {
			return "", false
		}
	}
	return s, true
}

func (c *funcContext) translateExprSlice(exprs []ast.Expr, desiredType types.Type) []string {
	parts := make([]string, len(exprs))
	for i, expr := range exprs {
		parts[i] = c.translateImplicitConversion(expr, desiredType).String()
	}
	return parts
}

func (c *funcContext) translateConversion(expr ast.Expr, desiredType types.Type) *expression {
	exprType := c.p.TypeOf(expr)
	if types.Identical(exprType, desiredType) {
		return c.translateExpr(expr)
	}

	if c.p.Pkg.Path() == "reflect" {
		if call, isCall := expr.(*ast.CallExpr); isCall && types.Identical(c.p.TypeOf(call.Fun), types.Typ[types.UnsafePointer]) {
			if ptr, isPtr := desiredType.(*types.Pointer); isPtr {
				if named, isNamed := ptr.Elem().(*types.Named); isNamed {
					switch named.Obj().Name() {
					case "arrayType", "chanType", "funcType", "interfaceType", "mapType", "ptrType", "sliceType", "structType":
						return c.formatExpr("%e.kindType", call.Args[0]) // unsafe conversion
					default:
						return c.translateExpr(expr)
					}
				}
			}
		}
	}

	switch t := desiredType.Underlying().(type) {
	case *types.Basic:
		switch {
		case isInteger(t):
			basicExprType := exprType.Underlying().(*types.Basic)
			switch {
			case is64Bit(t):
				if !is64Bit(basicExprType) {
					if basicExprType.Kind() == types.Uintptr { // this might be an Object returned from reflect.Value.Pointer()
						return c.formatExpr("new %1s(0, %2e.constructor === Number ? %2e : 1)", c.typeName(desiredType), expr)
					}
					return c.formatExpr("new %s(0, %e)", c.typeName(desiredType), expr)
				}
				return c.formatExpr("new %1s(%2h, %2l)", c.typeName(desiredType), expr)
			case is64Bit(basicExprType):
				if !isUnsigned(t) && !isUnsigned(basicExprType) {
					return c.fixNumber(c.formatParenExpr("%1l + ((%1h >> 31) * 4294967296)", expr), t)
				}
				return c.fixNumber(c.formatExpr("%s.$low", c.translateExpr(expr)), t)
			case isFloat(basicExprType):
				return c.formatParenExpr("%e >> 0", expr)
			case types.Identical(exprType, types.Typ[types.UnsafePointer]):
				return c.translateExpr(expr)
			default:
				return c.fixNumber(c.translateExpr(expr), t)
			}
		case isFloat(t):
			if t.Kind() == types.Float32 && exprType.Underlying().(*types.Basic).Kind() == types.Float64 {
				return c.formatExpr("$fround(%e)", expr)
			}
			return c.formatExpr("%f", expr)
		case isComplex(t):
			return c.formatExpr("new %1s(%2r, %2i)", c.typeName(desiredType), expr)
		case isString(t):
			value := c.translateExpr(expr)
			switch et := exprType.Underlying().(type) {
			case *types.Basic:
				if is64Bit(et) {
					value = c.formatExpr("%s.$low", value)
				}
				if isNumeric(et) {
					return c.formatExpr("$encodeRune(%s)", value)
				}
				return value
			case *types.Slice:
				if types.Identical(et.Elem().Underlying(), types.Typ[types.Rune]) {
					return c.formatExpr("$runesToString(%s)", value)
				}
				return c.formatExpr("$bytesToString(%s)", value)
			default:
				panic(fmt.Sprintf("Unhandled conversion: %v\n", et))
			}
		case t.Kind() == types.UnsafePointer:
			if unary, isUnary := expr.(*ast.UnaryExpr); isUnary && unary.Op == token.AND {
				if indexExpr, isIndexExpr := unary.X.(*ast.IndexExpr); isIndexExpr {
					return c.formatExpr("$sliceToArray(%s)", c.translateConversionToSlice(indexExpr.X, types.NewSlice(types.Typ[types.Uint8])))
				}
				if ident, isIdent := unary.X.(*ast.Ident); isIdent && ident.Name == "_zero" {
					return c.formatExpr("new Uint8Array(0)")
				}
			}
			if ptr, isPtr := c.p.TypeOf(expr).(*types.Pointer); c.p.Pkg.Path() == "syscall" && isPtr {
				if s, isStruct := ptr.Elem().Underlying().(*types.Struct); isStruct {
					array := c.newVariable("_array")
					target := c.newVariable("_struct")
					c.Printf("%s = new Uint8Array(%d);", array, sizes32.Sizeof(s))
					c.Delayed(func() {
						c.Printf("%s = %s, %s;", target, c.translateExpr(expr), c.loadStruct(array, target, s))
					})
					return c.formatExpr("%s", array)
				}
			}
			if call, ok := expr.(*ast.CallExpr); ok {
				if id, ok := call.Fun.(*ast.Ident); ok && id.Name == "new" {
					return c.formatExpr("new Uint8Array(%d)", int(sizes32.Sizeof(c.p.TypeOf(call.Args[0]))))
				}
			}
		}

	case *types.Slice:
		switch et := exprType.Underlying().(type) {
		case *types.Basic:
			if isString(et) {
				if types.Identical(t.Elem().Underlying(), types.Typ[types.Rune]) {
					return c.formatExpr("new %s($stringToRunes(%e))", c.typeName(desiredType), expr)
				}
				return c.formatExpr("new %s($stringToBytes(%e))", c.typeName(desiredType), expr)
			}
		case *types.Array, *types.Pointer:
			return c.formatExpr("new %s(%e)", c.typeName(desiredType), expr)
		}

	case *types.Pointer:
		switch u := t.Elem().Underlying().(type) {
		case *types.Array:
			return c.translateExpr(expr)
		case *types.Struct:
			if c.p.Pkg.Path() == "syscall" && types.Identical(exprType, types.Typ[types.UnsafePointer]) {
				array := c.newVariable("_array")
				target := c.newVariable("_struct")
				return c.formatExpr("(%s = %e, %s = %e, %s, %s)", array, expr, target, c.zeroValue(t.Elem()), c.loadStruct(array, target, u), target)
			}
			return c.formatExpr("$pointerOfStructConversion(%e, %s)", expr, c.typeName(t))
		}

		if !types.Identical(exprType, types.Typ[types.UnsafePointer]) {
			exprTypeElem := exprType.Underlying().(*types.Pointer).Elem()
			ptrVar := c.newVariable("_ptr")
			getterConv := c.translateConversion(c.setType(&ast.StarExpr{X: c.newIdent(ptrVar, exprType)}, exprTypeElem), t.Elem())
			setterConv := c.translateConversion(c.newIdent("$v", t.Elem()), exprTypeElem)
			return c.formatExpr("(%1s = %2e, new %3s(function() { return %4s; }, function($v) { %1s.$set(%5s); }, %1s.$target))", ptrVar, expr, c.typeName(desiredType), getterConv, setterConv)
		}

	case *types.Interface:
		if types.Identical(exprType, types.Typ[types.UnsafePointer]) {
			return c.translateExpr(expr)
		}
	}

	return c.translateImplicitConversionWithCloning(expr, desiredType)
}

func (c *funcContext) translateImplicitConversionWithCloning(expr ast.Expr, desiredType types.Type) *expression {
	switch desiredType.Underlying().(type) {
	case *types.Struct, *types.Array:
		switch expr.(type) {
		case nil, *ast.CompositeLit:
			// nothing
		default:
			return c.formatExpr("$clone(%e, %s)", expr, c.typeName(desiredType))
		}
	}

	return c.translateImplicitConversion(expr, desiredType)
}

func (c *funcContext) translateImplicitConversion(expr ast.Expr, desiredType types.Type) *expression {
	if desiredType == nil {
		return c.translateExpr(expr)
	}

	exprType := c.p.TypeOf(expr)
	if types.Identical(exprType, desiredType) {
		return c.translateExpr(expr)
	}

	basicExprType, isBasicExpr := exprType.Underlying().(*types.Basic)
	if isBasicExpr && basicExprType.Kind() == types.UntypedNil {
		return c.formatExpr("%e", c.zeroValue(desiredType))
	}

	switch desiredType.Underlying().(type) {
	case *types.Slice:
		return c.formatExpr("$subslice(new %1s(%2e.$array), %2e.$offset, %2e.$offset + %2e.$length)", c.typeName(desiredType), expr)

	case *types.Interface:
		if typesutil.IsJsObject(exprType) {
			// wrap JS object into js.Object struct when converting to interface
			return c.formatExpr("new $jsObjectPtr(%e)", expr)
		}
		if isWrapped(exprType) {
			return c.formatExpr("new %s(%e)", c.typeName(exprType), expr)
		}
		if _, isStruct := exprType.Underlying().(*types.Struct); isStruct {
			return c.formatExpr("new %1e.constructor.elem(%1e)", expr)
		}
	}

	return c.translateExpr(expr)
}

func (c *funcContext) translateConversionToSlice(expr ast.Expr, desiredType types.Type) *expression {
	switch c.p.TypeOf(expr).Underlying().(type) {
	case *types.Array, *types.Pointer:
		return c.formatExpr("new %s(%e)", c.typeName(desiredType), expr)
	}
	return c.translateExpr(expr)
}

func (c *funcContext) loadStruct(array, target string, s *types.Struct) string {
	view := c.newVariable("_view")
	code := fmt.Sprintf("%s = new DataView(%s.buffer, %s.byteOffset)", view, array, array)
	var fields []*types.Var
	var collectFields func(s *types.Struct, path string)
	collectFields = func(s *types.Struct, path string) {
		for i := 0; i < s.NumFields(); i++ {
			field := s.Field(i)
			if fs, isStruct := field.Type().Underlying().(*types.Struct); isStruct {
				collectFields(fs, path+"."+fieldName(s, i))
				continue
			}
			fields = append(fields, types.NewVar(0, nil, path+"."+fieldName(s, i), field.Type()))
		}
	}
	collectFields(s, target)
	offsets := sizes32.Offsetsof(fields)
	for i, field := range fields {
		switch t := field.Type().Underlying().(type) {
		case *types.Basic:
			if isNumeric(t) {
				if is64Bit(t) {
					code += fmt.Sprintf(", %s = new %s(%s.getUint32(%d, true), %s.getUint32(%d, true))", field.Name(), c.typeName(field.Type()), view, offsets[i]+4, view, offsets[i])
					break
				}
				code += fmt.Sprintf(", %s = %s.get%s(%d, true)", field.Name(), view, toJavaScriptType(t), offsets[i])
			}
		case *types.Array:
			code += fmt.Sprintf(`, %s = new ($nativeArray(%s))(%s.buffer, $min(%s.byteOffset + %d, %s.buffer.byteLength))`, field.Name(), typeKind(t.Elem()), array, array, offsets[i], array)
		}
	}
	return code
}

func (c *funcContext) fixNumber(value *expression, basic *types.Basic) *expression {
	switch basic.Kind() {
	case types.Int8:
		return c.formatParenExpr("%s << 24 >> 24", value)
	case types.Uint8:
		return c.formatParenExpr("%s << 24 >>> 24", value)
	case types.Int16:
		return c.formatParenExpr("%s << 16 >> 16", value)
	case types.Uint16:
		return c.formatParenExpr("%s << 16 >>> 16", value)
	case types.Int32, types.Int, types.UntypedInt:
		return c.formatParenExpr("%s >> 0", value)
	case types.Uint32, types.Uint, types.Uintptr:
		return c.formatParenExpr("%s >>> 0", value)
	case types.Float32:
		return c.formatExpr("$fround(%s)", value)
	case types.Float64:
		return value
	default:
		panic(fmt.Sprintf("fixNumber: unhandled basic.Kind(): %s", basic.String()))
	}
}

func (c *funcContext) internalize(s *expression, t types.Type) *expression {
	if typesutil.IsJsObject(t) {
		return s
	}
	switch u := t.Underlying().(type) {
	case *types.Basic:
		switch {
		case isBoolean(u):
			return c.formatExpr("!!(%s)", s)
		case isInteger(u) && !is64Bit(u):
			return c.fixNumber(c.formatExpr("$parseInt(%s)", s), u)
		case isFloat(u):
			return c.formatExpr("$parseFloat(%s)", s)
		}
	}
	return c.formatExpr("$internalize(%s, %s)", s, c.typeName(t))
}

func (c *funcContext) formatExpr(format string, a ...interface{}) *expression {
	return c.formatExprInternal(format, a, false)
}

func (c *funcContext) formatParenExpr(format string, a ...interface{}) *expression {
	return c.formatExprInternal(format, a, true)
}

func (c *funcContext) formatExprInternal(format string, a []interface{}, parens bool) *expression {
	processFormat := func(f func(uint8, uint8, int)) {
		n := 0
		for i := 0; i < len(format); i++ {
			b := format[i]
			if b == '%' {
				i++
				k := format[i]
				if k >= '0' && k <= '9' {
					n = int(k - '0' - 1)
					i++
					k = format[i]
				}
				f(0, k, n)
				n++
				continue
			}
			f(b, 0, 0)
		}
	}

	counts := make([]int, len(a))
	processFormat(func(b, k uint8, n int) {
		switch k {
		case 'e', 'f', 'h', 'l', 'r', 'i':
			counts[n]++
		}
	})

	out := bytes.NewBuffer(nil)
	vars := make([]string, len(a))
	hasAssignments := false
	for i, e := range a {
		if counts[i] <= 1 {
			continue
		}
		if _, isIdent := e.(*ast.Ident); isIdent {
			continue
		}
		if val := c.p.Types[e.(ast.Expr)].Value; val != nil {
			continue
		}
		if !hasAssignments {
			hasAssignments = true
			out.WriteByte('(')
			parens = false
		}
		v := c.newVariable("x")
		out.WriteString(v + " = " + c.translateExpr(e.(ast.Expr)).String() + ", ")
		vars[i] = v
	}

	processFormat(func(b, k uint8, n int) {
		writeExpr := func(suffix string) {
			if vars[n] != "" {
				out.WriteString(vars[n] + suffix)
				return
			}
			out.WriteString(c.translateExpr(a[n].(ast.Expr)).StringWithParens() + suffix)
		}
		switch k {
		case 0:
			out.WriteByte(b)
		case 's':
			if e, ok := a[n].(*expression); ok {
				out.WriteString(e.StringWithParens())
				return
			}
			out.WriteString(a[n].(string))
		case 'd':
			out.WriteString(strconv.Itoa(a[n].(int)))
		case 't':
			out.WriteString(a[n].(token.Token).String())
		case 'e':
			e := a[n].(ast.Expr)
			if val := c.p.Types[e].Value; val != nil {
				out.WriteString(c.translateExpr(e).String())
				return
			}
			writeExpr("")
		case 'f':
			e := a[n].(ast.Expr)
			if val := c.p.Types[e].Value; val != nil {
				d, _ := constant.Int64Val(constant.ToInt(val))
				out.WriteString(strconv.FormatInt(d, 10))
				return
			}
			if is64Bit(c.p.TypeOf(e).Underlying().(*types.Basic)) {
				out.WriteString("$flatten64(")
				writeExpr("")
				out.WriteString(")")
				return
			}
			writeExpr("")
		case 'h':
			e := a[n].(ast.Expr)
			if val := c.p.Types[e].Value; val != nil {
				d, _ := constant.Uint64Val(constant.ToInt(val))
				if c.p.TypeOf(e).Underlying().(*types.Basic).Kind() == types.Int64 {
					out.WriteString(strconv.FormatInt(int64(d)>>32, 10))
					return
				}
				out.WriteString(strconv.FormatUint(d>>32, 10))
				return
			}
			writeExpr(".$high")
		case 'l':
			if val := c.p.Types[a[n].(ast.Expr)].Value; val != nil {
				d, _ := constant.Uint64Val(constant.ToInt(val))
				out.WriteString(strconv.FormatUint(d&(1<<32-1), 10))
				return
			}
			writeExpr(".$low")
		case 'r':
			if val := c.p.Types[a[n].(ast.Expr)].Value; val != nil {
				r, _ := constant.Float64Val(constant.Real(val))
				out.WriteString(strconv.FormatFloat(r, 'g', -1, 64))
				return
			}
			writeExpr(".$real")
		case 'i':
			if val := c.p.Types[a[n].(ast.Expr)].Value; val != nil {
				i, _ := constant.Float64Val(constant.Imag(val))
				out.WriteString(strconv.FormatFloat(i, 'g', -1, 64))
				return
			}
			writeExpr(".$imag")
		case '%':
			out.WriteRune('%')
		default:
			panic(fmt.Sprintf("formatExpr: %%%c%d", k, n))
		}
	})

	if hasAssignments {
		out.WriteByte(')')
	}
	return &expression{str: out.String(), parens: parens}
}
