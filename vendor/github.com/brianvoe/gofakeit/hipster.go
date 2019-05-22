package gofakeit

// HipsterWord will return a single hipster word
func HipsterWord() string {
	return getRandValue([]string{"hipster", "word"})
}

// HipsterSentence will generate a random sentence
func HipsterSentence(wordCount int) string {
	return sentence(wordCount, HipsterWord)
}

// HipsterParagraph will generate a random paragraphGenerator
// Set Paragraph Count
// Set Sentence Count
// Set Word Count
// Set Paragraph Separator
func HipsterParagraph(paragraphCount int, sentenceCount int, wordCount int, separator string) string {
	return paragraphGenerator(paragrapOptions{paragraphCount, sentenceCount, wordCount, separator}, HipsterSentence)
}
