# xml-roundtrip-validator

The Go module `github.com/mattermost/xml-roundtrip-validator` implements mitigations for multiple security issues in Go's `encoding/xml`. Applications that use `encoding/xml` for security-critical operations, such as XML signature validation and SAML, may use the `Validate` and `ValidateAll` functions to avoid impact from malicious XML inputs.

## Usage

### Validate

```Go
import (
    "strings"

    xrv "github.com/mattermost/xml-roundtrip-validator"
)

func DoStuffWithXML(input string) {
    if err := xrv.Validate(strings.NewReader(input)); err != nil {
        panic(err)
    }
    // validation succeeded, input is safe
    actuallyDoStuffWithXML(input)
}
```

### ValidateAll

```Go
import (
    "strings"

    xrv "github.com/mattermost/xml-roundtrip-validator"
)

func DoStuffWithXML(input string) {
    if errs := xrv.ValidateAll(strings.NewReader(input)); len(errs) != 0 {
        for err := range errs {
            // here you can log each error individually if you like
        }
        return
    }
    // validation succeeded, input is safe
    actuallyDoStuffWithXML(input)
}
```

### CLI

Compiling:

```
$ go build cmd/xrv.go
```

Running:

```
$ ./xrv good.xml
Document validated without errors
$ ./xrv bad.xml 
validator: in token starting at 2:5: roundtrip error: expected {{ :Element} []}, observed {{ Element} []}
$ ./xrv -all bad.xml 
validator: in token starting at 2:5: roundtrip error: expected {{ :Element} []}, observed {{ Element} []}
validator: in token starting at 3:5: roundtrip error: expected {{ Element} [{{ :attr} z}]}, observed {{ Element} [{{ attr} z}]}
```

## Go vulnerabilities addressed

Descriptions of the Go vulnerabilities addressed by this module can be found in the advisories directory. Specifically, the issues addressed are:

 - [Element namespace prefix instability](./advisories/unstable-elements.md)
 - [Attribute namespace prefix instability](./advisories/unstable-attributes.md)
 - [Directive comment instability](./advisories/unstable-directives.md)
 - Any other similar roundtrip issues we may not know about
