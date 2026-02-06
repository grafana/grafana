package ltsv

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"unicode"

	"github.com/mithrandie/go-text"
)

type Writer struct {
	header []string

	writer    *bufio.Writer
	lineBreak string
	appended  bool
}

func NewWriter(w io.Writer, header []string, lineBreak text.LineBreak, enc text.Encoding) (*Writer, error) {
	for _, label := range header {
		for _, r := range label {
			if !unicode.In(r, LabelTable) {
				return nil, errors.New(fmt.Sprintf("unpermitted character in label: %U", r))
			}
		}
	}

	writer, err := text.GetTransformWriter(w, enc)
	if err != nil {
		return nil, err
	}

	return &Writer{
		header:    header,
		lineBreak: lineBreak.Value(),
		writer:    bufio.NewWriter(writer),
	}, nil
}

func (e *Writer) Write(record []string) error {
	if len(record) != len(e.header) {
		return errors.New("field length does not match")
	}

	if e.appended {
		if _, err := e.writer.WriteString(e.lineBreak); err != nil {
			return err
		}
	} else {
		e.appended = true
	}

	for i := 0; i < len(record); i++ {
		for _, r := range record[i] {
			if !unicode.In(r, FieldValueTable) {
				return errors.New(fmt.Sprintf("unpermitted character in field-value: %U", r))
			}
		}

		if 0 < i {
			if _, err := e.writer.WriteRune('\t'); err != nil {
				return err
			}
		}

		if _, err := e.writer.WriteString(e.header[i]); err != nil {
			return err
		}

		if _, err := e.writer.WriteRune(':'); err != nil {
			return err
		}

		if _, err := e.writer.WriteString(record[i]); err != nil {
			return err
		}
	}
	return nil
}

func (e *Writer) Flush() error {
	return e.writer.Flush()
}
