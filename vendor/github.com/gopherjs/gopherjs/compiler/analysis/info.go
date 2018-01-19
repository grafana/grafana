package analysis

import (
	"go/ast"
	"go/token"
	"go/types"

	"github.com/gopherjs/gopherjs/compiler/astutil"
	"github.com/gopherjs/gopherjs/compiler/typesutil"
)

type continueStmt struct {
	forStmt      *ast.ForStmt
	analyzeStack []ast.Node
}

type Info struct {
	*types.Info
	Pkg           *types.Package
	IsBlocking    func(*types.Func) bool
	HasPointer    map[*types.Var]bool
	FuncDeclInfos map[*types.Func]*FuncInfo
	FuncLitInfos  map[*ast.FuncLit]*FuncInfo
	InitFuncInfo  *FuncInfo
	allInfos      []*FuncInfo
	comments      ast.CommentMap
}

type FuncInfo struct {
	HasDefer      bool
	Flattened     map[ast.Node]bool
	Blocking      map[ast.Node]bool
	GotoLabel     map[*types.Label]bool
	LocalCalls    map[*types.Func][][]ast.Node
	ContinueStmts []continueStmt
	p             *Info
	analyzeStack  []ast.Node
}

func (info *Info) newFuncInfo() *FuncInfo {
	funcInfo := &FuncInfo{
		p:          info,
		Flattened:  make(map[ast.Node]bool),
		Blocking:   make(map[ast.Node]bool),
		GotoLabel:  make(map[*types.Label]bool),
		LocalCalls: make(map[*types.Func][][]ast.Node),
	}
	info.allInfos = append(info.allInfos, funcInfo)
	return funcInfo
}

func AnalyzePkg(files []*ast.File, fileSet *token.FileSet, typesInfo *types.Info, typesPkg *types.Package, isBlocking func(*types.Func) bool) *Info {
	info := &Info{
		Info:          typesInfo,
		Pkg:           typesPkg,
		HasPointer:    make(map[*types.Var]bool),
		comments:      make(ast.CommentMap),
		IsBlocking:    isBlocking,
		FuncDeclInfos: make(map[*types.Func]*FuncInfo),
		FuncLitInfos:  make(map[*ast.FuncLit]*FuncInfo),
	}
	info.InitFuncInfo = info.newFuncInfo()

	for _, file := range files {
		for k, v := range ast.NewCommentMap(fileSet, file, file.Comments) {
			info.comments[k] = v
		}
		ast.Walk(info.InitFuncInfo, file)
	}

	for {
		done := true
		for _, funcInfo := range info.allInfos {
			for obj, calls := range funcInfo.LocalCalls {
				if len(info.FuncDeclInfos[obj].Blocking) != 0 {
					for _, call := range calls {
						funcInfo.markBlocking(call)
					}
					delete(funcInfo.LocalCalls, obj)
					done = false
				}
			}
		}
		if done {
			break
		}
	}

	for _, funcInfo := range info.allInfos {
		for _, continueStmt := range funcInfo.ContinueStmts {
			if funcInfo.Blocking[continueStmt.forStmt.Post] {
				funcInfo.markBlocking(continueStmt.analyzeStack)
			}
		}
	}

	return info
}

