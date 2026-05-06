package excmd

const EOF = -1

type ElementType int

const (
	FixedString ElementType = iota
	Variable
	EnvironmentVariable
	RuntimeInformation
	CsvqExpression
)
