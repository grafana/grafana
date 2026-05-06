package flagext

import (
	"github.com/docker/go-units"
)

// ByteSize used to pass byte sizes to a go-flags CLI
type ByteSize int

// MarshalFlag implements go-flags Marshaller interface
func (b ByteSize) MarshalFlag() (string, error) {
	return units.HumanSize(float64(b)), nil
}

// UnmarshalFlag implements go-flags Unmarshaller interface
func (b *ByteSize) UnmarshalFlag(value string) error {
	sz, err := units.FromHumanSize(value)
	if err != nil {
		return err
	}
	*b = ByteSize(int(sz))
	return nil
}

// String method for a bytesize (pflag value and stringer interface)
func (b ByteSize) String() string {
	return units.HumanSize(float64(b))
}

// Set the value of this bytesize (pflag value interfaces)
func (b *ByteSize) Set(value string) error {
	return b.UnmarshalFlag(value)
}

// Type returns the type of the pflag value (pflag value interface)
func (b *ByteSize) Type() string {
	return "byte-size"
}
