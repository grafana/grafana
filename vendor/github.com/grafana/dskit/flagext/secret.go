package flagext

// SecretWithValue returns Secret with specified value.
func SecretWithValue(v string) Secret {
	return Secret{value: v}
}

type Secret struct {
	value string
}

// String implements flag.Value
func (v Secret) String() string {
	return v.value
}

// Set implements flag.Value
func (v *Secret) Set(s string) error {
	v.value = s
	return nil
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (v *Secret) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	if err := unmarshal(&s); err != nil {
		return err
	}

	return v.Set(s)
}

// MarshalYAML implements yaml.Marshaler.
func (v Secret) MarshalYAML() (interface{}, error) {
	if len(v.value) == 0 {
		return "", nil
	}
	return "********", nil
}

// Equal implements go-cmp equality.
func (v Secret) Equal(other Secret) bool {
	return v.value == other.value
}
