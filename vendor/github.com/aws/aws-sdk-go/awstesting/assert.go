package awstesting

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/url"
	"reflect"
	"regexp"
	"sort"
	"testing"
)

// Match is a testing helper to test for testing error by comparing expected
// with a regular expression.
func Match(t *testing.T, regex, expected string) {
	if !regexp.MustCompile(regex).Match([]byte(expected)) {
		t.Errorf("%q\n\tdoes not match /%s/", expected, regex)
	}
}

// AssertURL verifies the expected URL is matches the actual.
func AssertURL(t *testing.T, expect, actual string, msgAndArgs ...interface{}) bool {
	expectURL, err := url.Parse(expect)
	if err != nil {
		t.Errorf(errMsg("unable to parse expected URL", err, msgAndArgs))
		return false
	}
	actualURL, err := url.Parse(actual)
	if err != nil {
		t.Errorf(errMsg("unable to parse actual URL", err, msgAndArgs))
		return false
	}

	equal(t, expectURL.Host, actualURL.Host, msgAndArgs...)
	equal(t, expectURL.Scheme, actualURL.Scheme, msgAndArgs...)
	equal(t, expectURL.Path, actualURL.Path, msgAndArgs...)

	return AssertQuery(t, expectURL.Query().Encode(), actualURL.Query().Encode(), msgAndArgs...)
}

// AssertQuery verifies the expect HTTP query string matches the actual.
func AssertQuery(t *testing.T, expect, actual string, msgAndArgs ...interface{}) bool {
	expectQ, err := url.ParseQuery(expect)
	if err != nil {
		t.Errorf(errMsg("unable to parse expected Query", err, msgAndArgs))
		return false
	}
	actualQ, err := url.ParseQuery(expect)
	if err != nil {
		t.Errorf(errMsg("unable to parse actual Query", err, msgAndArgs))
		return false
	}

	// Make sure the keys are the same
	if !equal(t, queryValueKeys(expectQ), queryValueKeys(actualQ), msgAndArgs...) {
		return false
	}

	for k, expectQVals := range expectQ {
		sort.Strings(expectQVals)
		actualQVals := actualQ[k]
		sort.Strings(actualQVals)
		equal(t, expectQVals, actualQVals, msgAndArgs...)
	}

	return true
}

// AssertJSON verifies that the expect json string matches the actual.
func AssertJSON(t *testing.T, expect, actual string, msgAndArgs ...interface{}) bool {
	expectVal := map[string]interface{}{}
	if err := json.Unmarshal([]byte(expect), &expectVal); err != nil {
		t.Errorf(errMsg("unable to parse expected JSON", err, msgAndArgs...))
		return false
	}

	actualVal := map[string]interface{}{}
	if err := json.Unmarshal([]byte(actual), &actualVal); err != nil {
		t.Errorf(errMsg("unable to parse actual JSON", err, msgAndArgs...))
		return false
	}

	return equal(t, expectVal, actualVal, msgAndArgs...)
}

// AssertXML verifies that the expect xml string matches the actual.
func AssertXML(t *testing.T, expect, actual string, container interface{}, msgAndArgs ...interface{}) bool {
	expectVal := container
	if err := xml.Unmarshal([]byte(expect), &expectVal); err != nil {
		t.Errorf(errMsg("unable to parse expected XML", err, msgAndArgs...))
	}

	actualVal := container
	if err := xml.Unmarshal([]byte(actual), &actualVal); err != nil {
		t.Errorf(errMsg("unable to parse actual XML", err, msgAndArgs...))
	}
	return equal(t, expectVal, actualVal, msgAndArgs...)
}

// objectsAreEqual determines if two objects are considered equal.
//
// This function does no assertion of any kind.
//
// Based on github.com/stretchr/testify/assert.ObjectsAreEqual
// Copied locally to prevent non-test build dependencies on testify
func objectsAreEqual(expected, actual interface{}) bool {
	if expected == nil || actual == nil {
		return expected == actual
	}

	return reflect.DeepEqual(expected, actual)
}

// Equal asserts that two objects are equal.
//
//    assert.Equal(t, 123, 123, "123 and 123 should be equal")
//
// Returns whether the assertion was successful (true) or not (false).
//
// Based on github.com/stretchr/testify/assert.Equal
// Copied locally to prevent non-test build dependencies on testify
func equal(t *testing.T, expected, actual interface{}, msgAndArgs ...interface{}) bool {
	if !objectsAreEqual(expected, actual) {
		t.Errorf("Not Equal:\n\t%#v (expected)\n\t%#v (actual), %s",
			expected, actual, messageFromMsgAndArgs(msgAndArgs))
		return false
	}

	return true
}

func errMsg(baseMsg string, err error, msgAndArgs ...interface{}) string {
	message := messageFromMsgAndArgs(msgAndArgs)
	if message != "" {
		message += ", "
	}
	return fmt.Sprintf("%s%s, %v", message, baseMsg, err)
}

// Based on github.com/stretchr/testify/assert.messageFromMsgAndArgs
// Copied locally to prevent non-test build dependencies on testify
func messageFromMsgAndArgs(msgAndArgs []interface{}) string {
	if len(msgAndArgs) == 0 || msgAndArgs == nil {
		return ""
	}
	if len(msgAndArgs) == 1 {
		return msgAndArgs[0].(string)
	}
	if len(msgAndArgs) > 1 {
		return fmt.Sprintf(msgAndArgs[0].(string), msgAndArgs[1:]...)
	}
	return ""
}

func queryValueKeys(v url.Values) []string {
	keys := make([]string, 0, len(v))
	for k := range v {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
