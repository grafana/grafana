// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package dst declares the types used to represent decorated syntax
// trees for Go packages.
package dst

import (
	"go/token"
)

// ----------------------------------------------------------------------------
// Interfaces
//
// There are 3 main classes of nodes: Expressions and type nodes,
// statement nodes, and declaration nodes. The node names usually
// match the corresponding Go spec production names to which they
// correspond. The node fields correspond to the individual parts
// of the respective productions.
//
// All nodes contain position information marking the beginning of
// the corresponding source text segment; it is accessible via the
// Pos accessor method. Nodes may contain additional position info
// for language constructs where comments may be found between parts
// of the construct (typically any larger, parenthesized subpart).
// That position information is needed to properly position comments
// when printing the construct.

// Node is satisfied by all nodes types.
type Node interface {
	// Decorations returns the common Node decorations (Before, After, Start, End). This returns nil for Package nodes.
	Decorations() *NodeDecs
}

// All expression nodes implement the Expr interface.
type Expr interface {
	Node
	exprNode()
}

// All statement nodes implement the Stmt interface.
type Stmt interface {
	Node
	stmtNode()
}

// All declaration nodes implement the Decl interface.
type Decl interface {
	Node
	declNode()
}

// ----------------------------------------------------------------------------
// Expressions and types

// A Field represents a Field declaration list in a struct type,
// a method list in an interface type, or a parameter/result declaration
// in a signature.
// Field.Names is nil for unnamed parameters (parameter lists which only contain types)
// and embedded struct fields. In the latter case, the field name is the type name.
//
type Field struct {
	Names []*Ident  // field/method/(type) parameter names; or nil
	Type  Expr      // field/method/parameter type; or nil
	Tag   *BasicLit // field tag; or nil
	Decs  FieldDecorations
}

// A FieldList represents a list of Fields, enclosed by parentheses,
// curly braces, or square brackets.
type FieldList struct {
	Opening bool
	List    []*Field // field list; or nil
	Closing bool
	Decs    FieldListDecorations
}

// NumFields returns the number of parameters or struct fields represented by a FieldList.
func (f *FieldList) NumFields() int {
	n := 0
	if f != nil {
		for _, g := range f.List {
			m := len(g.Names)
			if m == 0 {
				m = 1
			}
			n += m
		}
	}
	return n
}

