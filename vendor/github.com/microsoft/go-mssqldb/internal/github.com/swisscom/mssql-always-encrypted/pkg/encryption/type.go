package encryption

type Type struct {
	Deterministic bool
	Name          string
	Value         byte
}

var Plaintext = Type{
	Deterministic: false,
	Name:          "Plaintext",
	Value:         0,
}

var Deterministic = Type{
	Deterministic: true,
	Name:          "Deterministic",
	Value:         1,
}

var Randomized = Type{
	Deterministic: false,
	Name:          "Randomized",
	Value:         2,
}

func From(encType byte) Type {
	switch encType {
	case 0:
		return Plaintext
	case 1:
		return Deterministic
	case 2:
		return Randomized
	}
	return Plaintext
}
