package json

type EscapeType int

const (
	Backslash        EscapeType = 0
	HexDigits        EscapeType = 1
	AllWithHexDigits EscapeType = 2
)

const (
	ObjectKeyEffect = "json_object_key"
	StringEffect    = "json_string"
	NumberEffect    = "json_number"
	BooleanEffect   = "json_boolean"
	NullEffect      = "json_null"
)
