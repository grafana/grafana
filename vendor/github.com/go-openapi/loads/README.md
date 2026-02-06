# Loads OAI specs [![Build Status](https://github.com/go-openapi/loads/actions/workflows/go-test.yml/badge.svg)](https://github.com/go-openapi/loads/actions?query=workflow%3A"go+test") [![codecov](https://codecov.io/gh/go-openapi/loads/branch/master/graph/badge.svg)](https://codecov.io/gh/go-openapi/loads)

[![license](http://img.shields.io/badge/license-Apache%20v2-orange.svg)](https://raw.githubusercontent.com/go-openapi/loads/master/LICENSE) [![GoDoc](https://godoc.org/github.com/go-openapi/loads?status.svg)](http://godoc.org/github.com/go-openapi/loads)
[![Go Report Card](https://goreportcard.com/badge/github.com/go-openapi/loads)](https://goreportcard.com/report/github.com/go-openapi/loads)

Loading of OAI v2 API specification documents from local or remote locations. Supports JSON and YAML documents.

Primary usage:

```go
  import (
	  "github.com/go-openapi/loads"
  )

  ...

	// loads a YAML spec from a http file
	doc, err := loads.Spec(ts.URL)
  
  ...

  // retrieves the object model for the API specification
  spec := doc.Spec()

  ...
```

See also the provided [examples](https://pkg.go.dev/github.com/go-openapi/loads#pkg-examples).

## Licensing

This library ships under the [SPDX-License-Identifier: Apache-2.0](./LICENSE).
