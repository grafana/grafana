package fixedlen

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"

	"github.com/mithrandie/go-text"
)

type Reader struct {
	DelimiterPositions DelimiterPositions
	WithoutNull        bool
	Encoding           text.Encoding
	SingleLine         bool

	reader *bufio.Reader
	buf    bytes.Buffer

	DetectedLineBreak text.LineBreak
}

func NewReader(r io.Reader, positions []int, enc text.Encoding) (*Reader, error) {
	decoder, err := text.GetTransformDecoder(r, enc)
	if err != nil {
		return nil, err
	}

	return &Reader{
		DelimiterPositions: positions,
		WithoutNull:        false,
		Encoding:           enc,
		reader:             bufio.NewReader(decoder),
	}, nil
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
	records := make([][]text.RawText, 0, 100)

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
	record := make([]text.RawText, len(r.DelimiterPositions))
	recordPos := 0
	delimiterPos := 0

	var lineBreak text.LineBreak
	lineEnd := false

	for i, endPos := range r.DelimiterPositions {
		if endPos < 0 || endPos <= delimiterPos {
			return nil, errors.New(fmt.Sprintf("invalid delimiter position: %s", r.DelimiterPositions))
		}
		delimiterPos = endPos

		r.buf.Reset()
		for !lineEnd && recordPos < delimiterPos {
			c, _, err := r.reader.ReadRune()

			if err != nil {
				if err != io.EOF || recordPos < 1 {
					return nil, err
				}
				lineEnd = true
				continue
			} else {
				switch c {
				case '\r':
					c2, _, _ := r.reader.ReadRune()
					if c2 == '\n' {
						lineBreak = text.CRLF
					} else {
						if err = r.reader.UnreadRune(); err != nil {
							return nil, err
						}
						lineBreak = text.CR
					}
					c = '\n'
				case '\n':
					lineBreak = text.LF
				}
				if c == '\n' {
					lineEnd = true
					continue
				}
			}

			recordPos = recordPos + text.RuneByteSize(c, r.Encoding)

			if delimiterPos < recordPos {
				return nil, errors.New("cannot delimit lines in a byte array of a character")
			}

			r.buf.WriteRune(c)
		}

		b := r.buf.Bytes()
		b = bytes.TrimSpace(b)

		if len(b) < 1 {
			if withoutNull {
				record[i] = text.RawText{}
			}
		} else {
			field := make([]byte, len(b))
			copy(field, b)
			record[i] = field
		}
	}

	if !r.SingleLine && !lineEnd {
		for {
			c, _, err := r.reader.ReadRune()
			if err != nil {
				if err != io.EOF || recordPos < 1 {
					return nil, err
				}
				break
			}
			switch c {
			case '\r':
				c2, _, _ := r.reader.ReadRune()
				if c2 == '\n' {
					lineBreak = text.CRLF
				} else {
					if err = r.reader.UnreadRune(); err != nil {
						return nil, err
					}
					lineBreak = text.CR
				}
				c = '\n'
			case '\n':
				lineBreak = text.LF
			}
			if c == '\n' {
				lineEnd = true
				break
			}
			recordPos++
		}
	}

	if r.DetectedLineBreak == "" {
		r.DetectedLineBreak = lineBreak
	}

	return record, nil
}
