package dateparse

import (
	"fmt"
	"strings"
	"time"
)

// parser defines a function that processes a string and returns the
// remaining characters unconsumed by the given parser.
//
// The data parsed from the consumed characters should be
// written to the `datetime` struct.
type parser func(result *datetime, chars string) (rest string, err error)

func trimPrefix(count int, str string) string {
	if len(str) > count {
		return str[count:]
	}
	return ""
}

func literalParser(literal byte) parser {
	return func(dt *datetime, chars string) (rest string, _ error) {
		if len(chars) < 1 && literal != ' ' {
			return "", fmt.Errorf("expected literal \"%c\", found empty string", literal)
		}
		chars = takeAllSpaces(chars)
		if literal == ' ' {
			return chars, nil
		}
		if chars[0] != literal {
			return "", fmt.Errorf("expected literal \"%c\", got \"%c\"", literal, chars[0])
		}
		return trimPrefix(1, chars), nil
	}
}

func parseAmPm(result *datetime, chars string) (rest string, _ error) {
	if len(chars) < 2 {
		return "", fmt.Errorf("expected > 2 chars, found %d", len(chars))
	}
	switch strings.ToLower(chars[:2]) {
	case "am":
		result.am = boolPtr(true)
	case "pm":
		result.am = boolPtr(false)
	default:
		return "", fmt.Errorf("expected AM or PM, got \"%s\"", chars[:2])
	}
	return trimPrefix(2, chars), nil
}

func parseWeekdayAbbreviation(result *datetime, chars string) (rest string, _ error) {
	if len(chars) < 3 {
		return "", fmt.Errorf("expected at least 3 chars, got %d", len(chars))
	}
	weekday, ok := weekdayAbbrev(chars[:3])
	if !ok {
		return "", fmt.Errorf("invalid week abbreviation \"%s\"", chars[:3])
	}
	result.weekday = &weekday
	return trimPrefix(3, chars), nil
}

func parseMonthAbbreviation(result *datetime, chars string) (rest string, _ error) {
	if len(chars) < 3 {
		return "", fmt.Errorf("expected at least 3 chars, got %d", len(chars))
	}
	month, ok := monthAbbrev(chars[:3])
	if !ok {
		return "", fmt.Errorf("invalid month abbreviation \"%s\"", chars[:3])
	}
	result.month = &month
	return trimPrefix(3, chars), nil
}

func parseMonthNumeric(result *datetime, chars string) (rest string, _ error) {
	num, rest, err := takeNumber(chars)
	if err != nil {
		return "", err
	}
	month := time.Month(num)
	result.month = &month
	return rest, nil
}

func parseMonth2DigitNumeric(result *datetime, chars string) (rest string, _ error) {
	num, rest, err := takeNumberAtMostNChars(2, chars)
	if err != nil {
		return "", err
	}
	if num < 1 || num > 12 {
		return "", fmt.Errorf("expected 01-12, got %s", string(chars))
	}
	month := time.Month(num)
	result.month = &month
	return rest, nil
}

func parseDayOfMonthNumeric(result *datetime, chars string) (rest string, _ error) {
	num, rest, err := takeNumber(chars)
	if err != nil {
		return "", err
	}
	result.day = &num
	return rest, nil
}

func parseDayOfMonth2DigitNumeric(result *datetime, chars string) (rest string, _ error) {
	num, rest, err := takeNumberAtMostNChars(2, chars)
	if err != nil {
		return "", err
	}
	if num < 1 || num > 31 {
		return "", fmt.Errorf("expected 01-31, got %s", string(chars))
	}
	result.day = &num
	return rest, nil
}

func parseMicrosecondsNumeric(result *datetime, chars string) (rest string, _ error) {
	num, rest, err := takeNumber(chars)
	if err != nil {
		return "", err
	}
	result.microseconds = &num
	return rest, nil
}

