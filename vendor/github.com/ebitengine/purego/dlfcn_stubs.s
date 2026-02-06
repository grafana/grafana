// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build darwin || !cgo && (freebsd || linux) && !faketime

#include "textflag.h"

// func dlopen(path *byte, mode int) (ret uintptr)
TEXT dlopen(SB), NOSPLIT|NOFRAME, $0-0
	JMP purego_dlopen(SB)
	RET

// func dlsym(handle uintptr, symbol *byte) (ret uintptr)
TEXT dlsym(SB), NOSPLIT|NOFRAME, $0-0
	JMP purego_dlsym(SB)
	RET

// func dlerror() (ret *byte)
TEXT dlerror(SB), NOSPLIT|NOFRAME, $0-0
	JMP purego_dlerror(SB)
	RET

// func dlclose(handle uintptr) (ret int)
TEXT dlclose(SB), NOSPLIT|NOFRAME, $0-0
	JMP purego_dlclose(SB)
	RET