// An expression is represented by a tree consisting of one
// or more of the following concrete expression nodes.
type (
	// A BadExpr node is a placeholder for an expression containing
	// syntax errors for which a correct expression node cannot be
	// created.
	BadExpr struct {
		Length int // position range of bad expression
		Decs   BadExprDecorations
	}

	// An Ident node represents an identifier.
	Ident struct {
		Name string  // identifier name
		Obj  *Object // denoted object; or nil
		Path string  // path of the imported package, if this identifier is not local
		Decs IdentDecorations
	}

	// An Ellipsis node stands for the "..." type in a
	// parameter list or the "..." length in an array type.
	//
	Ellipsis struct {
		Elt  Expr // ellipsis element type (parameter lists only); or nil
		Decs EllipsisDecorations
	}

	// A BasicLit node represents a literal of basic type.
	BasicLit struct {
		Kind  token.Token // token.INT, token.FLOAT, token.IMAG, token.CHAR, or token.STRING
		Value string      // literal string; e.g. 42, 0x7f, 3.14, 1e-9, 2.4i, 'a', '\x7f', "foo" or `\m\n\o`
		Decs  BasicLitDecorations
	}

	// A FuncLit node represents a function literal.
	FuncLit struct {
		Type *FuncType  // function type
		Body *BlockStmt // function body
		Decs FuncLitDecorations
	}

	// A CompositeLit node represents a composite literal.
	CompositeLit struct {
		Type       Expr   // literal type; or nil
		Elts       []Expr // list of composite elements; or nil
		Incomplete bool   // true if (source) expressions are missing in the Elts list
		Decs       CompositeLitDecorations
	}

	// A ParenExpr node represents a parenthesized expression.
	ParenExpr struct {
		X    Expr // parenthesized expression
		Decs ParenExprDecorations
	}

	// A SelectorExpr node represents an expression followed by a selector.
	SelectorExpr struct {
		X    Expr   // expression
		Sel  *Ident // field selector
		Decs SelectorExprDecorations
	}

	// An IndexExpr node represents an expression followed by an index.
	IndexExpr struct {
		X     Expr // expression
		Index Expr // index expression
		Decs  IndexExprDecorations
	}

	// An IndexListExpr node represents an expression followed by multiple
	// indices.
	IndexListExpr struct {
		X       Expr // expression
		Indices []Expr
		Decs    IndexListExprDecorations
	}

	// An SliceExpr node represents an expression followed by slice indices.
	SliceExpr struct {
		X      Expr // expression
		Low    Expr // begin of slice range; or nil
		High   Expr // end of slice range; or nil
		Max    Expr // maximum capacity of slice; or nil
		Slice3 bool // true if 3-index slice (2 colons present)
		Decs   SliceExprDecorations
	}

	// A TypeAssertExpr node represents an expression followed by a
	// type assertion.
	//
	TypeAssertExpr struct {
		X    Expr // expression
		Type Expr // asserted type; nil means type switch X.(type)
		Decs TypeAssertExprDecorations
	}

	// A CallExpr node represents an expression followed by an argument list.
	CallExpr struct {
		Fun      Expr   // function expression
		Args     []Expr // function arguments; or nil
		Ellipsis bool
		Decs     CallExprDecorations
	}

	// A StarExpr node represents an expression of the form "*" Expression.
	// Semantically it could be a unary "*" expression, or a pointer type.
	//
	StarExpr struct {
		X    Expr // operand
		Decs StarExprDecorations
	}

	// A UnaryExpr node represents a unary expression.
	// Unary "*" expressions are represented via StarExpr nodes.
	//
	UnaryExpr struct {
		Op   token.Token // operator
		X    Expr        // operand
		Decs UnaryExprDecorations
	}

	// A BinaryExpr node represents a binary expression.
	BinaryExpr struct {
		X    Expr        // left operand
		Op   token.Token // operator
		Y    Expr        // right operand
		Decs BinaryExprDecorations
	}

	// A KeyValueExpr node represents (key : value) pairs
	// in composite literals.
	//
	KeyValueExpr struct {
		Key   Expr
		Value Expr
		Decs  KeyValueExprDecorations
	}
)

// The direction of a channel type is indicated by a bit
// mask including one or both of the following constants.
type ChanDir int

const (
	SEND ChanDir = 1 << iota
	RECV
)

// A type is represented by a tree consisting of one
// or more of the following type-specific expression
// nodes.
type (
	// An ArrayType node represents an array or slice type.
	ArrayType struct {
		Len  Expr // Ellipsis node for [...]T array types, nil for slice types
		Elt  Expr // element type
		Decs ArrayTypeDecorations
	}

	// A StructType node represents a struct type.
	StructType struct {
		Fields     *FieldList // list of field declarations
		Incomplete bool       // true if (source) fields are missing in the Fields list
		Decs       StructTypeDecorations
	}

	// Pointer types are represented via StarExpr nodes.

	// A FuncType node represents a function type.
	FuncType struct {
		Func       bool
		TypeParams *FieldList // type parameters; or nil
		Params     *FieldList // (incoming) parameters; non-nil
		Results    *FieldList // (outgoing) results; or nil
		Decs       FuncTypeDecorations
	}

	// An InterfaceType node represents an interface type.
	InterfaceType struct {
		Methods    *FieldList // list of embedded interfaces, methods, or types
		Incomplete bool       // true if (source) methods or types are missing in the Methods list
		Decs       InterfaceTypeDecorations
	}

	// A MapType node represents a map type.
	MapType struct {
		Key   Expr
		Value Expr
		Decs  MapTypeDecorations
	}

	// A ChanType node represents a channel type.
	ChanType struct {
		Dir   ChanDir // channel direction
		Value Expr    // value type
		Decs  ChanTypeDecorations
	}
)

