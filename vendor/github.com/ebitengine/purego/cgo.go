// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build cgo && (darwin || freebsd || linux)

package purego

// if CGO_ENABLED=1 import the Cgo runtime to ensure that it is set up properly.
// This is required since some frameworks need TLS setup the C way which Go doesn't do.
// We currently don't support ios in fakecgo mode so force Cgo or fail
// Even if CGO_ENABLED=1 the Cgo runtime is not imported unless `import "C"` is used.
// which will import this package automatically. Normally this isn't an issue since it
// usually isn't possible to call into C without using that import. However, with purego
// it is since we don't use `import "C"`!
import (
	_ "runtime/cgo"

	_ "github.com/ebitengine/purego/internal/cgo"
)
