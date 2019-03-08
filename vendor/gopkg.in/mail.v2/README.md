# Gomail
[![Build Status](https://travis-ci.org/go-mail/mail.svg?branch=master)](https://travis-ci.org/go-mail/mail) [![Code Coverage](http://gocover.io/_badge/github.com/go-mail/mail)](http://gocover.io/github.com/go-mail/mail) [![Documentation](https://godoc.org/github.com/go-mail/mail?status.svg)](https://godoc.org/github.com/go-mail/mail)

This is an actively maintained fork of [Gomail][1] and includes fixes and
improvements for a number of outstanding issues. The current progress is
as follows:

 - [x] Timeouts and retries can be specified outside of the 10 second default.
 - [x] Proxying is supported through specifying a custom [NetDialTimeout][2].
 - [ ] Filenames are properly encoded for non-ASCII characters.
 - [ ] Email addresses are properly encoded for non-ASCII characters.
 - [ ] Embedded files and attachments are tested for their existence.
 - [ ] An `io.Reader` can be supplied when embedding and attaching files.

See [Transitioning Existing Codebases][3] for more information on switching.

[1]: https://github.com/go-gomail/gomail
[2]: https://godoc.org/gopkg.in/mail.v2#NetDialTimeout
[3]: #transitioning-existing-codebases

## Introduction

Gomail is a simple and efficient package to send emails. It is well tested and
documented.

Gomail can only send emails using an SMTP server. But the API is flexible and it
is easy to implement other methods for sending emails using a local Postfix, an
API, etc.

It requires Go 1.2 or newer. With Go 1.5, no external dependencies are used.


## Features

Gomail supports:
- Attachments
- Embedded images
- HTML and text templates
- Automatic encoding of special characters
- SSL and TLS
- Sending multiple emails with the same SMTP connection


## Documentation

https://godoc.org/github.com/go-mail/mail


## Download

If you're already using a dependency manager, like [dep][dep], use the following
import path:

```
github.com/go-mail/mail
```

If you *aren't* using vendoring, `go get` the [Gopkg.in](http://gopkg.in)
import path:

```
gopkg.in/mail.v2
```

[dep]: https://github.com/golang/dep#readme

## Examples

See the [examples in the documentation](https://godoc.org/github.com/go-mail/mail#example-package).


## FAQ

### x509: certificate signed by unknown authority

If you get this error it means the certificate used by the SMTP server is not
considered valid by the client running Gomail. As a quick workaround you can
bypass the verification of the server's certificate chain and host name by using
`SetTLSConfig`:

```go
package main

import (
	"crypto/tls"

	"gopkg.in/mail.v2"
)

func main() {
	d := mail.NewDialer("smtp.example.com", 587, "user", "123456")
	d.TLSConfig = &tls.Config{InsecureSkipVerify: true}

	// Send emails using d.
}
```

Note, however, that this is insecure and should not be used in production.

### Transitioning Existing Codebases

If you're already using the original Gomail, switching is as easy as updating
the import line to:

```
import gomail "gopkg.in/mail.v2"
```

## Contribute

Contributions are more than welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for
more info.


## Change log

See [CHANGELOG.md](CHANGELOG.md).


## License

[MIT](LICENSE)


## Support & Contact

You can ask questions on the [Gomail
thread](https://groups.google.com/d/topic/golang-nuts/jMxZHzvvEVg/discussion)
in the Go mailing-list.
