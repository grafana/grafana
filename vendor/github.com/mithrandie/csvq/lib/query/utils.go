package query

import (
	"bytes"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/ternary"
)

const LimitToUseUintSlicePool = 20

type UintPool struct {
	limitToUseSlice int
	m               map[uint]bool
	values          []uint
}

func NewUintPool(initCap int, limitToUseSlice int) *UintPool {
	return &UintPool{
		limitToUseSlice: limitToUseSlice,
		m:               make(map[uint]bool, initCap),
		values:          make([]uint, 0, initCap),
	}
}

func (c *UintPool) Exists(val uint) bool {
	if c.limitToUseSlice <= len(c.values) {
		_, ok := c.m[val]
		return ok
	}

	for i := range c.values {
		if val == c.values[i] {
			return true
		}
	}
	return false
}

func (c *UintPool) Add(val uint) {
	c.m[val] = true
	c.values = append(c.values, val)
}

func (c *UintPool) Range(fn func(idx int, value uint) error) error {
	var err error
	for i := range c.values {
		if err = fn(i, c.values[i]); err != nil {
			break
		}
	}
	return err
}

func (c *UintPool) Len() int {
	return len(c.values)
}

func InStrSliceWithCaseInsensitive(s string, list []string) bool {
	for _, v := range list {
		if strings.EqualFold(s, v) {
			return true
		}
	}
	return false
}

func Distinguish(list []value.Primary, flags *option.Flags) []value.Primary {
	values := make(map[string]int, 40)
	valueKeys := make([]string, 0, 40)

	buf := GetComparisonKeysBuf()

	for i, v := range list {
		buf.Reset()
		SerializeComparisonKeys(buf, []value.Primary{v}, flags)
		key := buf.String()
		if _, ok := values[key]; !ok {
			values[key] = i
			valueKeys = append(valueKeys, key)
		}
	}

	PutComparisonkeysBuf(buf)

	distinguished := make([]value.Primary, len(valueKeys))
	for i, key := range valueKeys {
		distinguished[i] = list[values[key]]
	}

	return distinguished
}

func FormatCount(i int, obj string) string {
	var s string
	if i == 0 {
		s = fmt.Sprintf("no %s", obj)
	} else if i == 1 {
		s = fmt.Sprintf("%d %s", i, obj)
	} else {
		s = fmt.Sprintf("%d %ss", i, obj)
	}
	return s
}

var comparisonKeysBufPool = &sync.Pool{
	New: func() interface{} {
		return &bytes.Buffer{}
	},
}

func GetComparisonKeysBuf() *bytes.Buffer {
	buf := comparisonKeysBufPool.Get().(*bytes.Buffer)
	return buf
}

func PutComparisonkeysBuf(buf *bytes.Buffer) {
	buf.Reset()
	comparisonKeysBufPool.Put(buf)
}

func SerializeComparisonKeys(buf *bytes.Buffer, values []value.Primary, flags *option.Flags) {
	for i, val := range values {
		if 0 < i {
			buf.WriteByte(58)
		}

		if flags.StrictEqual {
			SerializeIdenticalKey(buf, val)
		} else {
			SerializeKey(buf, val, flags)
		}
	}
}

func SerializeKey(buf *bytes.Buffer, val value.Primary, flags *option.Flags) {
	if value.IsNull(val) {
		serializeNull(buf)
	} else if in := value.ToIntegerStrictly(val); !value.IsNull(in) {
		serializeInteger(buf, in.(*value.Integer).String())
		value.Discard(in)
	} else if f := value.ToFloat(val); !value.IsNull(f) {
		serializeFloat(buf, f.(*value.Float).String())
		value.Discard(f)
	} else if dt := value.ToDatetime(val, flags.DatetimeFormat, flags.GetTimeLocation()); !value.IsNull(dt) {
		serializeDatetime(buf, dt.(*value.Datetime).Raw())
		value.Discard(dt)
	} else if b := value.ToBoolean(val); !value.IsNull(b) {
		if b.(*value.Boolean).Raw() {
			serializeInteger(buf, "1")
		} else {
			serializeInteger(buf, "0")
		}
	} else if s, ok := val.(*value.String); ok {
		serializeString(buf, s.Raw())
	} else {
		serializeNull(buf)
	}
}

func SerializeIdenticalKey(buf *bytes.Buffer, val value.Primary) {
	switch val.(type) {
	case *value.String:
		serializeCaseSensitiveString(buf, val.(*value.String).Raw())
	case *value.Integer:
		serializeInteger(buf, val.(*value.Integer).String())
	case *value.Float:
		serializeFloat(buf, val.(*value.Float).String())
	case *value.Boolean:
		serializeBoolean(buf, val.(*value.Boolean).Raw())
	case *value.Ternary:
		serializeTernary(buf, val.(*value.Ternary).Ternary())
	case *value.Datetime:
		serializeDatetime(buf, val.(*value.Datetime).Raw())
	default:
		serializeNull(buf)
	}
}

func serializeNull(buf *bytes.Buffer) {
	buf.Write([]byte{91, 78, 93})
}

func serializeInteger(buf *bytes.Buffer, s string) {
	buf.Write([]byte{91, 73, 93})
	buf.WriteString(s)
}

func serializeFloat(buf *bytes.Buffer, s string) {
	buf.Write([]byte{91, 70, 93})
	buf.WriteString(s)
}

func serializeDatetime(buf *bytes.Buffer, t time.Time) {
	serializeDatetimeFromUnixNano(buf, t.UnixNano())
}

func serializeDatetimeFromUnixNano(buf *bytes.Buffer, t int64) {
	buf.Write([]byte{91, 68, 93})
	buf.WriteString(value.Int64ToStr(t))
}

func serializeString(buf *bytes.Buffer, s string) {
	buf.Write([]byte{91, 83, 93})
	buf.WriteString(strings.ToUpper(option.TrimSpace(s)))
}

func serializeCaseSensitiveString(buf *bytes.Buffer, s string) {
	buf.Write([]byte{91, 83, 93})
	buf.WriteString(option.TrimSpace(s))
}

func serializeBoolean(buf *bytes.Buffer, b bool) {
	buf.Write([]byte{91, 66, 93})
	if b {
		buf.WriteString("T")
	} else {
		buf.WriteString("F")
	}
}

func serializeTernary(buf *bytes.Buffer, t ternary.Value) {
	buf.Write([]byte{91, 84, 93})
	if t == ternary.TRUE {
		buf.WriteString("T")
	} else if t == ternary.FALSE {
		buf.WriteString("F")
	} else {
		buf.WriteString("U")
	}
}
