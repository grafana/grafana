// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build !cgo

package purego

// if you are getting this error it means that you have
// CGO_ENABLED=0 while trying to build for ios.
// purego does not support this mode yet.
// the fix is to set CGO_ENABLED=1 which will require
// a C compiler.
var _ = _PUREGO_REQUIRES_CGO_ON_IOS
