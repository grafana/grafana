// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build !cgo

package purego

//go:cgo_import_dynamic purego_dlopen dlopen "libc.so.7"
//go:cgo_import_dynamic purego_dlsym dlsym "libc.so.7"
//go:cgo_import_dynamic purego_dlerror dlerror "libc.so.7"
//go:cgo_import_dynamic purego_dlclose dlclose "libc.so.7"
