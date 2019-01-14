// +build gofuzz

package logfmt

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"reflect"

	kr "github.com/kr/logfmt"
)

// Fuzz checks reserialized data matches
func Fuzz(data []byte) int {
	parsed, err := parse(data)
	if err != nil {
		return 0
	}
	var w1 bytes.Buffer
	if err = write(parsed, &w1); err != nil {
		panic(err)
	}
	parsed, err = parse(w1.Bytes())
	if err != nil {
		panic(err)
	}
	var w2 bytes.Buffer
	if err = write(parsed, &w2); err != nil {
		panic(err)
	}
	if !bytes.Equal(w1.Bytes(), w2.Bytes()) {
		panic(fmt.Sprintf("reserialized data does not match:\n%q\n%q\n", w1.Bytes(), w2.Bytes()))
	}
	return 1
}

// FuzzVsKR checks go-logfmt/logfmt against kr/logfmt
func FuzzVsKR(data []byte) int {
	parsed, err := parse(data)
	parsedKR, errKR := parseKR(data)

	// github.com/go-logfmt/logfmt is a stricter parser. It returns errors for
	// more inputs than github.com/kr/logfmt. Ignore any inputs that have a
	// stict error.
	if err != nil {
		return 0
	}

	// Fail if the more forgiving parser finds an error not found by the
	// stricter parser.
	if errKR != nil {
		panic(fmt.Sprintf("unmatched error: %v", errKR))
	}

	if !reflect.DeepEqual(parsed, parsedKR) {
		panic(fmt.Sprintf("parsers disagree:\n%+v\n%+v\n", parsed, parsedKR))
	}
	return 1
}

type kv struct {
	k, v []byte
}

func parse(data []byte) ([][]kv, error) {
	var got [][]kv
	dec := NewDecoder(bytes.NewReader(data))
	for dec.ScanRecord() {
		var kvs []kv
		for dec.ScanKeyval() {
			kvs = append(kvs, kv{dec.Key(), dec.Value()})
		}
		got = append(got, kvs)
	}
	return got, dec.Err()
}

func parseKR(data []byte) ([][]kv, error) {
	var (
		s   = bufio.NewScanner(bytes.NewReader(data))
		err error
		h   saveHandler
		got [][]kv
	)
	for err == nil && s.Scan() {
		h.kvs = nil
		err = kr.Unmarshal(s.Bytes(), &h)
		got = append(got, h.kvs)
	}
	if err == nil {
		err = s.Err()
	}
	return got, err
}

type saveHandler struct {
	kvs []kv
}

func (h *saveHandler) HandleLogfmt(key, val []byte) error {
	if len(key) == 0 {
		key = nil
	}
	if len(val) == 0 {
		val = nil
	}
	h.kvs = append(h.kvs, kv{key, val})
	return nil
}

func write(recs [][]kv, w io.Writer) error {
	enc := NewEncoder(w)
	for _, rec := range recs {
		for _, f := range rec {
			if err := enc.EncodeKeyval(f.k, f.v); err != nil {
				return err
			}
		}
		if err := enc.EndRecord(); err != nil {
			return err
		}
	}
	return nil
}
