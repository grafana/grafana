package protocol

import (
	"fmt"
	"io"
	"math"
	"sort"
	"strconv"
	"time"
)

// ErrIsNaN is a field error for when a float field is NaN.
var ErrIsNaN = &FieldError{"is NaN"}

// ErrIsInf is a field error for when a float field is Inf.
var ErrIsInf = &FieldError{"is Inf"}

// Encoder marshals Metrics into influxdb line protocol.
// It is not safe for concurrent use, make a new one!
// The default behavior when encountering a field error is to ignore the field and move on.
// If you wish it to error out on field errors, use Encoder.FailOnFieldErr(true)
type Encoder struct {
	w                io.Writer
	fieldSortOrder   FieldSortOrder
	fieldTypeSupport FieldTypeSupport
	failOnFieldError bool
	maxLineBytes     int
	fieldList        []*Field
	header           []byte
	footer           []byte
	pair             []byte
	precision        time.Duration
}

// SetMaxLineBytes sets a maximum length for a line, Encode will error if the generated line is longer
func (e *Encoder) SetMaxLineBytes(i int) {
	e.maxLineBytes = i
}

// SetFieldSortOrder sets a sort order for the data.
// The options are:
// NoSortFields (doesn't sort the fields)
// SortFields (sorts the keys in alphabetical order)
func (e *Encoder) SetFieldSortOrder(s FieldSortOrder) {
	e.fieldSortOrder = s
}

// SetFieldTypeSupport sets flags for if the encoder supports certain optional field types such as uint64
func (e *Encoder) SetFieldTypeSupport(s FieldTypeSupport) {
	e.fieldTypeSupport = s
}

// FailOnFieldErr whether or not to fail on a field error or just move on.
// The default behavior to move on
func (e *Encoder) FailOnFieldErr(s bool) {
	e.failOnFieldError = s
}

// SetPrecision sets time precision for writes
// Default is nanoseconds precision
func (e *Encoder) SetPrecision(p time.Duration) {
	e.precision = p
}

// NewEncoder gives us an encoder that marshals to a writer in influxdb line protocol
// as defined by:
// https://docs.influxdata.com/influxdb/v1.5/write_protocols/line_protocol_reference/
func NewEncoder(w io.Writer) *Encoder {
	return &Encoder{
		w:         w,
		header:    make([]byte, 0, 128),
		footer:    make([]byte, 0, 128),
		pair:      make([]byte, 0, 128),
		fieldList: make([]*Field, 0, 16),
		precision: time.Nanosecond,
	}
}

// This is here to significantly reduce allocations, wish that we had constant/immutable keyword that applied to
// more complex objects
var comma = []byte(",")

// Encode marshals a Metric to the io.Writer in the Encoder
func (e *Encoder) Encode(m Metric) (int, error) {
	err := e.buildHeader(m)
	if err != nil {
		return 0, err
	}

	e.buildFooter(m.Time())

	// here we make a copy of the *fields so we can do an in-place sort
	e.fieldList = append(e.fieldList[:0], m.FieldList()...)

	if e.fieldSortOrder == SortFields {
		sort.Slice(e.fieldList, func(i, j int) bool {
			return e.fieldList[i].Key < e.fieldList[j].Key
		})
	}
	i := 0
	totalWritten := 0
	pairsLen := 0
	firstField := true
	for _, field := range e.fieldList {
		err = e.buildFieldPair(field.Key, field.Value)
		if err != nil {
			if e.failOnFieldError {
				return 0, err
			}
			continue
		}

		bytesNeeded := len(e.header) + pairsLen + len(e.pair) + len(e.footer)

		// Additional length needed for field separator `,`
		if !firstField {
			bytesNeeded++
		}

		if e.maxLineBytes > 0 && bytesNeeded > e.maxLineBytes {
			// Need at least one field per line
			if firstField {
				return 0, ErrNeedMoreSpace
			}

			i, err = e.w.Write(e.footer)
			if err != nil {
				return 0, err
			}
			pairsLen = 0
			totalWritten += i

			bytesNeeded = len(e.header) + len(e.pair) + len(e.footer)

			if e.maxLineBytes > 0 && bytesNeeded > e.maxLineBytes {
				return 0, ErrNeedMoreSpace
			}

			i, err = e.w.Write(e.header)
			if err != nil {
				return 0, err
			}
			totalWritten += i

			i, err = e.w.Write(e.pair)
			if err != nil {
				return 0, err
			}
			totalWritten += i

			pairsLen += len(e.pair)
			firstField = false
			continue
		}

		if firstField {
			i, err = e.w.Write(e.header)
			if err != nil {
				return 0, err
			}
			totalWritten += i

		} else {
			i, err = e.w.Write(comma)
			if err != nil {
				return 0, err
			}
			totalWritten += i

		}

		i, err = e.w.Write(e.pair)
		if err != nil {
			return 0, err
		}
		totalWritten += i

		pairsLen += len(e.pair)
		firstField = false
	}

	if firstField {
		return 0, ErrNoFields
	}
	i, err = e.w.Write(e.footer)
	if err != nil {
		return 0, err
	}
	totalWritten += i
	return totalWritten, nil

}

