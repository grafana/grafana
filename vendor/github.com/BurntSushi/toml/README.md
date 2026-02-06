TOML stands for Tom's Obvious, Minimal Language. This Go package provides a
reflection interface similar to Go's standard library `json` and `xml` packages.

Compatible with TOML version [v1.0.0](https://toml.io/en/v1.0.0).

Documentation: https://pkg.go.dev/github.com/BurntSushi/toml

See the [releases page](https://github.com/BurntSushi/toml/releases) for a
changelog; this information is also in the git tag annotations (e.g. `git show
v0.4.0`).

This library requires Go 1.18 or newer; add it to your go.mod with:

    % go get github.com/BurntSushi/toml@latest

It also comes with a TOML validator CLI tool:

    % go install github.com/BurntSushi/toml/cmd/tomlv@latest
    % tomlv some-toml-file.toml

### Examples
For the simplest example, consider some TOML file as just a list of keys and
values:

```toml
Age = 25
Cats = [ "Cauchy", "Plato" ]
Pi = 3.14
Perfection = [ 6, 28, 496, 8128 ]
DOB = 1987-07-05T05:45:00Z
```

Which can be decoded with:

```go
type Config struct {
	Age        int
	Cats       []string
	Pi         float64
	Perfection []int
	DOB        time.Time
}

var conf Config
_, err := toml.Decode(tomlData, &conf)
```

You can also use struct tags if your struct field name doesn't map to a TOML key
value directly:

```toml
some_key_NAME = "wat"
```

```go
type TOML struct {
    ObscureKey string `toml:"some_key_NAME"`
}
```

Beware that like other decoders **only exported fields** are considered when
encoding and decoding; private fields are silently ignored.

### Using the `Marshaler` and `encoding.TextUnmarshaler` interfaces
Here's an example that automatically parses values in a `mail.Address`:

```toml
contacts = [
    "Donald Duck <donald@duckburg.com>",
    "Scrooge McDuck <scrooge@duckburg.com>",
]
```

Can be decoded with:

```go
// Create address type which satisfies the encoding.TextUnmarshaler interface.
type address struct {
	*mail.Address
}

func (a *address) UnmarshalText(text []byte) error {
	var err error
	a.Address, err = mail.ParseAddress(string(text))
	return err
}

// Decode it.
func decode() {
	blob := `
		contacts = [
			"Donald Duck <donald@duckburg.com>",
			"Scrooge McDuck <scrooge@duckburg.com>",
		]
	`

	var contacts struct {
		Contacts []address
	}

	_, err := toml.Decode(blob, &contacts)
	if err != nil {
		log.Fatal(err)
	}

	for _, c := range contacts.Contacts {
		fmt.Printf("%#v\n", c.Address)
	}

	// Output:
	// &mail.Address{Name:"Donald Duck", Address:"donald@duckburg.com"}
	// &mail.Address{Name:"Scrooge McDuck", Address:"scrooge@duckburg.com"}
}
```

To target TOML specifically you can implement `UnmarshalTOML` TOML interface in
a similar way.

### More complex usage
See the [`_example/`](/_example) directory for a more complex example.
