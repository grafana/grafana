package compiler

import (
	"fmt"
	"go/ast"
	"go/constant"
	"go/token"
	"go/types"
	"strings"

	"github.com/gopherjs/gopherjs/compiler/analysis"
	"github.com/gopherjs/gopherjs/compiler/astutil"
	"github.com/gopherjs/gopherjs/compiler/filter"
	"github.com/gopherjs/gopherjs/compiler/typesutil"
)

func (c *funcContext) translateStmtList(stmts []ast.Stmt) {
	for _, stmt := range stmts {
		c.translateStmt(stmt, nil)
	}
	c.SetPos(token.NoPos)
}

func (c *funcContext) translateStmt(stmt ast.Stmt, label *types.Label) {
	c.SetPos(stmt.Pos())

	stmt = filter.IncDecStmt(stmt, c.p.Info.Info)
	stmt = filter.Assign(stmt, c.p.Info.Info, c.p.Info.Pkg)

	switch s := stmt.(type) {
	case *ast.BlockStmt:
		c.translateStmtList(s.List)

	case *ast.IfStmt:
		var caseClauses []*ast.CaseClause
		ifStmt := s
		for {
			if ifStmt.Init != nil {
				panic("simplification error")
			}
			caseClauses = append(caseClauses, &ast.CaseClause{List: []ast.Expr{ifStmt.Cond}, Body: ifStmt.Body.List})
			elseStmt, ok := ifStmt.Else.(*ast.IfStmt)
			if !ok {
				break
			}
			ifStmt = elseStmt
		}
		var defaultClause *ast.CaseClause
		if block, ok := ifStmt.Else.(*ast.BlockStmt); ok {
			defaultClause = &ast.CaseClause{Body: block.List}
		}
		c.translateBranchingStmt(caseClauses, defaultClause, false, c.translateExpr, nil, c.Flattened[s])

	case *ast.SwitchStmt:
		if s.Init != nil || s.Tag != nil || len(s.Body.List) != 1 {
			panic("simplification error")
		}
		clause := s.Body.List[0].(*ast.CaseClause)
		if len(clause.List) != 0 {
			panic("simplification error")
		}

		prevFlowData := c.flowDatas[nil]
		data := &flowData{
			postStmt:  prevFlowData.postStmt,  // for "continue" of outer loop
			beginCase: prevFlowData.beginCase, // same
		}
		c.flowDatas[nil] = data
		c.flowDatas[label] = data
		defer func() {
			delete(c.flowDatas, label)
			c.flowDatas[nil] = prevFlowData
		}()

		if c.Flattened[s] {
			data.endCase = c.caseCounter
			c.caseCounter++

			c.Indent(func() {
				c.translateStmtList(clause.Body)
			})
			c.Printf("case %d:", data.endCase)
			return
		}

		if label != nil || analysis.HasBreak(clause) {
			if label != nil {
				c.Printf("%s:", label.Name())
			}
			c.Printf("switch (0) { default:")
			c.Indent(func() {
				c.translateStmtList(clause.Body)
			})
			c.Printf("}")
			return
		}

		c.translateStmtList(clause.Body)

	case *ast.TypeSwitchStmt:
		if s.Init != nil {
			c.translateStmt(s.Init, nil)
		}
		refVar := c.newVariable("_ref")
		var expr ast.Expr
		switch a := s.Assign.(type) {
		case *ast.AssignStmt:
			expr = a.Rhs[0].(*ast.TypeAssertExpr).X
		case *ast.ExprStmt:
			expr = a.X.(*ast.TypeAssertExpr).X
		}
		c.Printf("%s = %s;", refVar, c.translateExpr(expr))
		translateCond := func(cond ast.Expr) *expression {
			if types.Identical(c.p.TypeOf(cond), types.Typ[types.UntypedNil]) {
				return c.formatExpr("%s === $ifaceNil", refVar)
			}
			return c.formatExpr("$assertType(%s, %s, true)[1]", refVar, c.typeName(c.p.TypeOf(cond)))
		}
		var caseClauses []*ast.CaseClause
		var defaultClause *ast.CaseClause
		for _, cc := range s.Body.List {
			clause := cc.(*ast.CaseClause)
			var bodyPrefix []ast.Stmt
			if implicit := c.p.Implicits[clause]; implicit != nil {
				value := refVar
				if typesutil.IsJsObject(implicit.Type().Underlying()) {
					value += ".$val.object"
				} else if _, ok := implicit.Type().Underlying().(*types.Interface); !ok {
					value += ".$val"
				}
				bodyPrefix = []ast.Stmt{&ast.AssignStmt{
					Lhs: []ast.Expr{c.newIdent(c.objectName(implicit), implicit.Type())},
					Tok: token.DEFINE,
					Rhs: []ast.Expr{c.newIdent(value, implicit.Type())},
				}}
			}
			c := &ast.CaseClause{
				List: clause.List,
				Body: append(bodyPrefix, clause.Body...),
			}
			if len(c.List) == 0 {
				defaultClause = c
				continue
			}
			caseClauses = append(caseClauses, c)
		}
		c.translateBranchingStmt(caseClauses, defaultClause, true, translateCond, label, c.Flattened[s])

	case *ast.ForStmt:
		if s.Init != nil {
			c.translateStmt(s.Init, nil)
		}
		cond := func() string {
			if s.Cond == nil {
				return "true"
			}
			return c.translateExpr(s.Cond).String()
		}
		c.translateLoopingStmt(cond, s.Body, nil, func() {
			if s.Post != nil {
				c.translateStmt(s.Post, nil)
			}
		}, label, c.Flattened[s])

	case *ast.RangeStmt:
		refVar := c.newVariable("_ref")
		c.Printf("%s = %s;", refVar, c.translateExpr(s.X))

		switch t := c.p.TypeOf(s.X).Underlying().(type) {
		case *types.Basic:
			iVar := c.newVariable("_i")
			c.Printf("%s = 0;", iVar)
			runeVar := c.newVariable("_rune")
			c.translateLoopingStmt(func() string { return iVar + " < " + refVar + ".length" }, s.Body, func() {
				c.Printf("%s = $decodeRune(%s, %s);", runeVar, refVar, iVar)
				if !isBlank(s.Key) {
					c.Printf("%s", c.translateAssign(s.Key, c.newIdent(iVar, types.Typ[types.Int]), s.Tok == token.DEFINE))
				}
				if !isBlank(s.Value) {
					c.Printf("%s", c.translateAssign(s.Value, c.newIdent(runeVar+"[0]", types.Typ[types.Rune]), s.Tok == token.DEFINE))
				}
			}, func() {
				c.Printf("%s += %s[1];", iVar, runeVar)
			}, label, c.Flattened[s])

		case *types.Map:
			iVar := c.newVariable("_i")
			c.Printf("%s = 0;", iVar)
			keysVar := c.newVariable("_keys")
			c.Printf("%s = $keys(%s);", keysVar, refVar)
			c.translateLoopingStmt(func() string { return iVar + " < " + keysVar + ".length" }, s.Body, func() {
				entryVar := c.newVariable("_entry")
				c.Printf("%s = %s[%s[%s]];", entryVar, refVar, keysVar, iVar)
				c.translateStmt(&ast.IfStmt{
					Cond: c.newIdent(entryVar+" === undefined", types.Typ[types.Bool]),
					Body: &ast.BlockStmt{List: []ast.Stmt{&ast.BranchStmt{Tok: token.CONTINUE}}},
				}, nil)
				if !isBlank(s.Key) {
					c.Printf("%s", c.translateAssign(s.Key, c.newIdent(entryVar+".k", t.Key()), s.Tok == token.DEFINE))
				}
				if !isBlank(s.Value) {
					c.Printf("%s", c.translateAssign(s.Value, c.newIdent(entryVar+".v", t.Elem()), s.Tok == token.DEFINE))
				}
			}, func() {
				c.Printf("%s++;", iVar)
			}, label, c.Flattened[s])

		case *types.Array, *types.Pointer, *types.Slice:
			var length string
			var elemType types.Type
			switch t2 := t.(type) {
			case *types.Array:
				length = fmt.Sprintf("%d", t2.Len())
				elemType = t2.Elem()
			case *types.Pointer:
				length = fmt.Sprintf("%d", t2.Elem().Underlying().(*types.Array).Len())
				elemType = t2.Elem().Underlying().(*types.Array).Elem()
			case *types.Slice:
				length = refVar + ".$length"
				elemType = t2.Elem()
			}
			iVar := c.newVariable("_i")
			c.Printf("%s = 0;", iVar)
			c.translateLoopingStmt(func() string { return iVar + " < " + length }, s.Body, func() {
				if !isBlank(s.Key) {
					c.Printf("%s", c.translateAssign(s.Key, c.newIdent(iVar, types.Typ[types.Int]), s.Tok == token.DEFINE))
				}
				if !isBlank(s.Value) {
					c.Printf("%s", c.translateAssign(s.Value, c.setType(&ast.IndexExpr{
						X:     c.newIdent(refVar, t),
						Index: c.newIdent(iVar, types.Typ[types.Int]),
					}, elemType), s.Tok == token.DEFINE))
				}
			}, func() {
				c.Printf("%s++;", iVar)
			}, label, c.Flattened[s])

		case *types.Chan:
			okVar := c.newIdent(c.newVariable("_ok"), types.Typ[types.Bool])
			key := s.Key
			tok := s.Tok
			if key == nil {
				key = ast.NewIdent("_")
				tok = token.ASSIGN
			}
			forStmt := &ast.ForStmt{
				Body: &ast.BlockStmt{
					List: []ast.Stmt{
						&ast.AssignStmt{
							Lhs: []ast.Expr{
								key,
								okVar,
							},
							Rhs: []ast.Expr{
								c.setType(&ast.UnaryExpr{X: c.newIdent(refVar, t), Op: token.ARROW}, types.NewTuple(types.NewVar(0, nil, "", t.Elem()), types.NewVar(0, nil, "", types.Typ[types.Bool]))),
							},
							Tok: tok,
						},
						&ast.IfStmt{
							Cond: &ast.UnaryExpr{X: okVar, Op: token.NOT},
							Body: &ast.BlockStmt{List: []ast.Stmt{&ast.BranchStmt{Tok: token.BREAK}}},
						},
						s.Body,
					},
				},
			}
			c.Flattened[forStmt] = true
			c.translateStmt(forStmt, label)

		default:
			panic("")
		}

	case *ast.BranchStmt:
		normalLabel := ""
		blockingLabel := ""
		data := c.flowDatas[nil]
		if s.Label != nil {
			normalLabel = " " + s.Label.Name
			blockingLabel = " s" // use explicit label "s", because surrounding loop may not be flattened
			data = c.flowDatas[c.p.Uses[s.Label].(*types.Label)]
		}
		switch s.Tok {
		case token.BREAK:
			c.PrintCond(data.endCase == 0, fmt.Sprintf("break%s;", normalLabel), fmt.Sprintf("$s = %d; continue%s;", data.endCase, blockingLabel))
		case token.CONTINUE:
			data.postStmt()
			c.PrintCond(data.beginCase == 0, fmt.Sprintf("continue%s;", normalLabel), fmt.Sprintf("$s = %d; continue%s;", data.beginCase, blockingLabel))
		case token.GOTO:
			c.PrintCond(false, "goto "+s.Label.Name, fmt.Sprintf("$s = %d; continue;", c.labelCase(c.p.Uses[s.Label].(*types.Label))))
		case token.FALLTHROUGH:
			// handled in CaseClause
		default:
			panic("Unhandled branch statment: " + s.Tok.String())
		}

	case *ast.ReturnStmt:
		results := s.Results
		if c.resultNames != nil {
			if len(s.Results) != 0 {
				c.translateStmt(&ast.AssignStmt{
					Lhs: c.resultNames,
					Tok: token.ASSIGN,
					Rhs: s.Results,
				}, nil)
			}
			results = c.resultNames
		}
		rVal := c.translateResults(results)
		if len(c.Flattened) != 0 {
			c.Printf("$s = -1; return%s;", rVal)
			return
		}
		c.Printf("return%s;", rVal)

	case *ast.DeferStmt:
		isBuiltin := false
		isJs := false
		switch fun := s.Call.Fun.(type) {
		case *ast.Ident:
			var builtin *types.Builtin
			builtin, isBuiltin = c.p.Uses[fun].(*types.Builtin)
			if isBuiltin && builtin.Name() == "recover" {
				c.Printf("$deferred.push([$recover, []]);")
				return
			}
		case *ast.SelectorExpr:
			isJs = typesutil.IsJsPackage(c.p.Uses[fun.Sel].Pkg())
		}
		sig := c.p.TypeOf(s.Call.Fun).Underlying().(*types.Signature)
		args := c.translateArgs(sig, s.Call.Args, s.Call.Ellipsis.IsValid())
		if isBuiltin || isJs {
			vars := make([]string, len(s.Call.Args))
			callArgs := make([]ast.Expr, len(s.Call.Args))
			for i, arg := range s.Call.Args {
				v := c.newVariable("_arg")
				vars[i] = v
				callArgs[i] = c.newIdent(v, c.p.TypeOf(arg))
			}
			call := c.translateExpr(&ast.CallExpr{
				Fun:      s.Call.Fun,
				Args:     callArgs,
				Ellipsis: s.Call.Ellipsis,
			})
			c.Printf("$deferred.push([function(%s) { %s; }, [%s]]);", strings.Join(vars, ", "), call, strings.Join(args, ", "))
			return
		}
		c.Printf("$deferred.push([%s, [%s]]);", c.translateExpr(s.Call.Fun), strings.Join(args, ", "))

	case *ast.AssignStmt:
		if s.Tok != token.ASSIGN && s.Tok != token.DEFINE {
			panic(s.Tok)
		}

		switch {
		case len(s.Lhs) == 1 && len(s.Rhs) == 1:
			lhs := astutil.RemoveParens(s.Lhs[0])
			if isBlank(lhs) {
				c.Printf("$unused(%s);", c.translateExpr(s.Rhs[0]))
				return
			}
			c.Printf("%s", c.translateAssign(lhs, s.Rhs[0], s.Tok == token.DEFINE))

		case len(s.Lhs) > 1 && len(s.Rhs) == 1:
			tupleVar := c.newVariable("_tuple")
			c.Printf("%s = %s;", tupleVar, c.translateExpr(s.Rhs[0]))
			tuple := c.p.TypeOf(s.Rhs[0]).(*types.Tuple)
			for i, lhs := range s.Lhs {
				lhs = astutil.RemoveParens(lhs)
				if !isBlank(lhs) {
					c.Printf("%s", c.translateAssign(lhs, c.newIdent(fmt.Sprintf("%s[%d]", tupleVar, i), tuple.At(i).Type()), s.Tok == token.DEFINE))
				}
			}
		case len(s.Lhs) == len(s.Rhs):
			tmpVars := make([]string, len(s.Rhs))
			for i, rhs := range s.Rhs {
				tmpVars[i] = c.newVariable("_tmp")
				if isBlank(astutil.RemoveParens(s.Lhs[i])) {
					c.Printf("$unused(%s);", c.translateExpr(rhs))
					continue
				}
				c.Printf("%s", c.translateAssign(c.newIdent(tmpVars[i], c.p.TypeOf(s.Lhs[i])), rhs, true))
			}
			for i, lhs := range s.Lhs {
				lhs = astutil.RemoveParens(lhs)
				if !isBlank(lhs) {
					c.Printf("%s", c.translateAssign(lhs, c.newIdent(tmpVars[i], c.p.TypeOf(lhs)), s.Tok == token.DEFINE))
				}
			}

		default:
			panic("Invalid arity of AssignStmt.")

		}

	case *ast.DeclStmt:
		decl := s.Decl.(*ast.GenDecl)
		switch decl.Tok {
		case token.VAR:
			for _, spec := range s.Decl.(*ast.GenDecl).Specs {
				valueSpec := spec.(*ast.ValueSpec)
				lhs := make([]ast.Expr, len(valueSpec.Names))
				for i, name := range valueSpec.Names {
					lhs[i] = name
				}
				rhs := valueSpec.Values
				if len(rhs) == 0 {
					rhs = make([]ast.Expr, len(lhs))
					for i, e := range lhs {
						rhs[i] = c.zeroValue(c.p.TypeOf(e))
					}
				}
				c.translateStmt(&ast.AssignStmt{
					Lhs: lhs,
					Tok: token.DEFINE,
					Rhs: rhs,
				}, nil)
			}
		case token.TYPE:
			for _, spec := range decl.Specs {
				o := c.p.Defs[spec.(*ast.TypeSpec).Name].(*types.TypeName)
				c.p.typeNames = append(c.p.typeNames, o)
				c.p.objectNames[o] = c.newVariableWithLevel(o.Name(), true)
				c.p.dependencies[o] = true
			}
		case token.CONST:
			// skip, constants are inlined
		}

	case *ast.ExprStmt:
		expr := c.translateExpr(s.X)
		if expr != nil && expr.String() != "" {
			c.Printf("%s;", expr)
		}

	case *ast.LabeledStmt:
		label := c.p.Defs[s.Label].(*types.Label)
		if c.GotoLabel[label] {
			c.PrintCond(false, s.Label.Name+":", fmt.Sprintf("case %d:", c.labelCase(label)))
		}
		c.translateStmt(s.Stmt, label)

	case *ast.GoStmt:
		c.Printf("$go(%s, [%s]);", c.translateExpr(s.Call.Fun), strings.Join(c.translateArgs(c.p.TypeOf(s.Call.Fun).Underlying().(*types.Signature), s.Call.Args, s.Call.Ellipsis.IsValid()), ", "))

	case *ast.SendStmt:
		chanType := c.p.TypeOf(s.Chan).Underlying().(*types.Chan)
		call := &ast.CallExpr{
			Fun:  c.newIdent("$send", types.NewSignature(nil, types.NewTuple(types.NewVar(0, nil, "", chanType), types.NewVar(0, nil, "", chanType.Elem())), nil, false)),
			Args: []ast.Expr{s.Chan, c.newIdent(c.translateImplicitConversionWithCloning(s.Value, chanType.Elem()).String(), chanType.Elem())},
		}
		c.Blocking[call] = true
		c.translateStmt(&ast.ExprStmt{X: call}, label)

	case *ast.SelectStmt:
		selectionVar := c.newVariable("_selection")
		var channels []string
		var caseClauses []*ast.CaseClause
		flattened := false
		hasDefault := false
		for i, cc := range s.Body.List {
			clause := cc.(*ast.CommClause)
			switch comm := clause.Comm.(type) {
			case nil:
				channels = append(channels, "[]")
				hasDefault = true
			case *ast.ExprStmt:
				channels = append(channels, c.formatExpr("[%e]", astutil.RemoveParens(comm.X).(*ast.UnaryExpr).X).String())
			case *ast.AssignStmt:
				channels = append(channels, c.formatExpr("[%e]", astutil.RemoveParens(comm.Rhs[0]).(*ast.UnaryExpr).X).String())
			case *ast.SendStmt:
				chanType := c.p.TypeOf(comm.Chan).Underlying().(*types.Chan)
				channels = append(channels, c.formatExpr("[%e, %s]", comm.Chan, c.translateImplicitConversionWithCloning(comm.Value, chanType.Elem())).String())
			default:
				panic(fmt.Sprintf("unhandled: %T", comm))
			}

			indexLit := &ast.BasicLit{Kind: token.INT}
			c.p.Types[indexLit] = types.TypeAndValue{Type: types.Typ[types.Int], Value: constant.MakeInt64(int64(i))}

			var bodyPrefix []ast.Stmt
			if assign, ok := clause.Comm.(*ast.AssignStmt); ok {
				switch rhsType := c.p.TypeOf(assign.Rhs[0]).(type) {
				case *types.Tuple:
					bodyPrefix = []ast.Stmt{&ast.AssignStmt{Lhs: assign.Lhs, Rhs: []ast.Expr{c.newIdent(selectionVar+"[1]", rhsType)}, Tok: assign.Tok}}
				default:
					bodyPrefix = []ast.Stmt{&ast.AssignStmt{Lhs: assign.Lhs, Rhs: []ast.Expr{c.newIdent(selectionVar+"[1][0]", rhsType)}, Tok: assign.Tok}}
				}
			}

			caseClauses = append(caseClauses, &ast.CaseClause{
				List: []ast.Expr{indexLit},
				Body: append(bodyPrefix, clause.Body...),
			})

			flattened = flattened || c.Flattened[clause]
		}

		selectCall := c.setType(&ast.CallExpr{
			Fun:  c.newIdent("$select", types.NewSignature(nil, types.NewTuple(types.NewVar(0, nil, "", types.NewInterface(nil, nil))), types.NewTuple(types.NewVar(0, nil, "", types.Typ[types.Int])), false)),
			Args: []ast.Expr{c.newIdent(fmt.Sprintf("[%s]", strings.Join(channels, ", ")), types.NewInterface(nil, nil))},
		}, types.Typ[types.Int])
		c.Blocking[selectCall] = !hasDefault
		c.Printf("%s = %s;", selectionVar, c.translateExpr(selectCall))

		if len(caseClauses) != 0 {
			translateCond := func(cond ast.Expr) *expression {
				return c.formatExpr("%s[0] === %e", selectionVar, cond)
			}
			c.translateBranchingStmt(caseClauses, nil, true, translateCond, label, flattened)
		}

	case *ast.EmptyStmt:
		// skip

	default:
		panic(fmt.Sprintf("Unhandled statement: %T\n", s))

	}
}

