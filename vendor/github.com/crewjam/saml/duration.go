package saml

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Duration is a time.Duration that uses the xsd:duration format for text
// marshalling and unmarshalling.
type Duration time.Duration

// MarshalText implements the encoding.TextMarshaler interface.
func (d Duration) MarshalText() ([]byte, error) {
	if d == 0 {
		return nil, nil
	}

	out := "PT"
	if d < 0 {
		d *= -1
		out = "-" + out
	}

	h := time.Duration(d) / time.Hour
	m := time.Duration(d) % time.Hour / time.Minute
	s := time.Duration(d) % time.Minute / time.Second
	ns := time.Duration(d) % time.Second
	if h > 0 {
		out += fmt.Sprintf("%dH", h)
	}
	if m > 0 {
		out += fmt.Sprintf("%dM", m)
	}
	if s > 0 || ns > 0 {
		out += fmt.Sprintf("%d", s)
		if ns > 0 {
			out += strings.TrimRight(fmt.Sprintf(".%09d", ns), "0")
		}
		out += "S"
	}

	return []byte(out), nil
}

const (
	day   = 24 * time.Hour
	month = 30 * day  // Assumed to be 30 days.
	year  = 365 * day // Assumed to be non-leap year.
)

var (
	durationRegexp     = regexp.MustCompile(`^(-?)P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(.+))?$`)
	durationTimeRegexp = regexp.MustCompile(`^(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$`)
)

// UnmarshalText implements the encoding.TextUnmarshaler interface.
func (d *Duration) UnmarshalText(text []byte) error {
	if text == nil {
		*d = 0
		return nil
	}

	var (
		out  time.Duration
		sign time.Duration = 1
	)
	match := durationRegexp.FindStringSubmatch(string(text))
	if match == nil || strings.Join(match[2:6], "") == "" {
		return fmt.Errorf("invalid duration (%s)", text)
	}
	if match[1] == "-" {
		sign = -1
	}
	if match[2] != "" {
		y, err := strconv.Atoi(match[2])
		if err != nil {
			return fmt.Errorf("invalid duration years (%s): %s", text, err)
		}
		out += time.Duration(y) * year
	}
	if match[3] != "" {
		m, err := strconv.Atoi(match[3])
		if err != nil {
			return fmt.Errorf("invalid duration months (%s): %s", text, err)
		}
		out += time.Duration(m) * month
	}
	if match[4] != "" {
		d, err := strconv.Atoi(match[4])
		if err != nil {
			return fmt.Errorf("invalid duration days (%s): %s", text, err)
		}
		out += time.Duration(d) * day
	}
	if match[5] != "" {
		match := durationTimeRegexp.FindStringSubmatch(match[5])
		if match == nil {
			return fmt.Errorf("invalid duration (%s)", text)
		}
		if match[1] != "" {
			h, err := strconv.Atoi(match[1])
			if err != nil {
				return fmt.Errorf("invalid duration hours (%s): %s", text, err)
			}
			out += time.Duration(h) * time.Hour
		}
		if match[2] != "" {
			m, err := strconv.Atoi(match[2])
			if err != nil {
				return fmt.Errorf("invalid duration minutes (%s): %s", text, err)
			}
			out += time.Duration(m) * time.Minute
		}
		if match[3] != "" {
			s, err := strconv.ParseFloat(match[3], 64)
			if err != nil {
				return fmt.Errorf("invalid duration seconds (%s): %s", text, err)
			}
			out += time.Duration(s * float64(time.Second))
		}
	}

	*d = Duration(sign * out)
	return nil
}
