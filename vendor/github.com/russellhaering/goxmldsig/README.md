# goxmldsig

[![Build Status](https://travis-ci.org/russellhaering/goxmldsig.svg?branch=master)](https://travis-ci.org/russellhaering/goxmldsig)
[![GoDoc](https://godoc.org/github.com/russellhaering/goxmldsig?status.svg)](https://godoc.org/github.com/russellhaering/goxmldsig)

XML Digital Signatures implemented in pure Go.

## Installation

Install `goxmldsig` into your `$GOPATH` using `go get`:

```
$ go get github.com/russellhaering/goxmldsig
```

## Usage

### Signing

```go
package main

import (
    "github.com/beevik/etree"
    "github.com/russellhaering/goxmldsig"
)

func main() {
    // Generate a key and self-signed certificate for signing
    randomKeyStore := dsig.RandomKeyStoreForTest()
    ctx := dsig.NewDefaultSigningContext(randomKeyStore)
    elementToSign := &etree.Element{
        Tag: "ExampleElement",
    }
    elementToSign.CreateAttr("ID", "id1234")

    // Sign the element
    signedElement, err := ctx.SignEnveloped(elementToSign)
    if err != nil {
        panic(err)
    }

    // Serialize the signed element. It is important not to modify the element
    // after it has been signed - even pretty-printing the XML will invalidate
    // the signature.
    doc := etree.NewDocument()
    doc.SetRoot(signedElement)
    str, err := doc.WriteToString()
    if err != nil {
        panic(err)
    }

    println(str)
}
```

### Signature Validation

```go
// Validate an element against a root certificate
func validate(root *x509.Certificate, el *etree.Element) {
    // Construct a signing context with one or more roots of trust.
    ctx := dsig.NewDefaultValidationContext(&dsig.MemoryX509CertificateStore{
        Roots: []*x509.Certificate{root},
    })

    // It is important to only use the returned validated element.
    // See: https://www.w3.org/TR/xmldsig-bestpractices/#check-what-is-signed
    validated, err := ctx.Validate(el)
    if err != nil {
        panic(err)
    }

    doc := etree.NewDocument()
    doc.SetRoot(validated)
    str, err := doc.WriteToString()
    if err != nil {
        panic(err)
    }

    println(str)
}
```

## Limitations

This library was created in order to [implement SAML 2.0](https://github.com/russellhaering/gosaml2)
without needing to execute a command line tool to create and validate signatures. It currently
only implements the subset of relevant standards needed to support that implementation, but
I hope to make it more complete over time. Contributions are welcome.