func (c *funcContext) translateBranchingStmt(caseClauses []*ast.CaseClause, defaultClause *ast.CaseClause, canBreak bool, translateCond func(ast.Expr) *expression, label *types.Label, flatten bool) {
	var caseOffset, defaultCase, endCase int
	if flatten {
		caseOffset = c.caseCounter
		defaultCase = caseOffset + len(caseClauses)
		endCase = defaultCase
		if defaultClause != nil {
			endCase++
		}
		c.caseCounter = endCase + 1
	}

	hasBreak := false
	if canBreak {
		prevFlowData := c.flowDatas[nil]
		data := &flowData{
			postStmt:  prevFlowData.postStmt,  // for "continue" of outer loop
			beginCase: prevFlowData.beginCase, // same
			endCase:   endCase,
		}
		c.flowDatas[nil] = data
		c.flowDatas[label] = data
		defer func() {
			delete(c.flowDatas, label)
			c.flowDatas[nil] = prevFlowData
		}()

		for _, child := range caseClauses {
			if analysis.HasBreak(child) {
				hasBreak = true
				break
			}
		}
		if defaultClause != nil && analysis.HasBreak(defaultClause) {
			hasBreak = true
		}
	}

	if label != nil && !flatten {
		c.Printf("%s:", label.Name())
	}

	condStrs := make([]string, len(caseClauses))
	for i, clause := range caseClauses {
		conds := make([]string, len(clause.List))
		for j, cond := range clause.List {
			conds[j] = translateCond(cond).String()
		}
		condStrs[i] = strings.Join(conds, " || ")
		if flatten {
			c.Printf("/* */ if (%s) { $s = %d; continue; }", condStrs[i], caseOffset+i)
		}
	}

	if flatten {
		c.Printf("/* */ $s = %d; continue;", defaultCase)
	}

	prefix := ""
	suffix := ""
	if label != nil || hasBreak {
		prefix = "switch (0) { default: "
		suffix = " }"
	}

	for i, clause := range caseClauses {
		c.SetPos(clause.Pos())
		c.PrintCond(!flatten, fmt.Sprintf("%sif (%s) {", prefix, condStrs[i]), fmt.Sprintf("case %d:", caseOffset+i))
		c.Indent(func() {
			c.translateStmtList(clause.Body)
			if flatten && (i < len(caseClauses)-1 || defaultClause != nil) && !endsWithReturn(clause.Body) {
				c.Printf("$s = %d; continue;", endCase)
			}
		})
		prefix = "} else "
	}

	if defaultClause != nil {
		c.PrintCond(!flatten, prefix+"{", fmt.Sprintf("case %d:", caseOffset+len(caseClauses)))
		c.Indent(func() {
			c.translateStmtList(defaultClause.Body)
		})
	}

	c.PrintCond(!flatten, "}"+suffix, fmt.Sprintf("case %d:", endCase))
}