// exprNode() ensures that only expression/type nodes can be
// assigned to an Expr.
func (*BadExpr) exprNode()        {}
func (*Ident) exprNode()          {}
func (*Ellipsis) exprNode()       {}
func (*BasicLit) exprNode()       {}
func (*FuncLit) exprNode()        {}
func (*CompositeLit) exprNode()   {}
func (*ParenExpr) exprNode()      {}
func (*SelectorExpr) exprNode()   {}
func (*IndexExpr) exprNode()      {}
func (*IndexListExpr) exprNode()  {}
func (*SliceExpr) exprNode()      {}
func (*TypeAssertExpr) exprNode() {}
func (*CallExpr) exprNode()       {}
func (*StarExpr) exprNode()       {}
func (*UnaryExpr) exprNode()      {}
func (*BinaryExpr) exprNode()     {}
func (*KeyValueExpr) exprNode()   {}

func (*ArrayType) exprNode()     {}
func (*StructType) exprNode()    {}
func (*FuncType) exprNode()      {}
func (*InterfaceType) exprNode() {}
func (*MapType) exprNode()       {}
func (*ChanType) exprNode()      {}

// ----------------------------------------------------------------------------
// Convenience functions for Idents

// NewIdent creates a new Ident without position.
// Useful for ASTs generated by code other than the Go parser.
func NewIdent(name string) *Ident { return &Ident{name, nil, "", IdentDecorations{}} }

// IsExported reports whether name starts with an upper-case letter.
func IsExported(name string) bool { return token.IsExported(name) }

// IsExported reports whether id starts with an upper-case letter.
func (id *Ident) IsExported() bool { return token.IsExported(id.Name) }

func (id *Ident) String() string {
	if id != nil {
		if id.Path != "" {
			return id.Path + "." + id.Name
		}
		return id.Name
	}
	return "<nil>"
}

// ----------------------------------------------------------------------------
// Statements

