package dst

// ArrayTypeDecorations holds decorations for ArrayType:
//
// 	type R /*Start*/ [ /*Lbrack*/ 1] /*Len*/ int /*End*/
//
type ArrayTypeDecorations struct {
	NodeDecs
	Lbrack Decorations
	Len    Decorations
}

// AssignStmtDecorations holds decorations for AssignStmt:
//
// 	/*Start*/
// 	i = /*Tok*/ 1 /*End*/
//
type AssignStmtDecorations struct {
	NodeDecs
	Tok Decorations
}

// BadDeclDecorations holds decorations for BadDecl:
//
type BadDeclDecorations struct {
	NodeDecs
}

// BadExprDecorations holds decorations for BadExpr:
//
type BadExprDecorations struct {
	NodeDecs
}

// BadStmtDecorations holds decorations for BadStmt:
//
type BadStmtDecorations struct {
	NodeDecs
}

// BasicLitDecorations holds decorations for BasicLit:
//
type BasicLitDecorations struct {
	NodeDecs
}

// BinaryExprDecorations holds decorations for BinaryExpr:
//
// 	var P = /*Start*/ 1 /*X*/ & /*Op*/ 2 /*End*/
//
type BinaryExprDecorations struct {
	NodeDecs
	X  Decorations
	Op Decorations
}

// BlockStmtDecorations holds decorations for BlockStmt:
//
// 	if true /*Start*/ { /*Lbrace*/
// 		i++
// 	} /*End*/
//
// 	func() /*Start*/ { /*Lbrace*/ i++ } /*End*/ ()
//
type BlockStmtDecorations struct {
	NodeDecs
	Lbrace Decorations
}

// BranchStmtDecorations holds decorations for BranchStmt:
//
// 	/*Start*/
// 	goto /*Tok*/ A /*End*/
//
type BranchStmtDecorations struct {
	NodeDecs
	Tok Decorations
}

// CallExprDecorations holds decorations for CallExpr:
//
// 	var L = /*Start*/ C /*Fun*/ ( /*Lparen*/ 0, []int{}... /*Ellipsis*/) /*End*/
//
type CallExprDecorations struct {
	NodeDecs
	Fun      Decorations
	Lparen   Decorations
	Ellipsis Decorations
}

// CaseClauseDecorations holds decorations for CaseClause:
//
// 	switch i {
// 	/*Start*/ case /*Case*/ 1: /*Colon*/
// 		i++ /*End*/
// 	}
//
type CaseClauseDecorations struct {
	NodeDecs
	Case  Decorations
	Colon Decorations
}

// ChanTypeDecorations holds decorations for ChanType:
//
// 	type W /*Start*/ chan /*Begin*/ int /*End*/
//
// 	type X /*Start*/ <-chan /*Begin*/ int /*End*/
//
// 	type Y /*Start*/ chan /*Begin*/ <- /*Arrow*/ int /*End*/
//
type ChanTypeDecorations struct {
	NodeDecs
	Begin Decorations
	Arrow Decorations
}

// CommClauseDecorations holds decorations for CommClause:
//
// 	select {
// 	/*Start*/ case /*Case*/ a := <-c /*Comm*/ : /*Colon*/
// 		print(a) /*End*/
// 	}
//
type CommClauseDecorations struct {
	NodeDecs
	Case  Decorations
	Comm  Decorations
	Colon Decorations
}

// CompositeLitDecorations holds decorations for CompositeLit:
//
// 	var D = /*Start*/ A /*Type*/ { /*Lbrace*/ A: 0} /*End*/
//
type CompositeLitDecorations struct {
	NodeDecs
	Type   Decorations
	Lbrace Decorations
}

// DeclStmtDecorations holds decorations for DeclStmt:
//
type DeclStmtDecorations struct {
	NodeDecs
}

// DeferStmtDecorations holds decorations for DeferStmt:
//
// 	/*Start*/
// 	defer /*Defer*/ func() {}() /*End*/
//
type DeferStmtDecorations struct {
	NodeDecs
	Defer Decorations
}

// EllipsisDecorations holds decorations for Ellipsis:
//
// 	func B(a /*Start*/ ... /*Ellipsis*/ int /*End*/) {}
//
type EllipsisDecorations struct {
	NodeDecs
	Ellipsis Decorations
}

// EmptyStmtDecorations holds decorations for EmptyStmt:
//
type EmptyStmtDecorations struct {
	NodeDecs
}

