package fpconv

import (
	"math"
)

type (
	Fp struct {
		frac uint64
		exp  int64
	}
)

func build_fp(d float64) Fp {
	bits := get_dbits(d)

	fp := Fp{
		frac: bits & fracmask,
		exp:  int64((bits & expmask) >> 52),
	}

	if fp.exp != 0 {
		fp.frac += hiddenbit
		fp.exp -= expbias
	} else {
		fp.exp = -expbias + 1
	}

	return fp
}

func normalize(fp Fp) Fp {
	for (fp.frac & hiddenbit) == 0 {
		fp.frac <<= 1
		fp.exp--
	}

	var shift int64 = 64 - 52 - 1
	fp.frac <<= shift
	fp.exp -= shift
	return fp
}

func multiply(a, b Fp) Fp {
	lomask := uint64(0x00000000FFFFFFFF)

	var (
		ah_bl = uint64((a.frac >> 32) * (b.frac & lomask))
		al_bh = uint64((a.frac & lomask) * (b.frac >> 32))
		al_bl = uint64((a.frac & lomask) * (b.frac & lomask))
		ah_bh = uint64((a.frac >> 32) * (b.frac >> 32))
	)

	tmp := uint64((ah_bl & lomask) + (al_bh & lomask) + (al_bl >> 32))
	/* round up */
	tmp += uint64(1) << 31

	return Fp{
		ah_bh + (ah_bl >> 32) + (al_bh >> 32) + (tmp >> 32),
		a.exp + b.exp + 64,
	}
}

func get_dbits(d float64) uint64 {
	return math.Float64bits(d)
}

func get_normalized_boundaries(fp Fp) (Fp, Fp) {
	upper := Fp{
		frac: (fp.frac << 1) + 1,
		exp:  fp.exp - 1,
	}
	for (upper.frac & (hiddenbit << 1)) == 0 {
		upper.frac <<= 1
		upper.exp--
	}

	var u_shift int64 = 64 - 52 - 2

	upper.frac <<= u_shift
	upper.exp = upper.exp - u_shift

	l_shift := int64(1)
	if fp.frac == hiddenbit {
		l_shift = 2
	}

	lower := Fp{
		frac: (fp.frac << l_shift) - 1,
		exp:  fp.exp - l_shift,
	}

	lower.frac <<= lower.exp - upper.exp
	lower.exp = upper.exp
	return lower, upper
}
