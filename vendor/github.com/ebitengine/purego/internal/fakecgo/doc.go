// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build !cgo && (darwin || freebsd || linux)

// Package fakecgo implements the Cgo runtime (runtime/cgo) entirely in Go.
// This allows code that calls into C to function properly when CGO_ENABLED=0.
//
// # Goals
//
// fakecgo attempts to replicate the same naming structure as in the runtime.
// For example, functions that have the prefix "gcc_*" are named "go_*".
// This makes it easier to port other GOOSs and GOARCHs as well as to keep
// it in sync with runtime/cgo.
//
// # Support
//
// Currently, fakecgo only supports macOS on amd64 & arm64. It also cannot
// be used with -buildmode=c-archive because that requires special initialization
// that fakecgo does not implement at the moment.
//
// # Usage
//
// Using fakecgo is easy just import _ "github.com/ebitengine/purego" and then
// set the environment variable CGO_ENABLED=0.
// The recommended usage for fakecgo is to prefer using runtime/cgo if possible
// but if cross-compiling or fast build times are important fakecgo is available.
// Purego will pick which ever Cgo runtime is available and prefer the one that
// comes with Go (runtime/cgo).
package fakecgo

//go:generate go run gen.go
