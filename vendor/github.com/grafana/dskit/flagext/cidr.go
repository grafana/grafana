package flagext

import (
	"net"
	"strings"

	"github.com/pkg/errors"
)

// CIDR is a network CIDR.
type CIDR struct {
	Value *net.IPNet
}

// String implements flag.Value.
func (c CIDR) String() string {
	if c.Value == nil {
		return ""
	}
	return c.Value.String()
}

// Set implements flag.Value.
func (c *CIDR) Set(s string) error {
	_, value, err := net.ParseCIDR(s)
	if err != nil {
		return err
	}
	c.Value = value
	return nil
}

// CIDRSliceCSV is a slice of CIDRs that is parsed from a comma-separated string.
// It implements flag.Value and yaml Marshalers.
type CIDRSliceCSV []CIDR

// String implements flag.Value
func (c CIDRSliceCSV) String() string {
	values := make([]string, 0, len(c))
	for _, cidr := range c {
		values = append(values, cidr.String())
	}

	return strings.Join(values, ",")
}

// Set implements flag.Value
func (c *CIDRSliceCSV) Set(s string) error {
	parts := strings.Split(s, ",")

	for _, part := range parts {
		cidr := &CIDR{}
		if err := cidr.Set(part); err != nil {
			return errors.Wrapf(err, "cidr: %s", part)
		}

		*c = append(*c, *cidr)
	}

	return nil
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (c *CIDRSliceCSV) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	if err := unmarshal(&s); err != nil {
		return err
	}

	// An empty string means no CIDRs has been configured.
	if s == "" {
		*c = nil
		return nil
	}

	return c.Set(s)
}

// MarshalYAML implements yaml.Marshaler.
func (c CIDRSliceCSV) MarshalYAML() (interface{}, error) {
	return c.String(), nil
}