func (c *FuncInfo) Visit(node ast.Node) ast.Visitor {
	if node == nil {
		if len(c.analyzeStack) != 0 {
			c.analyzeStack = c.analyzeStack[:len(c.analyzeStack)-1]
		}
		return nil
	}
	c.analyzeStack = append(c.analyzeStack, node)

	switch n := node.(type) {
	case *ast.FuncDecl:
		newInfo := c.p.newFuncInfo()
		c.p.FuncDeclInfos[c.p.Defs[n.Name].(*types.Func)] = newInfo
		return newInfo
	case *ast.FuncLit:
		newInfo := c.p.newFuncInfo()
		c.p.FuncLitInfos[n] = newInfo
		return newInfo
	case *ast.BranchStmt:
		switch n.Tok {
		case token.GOTO:
			for _, n2 := range c.analyzeStack {
				c.Flattened[n2] = true
			}
			c.GotoLabel[c.p.Uses[n.Label].(*types.Label)] = true
		case token.CONTINUE:
			if n.Label != nil {
				label := c.p.Uses[n.Label].(*types.Label)
				for i := len(c.analyzeStack) - 1; i >= 0; i-- {
					if labelStmt, ok := c.analyzeStack[i].(*ast.LabeledStmt); ok && c.p.Defs[labelStmt.Label] == label {
						if _, ok := labelStmt.Stmt.(*ast.RangeStmt); ok {
							return nil
						}
						stack := make([]ast.Node, len(c.analyzeStack))
						copy(stack, c.analyzeStack)
						c.ContinueStmts = append(c.ContinueStmts, continueStmt{labelStmt.Stmt.(*ast.ForStmt), stack})
						return nil
					}
				}
				return nil
			}
			for i := len(c.analyzeStack) - 1; i >= 0; i-- {
				if _, ok := c.analyzeStack[i].(*ast.RangeStmt); ok {
					return nil
				}
				if forStmt, ok := c.analyzeStack[i].(*ast.ForStmt); ok {
					stack := make([]ast.Node, len(c.analyzeStack))
					copy(stack, c.analyzeStack)
					c.ContinueStmts = append(c.ContinueStmts, continueStmt{forStmt, stack})
					return nil
				}
			}
		}
	case *ast.CallExpr:
		callTo := func(obj types.Object) {
			switch o := obj.(type) {
			case *types.Func:
				if recv := o.Type().(*types.Signature).Recv(); recv != nil {
					if _, ok := recv.Type().Underlying().(*types.Interface); ok {
						c.markBlocking(c.analyzeStack)
						return
					}
				}
				if o.Pkg() != c.p.Pkg {
					if c.p.IsBlocking(o) {
						c.markBlocking(c.analyzeStack)
					}
					return
				}
				stack := make([]ast.Node, len(c.analyzeStack))
				copy(stack, c.analyzeStack)
				c.LocalCalls[o] = append(c.LocalCalls[o], stack)
			case *types.Var:
				c.markBlocking(c.analyzeStack)
			}
		}
		switch f := astutil.RemoveParens(n.Fun).(type) {
		case *ast.Ident:
			callTo(c.p.Uses[f])
		case *ast.SelectorExpr:
			if sel := c.p.Selections[f]; sel != nil && typesutil.IsJsObject(sel.Recv()) {
				break
			}
			callTo(c.p.Uses[f.Sel])
		case *ast.FuncLit:
			ast.Walk(c, n.Fun)
			for _, arg := range n.Args {
				ast.Walk(c, arg)
			}
			if len(c.p.FuncLitInfos[f].Blocking) != 0 {
				c.markBlocking(c.analyzeStack)
			}
			return nil
		default:
			if !astutil.IsTypeExpr(f, c.p.Info) {
				c.markBlocking(c.analyzeStack)
			}
		}
	case *ast.SendStmt:
		c.markBlocking(c.analyzeStack)
	case *ast.UnaryExpr:
		switch n.Op {
		case token.AND:
			if id, ok := astutil.RemoveParens(n.X).(*ast.Ident); ok {
				c.p.HasPointer[c.p.Uses[id].(*types.Var)] = true
			}
		case token.ARROW:
			c.markBlocking(c.analyzeStack)
		}
	case *ast.RangeStmt:
		if _, ok := c.p.TypeOf(n.X).Underlying().(*types.Chan); ok {
			c.markBlocking(c.analyzeStack)
		}
	case *ast.SelectStmt:
		for _, s := range n.Body.List {
			if s.(*ast.CommClause).Comm == nil { // default clause
				return c
			}
		}
		c.markBlocking(c.analyzeStack)
	case *ast.CommClause:
		switch comm := n.Comm.(type) {
		case *ast.SendStmt:
			ast.Walk(c, comm.Chan)
			ast.Walk(c, comm.Value)
		case *ast.ExprStmt:
			ast.Walk(c, comm.X.(*ast.UnaryExpr).X)
		case *ast.AssignStmt:
			ast.Walk(c, comm.Rhs[0].(*ast.UnaryExpr).X)
		}
		for _, s := range n.Body {
			ast.Walk(c, s)
		}
		return nil
	case *ast.GoStmt:
		ast.Walk(c, n.Call.Fun)
		for _, arg := range n.Call.Args {
			ast.Walk(c, arg)
		}
		return nil
	case *ast.DeferStmt:
		c.HasDefer = true
		if funcLit, ok := n.Call.Fun.(*ast.FuncLit); ok {
			ast.Walk(c, funcLit.Body)
		}
	}
	return c
}

func (c *FuncInfo) markBlocking(stack []ast.Node) {
	for _, n := range stack {
		c.Blocking[n] = true
		c.Flattened[n] = true
	}
}
