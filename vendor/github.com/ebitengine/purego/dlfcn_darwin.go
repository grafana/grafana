// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

package purego

// Source for constants: https://opensource.apple.com/source/dyld/dyld-360.14/include/dlfcn.h.auto.html

const (
	RTLD_DEFAULT = 1<<64 - 2 // Pseudo-handle for dlsym so search for any loaded symbol
	RTLD_LAZY    = 0x1       // Relocations are performed at an implementation-dependent time.
	RTLD_NOW     = 0x2       // Relocations are performed when the object is loaded.
	RTLD_LOCAL   = 0x4       // All symbols are not made available for relocation processing by other modules.
	RTLD_GLOBAL  = 0x8       // All symbols are available for relocation processing of other modules.
)

//go:cgo_import_dynamic purego_dlopen dlopen "/usr/lib/libSystem.B.dylib"
//go:cgo_import_dynamic purego_dlsym dlsym "/usr/lib/libSystem.B.dylib"
//go:cgo_import_dynamic purego_dlerror dlerror "/usr/lib/libSystem.B.dylib"
//go:cgo_import_dynamic purego_dlclose dlclose "/usr/lib/libSystem.B.dylib"

//go:cgo_import_dynamic purego_dlopen dlopen "/usr/lib/libSystem.B.dylib"
//go:cgo_import_dynamic purego_dlsym dlsym "/usr/lib/libSystem.B.dylib"
//go:cgo_import_dynamic purego_dlerror dlerror "/usr/lib/libSystem.B.dylib"
//go:cgo_import_dynamic purego_dlclose dlclose "/usr/lib/libSystem.B.dylib"
