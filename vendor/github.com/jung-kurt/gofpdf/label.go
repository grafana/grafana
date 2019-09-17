package gofpdf

// Adapted from Nice Numbers for Graph Labels by Paul Heckbert from "Graphics
// Gems", Academic Press, 1990

// Paul Heckbert	2 Dec 88

// https://github.com/erich666/GraphicsGems

// LICENSE

// This code repository predates the concept of Open Source, and predates most
// licenses along such lines. As such, the official license truly is:

// EULA: The Graphics Gems code is copyright-protected. In other words, you
// cannot claim the text of the code as your own and resell it. Using the code
// is permitted in any program, product, or library, non-commercial or
// commercial. Giving credit is not required, though is a nice gesture. The
// code comes as-is, and if there are any flaws or problems with any Gems code,
// nobody involved with Gems - authors, editors, publishers, or webmasters -
// are to be held responsible. Basically, don't be a jerk, and remember that
// anything free comes with no guarantee.

import (
	"math"
)

// niceNum returns a "nice" number approximately equal to x. The number is
// rounded if round is true, converted to its ceiling otherwise.
func niceNum(val float64, round bool) float64 {
	var nf float64

	exp := int(math.Floor(math.Log10(val)))
	f := val / math.Pow10(exp)
	if round {
		switch {
		case f < 1.5:
			nf = 1
		case f < 3.0:
			nf = 2
		case f < 7.0:
			nf = 5
		default:
			nf = 10
		}
	} else {
		switch {
		case f <= 1:
			nf = 1
		case f <= 2.0:
			nf = 2
		case f <= 5.0:
			nf = 5
		default:
			nf = 10
		}
	}
	return nf * math.Pow10(exp)
}

// TickmarkPrecision returns an appropriate precision value for label
// formatting.
func TickmarkPrecision(div float64) int {
	return int(math.Max(-math.Floor(math.Log10(div)), 0))
}

// Tickmarks returns a slice of tickmarks appropriate for a chart axis and an
// appropriate precision for formatting purposes. The values min and max will
// be contained within the tickmark range.
func Tickmarks(min, max float64) (list []float64, precision int) {
	if max > min {
		spread := niceNum(max-min, false)
		d := niceNum((spread / 4), true)
		graphMin := math.Floor(min/d) * d
		graphMax := math.Ceil(max/d) * d
		precision = TickmarkPrecision(d)
		for x := graphMin; x < graphMax+0.5*d; x += d {
			list = append(list, x)
		}
	}
	return
}