// A statement is represented by a tree consisting of one
// or more of the following concrete statement nodes.
type (
	// A BadStmt node is a placeholder for statements containing
	// syntax errors for which no correct statement nodes can be
	// created.
	//
	BadStmt struct {
		Length int // position range of bad statement
		Decs   BadStmtDecorations
	}

	// A DeclStmt node represents a declaration in a statement list.
	DeclStmt struct {
		Decl Decl // *GenDecl with CONST, TYPE, or VAR token
		Decs DeclStmtDecorations
	}

	// An EmptyStmt node represents an empty statement.
	// The "position" of the empty statement is the position
	// of the immediately following (explicit or implicit) semicolon.
	//
	EmptyStmt struct {
		Implicit bool // if set, ";" was omitted in the source
		Decs     EmptyStmtDecorations
	}

	// A LabeledStmt node represents a labeled statement.
	LabeledStmt struct {
		Label *Ident
		Stmt  Stmt
		Decs  LabeledStmtDecorations
	}

	// An ExprStmt node represents a (stand-alone) expression
	// in a statement list.
	//
	ExprStmt struct {
		X    Expr // expression
		Decs ExprStmtDecorations
	}

	// A SendStmt node represents a send statement.
	SendStmt struct {
		Chan  Expr
		Value Expr
		Decs  SendStmtDecorations
	}

	// An IncDecStmt node represents an increment or decrement statement.
	IncDecStmt struct {
		X    Expr
		Tok  token.Token // INC or DEC
		Decs IncDecStmtDecorations
	}

	// An AssignStmt node represents an assignment or
	// a short variable declaration.
	//
	AssignStmt struct {
		Lhs  []Expr
		Tok  token.Token // assignment token, DEFINE
		Rhs  []Expr
		Decs AssignStmtDecorations
	}

	// A GoStmt node represents a go statement.
	GoStmt struct {
		Call *CallExpr
		Decs GoStmtDecorations
	}

	// A DeferStmt node represents a defer statement.
	DeferStmt struct {
		Call *CallExpr
		Decs DeferStmtDecorations
	}

	// A ReturnStmt node represents a return statement.
	ReturnStmt struct {
		Results []Expr // result expressions; or nil
		Decs    ReturnStmtDecorations
	}

	// A BranchStmt node represents a break, continue, goto,
	// or fallthrough statement.
	//
	BranchStmt struct {
		Tok   token.Token // keyword token (BREAK, CONTINUE, GOTO, FALLTHROUGH)
		Label *Ident      // label name; or nil
		Decs  BranchStmtDecorations
	}

	// A BlockStmt node represents a braced statement list.
	BlockStmt struct {
		List           []Stmt
		RbraceHasNoPos bool // Rbrace may be absent due to syntax error, so we duplicate this in the output for compatibility.
		Decs           BlockStmtDecorations
	}

	// An IfStmt node represents an if statement.
	IfStmt struct {
		Init Stmt // initialization statement; or nil
		Cond Expr // condition
		Body *BlockStmt
		Else Stmt // else branch; or nil
		Decs IfStmtDecorations
	}

	// A CaseClause represents a case of an expression or type switch statement.
	CaseClause struct {
		List []Expr // list of expressions or types; nil means default case
		Body []Stmt // statement list; or nil
		Decs CaseClauseDecorations
	}

	// A SwitchStmt node represents an expression switch statement.
	SwitchStmt struct {
		Init Stmt       // initialization statement; or nil
		Tag  Expr       // tag expression; or nil
		Body *BlockStmt // CaseClauses only
		Decs SwitchStmtDecorations
	}

	// A TypeSwitchStmt node represents a type switch statement.
	TypeSwitchStmt struct {
		Init   Stmt       // initialization statement; or nil
		Assign Stmt       // x := y.(type) or y.(type)
		Body   *BlockStmt // CaseClauses only
		Decs   TypeSwitchStmtDecorations
	}

	// A CommClause node represents a case of a select statement.
	CommClause struct {
		Comm Stmt   // send or receive statement; nil means default case
		Body []Stmt // statement list; or nil
		Decs CommClauseDecorations
	}

	// A SelectStmt node represents a select statement.
	SelectStmt struct {
		Body *BlockStmt // CommClauses only
		Decs SelectStmtDecorations
	}

	// A ForStmt represents a for statement.
	ForStmt struct {
		Init Stmt // initialization statement; or nil
		Cond Expr // condition; or nil
		Post Stmt // post iteration statement; or nil
		Body *BlockStmt
		Decs ForStmtDecorations
	}

	// A RangeStmt represents a for statement with a range clause.
	RangeStmt struct {
		Key, Value Expr        // Key, Value may be nil
		Tok        token.Token // ILLEGAL if Key == nil, ASSIGN, DEFINE
		X          Expr        // value to range over
		Body       *BlockStmt
		Decs       RangeStmtDecorations
	}
)

// stmtNode() ensures that only statement nodes can be
// assigned to a Stmt.
func (*BadStmt) stmtNode()        {}
func (*DeclStmt) stmtNode()       {}
func (*EmptyStmt) stmtNode()      {}
func (*LabeledStmt) stmtNode()    {}
func (*ExprStmt) stmtNode()       {}
func (*SendStmt) stmtNode()       {}
func (*IncDecStmt) stmtNode()     {}
func (*AssignStmt) stmtNode()     {}
func (*GoStmt) stmtNode()         {}
func (*DeferStmt) stmtNode()      {}
func (*ReturnStmt) stmtNode()     {}
func (*BranchStmt) stmtNode()     {}
func (*BlockStmt) stmtNode()      {}
func (*IfStmt) stmtNode()         {}
func (*CaseClause) stmtNode()     {}
func (*SwitchStmt) stmtNode()     {}
func (*TypeSwitchStmt) stmtNode() {}
func (*CommClause) stmtNode()     {}
func (*SelectStmt) stmtNode()     {}
func (*ForStmt) stmtNode()        {}
func (*RangeStmt) stmtNode()      {}

// ----------------------------------------------------------------------------
// Declarations

