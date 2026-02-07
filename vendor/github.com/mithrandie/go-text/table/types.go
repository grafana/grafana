package table

import "github.com/mithrandie/go-text"

type Format int

const (
	PlainTable Format = iota
	GFMTable
	OrgTable
	BoxTable
)

type Field struct {
	Contents  string
	Alignment text.FieldAlignment

	Lines []string
	Width int
}

func NewField(contents string, alignment text.FieldAlignment) Field {
	return Field{
		Contents:  contents,
		Alignment: alignment,
	}
}
