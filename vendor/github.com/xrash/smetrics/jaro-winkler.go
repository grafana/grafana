package smetrics

import (
	"math"
)

// The Jaro-Winkler distance. The result is 1 for equal strings, and 0 for completely different strings. It is commonly used on Record Linkage stuff, thus it tries to be accurate for common typos when writing real names such as  person names and street names.
// Jaro-Winkler is a modification of the Jaro algorithm. It works by first running Jaro, then boosting the score of exact matches at the beginning of the strings. Because of that, it introduces two more parameters: the boostThreshold and the prefixSize. These are commonly set to 0.7 and 4, respectively.
func JaroWinkler(a, b string, boostThreshold float64, prefixSize int) float64 {
	j := Jaro(a, b)

	if j <= boostThreshold {
		return j
	}

	prefixSize = int(math.Min(float64(len(a)), math.Min(float64(prefixSize), float64(len(b)))))

	var prefixMatch float64
	for i := 0; i < prefixSize; i++ {
		if a[i] == b[i] {
			prefixMatch++
		} else {
			break
		}
	}

	return j + 0.1*prefixMatch*(1.0-j)
}