func (c *funcContext) translateLoopingStmt(cond func() string, body *ast.BlockStmt, bodyPrefix, post func(), label *types.Label, flatten bool) {
	prevFlowData := c.flowDatas[nil]
	data := &flowData{
		postStmt: post,
	}
	if flatten {
		data.beginCase = c.caseCounter
		data.endCase = c.caseCounter + 1
		c.caseCounter += 2
	}
	c.flowDatas[nil] = data
	c.flowDatas[label] = data
	defer func() {
		delete(c.flowDatas, label)
		c.flowDatas[nil] = prevFlowData
	}()

	if !flatten && label != nil {
		c.Printf("%s:", label.Name())
	}
	c.PrintCond(!flatten, "while (true) {", fmt.Sprintf("case %d:", data.beginCase))
	c.Indent(func() {
		condStr := cond()
		if condStr != "true" {
			c.PrintCond(!flatten, fmt.Sprintf("if (!(%s)) { break; }", condStr), fmt.Sprintf("if(!(%s)) { $s = %d; continue; }", condStr, data.endCase))
		}

		prevEV := c.p.escapingVars
		c.handleEscapingVars(body)

		if bodyPrefix != nil {
			bodyPrefix()
		}
		c.translateStmtList(body.List)
		isTerminated := false
		if len(body.List) != 0 {
			switch body.List[len(body.List)-1].(type) {
			case *ast.ReturnStmt, *ast.BranchStmt:
				isTerminated = true
			}
		}
		if !isTerminated {
			post()
		}

		c.p.escapingVars = prevEV
	})
	c.PrintCond(!flatten, "}", fmt.Sprintf("$s = %d; continue; case %d:", data.beginCase, data.endCase))
}

