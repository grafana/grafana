package ajson

import "fmt"

// Error is common struct to provide internal errors
type Error struct {
	Type    ErrorType
	Index   int
	Char    byte
	Message string
	Value   interface{}
}

// ErrorType is container for reflection type of error
type ErrorType int

const (
	// WrongSymbol means that system found symbol than not allowed to be
	WrongSymbol ErrorType = iota
	// UnexpectedEOF means that data ended, leaving the node undone
	UnexpectedEOF
	// WrongType means that wrong type requested
	WrongType
	// WrongRequest means that wrong range requested
	WrongRequest
	// Unparsed means that json structure wasn't parsed yet
	Unparsed
	// UnsupportedType means that wrong type was given
	UnsupportedType
)

func errorSymbol(b *buffer) error {
	symbol, err := b.current()
	if err != nil {
		symbol = 0
	}
	return Error{
		Type:  WrongSymbol,
		Index: b.index,
		Char:  symbol,
	}
}

func errorAt(index int, symbol byte) error {
	return Error{
		Type:  WrongSymbol,
		Index: index,
		Char:  symbol,
	}
}

func errorEOF(b *buffer) error {
	return Error{
		Type:  UnexpectedEOF,
		Index: b.index,
	}
}

func errorType() error {
	return Error{
		Type: WrongType,
	}
}

func unsupportedType(value interface{}) error {
	return Error{
		Type:  UnsupportedType,
		Value: value,
	}
}

func errorUnparsed() error {
	return Error{
		Type: Unparsed,
	}
}

func errorRequest(format string, args ...interface{}) error {
	return Error{
		Type:    WrongRequest,
		Message: fmt.Sprintf(format, args...),
	}
}

// Error interface implementation
func (err Error) Error() string {
	switch err.Type {
	case WrongSymbol:
		return fmt.Sprintf("wrong symbol '%s' at %d", []byte{err.Char}, err.Index)
	case UnexpectedEOF:
		return "unexpected end of file"
	case WrongType:
		return "wrong type of Node"
	case UnsupportedType:
		return fmt.Sprintf("unsupported type was given: '%T'", err.Value)
	case Unparsed:
		return "not parsed yet"
	case WrongRequest:
		return fmt.Sprintf("wrong request: %s", err.Message)
	}
	return fmt.Sprintf("unknown error: '%s' at %d", []byte{err.Char}, err.Index)
}
