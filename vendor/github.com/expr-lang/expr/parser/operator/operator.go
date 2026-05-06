package operator

type Associativity int

const (
	Left Associativity = iota + 1
	Right
)

type Operator struct {
	Precedence    int
	Associativity Associativity
}

func Less(a, b string) bool {
	return Binary[a].Precedence < Binary[b].Precedence
}

func IsBoolean(op string) bool {
	return op == "and" || op == "or" || op == "&&" || op == "||"
}

func AllowedNegateSuffix(op string) bool {
	switch op {
	case "contains", "matches", "startsWith", "endsWith", "in":
		return true
	default:
		return false
	}
}

var Unary = map[string]Operator{
	"not": {50, Left},
	"!":   {50, Left},
	"-":   {90, Left},
	"+":   {90, Left},
}

var Binary = map[string]Operator{
	"|":          {0, Left},
	"or":         {10, Left},
	"||":         {10, Left},
	"and":        {15, Left},
	"&&":         {15, Left},
	"==":         {20, Left},
	"!=":         {20, Left},
	"<":          {20, Left},
	">":          {20, Left},
	">=":         {20, Left},
	"<=":         {20, Left},
	"in":         {20, Left},
	"matches":    {20, Left},
	"contains":   {20, Left},
	"startsWith": {20, Left},
	"endsWith":   {20, Left},
	"..":         {25, Left},
	"+":          {30, Left},
	"-":          {30, Left},
	"*":          {60, Left},
	"/":          {60, Left},
	"%":          {60, Left},
	"**":         {100, Right},
	"^":          {100, Right},
	"??":         {500, Left},
}

func IsComparison(op string) bool {
	return op == "<" || op == ">" || op == ">=" || op == "<="
}
