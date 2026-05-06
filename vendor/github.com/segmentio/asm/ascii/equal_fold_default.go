//go:build purego || !amd64
// +build purego !amd64

package ascii

// EqualFoldString is a version of strings.EqualFold designed to work on ASCII
// input instead of UTF-8.
//
// When the program has guarantees that the input is composed of ASCII
// characters only, it allows for greater optimizations.
func EqualFoldString(a, b string) bool {
	if len(a) != len(b) {
		return false
	}

	var cmp byte

	for len(a) >= 8 {
		cmp |= lowerCase[a[0]] ^ lowerCase[b[0]]
		cmp |= lowerCase[a[1]] ^ lowerCase[b[1]]
		cmp |= lowerCase[a[2]] ^ lowerCase[b[2]]
		cmp |= lowerCase[a[3]] ^ lowerCase[b[3]]
		cmp |= lowerCase[a[4]] ^ lowerCase[b[4]]
		cmp |= lowerCase[a[5]] ^ lowerCase[b[5]]
		cmp |= lowerCase[a[6]] ^ lowerCase[b[6]]
		cmp |= lowerCase[a[7]] ^ lowerCase[b[7]]

		if cmp != 0 {
			return false
		}

		a = a[8:]
		b = b[8:]
	}

	switch len(a) {
	case 7:
		cmp |= lowerCase[a[6]] ^ lowerCase[b[6]]
		fallthrough
	case 6:
		cmp |= lowerCase[a[5]] ^ lowerCase[b[5]]
		fallthrough
	case 5:
		cmp |= lowerCase[a[4]] ^ lowerCase[b[4]]
		fallthrough
	case 4:
		cmp |= lowerCase[a[3]] ^ lowerCase[b[3]]
		fallthrough
	case 3:
		cmp |= lowerCase[a[2]] ^ lowerCase[b[2]]
		fallthrough
	case 2:
		cmp |= lowerCase[a[1]] ^ lowerCase[b[1]]
		fallthrough
	case 1:
		cmp |= lowerCase[a[0]] ^ lowerCase[b[0]]
	}

	return cmp == 0
}