// ExprStmtDecorations holds decorations for ExprStmt:
//
type ExprStmtDecorations struct {
	NodeDecs
}

// FieldDecorations holds decorations for Field:
//
// 	type A struct {
// 		/*Start*/ A int /*Type*/ `a:"a"` /*End*/
// 	}
//
type FieldDecorations struct {
	NodeDecs
	Type Decorations
}

// FieldListDecorations holds decorations for FieldList:
//
// 	type A1 struct /*Start*/ { /*Opening*/
// 		a, b int
// 		c    string
// 	} /*End*/
//
type FieldListDecorations struct {
	NodeDecs
	Opening Decorations
}

// FileDecorations holds decorations for File:
//
// 	/*Start*/ package /*Package*/ data /*Name*/
//
type FileDecorations struct {
	NodeDecs
	Package Decorations
	Name    Decorations
}

// ForStmtDecorations holds decorations for ForStmt:
//
// 	/*Start*/
// 	for /*For*/ {
// 		i++
// 	} /*End*/
//
// 	/*Start*/
// 	for /*For*/ i < 1 /*Cond*/ {
// 		i++
// 	} /*End*/
//
// 	/*Start*/
// 	for /*For*/ i = 0; /*Init*/ i < 10; /*Cond*/ i++ /*Post*/ {
// 		i++
// 	} /*End*/
//
type ForStmtDecorations struct {
	NodeDecs
	For  Decorations
	Init Decorations
	Cond Decorations
	Post Decorations
}

// FuncDeclDecorations holds decorations for FuncDecl:
//
// 	/*Start*/
// 	func /*Func*/ d /*Name*/ (d, e int) /*Params*/ {
// 		return
// 	} /*End*/
//
// 	/*Start*/
// 	func /*Func*/ TP /*Name*/ [P any] /*TypeParams*/ (a int) /*Params*/ (b P) /*Results*/ {
// 		return b
// 	} /*End*/
//
// 	/*Start*/
// 	func /*Func*/ (a *A) /*Recv*/ e /*Name*/ (d, e int) /*Params*/ {
// 		return
// 	} /*End*/
//
// 	/*Start*/
// 	func /*Func*/ (a *A) /*Recv*/ f /*Name*/ (d, e int) /*Params*/ (f, g int) /*Results*/ {
// 		return
// 	} /*End*/
//
type FuncDeclDecorations struct {
	NodeDecs
	Func       Decorations
	Recv       Decorations
	Name       Decorations
	TypeParams Decorations
	Params     Decorations
	Results    Decorations
}

// FuncLitDecorations holds decorations for FuncLit:
//
// 	var C = /*Start*/ func(a int, b ...int) (c int) /*Type*/ { return 0 } /*End*/
//
type FuncLitDecorations struct {
	NodeDecs
	Type Decorations
}

// FuncTypeDecorations holds decorations for FuncType:
//
// 	type T /*Start*/ func /*Func*/ (a int) /*Params*/ (b int) /*End*/
//
type FuncTypeDecorations struct {
	NodeDecs
	Func       Decorations
	TypeParams Decorations
	Params     Decorations
}

// GenDeclDecorations holds decorations for GenDecl:
//
// 	/*Start*/
// 	const /*Tok*/ ( /*Lparen*/
// 		a, b = 1, 2
// 		c    = 3
// 	) /*End*/
//
// 	/*Start*/
// 	const /*Tok*/ d = 1 /*End*/
//
type GenDeclDecorations struct {
	NodeDecs
	Tok    Decorations
	Lparen Decorations
}

// GoStmtDecorations holds decorations for GoStmt:
//
// 	/*Start*/
// 	go /*Go*/ func() {}() /*End*/
//
type GoStmtDecorations struct {
	NodeDecs
	Go Decorations
}

// IdentDecorations holds decorations for Ident:
//
// 	/*Start*/
// 	i /*End*/ ++
//
// 	/*Start*/
// 	fmt. /*X*/ Print /*End*/ ()
//
type IdentDecorations struct {
	NodeDecs
	X Decorations
}

// IfStmtDecorations holds decorations for IfStmt:
//
// 	/*Start*/
// 	if /*If*/ a := b; /*Init*/ a /*Cond*/ {
// 		i++
// 	} else /*Else*/ {
// 		i++
// 	} /*End*/
//
type IfStmtDecorations struct {
	NodeDecs
	If   Decorations
	Init Decorations
	Cond Decorations
	Else Decorations
}

