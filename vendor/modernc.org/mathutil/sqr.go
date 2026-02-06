//go:build !riscv64 && !loong64
// +build !riscv64,!loong64

package mathutil

import "github.com/remyoudompheng/bigfft"

func (f *float) sqr() {
	f.n = bigfft.Mul(f.n, f.n)
	f.fracBits *= 2
	f.normalize()
}