func (c *funcContext) translateAssign(lhs, rhs ast.Expr, define bool) string {
	lhs = astutil.RemoveParens(lhs)
	if isBlank(lhs) {
		panic("translateAssign with blank lhs")
	}

	if l, ok := lhs.(*ast.IndexExpr); ok {
		if t, ok := c.p.TypeOf(l.X).Underlying().(*types.Map); ok {
			if typesutil.IsJsObject(c.p.TypeOf(l.Index)) {
				c.p.errList = append(c.p.errList, types.Error{Fset: c.p.fileSet, Pos: l.Index.Pos(), Msg: "cannot use js.Object as map key"})
			}
			keyVar := c.newVariable("_key")
			return fmt.Sprintf(`%s = %s; (%s || $throwRuntimeError("assignment to entry in nil map"))[%s.keyFor(%s)] = { k: %s, v: %s };`, keyVar, c.translateImplicitConversionWithCloning(l.Index, t.Key()), c.translateExpr(l.X), c.typeName(t.Key()), keyVar, keyVar, c.translateImplicitConversionWithCloning(rhs, t.Elem()))
		}
	}

	lhsType := c.p.TypeOf(lhs)
	rhsExpr := c.translateImplicitConversion(rhs, lhsType)
	if _, ok := rhs.(*ast.CompositeLit); ok && define {
		return fmt.Sprintf("%s = %s;", c.translateExpr(lhs), rhsExpr) // skip $copy
	}

	isReflectValue := false
	if named, ok := lhsType.(*types.Named); ok && named.Obj().Pkg() != nil && named.Obj().Pkg().Path() == "reflect" && named.Obj().Name() == "Value" {
		isReflectValue = true
	}
	if !isReflectValue { // this is a performance hack, but it is safe since reflect.Value has no exported fields and the reflect package does not violate this assumption
		switch lhsType.Underlying().(type) {
		case *types.Array, *types.Struct:
			if define {
				return fmt.Sprintf("%s = $clone(%s, %s);", c.translateExpr(lhs), rhsExpr, c.typeName(lhsType))
			}
			return fmt.Sprintf("%s.copy(%s, %s);", c.typeName(lhsType), c.translateExpr(lhs), rhsExpr)
		}
	}

	switch l := lhs.(type) {
	case *ast.Ident:
		return fmt.Sprintf("%s = %s;", c.objectName(c.p.ObjectOf(l)), rhsExpr)
	case *ast.SelectorExpr:
		sel, ok := c.p.SelectionOf(l)
		if !ok {
			// qualified identifier
			return fmt.Sprintf("%s = %s;", c.objectName(c.p.Uses[l.Sel]), rhsExpr)
		}
		fields, jsTag := c.translateSelection(sel, l.Pos())
		if jsTag != "" {
			return fmt.Sprintf("%s.%s.%s = %s;", c.translateExpr(l.X), strings.Join(fields, "."), jsTag, c.externalize(rhsExpr.String(), sel.Type()))
		}
		return fmt.Sprintf("%s.%s = %s;", c.translateExpr(l.X), strings.Join(fields, "."), rhsExpr)
	case *ast.StarExpr:
		return fmt.Sprintf("%s.$set(%s);", c.translateExpr(l.X), rhsExpr)
	case *ast.IndexExpr:
		switch t := c.p.TypeOf(l.X).Underlying().(type) {
		case *types.Array, *types.Pointer:
			pattern := rangeCheck("%1e[%2f] = %3s", c.p.Types[l.Index].Value != nil, true)
			if _, ok := t.(*types.Pointer); ok { // check pointer for nil (attribute getter causes a panic)
				pattern = `%1e.nilCheck, ` + pattern
			}
			return c.formatExpr(pattern, l.X, l.Index, rhsExpr).String() + ";"
		case *types.Slice:
			return c.formatExpr(rangeCheck("%1e.$array[%1e.$offset + %2f] = %3s", c.p.Types[l.Index].Value != nil, false), l.X, l.Index, rhsExpr).String() + ";"
		default:
			panic(fmt.Sprintf("Unhandled lhs type: %T\n", t))
		}
	default:
		panic(fmt.Sprintf("Unhandled lhs type: %T\n", l))
	}
}

