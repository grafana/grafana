package traceql

import "fmt"

type Operator int

const (
	OpNone Operator = iota
	OpAdd
	OpSub
	OpDiv
	OpMod
	OpMult
	OpEqual
	OpNotEqual
	OpRegex
	OpNotRegex
	OpGreater
	OpGreaterEqual
	OpLess
	OpLessEqual
	OpPower
	OpAnd
	OpOr
	OpNot
	OpSpansetChild
	OpSpansetParent
	OpSpansetDescendant
	OpSpansetAncestor
	OpSpansetAnd
	OpSpansetUnion
	OpSpansetSibling
	OpSpansetNotChild
	OpSpansetNotParent
	OpSpansetNotSibling
	OpSpansetNotAncestor
	OpSpansetNotDescendant
	OpSpansetUnionChild
	OpSpansetUnionParent
	OpSpansetUnionSibling
	OpSpansetUnionAncestor
	OpSpansetUnionDescendant
	OpExists // OpNotExists is not parseable directly in the grammar. span.foo != nil and nil != span.foo are rewritten to something like exists(span.foo). this distinguishes it from when span.foo is nil in an expression like span.foo != "bar"
)

func (op Operator) isBoolean() bool {
	return op == OpOr ||
		op == OpAnd ||
		op == OpEqual ||
		op == OpNotEqual ||
		op == OpRegex ||
		op == OpNotRegex ||
		op == OpGreater ||
		op == OpGreaterEqual ||
		op == OpLess ||
		op == OpLessEqual ||
		op == OpNot ||
		op == OpExists
}

func (op Operator) binaryTypesValid(lhsT StaticType, rhsT StaticType) bool {
	return binaryTypeValid(op, lhsT) && binaryTypeValid(op, rhsT)
}

func binaryTypeValid(op Operator, t StaticType) bool {
	if t == TypeAttribute {
		return true
	}

	switch t {
	case TypeBoolean, TypeBooleanArray:
		return op == OpAnd ||
			op == OpOr ||
			op == OpEqual ||
			op == OpNotEqual
	case TypeFloat, TypeFloatArray, TypeInt, TypeIntArray, TypeDuration:
		return op == OpAdd ||
			op == OpSub ||
			op == OpMult ||
			op == OpDiv ||
			op == OpMod ||
			op == OpPower ||
			op == OpEqual ||
			op == OpNotEqual ||
			op == OpGreater ||
			op == OpGreaterEqual ||
			op == OpLess ||
			op == OpLessEqual
	case TypeString, TypeStringArray:
		return op == OpEqual ||
			op == OpNotEqual ||
			op == OpRegex ||
			op == OpNotRegex ||
			op == OpGreater ||
			op == OpGreaterEqual ||
			op == OpLess ||
			op == OpLessEqual
	case TypeNil, TypeStatus, TypeKind:
		return op == OpEqual || op == OpNotEqual
	}

	return false
}

func (op Operator) unaryTypesValid(t StaticType) bool {
	if t == TypeAttribute {
		return true
	}

	switch op {
	case OpSub:
		return t.isNumeric()
	case OpNot:
		return t == TypeBoolean
	case OpExists:
		return true
	}

	return false
}

func (op Operator) String() string {
	switch op {
	case OpAdd:
		return "+"
	case OpSub:
		return "-"
	case OpDiv:
		return "/"
	case OpMod:
		return "%"
	case OpMult:
		return "*"
	case OpEqual:
		return "="
	case OpNotEqual:
		return "!="
	case OpRegex:
		return "=~"
	case OpNotRegex:
		return "!~"
	case OpGreater:
		return ">"
	case OpGreaterEqual:
		return ">="
	case OpLess:
		return "<"
	case OpLessEqual:
		return "<="
	case OpPower:
		return "^"
	case OpAnd:
		return "&&"
	case OpOr:
		return "||"
	case OpNot:
		return "!"
	case OpSpansetChild:
		return ">"
	case OpSpansetParent:
		return "<"
	case OpSpansetDescendant:
		return ">>"
	case OpSpansetAncestor:
		return "<<"
	case OpSpansetAnd:
		return "&&"
	case OpSpansetSibling:
		return "~"
	case OpSpansetUnion:
		return "||"
	case OpSpansetNotChild:
		return "!>"
	case OpSpansetNotParent:
		return "!<"
	case OpSpansetNotSibling:
		return "!~"
	case OpSpansetNotAncestor:
		return "!<<"
	case OpSpansetNotDescendant:
		return "!>>"
	case OpSpansetUnionChild:
		return "&>"
	case OpSpansetUnionParent:
		return "&<"
	case OpSpansetUnionSibling:
		return "&~"
	case OpSpansetUnionAncestor:
		return "&<<"
	case OpSpansetUnionDescendant:
		return "&>>"
	}

	return fmt.Sprintf("operator(%d)", op)
}
