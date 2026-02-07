package units

// Base2Bytes is the old non-SI power-of-2 byte scale (1024 bytes in a kilobyte,
// etc.).
type Base2Bytes int64

// Base-2 byte units.
const (
	Kibibyte Base2Bytes = 1024
	KiB                 = Kibibyte
	Mebibyte            = Kibibyte * 1024
	MiB                 = Mebibyte
	Gibibyte            = Mebibyte * 1024
	GiB                 = Gibibyte
	Tebibyte            = Gibibyte * 1024
	TiB                 = Tebibyte
	Pebibyte            = Tebibyte * 1024
	PiB                 = Pebibyte
	Exbibyte            = Pebibyte * 1024
	EiB                 = Exbibyte
)

var (
	bytesUnitMap    = MakeUnitMap("iB", "B", 1024)
	oldBytesUnitMap = MakeUnitMap("B", "B", 1024)
)

// ParseBase2Bytes supports both iB and B in base-2 multipliers. That is, KB
// and KiB are both 1024.
// However "kB", which is the correct SI spelling of 1000 Bytes, is rejected.
func ParseBase2Bytes(s string) (Base2Bytes, error) {
	n, err := ParseUnit(s, bytesUnitMap)
	if err != nil {
		n, err = ParseUnit(s, oldBytesUnitMap)
	}
	return Base2Bytes(n), err
}

func (b Base2Bytes) String() string {
	return ToString(int64(b), 1024, "iB", "B")
}

// MarshalText implement encoding.TextMarshaler to process json/yaml.
func (b Base2Bytes) MarshalText() ([]byte, error) {
	return []byte(b.String()), nil
}

// UnmarshalText implement encoding.TextUnmarshaler to process json/yaml.
func (b *Base2Bytes) UnmarshalText(text []byte) error {
	n, err := ParseBase2Bytes(string(text))
	*b = n
	return err
}

// Floor returns Base2Bytes with all but the largest unit zeroed out. So that e.g. 1GiB1MiB1KiB → 1GiB.
func (b Base2Bytes) Floor() Base2Bytes {
	switch {
	case b > Exbibyte:
		return (b / Exbibyte) * Exbibyte
	case b > Pebibyte:
		return (b / Pebibyte) * Pebibyte
	case b > Tebibyte:
		return (b / Tebibyte) * Tebibyte
	case b > Gibibyte:
		return (b / Gibibyte) * Gibibyte
	case b > Mebibyte:
		return (b / Mebibyte) * Mebibyte
	case b > Kibibyte:
		return (b / Kibibyte) * Kibibyte
	default:
		return b
	}
}

// Round returns Base2Bytes with all but the first n units zeroed out. So that e.g. 1GiB1MiB1KiB → 1GiB1MiB, if n is 2.
func (b Base2Bytes) Round(n int) Base2Bytes {
	idx := 0

	switch {
	case b > Exbibyte:
		idx = n
	case b > Pebibyte:
		idx = n + 1
	case b > Tebibyte:
		idx = n + 2
	case b > Gibibyte:
		idx = n + 3
	case b > Mebibyte:
		idx = n + 4
	case b > Kibibyte:
		idx = n + 5
	}

	switch idx {
	case 1:
		return b - b%Exbibyte
	case 2:
		return b - b%Pebibyte
	case 3:
		return b - b%Tebibyte
	case 4:
		return b - b%Gibibyte
	case 5:
		return b - b%Mebibyte
	case 6:
		return b - b%Kibibyte
	default:
		return b
	}
}

var metricBytesUnitMap = MakeUnitMap("B", "B", 1000)

// MetricBytes are SI byte units (1000 bytes in a kilobyte).
type MetricBytes SI

// SI base-10 byte units.
const (
	Kilobyte MetricBytes = 1000
	KB                   = Kilobyte
	Megabyte             = Kilobyte * 1000
	MB                   = Megabyte
	Gigabyte             = Megabyte * 1000
	GB                   = Gigabyte
	Terabyte             = Gigabyte * 1000
	TB                   = Terabyte
	Petabyte             = Terabyte * 1000
	PB                   = Petabyte
	Exabyte              = Petabyte * 1000
	EB                   = Exabyte
)

// ParseMetricBytes parses base-10 metric byte units. That is, KB is 1000 bytes.
func ParseMetricBytes(s string) (MetricBytes, error) {
	n, err := ParseUnit(s, metricBytesUnitMap)
	return MetricBytes(n), err
}

// TODO: represents 1000B as uppercase "KB", while SI standard requires "kB".
func (m MetricBytes) String() string {
	return ToString(int64(m), 1000, "B", "B")
}

// Floor returns MetricBytes with all but the largest unit zeroed out. So that e.g. 1GB1MB1KB → 1GB.
func (b MetricBytes) Floor() MetricBytes {
	switch {
	case b > Exabyte:
		return (b / Exabyte) * Exabyte
	case b > Petabyte:
		return (b / Petabyte) * Petabyte
	case b > Terabyte:
		return (b / Terabyte) * Terabyte
	case b > Gigabyte:
		return (b / Gigabyte) * Gigabyte
	case b > Megabyte:
		return (b / Megabyte) * Megabyte
	case b > Kilobyte:
		return (b / Kilobyte) * Kilobyte
	default:
		return b
	}
}

// Round returns MetricBytes with all but the first n units zeroed out. So that e.g. 1GB1MB1KB → 1GB1MB, if n is 2.
func (b MetricBytes) Round(n int) MetricBytes {
	idx := 0

	switch {
	case b > Exabyte:
		idx = n
	case b > Petabyte:
		idx = n + 1
	case b > Terabyte:
		idx = n + 2
	case b > Gigabyte:
		idx = n + 3
	case b > Megabyte:
		idx = n + 4
	case b > Kilobyte:
		idx = n + 5
	}

	switch idx {
	case 1:
		return b - b%Exabyte
	case 2:
		return b - b%Petabyte
	case 3:
		return b - b%Terabyte
	case 4:
		return b - b%Gigabyte
	case 5:
		return b - b%Megabyte
	case 6:
		return b - b%Kilobyte
	default:
		return b
	}
}

// ParseStrictBytes supports both iB and B suffixes for base 2 and metric,
// respectively. That is, KiB represents 1024 and kB, KB represent 1000.
func ParseStrictBytes(s string) (int64, error) {
	n, err := ParseUnit(s, bytesUnitMap)
	if err != nil {
		n, err = ParseUnit(s, metricBytesUnitMap)
	}
	return int64(n), err
}