// A Spec node represents a single (non-parenthesized) import,
// constant, type, or variable declaration.
type (
	// The Spec type stands for any of *ImportSpec, *ValueSpec, and *TypeSpec.
	Spec interface {
		Node
		specNode()
	}

	// An ImportSpec node represents a single package import.
	ImportSpec struct {
		Name *Ident    // local package name (including "."); or nil
		Path *BasicLit // import path
		Decs ImportSpecDecorations
	}

	// A ValueSpec node represents a constant or variable declaration
	// (ConstSpec or VarSpec production).
	//
	ValueSpec struct {
		Names  []*Ident // value names (len(Names) > 0)
		Type   Expr     // value type; or nil
		Values []Expr   // initial values; or nil
		Decs   ValueSpecDecorations
	}

	// A TypeSpec node represents a type declaration (TypeSpec production).
	TypeSpec struct {
		Name       *Ident     // type name
		TypeParams *FieldList // type parameters; or nil
		Assign     bool       // position of '=', if any
		Type       Expr       // *Ident, *ParenExpr, *SelectorExpr, *StarExpr, or any of the *XxxTypes
		Decs       TypeSpecDecorations
	}
)

// Pos and End implementations for spec nodes.

// specNode() ensures that only spec nodes can be
// assigned to a Spec.
func (*ImportSpec) specNode() {}
func (*ValueSpec) specNode()  {}
func (*TypeSpec) specNode()   {}

// A declaration is represented by one of the following declaration nodes.
type (
	// A BadDecl node is a placeholder for a declaration containing
	// syntax errors for which a correct declaration node cannot be
	// created.
	//
	BadDecl struct {
		Length int // position range of bad declaration
		Decs   BadDeclDecorations
	}

	// A GenDecl node (generic declaration node) represents an import,
	// constant, type or variable declaration. A valid Lparen position
	// (Lparen.IsValid()) indicates a parenthesized declaration.
	//
	// Relationship between Tok value and Specs element type:
	//
	//	token.IMPORT  *ImportSpec
	//	token.CONST   *ValueSpec
	//	token.TYPE    *TypeSpec
	//	token.VAR     *ValueSpec
	//
	GenDecl struct {
		Tok    token.Token // IMPORT, CONST, TYPE, or VAR
		Lparen bool
		Specs  []Spec
		Rparen bool
		Decs   GenDeclDecorations
	}

	// A FuncDecl node represents a function declaration.
	FuncDecl struct {
		Recv *FieldList // receiver (methods); or nil (functions)
		Name *Ident     // function/method name
		Type *FuncType  // function signature: type and value parameters, results, and position of "func" keyword
		Body *BlockStmt // function body; or nil for external (non-Go) function
		Decs FuncDeclDecorations
	}
)

// declNode() ensures that only declaration nodes can be
// assigned to a Decl.
func (*BadDecl) declNode()  {}
func (*GenDecl) declNode()  {}
func (*FuncDecl) declNode() {}

// ----------------------------------------------------------------------------
// Files and packages

// A File node represents a Go source file.
//
// The Comments list contains all comments in the source file in order of
// appearance, including the comments that are pointed to from other nodes
// via Doc and Comment fields.
//
// For correct printing of source code containing comments (using packages
// go/format and go/printer), special care must be taken to update comments
// when a File's syntax tree is modified: For printing, comments are interspersed
// between tokens based on their position. If syntax tree nodes are
// removed or moved, relevant comments in their vicinity must also be removed
// (from the File.Comments list) or moved accordingly (by updating their
// positions). A CommentMap may be used to facilitate some of these operations.
//
// Whether and how a comment is associated with a node depends on the
// interpretation of the syntax tree by the manipulating program: Except for Doc
// and Comment comments directly associated with nodes, the remaining comments
// are "free-floating" (see also issues #18593, #20744).
type File struct {
	Name       *Ident        // package name
	Decls      []Decl        // top-level declarations; or nil
	Scope      *Scope        // package scope (this file only)
	Imports    []*ImportSpec // imports in this file
	Unresolved []*Ident      // unresolved identifiers in this file
	Decs       FileDecorations
}

// A Package node represents a set of source files
// collectively building a Go package.
type Package struct {
	Name    string             // package name
	Scope   *Scope             // package scope across all files
	Imports map[string]*Object // map of package id -> package object
	Files   map[string]*File   // Go source files by filename
}
