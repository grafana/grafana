package units

// SI units.
type SI int64

// SI unit multiples.
const (
	Kilo SI = 1000
	Mega    = Kilo * 1000
	Giga    = Mega * 1000
	Tera    = Giga * 1000
	Peta    = Tera * 1000
	Exa     = Peta * 1000
)

func MakeUnitMap(suffix, shortSuffix string, scale int64) map[string]float64 {
	res := map[string]float64{
		shortSuffix: 1,
		// see below for "k" / "K"
		"M" + suffix: float64(scale * scale),
		"G" + suffix: float64(scale * scale * scale),
		"T" + suffix: float64(scale * scale * scale * scale),
		"P" + suffix: float64(scale * scale * scale * scale * scale),
		"E" + suffix: float64(scale * scale * scale * scale * scale * scale),
	}

	// Standard SI prefixes use lowercase "k" for kilo = 1000.
	// For compatibility, and to be fool-proof, we accept both "k" and "K" in metric mode.
	//
	// However, official binary prefixes are always capitalized - "KiB" -
	// and we specifically never parse "kB" as 1024B because:
	//
	// (1) people pedantic enough to use lowercase according to SI unlikely to abuse "k" to mean 1024 :-)
	//
	// (2) Use of capital K for 1024 was an informal tradition predating IEC prefixes:
	//     "The binary meaning of the kilobyte for 1024 bytes typically uses the symbol KB, with an
	//     uppercase letter K."
	//     -- https://en.wikipedia.org/wiki/Kilobyte#Base_2_(1024_bytes)
	//     "Capitalization of the letter K became the de facto standard for binary notation, although this
	//     could not be extended to higher powers, and use of the lowercase k did persist.[13][14][15]"
	//     -- https://en.wikipedia.org/wiki/Binary_prefix#History
	//     See also the extensive https://en.wikipedia.org/wiki/Timeline_of_binary_prefixes.
	if scale == 1024 {
		res["K"+suffix] = float64(scale)
	} else {
		res["k"+suffix] = float64(scale)
		res["K"+suffix] = float64(scale)
	}
	return res
}
