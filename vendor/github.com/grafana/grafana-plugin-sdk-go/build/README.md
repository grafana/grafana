# Reusable Mage build tools

This package includes standard mage targets useful in the build.

See: https://magefile.org/magefiles/.

These targets can be used in your plugin project by creating `Magefile.go` in the root of your project like the following:

```go
//+build mage

package main

import (
	// mage:import
	build "github.com/grafana/grafana-plugin-sdk-go/build"
)

// Default configures the default target.
var Default = build.BuildAll
```

https://magefile.org/importing/
