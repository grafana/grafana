package cli

import "unicode"

// lexicographicLess compares strings alphabetically considering case.
func lexicographicLess(i, j string) bool {
	iRunes := []rune(i)
	jRunes := []rune(j)

	lenShared := len(iRunes)
	if lenShared > len(jRunes) {
		lenShared = len(jRunes)
	}

	for index := 0; index < lenShared; index++ {
		ir := iRunes[index]
		jr := jRunes[index]

		if lir, ljr := unicode.ToLower(ir), unicode.ToLower(jr); lir != ljr {
			return lir < ljr
		}

		if ir != jr {
			return ir < jr
		}
	}

	return i < j
}
