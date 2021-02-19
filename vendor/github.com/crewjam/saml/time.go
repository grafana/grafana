package saml

import "time"

// RelaxedTime is a version of time.Time that supports the time format
// found in SAML documents.
type RelaxedTime time.Time

const timeFormat = "2006-01-02T15:04:05.999Z07:00"

// MarshalText implements encoding.TextMarshaler
func (m RelaxedTime) MarshalText() ([]byte, error) {
	// According to section 1.2.2 of the OASIS SAML 1.1 spec, we can't trust
	// other applications to handle time resolution finer than a millisecond.
	//
	// The time MUST be expressed in UTC.
	return []byte(m.String()), nil
}

func (m RelaxedTime) String() string {
	return time.Time(m).Round(time.Millisecond).UTC().Format(timeFormat)
}

// UnmarshalText implements encoding.TextUnmarshaler
func (m *RelaxedTime) UnmarshalText(text []byte) error {
	if len(text) == 0 {
		*m = RelaxedTime(time.Time{})
		return nil
	}
	t, err1 := time.Parse(time.RFC3339, string(text))
	if err1 == nil {
		t = t.Round(time.Millisecond)
		*m = RelaxedTime(t)
		return nil
	}

	t, err2 := time.Parse(time.RFC3339Nano, string(text))
	if err2 == nil {
		t = t.Round(time.Millisecond)
		*m = RelaxedTime(t)
		return nil
	}

	t, err2 = time.Parse("2006-01-02T15:04:05.999999999", string(text))
	if err2 == nil {
		t = t.Round(time.Millisecond)
		*m = RelaxedTime(t)
		return nil
	}

	return err1
}
