package sourcemap

import (
	"errors"
	"io"
	"strings"

	"github.com/go-sourcemap/sourcemap/internal/base64vlq"
)

type fn func(m *mappings) (fn, error)

type mapping struct {
	genLine      int32
	genColumn    int32
	sourcesInd   int32
	sourceLine   int32
	sourceColumn int32
	namesInd     int32
}

type mappings struct {
	rd  *strings.Reader
	dec base64vlq.Decoder

	hasValue bool
	hasName  bool
	value    mapping

	values []mapping
}

func parseMappings(s string) ([]mapping, error) {
	if s == "" {
		return nil, errors.New("sourcemap: mappings are empty")
	}

	rd := strings.NewReader(s)
	m := &mappings{
		rd:  rd,
		dec: base64vlq.NewDecoder(rd),

		values: make([]mapping, 0, mappingsNumber(s)),
	}
	m.value.genLine = 1
	m.value.sourceLine = 1

	err := m.parse()
	if err != nil {
		return nil, err
	}

	values := m.values
	m.values = nil
	return values, nil
}

func mappingsNumber(s string) int {
	return strings.Count(s, ",") + strings.Count(s, ";")
}

func (m *mappings) parse() error {
	next := parseGenCol
	for {
		c, err := m.rd.ReadByte()
		if err == io.EOF {
			m.pushValue()
			return nil
		}
		if err != nil {
			return err
		}

		switch c {
		case ',':
			m.pushValue()
			next = parseGenCol
		case ';':
			m.pushValue()

			m.value.genLine++
			m.value.genColumn = 0

			next = parseGenCol
		default:
			err := m.rd.UnreadByte()
			if err != nil {
				return err
			}

			next, err = next(m)
			if err != nil {
				return err
			}
			m.hasValue = true
		}
	}
}

func parseGenCol(m *mappings) (fn, error) {
	n, err := m.dec.Decode()
	if err != nil {
		return nil, err
	}
	m.value.genColumn += n
	return parseSourcesInd, nil
}

func parseSourcesInd(m *mappings) (fn, error) {
	n, err := m.dec.Decode()
	if err != nil {
		return nil, err
	}
	m.value.sourcesInd += n
	return parseSourceLine, nil
}

func parseSourceLine(m *mappings) (fn, error) {
	n, err := m.dec.Decode()
	if err != nil {
		return nil, err
	}
	m.value.sourceLine += n
	return parseSourceCol, nil
}

func parseSourceCol(m *mappings) (fn, error) {
	n, err := m.dec.Decode()
	if err != nil {
		return nil, err
	}
	m.value.sourceColumn += n
	return parseNamesInd, nil
}

func parseNamesInd(m *mappings) (fn, error) {
	n, err := m.dec.Decode()
	if err != nil {
		return nil, err
	}
	m.hasName = true
	m.value.namesInd += n
	return parseGenCol, nil
}

func (m *mappings) pushValue() {
	if !m.hasValue {
		return
	}
	m.hasValue = false
	if m.hasName {
		m.values = append(m.values, m.value)
		m.hasName = false
	} else {
		m.values = append(m.values, mapping{
			genLine:      m.value.genLine,
			genColumn:    m.value.genColumn,
			sourcesInd:   m.value.sourcesInd,
			sourceLine:   m.value.sourceLine,
			sourceColumn: m.value.sourceColumn,
			namesInd:     -1,
		})
	}
}
