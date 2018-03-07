package assertions

import (
	"fmt"
	"reflect"
	"strings"
)

// ShouldStartWith receives exactly 2 string parameters and ensures that the first starts with the second.
func ShouldStartWith(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}

	value, valueIsString := actual.(string)
	prefix, prefixIsString := expected[0].(string)

	if !valueIsString || !prefixIsString {
		return fmt.Sprintf(shouldBothBeStrings, reflect.TypeOf(actual), reflect.TypeOf(expected[0]))
	}

	return shouldStartWith(value, prefix)
}
func shouldStartWith(value, prefix string) string {
	if !strings.HasPrefix(value, prefix) {
		shortval := value
		if len(shortval) > len(prefix) {
			shortval = shortval[:len(prefix)] + "..."
		}
		return serializer.serialize(prefix, shortval, fmt.Sprintf(shouldHaveStartedWith, value, prefix))
	}
	return success
}

// ShouldNotStartWith receives exactly 2 string parameters and ensures that the first does not start with the second.
func ShouldNotStartWith(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}

	value, valueIsString := actual.(string)
	prefix, prefixIsString := expected[0].(string)

	if !valueIsString || !prefixIsString {
		return fmt.Sprintf(shouldBothBeStrings, reflect.TypeOf(actual), reflect.TypeOf(expected[0]))
	}

	return shouldNotStartWith(value, prefix)
}
func shouldNotStartWith(value, prefix string) string {
	if strings.HasPrefix(value, prefix) {
		if value == "" {
			value = "<empty>"
		}
		if prefix == "" {
			prefix = "<empty>"
		}
		return fmt.Sprintf(shouldNotHaveStartedWith, value, prefix)
	}
	return success
}

// ShouldEndWith receives exactly 2 string parameters and ensures that the first ends with the second.
func ShouldEndWith(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}

	value, valueIsString := actual.(string)
	suffix, suffixIsString := expected[0].(string)

	if !valueIsString || !suffixIsString {
		return fmt.Sprintf(shouldBothBeStrings, reflect.TypeOf(actual), reflect.TypeOf(expected[0]))
	}

	return shouldEndWith(value, suffix)
}
func shouldEndWith(value, suffix string) string {
	if !strings.HasSuffix(value, suffix) {
		shortval := value
		if len(shortval) > len(suffix) {
			shortval = "..." + shortval[len(shortval)-len(suffix):]
		}
		return serializer.serialize(suffix, shortval, fmt.Sprintf(shouldHaveEndedWith, value, suffix))
	}
	return success
}

// ShouldEndWith receives exactly 2 string parameters and ensures that the first does not end with the second.
func ShouldNotEndWith(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}

	value, valueIsString := actual.(string)
	suffix, suffixIsString := expected[0].(string)

	if !valueIsString || !suffixIsString {
		return fmt.Sprintf(shouldBothBeStrings, reflect.TypeOf(actual), reflect.TypeOf(expected[0]))
	}

	return shouldNotEndWith(value, suffix)
}
func shouldNotEndWith(value, suffix string) string {
	if strings.HasSuffix(value, suffix) {
		if value == "" {
			value = "<empty>"
		}
		if suffix == "" {
			suffix = "<empty>"
		}
		return fmt.Sprintf(shouldNotHaveEndedWith, value, suffix)
	}
	return success
}

// ShouldContainSubstring receives exactly 2 string parameters and ensures that the first contains the second as a substring.
func ShouldContainSubstring(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}

	long, longOk := actual.(string)
	short, shortOk := expected[0].(string)

	if !longOk || !shortOk {
		return fmt.Sprintf(shouldBothBeStrings, reflect.TypeOf(actual), reflect.TypeOf(expected[0]))
	}

	if !strings.Contains(long, short) {
		return serializer.serialize(expected[0], actual, fmt.Sprintf(shouldHaveContainedSubstring, long, short))
	}
	return success
}

// ShouldNotContainSubstring receives exactly 2 string parameters and ensures that the first does NOT contain the second as a substring.
func ShouldNotContainSubstring(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}

	long, longOk := actual.(string)
	short, shortOk := expected[0].(string)

	if !longOk || !shortOk {
		return fmt.Sprintf(shouldBothBeStrings, reflect.TypeOf(actual), reflect.TypeOf(expected[0]))
	}

	if strings.Contains(long, short) {
		return fmt.Sprintf(shouldNotHaveContainedSubstring, long, short)
	}
	return success
}

// ShouldBeBlank receives exactly 1 string parameter and ensures that it is equal to "".
func ShouldBeBlank(actual interface{}, expected ...interface{}) string {
	if fail := need(0, expected); fail != success {
		return fail
	}
	value, ok := actual.(string)
	if !ok {
		return fmt.Sprintf(shouldBeString, reflect.TypeOf(actual))
	}
	if value != "" {
		return serializer.serialize("", value, fmt.Sprintf(shouldHaveBeenBlank, value))
	}
	return success
}

// ShouldNotBeBlank receives exactly 1 string parameter and ensures that it is equal to "".
func ShouldNotBeBlank(actual interface{}, expected ...interface{}) string {
	if fail := need(0, expected); fail != success {
		return fail
	}
	value, ok := actual.(string)
	if !ok {
		return fmt.Sprintf(shouldBeString, reflect.TypeOf(actual))
	}
	if value == "" {
		return shouldNotHaveBeenBlank
	}
	return success
}

// ShouldEqualWithout receives exactly 3 string parameters and ensures that the first is equal to the second
// after removing all instances of the third from the first using strings.Replace(first, third, "", -1).
func ShouldEqualWithout(actual interface{}, expected ...interface{}) string {
	if fail := need(2, expected); fail != success {
		return fail
	}
	actualString, ok1 := actual.(string)
	expectedString, ok2 := expected[0].(string)
	replace, ok3 := expected[1].(string)

	if !ok1 || !ok2 || !ok3 {
		return fmt.Sprintf(shouldAllBeStrings, []reflect.Type{
			reflect.TypeOf(actual),
			reflect.TypeOf(expected[0]),
			reflect.TypeOf(expected[1]),
		})
	}

	replaced := strings.Replace(actualString, replace, "", -1)
	if replaced == expectedString {
		return ""
	}

	return fmt.Sprintf("Expected '%s' to equal '%s' but without any '%s' (but it didn't).", actualString, expectedString, replace)
}

// ShouldEqualTrimSpace receives exactly 2 string parameters and ensures that the first is equal to the second
// after removing all leading and trailing whitespace using strings.TrimSpace(first).
func ShouldEqualTrimSpace(actual interface{}, expected ...interface{}) string {
	if fail := need(1, expected); fail != success {
		return fail
	}

	actualString, valueIsString := actual.(string)
	_, value2IsString := expected[0].(string)

	if !valueIsString || !value2IsString {
		return fmt.Sprintf(shouldBothBeStrings, reflect.TypeOf(actual), reflect.TypeOf(expected[0]))
	}

	actualString = strings.TrimSpace(actualString)
	return ShouldEqual(actualString, expected[0])
}
