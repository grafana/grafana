// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build !cgo && (darwin || freebsd || linux)

package fakecgo

//go:nosplit
//go:norace
func x_cgo_setenv(arg *[2]*byte) {
	setenv(arg[0], arg[1], 1)
}

//go:nosplit
//go:norace
func x_cgo_unsetenv(arg *[1]*byte) {
	unsetenv(arg[0])
}
