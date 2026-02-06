package jsonl

import (
	"bufio"
	"github.com/mithrandie/go-text/json"
	"io"
)

type Reader struct {
	reader *bufio.Reader
	line   int
	pos    int

	decoder *json.Decoder
}

func NewReader(r io.Reader) *Reader {
	return &Reader{
		reader:  bufio.NewReader(r),
		line:    0,
		pos:     0,
		decoder: json.NewDecoder(),
	}
}

func (r *Reader) SetUseInteger(useInteger bool) {
	r.decoder.UseInteger = useInteger
}

func (r *Reader) Read() (json.Structure, json.EscapeType, error) {
	line, err := r.reader.ReadString('\n')

	if err == io.EOF {
		if len(line) < 1 {
			return nil, json.Backslash, io.EOF
		}
		err = nil
	}

	if err != nil {
		return nil, json.Backslash, err
	}

	r.line++
	r.pos = r.pos + len(line)

	st, et, err := r.decoder.Decode(line)
	if err != nil {
		if e, ok := err.(*json.DecodeError); ok {
			err = json.NewDecodeError(r.line, e.Char(), e.Message())
		}
		return nil, et, err
	}
	return st, et, nil
}

func (r *Reader) ReadAll() ([]json.Structure, json.EscapeType, error) {
	lines := make([]json.Structure, 0, 160)
	escapeType := json.Backslash

	for {
		st, et, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, escapeType, err
		}
		if st == nil {
			continue
		}

		if escapeType < et {
			escapeType = et
		}

		lines = append(lines, st)
	}

	return lines, escapeType, nil
}

func (r *Reader) Pos() int {
	return r.pos
}
