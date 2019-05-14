package fake

import (
	"strings"
)

// Gender generates random gender
func Gender() string {
	return lookup(lang, "genders", true)
}

// GenderAbbrev returns first downcased letter of the random gender
func GenderAbbrev() string {
	g := Gender()
	if g != "" {
		return strings.ToLower(string(g[0]))
	}
	return ""
}

// Language generates random human language
func Language() string {
	return lookup(lang, "languages", true)
}