// ImportSpecDecorations holds decorations for ImportSpec:
//
// 	import (
// 		/*Start*/ fmt /*Name*/ "fmt" /*End*/
// 	)
//
type ImportSpecDecorations struct {
	NodeDecs
	Name Decorations
}

// IncDecStmtDecorations holds decorations for IncDecStmt:
//
// 	/*Start*/
// 	i /*X*/ ++ /*End*/
//
type IncDecStmtDecorations struct {
	NodeDecs
	X Decorations
}

// IndexExprDecorations holds decorations for IndexExpr:
//
// 	var G = /*Start*/ []int{0} /*X*/ [ /*Lbrack*/ 0 /*Index*/] /*End*/
//
type IndexExprDecorations struct {
	NodeDecs
	X      Decorations
	Lbrack Decorations
	Index  Decorations
}

// IndexListExprDecorations holds decorations for IndexListExpr:
//
// 	var T4 /*Start*/ T3 /*X*/ [ /*Lbrack*/ int, string /*Indices*/] /*End*/
//
type IndexListExprDecorations struct {
	NodeDecs
	X       Decorations
	Lbrack  Decorations
	Indices Decorations
}

// InterfaceTypeDecorations holds decorations for InterfaceType:
//
// 	type U /*Start*/ interface /*Interface*/ {
// 		A()
// 	} /*End*/
//
type InterfaceTypeDecorations struct {
	NodeDecs
	Interface Decorations
}

// KeyValueExprDecorations holds decorations for KeyValueExpr:
//
// 	var Q = map[string]string{
// 		/*Start*/ "a" /*Key*/ : /*Colon*/ "a", /*End*/
// 	}
//
type KeyValueExprDecorations struct {
	NodeDecs
	Key   Decorations
	Colon Decorations
}

// LabeledStmtDecorations holds decorations for LabeledStmt:
//
// 	/*Start*/
// 	A /*Label*/ : /*Colon*/
// 		print("Stmt") /*End*/
//
type LabeledStmtDecorations struct {
	NodeDecs
	Label Decorations
	Colon Decorations
}

// MapTypeDecorations holds decorations for MapType:
//
// 	type V /*Start*/ map[ /*Map*/ int] /*Key*/ int /*End*/
//
type MapTypeDecorations struct {
	NodeDecs
	Map Decorations
	Key Decorations
}

// PackageDecorations holds decorations for Package:
//
type PackageDecorations struct {
	NodeDecs
}

// ParenExprDecorations holds decorations for ParenExpr:
//
// 	var E = /*Start*/ ( /*Lparen*/ 1 + 1 /*X*/) /*End*/ / 2
//
type ParenExprDecorations struct {
	NodeDecs
	Lparen Decorations
	X      Decorations
}

// RangeStmtDecorations holds decorations for RangeStmt:
//
// 	/*Start*/
// 	for range /*Range*/ a /*X*/ {
// 	} /*End*/
//
// 	/*Start*/
// 	for /*For*/ k /*Key*/ := range /*Range*/ a /*X*/ {
// 		print(k)
// 	} /*End*/
//
// 	/*Start*/
// 	for /*For*/ k /*Key*/, v /*Value*/ := range /*Range*/ a /*X*/ {
// 		print(k, v)
// 	} /*End*/
//
type RangeStmtDecorations struct {
	NodeDecs
	For   Decorations
	Key   Decorations
	Value Decorations
	Range Decorations
	X     Decorations
}

// ReturnStmtDecorations holds decorations for ReturnStmt:
//
// 	func() int {
// 		/*Start*/ return /*Return*/ 1 /*End*/
// 	}()
//
type ReturnStmtDecorations struct {
	NodeDecs
	Return Decorations
}

// SelectStmtDecorations holds decorations for SelectStmt:
//
// 	/*Start*/
// 	select /*Select*/ {
// 	} /*End*/
//
type SelectStmtDecorations struct {
	NodeDecs
	Select Decorations
}

// SelectorExprDecorations holds decorations for SelectorExpr:
//
// 	var F = /*Start*/ tt. /*X*/ F /*End*/ ()
//
type SelectorExprDecorations struct {
	NodeDecs
	X Decorations
}

// SendStmtDecorations holds decorations for SendStmt:
//
// 	/*Start*/
// 	c /*Chan*/ <- /*Arrow*/ 0 /*End*/
//
type SendStmtDecorations struct {
	NodeDecs
	Chan  Decorations
	Arrow Decorations
}

