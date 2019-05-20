package gofakeit

import "strings"

// HackerPhrase will return a random hacker sentence
func HackerPhrase() string {
	words := strings.Split(Generate(getRandValue([]string{"hacker", "phrase"})), " ")
	words[0] = strings.Title(words[0])
	return strings.Join(words, " ")
}

// HackerAbbreviation will return a random hacker abbreviation
func HackerAbbreviation() string {
	return getRandValue([]string{"hacker", "abbreviation"})
}

// HackerAdjective will return a random hacker adjective
func HackerAdjective() string {
	return getRandValue([]string{"hacker", "adjective"})
}

// HackerNoun will return a random hacker noun
func HackerNoun() string {
	return getRandValue([]string{"hacker", "noun"})
}

// HackerVerb will return a random hacker verb
func HackerVerb() string {
	return getRandValue([]string{"hacker", "verb"})
}

// HackerIngverb will return a random hacker ingverb
func HackerIngverb() string {
	return getRandValue([]string{"hacker", "ingverb"})
}
