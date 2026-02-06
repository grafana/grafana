package fixedlen

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"

	"github.com/mithrandie/go-text"
)

type Writer struct {
	InsertSpace bool
	PadChar     byte
	SingleLine  bool

	delimiterPositions DelimiterPositions
	encoding           text.Encoding
	writer             *bufio.Writer
	lineBreak          string
	appended           bool
}

func NewWriter(w io.Writer, delimiterPositions DelimiterPositions, lineBreak text.LineBreak, enc text.Encoding) (*Writer, error) {
	writer, err := text.GetTransformWriter(w, enc)
	if err != nil {
		return nil, err
	}

	return &Writer{
		InsertSpace:        false,
		PadChar:            ' ',
		delimiterPositions: delimiterPositions,
		encoding:           enc,
		lineBreak:          lineBreak.Value(),
		writer:             bufio.NewWriter(writer),
	}, nil
}

func (e *Writer) Write(record []Field) error {
	if !e.SingleLine && e.appended {
		if _, err := e.writer.WriteString(e.lineBreak); err != nil {
			return err
		}
	} else {
		e.appended = true
	}

	start := 0
	for i, end := range e.delimiterPositions {
		if end <= start {
			return errors.New(fmt.Sprintf("invalid delimiter position: %s", e.delimiterPositions))
		}

		if e.InsertSpace && 0 < i {
			if err := e.writer.WriteByte(e.PadChar); err != nil {
				return err
			}
		}

		size := end - start
		if i < len(record) {
			if err := e.addField(record[i], size); err != nil {
				return err
			}
		} else {
			if _, err := e.writer.Write(bytes.Repeat([]byte{e.PadChar}, size)); err != nil {
				return err
			}
		}
		start = end
	}

	return nil
}

func (e *Writer) addField(field Field, fieldSize int) error {
	size := text.ByteSize(field.Contents, e.encoding)
	if fieldSize < size {
		return errors.New(fmt.Sprintf("value is too long: %q for %d byte(s) length field", field.Contents, fieldSize))
	}

	padLen := fieldSize - size

	switch field.Alignment {
	case text.Centering:
		halfPadLen := padLen / 2
		if _, err := e.writer.Write(bytes.Repeat([]byte{e.PadChar}, halfPadLen)); err != nil {
			return err
		}
		if _, err := e.writer.WriteString(field.Contents); err != nil {
			return err
		}
		if _, err := e.writer.Write(bytes.Repeat([]byte{e.PadChar}, padLen-halfPadLen)); err != nil {
			return err
		}
	case text.RightAligned:
		if _, err := e.writer.Write(bytes.Repeat([]byte{e.PadChar}, padLen)); err != nil {
			return err
		}
		if _, err := e.writer.WriteString(field.Contents); err != nil {
			return err
		}
	default:
		if _, err := e.writer.WriteString(field.Contents); err != nil {
			return err
		}
		if _, err := e.writer.Write(bytes.Repeat([]byte{e.PadChar}, padLen)); err != nil {

		}
	}

	return nil
}

func (e *Writer) Flush() error {
	return e.writer.Flush()
}
