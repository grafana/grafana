// Copyright 2010 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package bigfft

import (
	"math/big"
	_ "unsafe"
)

type Word = big.Word

//go:linkname addVV math/big.addVV
func addVV(z, x, y []Word) (c Word)

//go:linkname subVV math/big.subVV
func subVV(z, x, y []Word) (c Word)

//go:linkname addVW math/big.addVW
func addVW(z, x []Word, y Word) (c Word)

//go:linkname subVW math/big.subVW
func subVW(z, x []Word, y Word) (c Word)

//go:linkname shlVU math/big.shlVU
func shlVU(z, x []Word, s uint) (c Word)

//go:linkname mulAddVWW math/big.mulAddVWW
func mulAddVWW(z, x []Word, y, r Word) (c Word)

//go:linkname addMulVVW math/big.addMulVVW
func addMulVVW(z, x []Word, y Word) (c Word)
