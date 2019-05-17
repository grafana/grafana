package gofakeit

import (
	"math/rand"
)

// Letter will generate a single random lower case ASCII letter
func Letter() string {
	return string(randLetter())
}

// Digit will generate a single ASCII digit
func Digit() string {
	return string(randDigit())
}

// Lexify will replace ? will random generated letters
func Lexify(str string) string {
	return replaceWithLetters(str)
}

// ShuffleStrings will randomize a slice of strings
func ShuffleStrings(a []string) {
	swap := func(i, j int) {
		a[i], a[j] = a[j], a[i]
	}
	//to avoid upgrading to 1.10 I copied the algorithm
	n := len(a)
	if n <= 1 {
		return
	}

	//if size is > int32 probably it will never finish, or ran out of entropy
	i := n - 1
	for ; i > 0; i-- {
		j := int(rand.Int31n(int32(i + 1)))
		swap(i, j)
	}
}

// RandString will take in a slice of string and return a randomly selected value
func RandString(a []string) string {
	size := len(a)
	if size == 0 {
		return ""
	}
	return a[rand.Intn(size)]
}
