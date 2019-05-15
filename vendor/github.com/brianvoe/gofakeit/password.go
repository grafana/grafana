package gofakeit

import (
	"math/rand"
)

const lowerStr = "abcdefghijklmnopqrstuvwxyz"
const upperStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const numericStr = "0123456789"
const specialStr = "!@#$%&*+-=?"
const spaceStr = "   "

// Password will generate a random password
// Minimum number length of 5 if less than
func Password(lower bool, upper bool, numeric bool, special bool, space bool, num int) string {
	// Make sure the num minimun is at least 5
	if num < 5 {
		num = 5
	}
	i := 0
	b := make([]byte, num)
	var passString string

	if lower {
		passString += lowerStr
		b[i] = lowerStr[rand.Int63()%int64(len(lowerStr))]
		i++
	}
	if upper {
		passString += upperStr
		b[i] = upperStr[rand.Int63()%int64(len(upperStr))]
		i++
	}
	if numeric {
		passString += numericStr
		b[i] = numericStr[rand.Int63()%int64(len(numericStr))]
		i++
	}
	if special {
		passString += specialStr
		b[i] = specialStr[rand.Int63()%int64(len(specialStr))]
		i++
	}
	if space {
		passString += spaceStr
		b[i] = spaceStr[rand.Int63()%int64(len(spaceStr))]
		i++
	}

	// Set default if empty
	if passString == "" {
		passString = lowerStr + numericStr
	}

	// Loop through and add it up
	for i <= num-1 {
		b[i] = passString[rand.Int63()%int64(len(passString))]
		i++
	}

	// Shuffle bytes
	for i := range b {
		j := rand.Intn(i + 1)
		b[i], b[j] = b[j], b[i]
	}

	return string(b)
}
