# testcerts

![Actions Status](https://github.com/madflojo/testcerts/actions/workflows/go.yaml/badge.svg?branch=main)
[![codecov](https://codecov.io/gh/madflojo/testcerts/branch/main/graph/badge.svg?token=H9C9B6I0AS)](https://codecov.io/gh/madflojo/testcerts)
[![Go Report Card](https://goreportcard.com/badge/github.com/madflojo/testcerts)](https://goreportcard.com/report/github.com/madflojo/testcerts)
[![Go Reference](https://pkg.go.dev/badge/github.com/madflojo/testcerts.svg)](https://pkg.go.dev/github.com/madflojo/testcerts)
[![license](https://img.shields.io/github/license/madflojo/testcerts.svg?maxAge=2592000)](https://github.com/madflojo/testcerts/LICENSE)

Stop saving test certificates in your code repos. Start generating them in your tests.

```go
func TestFunc(t *testing.T) {
	// Create and write self-signed Certificate and Key to temporary files
	cert, key, err := testcerts.GenerateToTempFile("/tmp/")
	if err != nil {
		// do something
	}
	defer os.Remove(key)
	defer os.Remove(cert)

	// Start HTTP Listener with test certificates
	err = http.ListenAndServeTLS("127.0.0.1:443", cert, key, someHandler)
	if err != nil {
		// do something
	}
}
```

For more complex tests, you can also use this package to create a Certificate Authority and a key pair signed by that Certificate Authority for any test domain you want.

```go
func TestFunc(t *testing.T) {
	// Generate Certificate Authority
	ca := testcerts.NewCA()

	go func() {
		// Create a signed Certificate and Key for "localhost"
		certs, err := ca.NewKeyPair("localhost")
		if err != nil {
			// do something
		}

		// Write certificates to a file
		err = certs.ToFile("/tmp/cert", "/tmp/key")
		if err {
			// do something
		}

		// Start HTTP Listener
		err = http.ListenAndServeTLS("localhost:443", "/tmp/cert", "/tmp/key", someHandler)
		if err != nil {
			// do something
		}
	}()

	// Create a client with the self-signed CA
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: certs.ConfigureTLSConfig(ca.GenerateTLSConfig()),
		},
	}

	// Make an HTTPS request
	r, _ := client.Get("https://localhost")
}
```

Simplify your testing, and don't hassle with certificates anymore.

## Contributing

If you find a bug or have an idea for a feature, please open an issue or a pull request.

## License

testcerts is released under the MIT License. See [LICENSE](./LICENSE) for details.



