package value

import (
	"bytes"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mithrandie/csvq/lib/option"

	"github.com/mithrandie/ternary"
)

var DatetimeFormats = NewDatetimeFormatMap()

type DatetimeFormatMap struct {
	m   *sync.Map
	mtx *sync.Mutex
}

func NewDatetimeFormatMap() DatetimeFormatMap {
	return DatetimeFormatMap{
		m:   &sync.Map{},
		mtx: &sync.Mutex{},
	}
}

func (dfmap DatetimeFormatMap) store(key string, value string) {
	dfmap.m.Store(key, value)
}

func (dfmap DatetimeFormatMap) load(key string) (string, bool) {
	v, ok := dfmap.m.Load(key)
	if ok {
		return v.(string), ok
	}
	return "", ok
}

func (dfmap DatetimeFormatMap) Get(s string) string {
	if f, ok := dfmap.load(s); ok {
		return f
	}

	dfmap.mtx.Lock()
	defer dfmap.mtx.Unlock()

	if f, ok := dfmap.load(s); ok {
		return f
	}

	f := ConvertDatetimeFormat(s)
	dfmap.store(s, f)
	return f
}

func StrToTime(s string, formats []string, location *time.Location) (time.Time, bool) {
	s = option.TrimSpace(s)

	for _, format := range formats {
		if t, e := time.ParseInLocation(DatetimeFormats.Get(format), s, location); e == nil {
			return t, true
		}
	}

	if 8 <= len(s) && '0' <= s[0] && s[0] <= '9' {
		switch {
		case s[4] == '-':
			if len(s) < 10 {
				if t, e := time.ParseInLocation("2006-1-2", s, location); e == nil {
					return t, true
				}
			} else if len(s) == 10 {
				if t, e := time.ParseInLocation("2006-01-02", s, location); e == nil {
					return t, true
				}
			} else if s[10] == 'T' {
				if s[len(s)-6] == '+' || s[len(s)-6] == '-' || s[len(s)-1] == 'Z' {
					if t, e := time.Parse(time.RFC3339Nano, s); e == nil {
						return t, true
					}
				} else {
					if t, e := time.ParseInLocation("2006-01-02T15:04:05.999999999", s, location); e == nil {
						return t, true
					}
				}
			} else if s[10] == ' ' {
				if t, e := time.ParseInLocation("2006-01-02 15:04:05.999999999", s, location); e == nil {
					return t, true
				} else if t, e := time.Parse("2006-01-02 15:04:05.999999999 Z07:00", s); e == nil {
					return t, true
				} else if t, e := time.Parse("2006-01-02 15:04:05.999999999 -0700", s); e == nil {
					return t, true
				} else if t, e := time.Parse("2006-01-02 15:04:05.999999999 MST", s); e == nil {
					return t, true
				}
			} else {
				if t, e := time.ParseInLocation("2006-1-2 15:04:05.999999999", s, location); e == nil {
					return t, true
				} else if t, e := time.Parse("2006-1-2 15:04:05.999999999 Z07:00", s); e == nil {
					return t, true
				} else if t, e := time.Parse("2006-1-2 15:04:05.999999999 -0700", s); e == nil {
					return t, true
				} else if t, e := time.Parse("2006-1-2 15:04:05.999999999 MST", s); e == nil {
					return t, true
				}
			}
		case s[4] == '/':
			if len(s) < 10 {
				if t, e := time.ParseInLocation("2006/1/2", s, location); e == nil {
					return t, true
				}
			} else if len(s) == 10 {
				if t, e := time.ParseInLocation("2006/01/02", s, location); e == nil {
					return t, true
				}
			} else if s[10] == ' ' {
				if t, e := time.ParseInLocation("2006/01/02 15:04:05.999999999", s, location); e == nil {
					return t, true
				} else if t, e := time.Parse("2006/01/02 15:04:05.999999999 Z07:00", s); e == nil {
					return t, true
				} else if t, e := time.Parse("2006/01/02 15:04:05.999999999 -0700", s); e == nil {
					return t, true
				} else if t, e := time.Parse("2006/01/02 15:04:05.999999999 MST", s); e == nil {
					return t, true
				}
			} else {
				if t, e := time.ParseInLocation("2006/1/2 15:04:05.999999999", s, location); e == nil {
					return t, true
				} else if t, e := time.Parse("2006/1/2 15:04:05.999999999 Z07:00", s); e == nil {
					return t, true
				} else if t, e := time.Parse("2006/1/2 15:04:05.999999999 -0700", s); e == nil {
					return t, true
				} else if t, e := time.Parse("2006/1/2 15:04:05.999999999 MST", s); e == nil {
					return t, true
				}
			}
		default:
			if t, e := time.Parse(time.RFC822, s); e == nil {
				return t, true
			} else if t, e := time.Parse(time.RFC822Z, s); e == nil {
				return t, true
			}
		}
	}
	return time.Time{}, false
}

