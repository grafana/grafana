package gofakeit

import (
	"bytes"
	"strings"
	"unicode"
)

type paragrapOptions struct {
	paragraphCount int
	sentenceCount  int
	wordCount      int
	separator      string
}

const bytesPerWordEstimation = 6

type sentenceGenerator func(wordCount int) string
type wordGenerator func() string

// Word will generate a random word
func Word() string {
	return getRandValue([]string{"lorem", "word"})
}

// Sentence will generate a random sentence
func Sentence(wordCount int) string {
	return sentence(wordCount, Word)
}

// Paragraph will generate a random paragraphGenerator
// Set Paragraph Count
// Set Sentence Count
// Set Word Count
// Set Paragraph Separator
func Paragraph(paragraphCount int, sentenceCount int, wordCount int, separator string) string {
	return paragraphGenerator(paragrapOptions{paragraphCount, sentenceCount, wordCount, separator}, Sentence)
}

func sentence(wordCount int, word wordGenerator) string {
	if wordCount <= 0 {
		return ""
	}

	wordSeparator := ' '
	sentence := bytes.Buffer{}
	sentence.Grow(wordCount * bytesPerWordEstimation)

	for i := 0; i < wordCount; i++ {
		word := word()
		if i == 0 {
			runes := []rune(word)
			runes[0] = unicode.ToTitle(runes[0])
			word = string(runes)
		}
		sentence.WriteString(word)
		if i < wordCount-1 {
			sentence.WriteRune(wordSeparator)
		}
	}
	sentence.WriteRune('.')
	return sentence.String()
}

func paragraphGenerator(opts paragrapOptions, sentecer sentenceGenerator) string {
	if opts.paragraphCount <= 0 || opts.sentenceCount <= 0 || opts.wordCount <= 0 {
		return ""
	}

	//to avoid making Go 1.10 dependency, we cannot use strings.Builder
	paragraphs := bytes.Buffer{}
	//we presume the length
	paragraphs.Grow(opts.paragraphCount * opts.sentenceCount * opts.wordCount * bytesPerWordEstimation)
	wordSeparator := ' '

	for i := 0; i < opts.paragraphCount; i++ {
		for e := 0; e < opts.sentenceCount; e++ {
			paragraphs.WriteString(sentecer(opts.wordCount))
			if e < opts.sentenceCount-1 {
				paragraphs.WriteRune(wordSeparator)
			}
		}

		if i < opts.paragraphCount-1 {
			paragraphs.WriteString(opts.separator)
		}
	}

	return paragraphs.String()
}

// Question will return a random question
func Question() string {
	return strings.Replace(HipsterSentence(Number(3, 10)), ".", "?", 1)
}

// Quote will return a random quote from a random person
func Quote() string {
	return `"` + HipsterSentence(Number(3, 10)) + `" - ` + FirstName() + " " + LastName()
}