func (c *funcContext) translateResults(results []ast.Expr) string {
	tuple := c.sig.Results()
	switch tuple.Len() {
	case 0:
		return ""
	case 1:
		result := c.zeroValue(tuple.At(0).Type())
		if results != nil {
			result = results[0]
		}
		v := c.translateImplicitConversion(result, tuple.At(0).Type())
		c.delayedOutput = nil
		return " " + v.String()
	default:
		if len(results) == 1 {
			resultTuple := c.p.TypeOf(results[0]).(*types.Tuple)

			if resultTuple.Len() != tuple.Len() {
				panic("invalid tuple return assignment")
			}

			resultExpr := c.translateExpr(results[0]).String()

			if types.Identical(resultTuple, tuple) {
				return " " + resultExpr
			}

			tmpVar := c.newVariable("_returncast")
			c.Printf("%s = %s;", tmpVar, resultExpr)

			// Not all the return types matched, map everything out for implicit casting
			results = make([]ast.Expr, resultTuple.Len())
			for i := range results {
				results[i] = c.newIdent(fmt.Sprintf("%s[%d]", tmpVar, i), resultTuple.At(i).Type())
			}
		}
		values := make([]string, tuple.Len())
		for i := range values {
			result := c.zeroValue(tuple.At(i).Type())
			if results != nil {
				result = results[i]
			}
			values[i] = c.translateImplicitConversion(result, tuple.At(i).Type()).String()
		}
		c.delayedOutput = nil
		return " [" + strings.Join(values, ", ") + "]"
	}
}

func (c *funcContext) labelCase(label *types.Label) int {
	labelCase, ok := c.labelCases[label]
	if !ok {
		labelCase = c.caseCounter
		c.caseCounter++
		c.labelCases[label] = labelCase
	}
	return labelCase
}
