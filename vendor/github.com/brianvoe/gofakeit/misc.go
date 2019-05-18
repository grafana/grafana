package gofakeit

import (
	"math/rand"

	"github.com/brianvoe/gofakeit/data"
)

const hashtag = '#'
const questionmark = '?'

// Check if in lib
func dataCheck(dataVal []string) bool {
	var checkOk bool

	if len(dataVal) == 2 {
		_, checkOk = data.Data[dataVal[0]]
		if checkOk {
			_, checkOk = data.Data[dataVal[0]][dataVal[1]]
		}
	}

	return checkOk
}

// Check if in lib
func intDataCheck(dataVal []string) bool {
	if len(dataVal) != 2 {
		return false
	}

	_, checkOk := data.IntData[dataVal[0]]
	if checkOk {
		_, checkOk = data.IntData[dataVal[0]][dataVal[1]]
	}

	return checkOk
}

// Get Random Value
func getRandValue(dataVal []string) string {
	if !dataCheck(dataVal) {
		return ""
	}
	return data.Data[dataVal[0]][dataVal[1]][rand.Intn(len(data.Data[dataVal[0]][dataVal[1]]))]
}

// Get Random Integer Value
func getRandIntValue(dataVal []string) int {
	if !intDataCheck(dataVal) {
		return 0
	}
	return data.IntData[dataVal[0]][dataVal[1]][rand.Intn(len(data.IntData[dataVal[0]][dataVal[1]]))]
}

// Replace # with numbers
func replaceWithNumbers(str string) string {
	if str == "" {
		return str
	}
	bytestr := []byte(str)
	for i := 0; i < len(bytestr); i++ {
		if bytestr[i] == hashtag {
			bytestr[i] = byte(randDigit())
		}
	}
	if bytestr[0] == '0' {
		bytestr[0] = byte(rand.Intn(8)+1) + '0'
	}

	return string(bytestr)
}

// Replace ? with ASCII lowercase letters
func replaceWithLetters(str string) string {
	if str == "" {
		return str
	}
	bytestr := []byte(str)
	for i := 0; i < len(bytestr); i++ {
		if bytestr[i] == questionmark {
			bytestr[i] = byte(randLetter())
		}
	}

	return string(bytestr)
}

// Generate random lowercase ASCII letter
func randLetter() rune {
	return rune(byte(rand.Intn(26)) + 'a')
}

// Generate random ASCII digit
func randDigit() rune {
	return rune(byte(rand.Intn(10)) + '0')
}

// Generate random integer between min and max
func randIntRange(min, max int) int {
	if min == max {
		return min
	}
	return rand.Intn((max+1)-min) + min
}

func randFloat32Range(min, max float32) float32 {
	if min == max {
		return min
	}
	return rand.Float32()*(max-min) + min
}

func randFloat64Range(min, max float64) float64 {
	if min == max {
		return min
	}
	return rand.Float64()*(max-min) + min
}

// Categories will return a map string array of available data categories and sub categories
func Categories() map[string][]string {
	types := make(map[string][]string)
	for category, subCategoriesMap := range data.Data {
		subCategories := make([]string, 0)
		for subType := range subCategoriesMap {
			subCategories = append(subCategories, subType)
		}
		types[category] = subCategories
	}
	return types
}