func (e *Encoder) buildHeader(m Metric) error {
	e.header = e.header[:0]
	name := nameEscape(m.Name())
	if name == "" {
		return ErrInvalidName
	}
	e.header = append(e.header, name...)

	for _, tag := range m.TagList() {
		key := escape(tag.Key)
		value := escape(tag.Value)

		// Some keys and values are not encodeable as line protocol, such as
		// those with a trailing '\' or empty strings.
		if key == "" || value == "" {
			continue
		}

		e.header = append(e.header, ',')
		e.header = append(e.header, key...)
		e.header = append(e.header, '=')
		e.header = append(e.header, value...)
	}

	e.header = append(e.header, ' ')
	return nil
}

func (e *Encoder) buildFieldVal(value interface{}) error {
	switch v := value.(type) {
	case uint64:
		if e.fieldTypeSupport&UintSupport != 0 {
			e.pair = append(strconv.AppendUint(e.pair, v, 10), 'u')
		} else if v <= uint64(math.MaxInt64) {
			e.pair = append(strconv.AppendInt(e.pair, int64(v), 10), 'i')
		} else {
			e.pair = append(strconv.AppendInt(e.pair, math.MaxInt64, 10), 'i')
		}
	case int64:
		e.pair = append(strconv.AppendInt(e.pair, v, 10), 'i')
	case int:
		e.pair = append(strconv.AppendInt(e.pair, int64(v), 10), 'i')
	case float64:
		if math.IsNaN(v) {
			return ErrIsNaN
		}

		if math.IsInf(v, 0) {
			return ErrIsInf
		}

		e.pair = strconv.AppendFloat(e.pair, v, 'f', -1, 64)
	case float32:
		v32 := float64(v)
		if math.IsNaN(v32) {
			return ErrIsNaN
		}

		if math.IsInf(v32, 0) {
			return ErrIsInf
		}

		e.pair = strconv.AppendFloat(e.pair, v32, 'f', -1, 64)

	case string:
		e.pair = append(e.pair, '"')
		e.pair = append(e.pair, stringFieldEscape(v)...)
		e.pair = append(e.pair, '"')
	case []byte:
		e.pair = append(e.pair, '"')
		stringFieldEscapeBytes(&e.pair, v)
		e.pair = append(e.pair, '"')
	case bool:
		e.pair = strconv.AppendBool(e.pair, v)
	default:
		return &FieldError{fmt.Sprintf("invalid value type: %T", v)}
	}
	return nil
}

func (e *Encoder) buildFieldPair(key string, value interface{}) error {
	e.pair = e.pair[:0]
	key = escape(key)
	// Some keys are not encodeable as line protocol, such as those with a
	// trailing '\' or empty strings.
	if key == "" || key[:len(key)-1] == "\\" {
		return &FieldError{"invalid field key"}
	}
	e.pair = append(e.pair, key...)
	e.pair = append(e.pair, '=')
	return e.buildFieldVal(value)
}

func (e *Encoder) buildFooter(t time.Time) {
	e.footer = e.footer[:0]
	if !t.IsZero() {
		e.footer = append(e.footer, ' ')
		switch e.precision {
		case time.Microsecond:
			e.footer = strconv.AppendInt(e.footer, t.UnixNano()/1000, 10)
		case time.Millisecond:
			e.footer = strconv.AppendInt(e.footer, t.UnixNano()/1000000, 10)
		case time.Second:
			e.footer = strconv.AppendInt(e.footer, t.Unix(), 10)
		default:
			e.footer = strconv.AppendInt(e.footer, t.UnixNano(), 10)
		}
	}
	e.footer = append(e.footer, '\n')
}