func parse24HourNumeric(result *datetime, chars string) (rest string, _ error) {
	hour, rest, err := takeNumber(chars)
	if err != nil {
		return "", err
	}
	result.hours = &hour
	return rest, nil
}

func parse12HourNumeric(result *datetime, chars string) (rest string, _ error) {
	num, rest, err := takeNumber(chars)
	if err != nil {
		return "", err
	}
	result.hours = &num
	return rest, nil
}

func parseMinuteNumeric(result *datetime, chars string) (rest string, _ error) {
	min, rest, err := takeNumber(chars)
	if err != nil {
		return "", err
	}
	result.minutes = &min
	return rest, nil
}

func parseMonthName(result *datetime, chars string) (rest string, _ error) {
	month, charCount, ok := monthName(chars)
	if !ok {
		return "", fmt.Errorf("unknown month name, got \"%s\"", chars)
	}
	result.month = &month
	return trimPrefix(charCount, chars), nil
}

func parse12HourTimestamp(result *datetime, chars string) (rest string, _ error) {
	hour, rest, err := takeNumberAtMostNChars(2, chars)
	if err != nil {
		return "", err
	}
	rest, err = literalParser(':')(result, rest)
	if err != nil {
		return "", err
	}
	min, rest, err := takeNumberAtMostNChars(2, rest)
	if err != nil {
		return "", err
	}
	rest, err = literalParser(':')(result, rest)
	if err != nil {
		return "", err
	}
	sec, rest, err := takeNumberAtMostNChars(2, rest)
	if err != nil {
		return "", err
	}
	rest = takeAllSpaces(rest)
	rest, err = parseAmPm(result, rest)
	if err != nil {
		return "", err
	}
	result.seconds = &sec
	result.minutes = &min
	result.hours = &hour
	return rest, nil
}

func parseSecondsNumeric(result *datetime, chars string) (rest string, _ error) {
	sec, rest, err := takeNumber(chars)
	if err != nil {
		return "", err
	}
	result.seconds = &sec
	return rest, nil
}

func parse24HourTimestamp(result *datetime, chars string) (rest string, _ error) {
	hour, rest, err := takeNumberAtMostNChars(2, chars)
	if err != nil {
		return "", err
	}
	rest, err = literalParser(':')(result, rest)
	if err != nil {
		return "", err
	}
	minute, rest, err := takeNumberAtMostNChars(2, rest)
	if err != nil {
		return "", err
	}
	rest, err = literalParser(':')(result, rest)
	if err != nil {
		return "", err
	}
	seconds, rest, err := takeNumberAtMostNChars(2, rest)
	if err != nil {
		return "", err
	}
	result.hours = &hour
	result.minutes = &minute
	result.seconds = &seconds
	return rest, err
}

func parseYear2DigitNumeric(result *datetime, chars string) (rest string, _ error) {
	year, rest, err := takeNumberAtMostNChars(2, chars)
	if err != nil {
		return "", err
	}
	if year >= 70 {
		year += 1900
	} else {
		year += 2000
	}
	result.year = &year
	return rest, nil
}

func parseYear4DigitNumeric(result *datetime, chars string) (rest string, _ error) {
	if len(chars) < 4 {
		return "", fmt.Errorf("expected at least 4 chars, got %d", len(chars))
	}
	year, rest, err := takeNumberAtMostNChars(4, chars)
	if err != nil {
		return "", err
	}
	result.year = &year
	return rest, nil
}

func parseDayNumericWithEnglishSuffix(result *datetime, chars string) (rest string, _ error) {
	num, rest, err := takeNumber(chars)
	if err != nil {
		return "", err
	}
	result.day = &num
	return trimPrefix(2, rest), nil
}

func parseDayOfYearNumeric(result *datetime, chars string) (rest string, _ error) {
	num, rest, err := takeNumber(chars)
	if err != nil {
		return "", err
	}
	result.dayOfYear = &num
	return rest, nil
}
