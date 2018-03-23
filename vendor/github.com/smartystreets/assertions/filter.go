package assertions

import "fmt"

const (
	success                = ""
	needExactValues        = "This assertion requires exactly %d comparison values (you provided %d)."
	needNonEmptyCollection = "This assertion requires at least 1 comparison value (you provided 0)."
	needFewerValues        = "This assertion allows %d or fewer comparison values (you provided %d)."
)

func need(needed int, expected []interface{}) string {
	if len(expected) != needed {
		return fmt.Sprintf(needExactValues, needed, len(expected))
	}
	return success
}

func atLeast(minimum int, expected []interface{}) string {
	if len(expected) < 1 {
		return needNonEmptyCollection
	}
	return success
}

func atMost(max int, expected []interface{}) string {
	if len(expected) > max {
		return fmt.Sprintf(needFewerValues, max, len(expected))
	}
	return success
}
