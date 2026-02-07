package rulesfn

// Substring returns the substring of the input provided. If the start or stop
// indexes are not valid for the input nil will be returned. If errors occur
// they will be added to the provided [ErrorCollector].
func SubString(input string, start, stop int, reverse bool) *string {
	if start < 0 || stop < 1 || start >= stop || len(input) < stop {
		return nil
	}

	for _, r := range input {
		if r > 127 {
			return nil
		}
	}

	if !reverse {
		v := input[start:stop]
		return &v
	}

	rStart := len(input) - stop
	rStop := len(input) - start
	return SubString(input, rStart, rStop, false)
}
