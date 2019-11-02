# SAML
[![](https://godoc.org/github.com/crewjam/saml?status.svg)](http://godoc.org/github.com/crewjam/saml)

[![Build Status](https://travis-ci.org/crewjam/saml.svg?branch=master)](https://travis-ci.org/crewjam/saml)

Package saml contains a partial implementation of the SAML standard in golang.
SAML is a standard for identity federation, i.e. either allowing a third party to authenticate your users or allowing third parties to rely on us to authenticate their users.

## Introduction

In SAML parlance an **Identity Provider** (IDP) is a service that knows how to authenticate users. A **Service Provider** (SP) is a service that delegates authentication to an IDP. If you are building a service where users log in with someone else's credentials, then you are a **Service Provider**. This package supports implementing both service providers and identity providers.

The core package contains the implementation of SAML. The package samlsp provides helper middleware suitable for use in Service Provider applications. The package samlidp provides a rudimentary IDP service that is useful for testing or as a starting point for other integrations.

## Breaking Changes 

Note: between version 0.2.0 and the current master include changes to the API
that will break your existing code a little.

This change turned some fields from pointers to a single optional struct into
the more correct slice of struct, and to pluralize the field name. For example,
`IDPSSODescriptor *IDPSSODescriptor` has become 
`IDPSSODescriptors []IDPSSODescriptor`. This more accurately reflects the 
standard.

The struct `Metadata` has been renamed to `EntityDescriptor`. In 0.2.0 and before, 
every struct derived from the standard has the same name as in the standard, 
*except* for `Metadata` which should always have been called `EntityDescriptor`. 

In various places `url.URL` is now used where `string` was used <= version 0.1.0.

In various places where keys and certificates were modeled as `string` 
<= version 0.1.0 (what was I thinking?!) they are now modeled as 
`*rsa.PrivateKey`, `*x509.Certificate`, or `crypto.PrivateKey` as appropriate.

## Getting Started as a Service Provider

Let us assume we have a simple web application to protect. We'll modify this application so it uses SAML to authenticate users.
```golang
package main

import (
    "fmt"
    "net/http"
)

func hello(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello, World!")
}

func main() {
    app := http.HandlerFunc(hello)
    http.Handle("/hello", app)
    http.ListenAndServe(":8000", nil)
}
```
Each service provider must have an self-signed X.509 key pair established. You can generate your own with something like this:

    openssl req -x509 -newkey rsa:2048 -keyout myservice.key -out myservice.cert -days 365 -nodes -subj "/CN=myservice.example.com"

We will use `samlsp.Middleware` to wrap the endpoint we want to protect. Middleware provides both an `http.Handler` to serve the SAML specific URLs **and** a set of wrappers to require the user to be logged in. We also provide the URL where the service provider can fetch the metadata from the IDP at startup. In our case, we'll use [samltest.id](https://samltest.id/), an identity provider designed for testing.

```golang
package main

import (
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"net/url"

	"github.com/crewjam/saml/samlsp"
)

func hello(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hello, %s!", samlsp.Token(r.Context()).Attributes.Get("cn"))
}

func main() {
	keyPair, err := tls.LoadX509KeyPair("myservice.cert", "myservice.key")
	if err != nil {
		panic(err) // TODO handle error
	}
	keyPair.Leaf, err = x509.ParseCertificate(keyPair.Certificate[0])
	if err != nil {
		panic(err) // TODO handle error
	}

	idpMetadataURL, err := url.Parse("https://samltest.id/saml/idp")
	if err != nil {
		panic(err) // TODO handle error
	}

	rootURL, err := url.Parse("http://localhost:8000")
	if err != nil {
		panic(err) // TODO handle error
	}

	samlSP, _ := samlsp.New(samlsp.Options{
		URL:            *rootURL,
		Key:            keyPair.PrivateKey.(*rsa.PrivateKey),
		Certificate:    keyPair.Leaf,
		IDPMetadataURL: idpMetadataURL,
	})
	app := http.HandlerFunc(hello)
	http.Handle("/hello", samlSP.RequireAccount(app))
	http.Handle("/saml/", samlSP)
	http.ListenAndServe(":8000", nil)
}
```

Next we'll have to register our service provider with the identity provider to establish trust from the service provider to the IDP. For [samltest.id](https://samltest.id/), you can do something like:

    mdpath=saml-test-$USER-$HOST.xml
    curl localhost:8000/saml/metadata > $mdpath

Navigate to https://samltest.id/upload.php and upload the file you fetched.

Now you should be able to authenticate. The flow should look like this:

1. You browse to `localhost:8000/hello`

1. The middleware redirects you to `https://samltest.id/idp/profile/SAML2/Redirect/SSO`

1. samltest.id prompts you for a username and password.

1. samltest.id returns you an HTML document which contains an HTML form setup to POST to `localhost:8000/saml/acs`. The form is automatically submitted if you have javascript enabled.

1. The local service validates the response, issues a session cookie, and redirects you to the original URL, `localhost:8000/hello`.

1. This time when `localhost:8000/hello` is requested there is a valid session and so the main content is served.

## Getting Started as an Identity Provider

Please see `example/idp/` for a substantially complete example of how to use the library and helpers to be an identity provider.

## Support

The SAML standard is huge and complex with many dark corners and strange, unused features. This package implements the most commonly used subset of these features required to provide a single sign on experience. The package supports at least the subset of SAML known as [interoperable SAML](http://saml2int.org).

This package supports the **Web SSO** profile. Message flows from the service provider to the IDP are supported using the **HTTP Redirect** binding and the **HTTP POST** binding. Message flows from the IDP to the service provider are supported via the **HTTP POST** binding.

The package supports signed and encrypted SAML assertions. It does not support signed or encrypted requests.

## RelayState

The *RelayState* parameter allows you to pass user state information across the authentication flow. The most common use for this is to allow a user to request a deep link into your site, be redirected through the SAML login flow, and upon successful completion, be directed to the originally requested link, rather than the root.

Unfortunately, *RelayState* is less useful than it could be. Firstly, it is **not** authenticated, so anything you supply must be signed to avoid XSS or CSRF. Secondly, it is limited to 80 bytes in length, which precludes signing. (See section 3.6.3.1 of SAMLProfiles.)

## References

The SAML specification is a collection of PDFs (sadly):

- [SAMLCore](http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf) defines data types.

- [SAMLBindings](http://docs.oasis-open.org/security/saml/v2.0/saml-bindings-2.0-os.pdf) defines the details of the HTTP requests in play.

- [SAMLProfiles](http://docs.oasis-open.org/security/saml/v2.0/saml-profiles-2.0-os.pdf) describes data flows.

- [SAMLConformance](http://docs.oasis-open.org/security/saml/v2.0/saml-conformance-2.0-os.pdf) includes a support matrix for various parts of the protocol.

[SAMLtest](https://samltest.id/) is a testing ground for SAML service and identity providers.

## Security Issues

Please do not report security issues in the issue tracker. Rather, please contact me directly at ross@kndr.org ([PGP Key `78B6038B3B9DFB88`](https://keybase.io/crewjam)).
