package ctystrings

import (
	"fmt"
	"unicode/utf8"

	"github.com/apparentlymart/go-textseg/v15/textseg"
	"golang.org/x/text/unicode/norm"
)

// SafeKnownPrefix takes a string intended to represent a known prefix of
// another string and modifies it so that it would be safe to use with
// byte-based prefix matching against another NFC-normalized string. It
// also takes into account grapheme cluster boundaries and trims off any
// suffix that could potentially be an incomplete grapheme cluster.
//
// Specifically, SafeKnownPrefix first applies NFC normalization to the prefix
// and then trims off one or more characters from the end of the string which
// could potentially be transformed into a different character if another
// string were appended to it. For example, a trailing latin letter will
// typically be trimmed because appending a combining diacritic mark would
// transform it into a different character.
//
// This transformation is important whenever the remainder of the string is
// arbitrary user input not directly controlled by the application. If an
// application can guarantee that the remainder of the string will not begin
// with combining marks then it is safe to instead just normalize the prefix
// string with [Normalize].
func SafeKnownPrefix(prefix string) string {
	prefix = Normalize(prefix)

	// Our starting approach here is essentially what a streaming parser would
	// do when consuming a Unicode string in chunks and needing to determine
	// what prefix of the current buffer is safe to process without waiting for
	// more information, which is described in TR15 section 13.1
	// "Buffering with Unicode Normalization":
	// https://unicode.org/reports/tr15/#Buffering_with_Unicode_Normalization
	//
	// The general idea here is to find the last character in the string that
	// could potentially start a sequence of codepoints that would combine
	// together, and then truncate the string to exclude that character and
	// everything after it.

	form := norm.NFC
	lastBoundary := form.LastBoundary([]byte(prefix))
	if lastBoundary != -1 && lastBoundary != len(prefix) {
		prefix = prefix[:lastBoundary]
		// If we get here then we've already shortened the prefix and so
		// further analysis below is unnecessary because it would be relying
		// on an incomplete prefix anyway.
		return prefix
	}

	// Now we'll use the textseg package's grapheme cluster scanner to scan
	// as far through the string as we can without the scanner telling us
	// that it would need more bytes to decide.
	//
	// This step is conservative because the grapheme cluster rules are not
	// designed with prefix-matching in mind. In the base case we'll just
	// always discard the last grapheme cluster, although we do have some
	// special cases for trailing codepoints that can't possibly combine with
	// subsequent codepoints to form a single grapheme cluster and which seem
	// likely to arise often in practical use.
	remain := []byte(prefix)
	prevBoundary := 0
	thisBoundary := 0
	for len(remain) > 0 {
		advance, _, err := textseg.ScanGraphemeClusters(remain, false)
		if err != nil {
			// ScanGraphemeClusters should never return an error because
			// any sequence of valid UTF-8 encodings is valid input.
			panic(fmt.Sprintf("textseg.ScanGraphemeClusters returned error: %s", err))
		}
		if advance == 0 {
			// If we have at least one byte remaining but the scanner cannot
			// advance then that means the remainder might be an incomplete
			// grapheme cluster and so we need to stop here, discarding the
			// rest of the input. However, we do now know that we can safely
			// include what we found on the previous iteration of this loop.
			prevBoundary = thisBoundary
			break
		}
		prevBoundary = thisBoundary
		thisBoundary += advance
		remain = remain[advance:]
	}

	// This is our heuristic for detecting cases where we can be sure that
	// the above algorithm was too conservative because the last segment
	// we found is definitely not subject to the grapheme cluster "do not split"
	// rules.
	suspect := prefix[prevBoundary:thisBoundary]
	if sequenceMustEndGraphemeCluster(suspect) {
		prevBoundary = thisBoundary
	}

	return prefix[:prevBoundary]
}

// sequenceMustEndGraphemeCluster is a heuristic we use to avoid discarding
// the final grapheme cluster of a prefix in SafeKnownPrefix by recognizing
// that a particular sequence is one known to not be subject to any of
// the UAX29 "do not break" rules.
//
// If this function returns true then it is safe to include the given byte
// sequence at the end of a safe prefix. Otherwise we don't know whether or
// not it is safe.
func sequenceMustEndGraphemeCluster(s string) bool {
	// For now we're only considering sequences that represent a single
	// codepoint. We'll assume that any sequence of two or more codepoints
	// that could be a grapheme cluster might be extendable.
	if utf8.RuneCountInString(s) != 1 {
		return false
	}

	r, _ := utf8.DecodeRuneInString(s)

	// Our initial ruleset is focused on characters that are commonly used
	// as delimiters in text intended for both human and machine use, such
	// as JSON documents.
	//
	// We don't include any letters or digits of any script here intentionally
	// because those are the ones most likely to be subject to combining rules
	// in either current or future Unicode specifications.
	//
	// We can safely grow this set over time, but we should be very careful
	// about shrinking it because it could cause value refinements to loosen
	// and thus cause results that were once known to become unknown.
	switch r {
	case '-', '_', ':', ';', '/', '\\', ',', '.', '(', ')', '{', '}', '[', ']', '|', '?', '!', '~', ' ', '\t', '@', '#', '$', '%', '^', '&', '*', '+', '"', '\'':
		return true
	default:
		return false
	}
}
