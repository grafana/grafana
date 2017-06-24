package govaluate

/*
	Represents all valid types of tokens that a token can be.
*/
type TokenKind int

const (
	UNKNOWN TokenKind = iota

	PREFIX
	NUMERIC
	BOOLEAN
	STRING
	PATTERN
	TIME
	VARIABLE
	FUNCTION
	SEPARATOR
	ACCESSOR

	COMPARATOR
	LOGICALOP
	MODIFIER

	CLAUSE
	CLAUSE_CLOSE

	TERNARY
)

/*
	GetTokenKindString returns a string that describes the given TokenKind.
	e.g., when passed the NUMERIC TokenKind, this returns the string "NUMERIC".
*/
func (kind TokenKind) String() string {

	switch kind {

	case PREFIX:
		return "PREFIX"
	case NUMERIC:
		return "NUMERIC"
	case BOOLEAN:
		return "BOOLEAN"
	case STRING:
		return "STRING"
	case PATTERN:
		return "PATTERN"
	case TIME:
		return "TIME"
	case VARIABLE:
		return "VARIABLE"
	case FUNCTION:
		return "FUNCTION"
	case SEPARATOR:
		return "SEPARATOR"
	case COMPARATOR:
		return "COMPARATOR"
	case LOGICALOP:
		return "LOGICALOP"
	case MODIFIER:
		return "MODIFIER"
	case CLAUSE:
		return "CLAUSE"
	case CLAUSE_CLOSE:
		return "CLAUSE_CLOSE"
	case TERNARY:
		return "TERNARY"
	case ACCESSOR:
		return "ACCESSOR"
	}

	return "UNKNOWN"
}
