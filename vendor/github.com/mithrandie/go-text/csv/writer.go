package csv

import (
	"bufio"
	"io"

	"github.com/mithrandie/go-text"
)

const QuotationMark = 0x22

type Writer struct {
	Delimiter rune

	writer    *bufio.Writer
	lineBreak string
	appended  bool
}

func NewWriter(w io.Writer, lineBreak text.LineBreak, enc text.Encoding) (*Writer, error) {
	writer, err := text.GetTransformWriter(w, enc)
	if err != nil {
		return nil, err
	}

	return &Writer{
		Delimiter: ',',
		lineBreak: lineBreak.Value(),
		writer:    bufio.NewWriter(writer),
	}, nil
}

func (e *Writer) Write(record []Field) error {
	if e.appended {
		if _, err := e.writer.WriteString(e.lineBreak); err != nil {
			return err
		}
	} else {
		e.appended = true
	}

	for i := 0; i < len(record); i++ {
		if 0 < i {
			if _, err := e.writer.WriteRune(e.Delimiter); err != nil {
				return err
			}
		}

		if record[i].Quote || e.includeDelimiterOrQuote(record[i].Contents) {
			if err := e.writer.WriteByte(QuotationMark); err != nil {
				return err
			}

			runes := []rune(record[i].Contents)
			pos := 0

			for {
				if len(runes) <= pos {
					break
				}

				r := runes[pos]
				switch r {
				case '"':
					if _, err := e.writer.Write([]byte{QuotationMark, QuotationMark}); err != nil {
						return err
					}
				default:
					if _, err := e.writer.WriteRune(r); err != nil {
						return err
					}
				}

				pos++
			}
			if err := e.writer.WriteByte(QuotationMark); err != nil {
				return err
			}
		} else {
			if _, err := e.writer.WriteString(record[i].Contents); err != nil {
				return err
			}
		}
	}
	return nil
}

func (e *Writer) Flush() error {
	return e.writer.Flush()
}

func (e *Writer) includeDelimiterOrQuote(s string) bool {
	for _, r := range s {
		if r == e.Delimiter || r == QuotationMark {
			return true
		}
	}
	return false
}
