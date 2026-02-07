package csv

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"unicode"

	"github.com/mithrandie/go-text"
)

type Reader struct {
	Delimiter         rune
	WithoutNull       bool
	AllowUnevenFields bool
	Encoding          text.Encoding

	reader *bufio.Reader
	line   int
	column int

	recordBuf     bytes.Buffer
	fieldStartPos []int
	fieldQuoted   []bool

	FieldsPerRecord int

	DetectedLineBreak text.LineBreak
	EnclosedAll       bool
}

func NewReader(r io.Reader, enc text.Encoding) (*Reader, error) {
	decoder, err := text.GetTransformDecoder(r, enc)
	if err != nil {
		return nil, err
	}

	return &Reader{
		Delimiter:         ',',
		WithoutNull:       false,
		AllowUnevenFields: false,
		Encoding:          enc,
		reader:            bufio.NewReader(decoder),
		line:              1,
		column:            0,
		recordBuf:         bytes.Buffer{},
		fieldStartPos:     make([]int, 0, 40),
		fieldQuoted:       make([]bool, 0, 40),
		FieldsPerRecord:   0,
		EnclosedAll:       true,
	}, nil
}

func (r *Reader) newError(s string) error {
	return errors.New(fmt.Sprintf("line %d, column %d: %s", r.line, r.column, s))
}

func (r *Reader) ReadHeader() ([]string, error) {
	record, err := r.parseRecord(true)
	if err != nil {
		return nil, err
	}

	header := make([]string, len(record))
	for i, v := range record {
		header[i] = string(v)
	}
	return header, nil
}

func (r *Reader) Read() ([]text.RawText, error) {
	return r.parseRecord(r.WithoutNull)
}

func (r *Reader) ReadAll() ([][]text.RawText, error) {
	records := make([][]text.RawText, 0, 160)

	for {
		record, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}

	return records, nil
}

func (r *Reader) parseRecord(withoutNull bool) ([]text.RawText, error) {
	r.recordBuf.Reset()
	r.fieldStartPos = r.fieldStartPos[:0]
	r.fieldQuoted = r.fieldQuoted[:0]

	fieldIndex := 0
	fieldPosition := 0
	for {
		if 0 < r.FieldsPerRecord && r.FieldsPerRecord <= fieldIndex {
			if !r.AllowUnevenFields {
				return nil, r.newError("wrong number of fields in line")
			}
			r.FieldsPerRecord = fieldIndex + 1
		}

		fieldPosition = r.recordBuf.Len()
		quoted, eol, err := r.parseField()

		if err != nil {
			if err == io.EOF {
				if fieldIndex < 1 && r.recordBuf.Len() < 1 {
					return nil, io.EOF
				}
			} else {
				return nil, err
			}
		}

		if eol && fieldIndex < 1 && r.recordBuf.Len() < 1 {
			continue
		}

		r.fieldStartPos = append(r.fieldStartPos, fieldPosition)
		r.fieldQuoted = append(r.fieldQuoted, quoted)
		fieldIndex++

		if eol {
			break
		}
	}

	if r.FieldsPerRecord < 1 {
		r.FieldsPerRecord = fieldIndex
	} else if fieldIndex < r.FieldsPerRecord {
		if !r.AllowUnevenFields {
			r.line--
			return nil, r.newError("wrong number of fields in line")
		}
	}

	record := make([]text.RawText, len(r.fieldStartPos))
	recordStr := make([]byte, r.recordBuf.Len())
	copy(recordStr, r.recordBuf.Bytes())
	var endPos int
	for i, pos := range r.fieldStartPos {
		if i == len(r.fieldStartPos)-1 {
			endPos = r.recordBuf.Len()
		} else {
			endPos = r.fieldStartPos[i+1]
		}

		if pos == endPos && !r.fieldQuoted[i] {
			if withoutNull {
				record[i] = text.RawText{}
			}
		} else {
			record[i] = recordStr[pos:endPos]
		}
	}

	return record, nil
}

func (r *Reader) parseField() (bool, bool, error) {
	var eof error
	eol := false
	startPos := r.recordBuf.Len()

	quoted := false
	escaped := false

	var lineBreak text.LineBreak

Read:
	for {
		lineBreak = ""

		ch, _, err := r.reader.ReadRune()
		r.column++

		if err != nil {
			if err == io.EOF {
				if !escaped && quoted {
					return quoted, eol, r.newError("extraneous \" in field")
				}
				eol = true
			}
			return quoted, eol, err
		}

		switch ch {
		case '\r':
			nxtCh, _, _ := r.reader.ReadRune()
			if nxtCh == '\n' {
				lineBreak = text.CRLF
			} else {
				if err = r.reader.UnreadRune(); err != nil {
					return quoted, eol, err
				}
				lineBreak = text.CR
			}
			ch = '\n'
		case '\n':
			lineBreak = text.LF
		}
		if ch == '\n' {
			r.line++
			r.column = 0
		}

		if quoted {
			if escaped {
				switch ch {
				case '"':
					escaped = false
					r.recordBuf.WriteRune(ch)
					continue
				case r.Delimiter:
					break Read
				case '\n':
					if r.DetectedLineBreak == "" {
						r.DetectedLineBreak = lineBreak
					}
					eol = true
					break Read
				default:
					r.column--
					return quoted, eol, r.newError("unexpected \" in field")
				}
			}

			switch ch {
			case '"':
				escaped = true
			case '\n':
				r.recordBuf.WriteString(lineBreak.Value())
			default:
				r.recordBuf.WriteRune(ch)
			}
			continue
		}

		switch ch {
		case '\n':
			if r.DetectedLineBreak == "" {
				r.DetectedLineBreak = lineBreak
			}
			eol = true
			break Read
		case r.Delimiter:
			break Read
		case '"':
			if startPos == r.recordBuf.Len() {
				quoted = true
			} else {
				r.recordBuf.WriteRune(ch)
			}
		default:
			if r.EnclosedAll && unicode.IsLetter(ch) {
				r.EnclosedAll = false
			}
			r.recordBuf.WriteRune(ch)
		}
	}

	return quoted, eol, eof
}