// SliceExprDecorations holds decorations for SliceExpr:
//
// 	var H = /*Start*/ []int{0, 1, 2} /*X*/ [ /*Lbrack*/ 1: /*Low*/ 2: /*High*/ 3 /*Max*/] /*End*/
//
// 	var H1 = /*Start*/ []int{0, 1, 2} /*X*/ [ /*Lbrack*/ 1: /*Low*/ 2 /*High*/] /*End*/
//
// 	var H2 = /*Start*/ []int{0} /*X*/ [: /*Low*/] /*End*/
//
// 	var H3 = /*Start*/ []int{0} /*X*/ [ /*Lbrack*/ 1: /*Low*/] /*End*/
//
// 	var H4 = /*Start*/ []int{0, 1, 2} /*X*/ [: /*Low*/ 2 /*High*/] /*End*/
//
// 	var H5 = /*Start*/ []int{0, 1, 2} /*X*/ [: /*Low*/ 2: /*High*/ 3 /*Max*/] /*End*/
//
type SliceExprDecorations struct {
	NodeDecs
	X      Decorations
	Lbrack Decorations
	Low    Decorations
	High   Decorations
	Max    Decorations
}

// StarExprDecorations holds decorations for StarExpr:
//
// 	var N = /*Start*/ * /*Star*/ p /*End*/
//
type StarExprDecorations struct {
	NodeDecs
	Star Decorations
}

// StructTypeDecorations holds decorations for StructType:
//
// 	type S /*Start*/ struct /*Struct*/ {
// 		A int
// 	} /*End*/
//
type StructTypeDecorations struct {
	NodeDecs
	Struct Decorations
}

// SwitchStmtDecorations holds decorations for SwitchStmt:
//
// 	/*Start*/
// 	switch /*Switch*/ i /*Tag*/ {
// 	} /*End*/
//
// 	/*Start*/
// 	switch /*Switch*/ a := i; /*Init*/ a /*Tag*/ {
// 	} /*End*/
//
type SwitchStmtDecorations struct {
	NodeDecs
	Switch Decorations
	Init   Decorations
	Tag    Decorations
}

// TypeAssertExprDecorations holds decorations for TypeAssertExpr:
//
// 	var J = /*Start*/ f. /*X*/ ( /*Lparen*/ int /*Type*/) /*End*/
//
type TypeAssertExprDecorations struct {
	NodeDecs
	X      Decorations
	Lparen Decorations
	Type   Decorations
}

// TypeSpecDecorations holds decorations for TypeSpec:
//
// 	type (
// 		/*Start*/ T1 /*Name*/ []int /*End*/
// 	)
//
// 	type (
// 		/*Start*/ T2 = /*Name*/ T1 /*End*/
// 	)
//
// 	type (
// 		/*Start*/ T3 /*Name*/ [P any, Q any] /*TypeParams*/ []P /*End*/
// 	)
//
type TypeSpecDecorations struct {
	NodeDecs
	Name       Decorations
	TypeParams Decorations
}

// TypeSwitchStmtDecorations holds decorations for TypeSwitchStmt:
//
// 	/*Start*/
// 	switch /*Switch*/ f.(type) /*Assign*/ {
// 	} /*End*/
//
// 	/*Start*/
// 	switch /*Switch*/ g := f.(type) /*Assign*/ {
// 	case int:
// 		print(g)
// 	} /*End*/
//
// 	/*Start*/
// 	switch /*Switch*/ g := f; /*Init*/ g := g.(type) /*Assign*/ {
// 	case int:
// 		print(g)
// 	} /*End*/
//
type TypeSwitchStmtDecorations struct {
	NodeDecs
	Switch Decorations
	Init   Decorations
	Assign Decorations
}

// UnaryExprDecorations holds decorations for UnaryExpr:
//
// 	var O = /*Start*/ ^ /*Op*/ 1 /*End*/
//
type UnaryExprDecorations struct {
	NodeDecs
	Op Decorations
}

// ValueSpecDecorations holds decorations for ValueSpec:
//
// 	var (
// 		/*Start*/ j = /*Assign*/ 1 /*End*/
// 	)
//
// 	var (
// 		/*Start*/ k, l = /*Assign*/ 1, 2 /*End*/
// 	)
//
// 	var (
// 		/*Start*/ m, n int = /*Assign*/ 1, 2 /*End*/
// 	)
//
type ValueSpecDecorations struct {
	NodeDecs
	Assign Decorations
}