func ConvertDatetimeFormat(format string) string {
	runes := []rune(format)
	var buf bytes.Buffer

	escaped := false
	for _, r := range runes {
		if !escaped {
			switch r {
			case '%':
				escaped = true
			default:
				buf.WriteRune(r)
			}
			continue
		}

		switch r {
		case 'a':
			buf.WriteString("Mon")
		case 'b':
			buf.WriteString("Jan")
		case 'c':
			buf.WriteString("1")
		case 'd':
			buf.WriteString("02")
		case 'E':
			buf.WriteString("_2")
		case 'e':
			buf.WriteString("2")
		case 'F':
			buf.WriteString(".999999")
		case 'f':
			buf.WriteString(".000000")
		case 'H':
			buf.WriteString("15")
		case 'h':
			buf.WriteString("03")
		case 'i':
			buf.WriteString("04")
		case 'l':
			buf.WriteString("3")
		case 'M':
			buf.WriteString("January")
		case 'm':
			buf.WriteString("01")
		case 'N':
			buf.WriteString(".999999999")
		case 'n':
			buf.WriteString(".000000000")
		case 'p':
			buf.WriteString("PM")
		case 'r':
			buf.WriteString("03:04:05 PM")
		case 's':
			buf.WriteString("05")
		case 'T':
			buf.WriteString("15:04:05")
		case 'W':
			buf.WriteString("Monday")
		case 'Y':
			buf.WriteString("2006")
		case 'y':
			buf.WriteString("06")
		case 'Z':
			buf.WriteString("Z07:00")
		case 'z':
			buf.WriteString("MST")
		default:
			buf.WriteRune(r)
		}
		escaped = false
	}

	return buf.String()
}

func Float64ToTime(f float64, location *time.Location) time.Time {
	s := Float64ToStr(f, false)
	ar := strings.Split(s, ".")

	sec, _ := strconv.ParseInt(ar[0], 10, 64)
	nsec, _ := (func() (int64, error) {
		if len(ar) < 2 {
			return 0, nil
		}

		if 9 < len(ar[1]) {
			return strconv.ParseInt(ar[1][:9], 10, 64)
		}

		dec := ar[1] + strings.Repeat("0", 9-len(ar[1]))
		return strconv.ParseInt(dec, 10, 64)
	})()

	return TimeFromUnixTime(sec, nsec, location)
}

func Int64ToStr(i int64) string {
	return strconv.FormatInt(i, 10)
}

func Float64ToStr(f float64, useScientificNotation bool) string {
	if useScientificNotation {
		return strconv.FormatFloat(f, 'g', -1, 64)
	}
	return strconv.FormatFloat(f, 'f', -1, 64)
}

func ToInteger(p Primary) Primary {
	switch val := p.(type) {
	case *Integer:
		return NewInteger(val.Raw())
	case *Float:
		if math.IsNaN(val.Raw()) || math.IsInf(val.Raw(), 0) {
			return NewNull()
		}
		return NewInteger(int64(val.Raw()))
	case *String:
		s := option.TrimSpace(val.Raw())
		if i, e := strconv.ParseInt(s, 10, 64); e == nil {
			return NewInteger(i)
		}
		if f, e := strconv.ParseFloat(s, 64); e == nil {
			return NewInteger(int64(f))
		}
	}

	return NewNull()
}

func ToIntegerStrictly(p Primary) Primary {
	switch p.(type) {
	case *Integer:
		return NewInteger(p.(*Integer).Raw())
	case *String:
		s := option.TrimSpace(p.(*String).Raw())
		if i, e := strconv.ParseInt(s, 10, 64); e == nil {
			return NewInteger(i)
		}
	}

	return NewNull()
}

func ToFloat(p Primary) Primary {
	switch p.(type) {
	case *Integer:
		return NewFloat(float64(p.(*Integer).Raw()))
	case *Float:
		return NewFloat(p.(*Float).Raw())
	case *String:
		s := option.TrimSpace(p.(*String).Raw())
		if f, e := strconv.ParseFloat(s, 64); e == nil {
			return NewFloat(f)
		}
	}

	return NewNull()
}

func ToDatetime(p Primary, formats []string, location *time.Location) Primary {
	switch p.(type) {
	case *Datetime:
		return NewDatetime(p.(*Datetime).Raw())
	case *String:
		if dt, ok := StrToTime(p.(*String).Raw(), formats, location); ok {
			return NewDatetime(dt)
		}
	}

	return NewNull()
}

func TimeFromUnixTime(sec int64, nano int64, location *time.Location) time.Time {
	return time.Unix(sec, nano).In(location)
}

func ToBoolean(p Primary) Primary {
	switch p.(type) {
	case *Boolean:
		return NewBoolean(p.(*Boolean).Raw())
	case *String, *Integer, *Float, *Ternary:
		if p.Ternary() != ternary.UNKNOWN {
			return NewBoolean(p.Ternary().ParseBool())
		}
	}
	return NewNull()
}

func ToString(p Primary) Primary {
	switch p.(type) {
	case *String:
		return NewString(p.(*String).Raw())
	case *Integer:
		return NewString(Int64ToStr(p.(*Integer).Raw()))
	case *Float:
		return NewString(Float64ToStr(p.(*Float).Raw(), false))
	}
	return NewNull()
}
