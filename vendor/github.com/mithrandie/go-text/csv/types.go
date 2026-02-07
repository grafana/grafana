package csv

type Field struct {
	Contents string
	Quote    bool
}

func NewField(contents string, quote bool) Field {
	return Field{
		Contents: contents,
		Quote:    quote,
	}
}
