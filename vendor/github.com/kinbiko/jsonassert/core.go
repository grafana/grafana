package jsonassert

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

func (a *Asserter) pathassertf(path, act, exp string) {
	if t, ok := a.Printer.(tt); ok {
		t.Helper()
	}
	if act == exp {
		return
	}
	actType, err := findType(act)
	if err != nil {
		a.Printer.Errorf("'actual' JSON is not valid JSON: " + err.Error())
		return
	}
	expType, err := findType(exp)
	if err != nil {
		a.Printer.Errorf("'expected' JSON is not valid JSON: " + err.Error())
		return
	}

	// If we're only caring about the presence of the key, then don't bother checking any further
	if expPresence, _ := extractString(exp); expPresence == "<<PRESENCE>>" {
		if actType == jsonNull {
			a.Printer.Errorf(`expected the presence of any value at '%s', but was absent`, path)
		}
		return
	}

	if actType != expType {
		a.Printer.Errorf("actual JSON (%s) and expected JSON (%s) were of different types at '%s'", actType, expType, path)
		return
	}
	switch actType {
	case jsonBoolean:
		actBool, _ := extractBoolean(act)
		expBool, _ := extractBoolean(exp)
		a.checkBoolean(path, actBool, expBool)
	case jsonNumber:
		actNumber, _ := extractNumber(act)
		expNumber, _ := extractNumber(exp)
		a.checkNumber(path, actNumber, expNumber)
	case jsonString:
		actString, _ := extractString(act)
		expString, _ := extractString(exp)
		a.checkString(path, actString, expString)
	case jsonObject:
		actObject, _ := extractObject(act)
		expObject, _ := extractObject(exp)
		a.checkObject(path, actObject, expObject)
	case jsonArray:
		actArray, _ := extractArray(act)
		expArray, _ := extractArray(exp)
		a.checkArray(path, actArray, expArray)
	}
}

func serialize(a interface{}) string {
	bytes, err := json.Marshal(a)
	if err != nil {
		// Really don't want to panic here, but I can't see a reasonable solution.
		// If this line *does* get executed then we should really investigate what kind of input was given
		panic(errors.New("unexpected failure to re-serialize nested JSON. Please raise an issue including this error message and both the expected and actual JSON strings you used to trigger this panic" + err.Error()))
	}
	return string(bytes)
}

type jsonType string

const (
	jsonString      jsonType = "string"
	jsonNumber      jsonType = "number"
	jsonBoolean     jsonType = "boolean"
	jsonNull        jsonType = "null"
	jsonObject      jsonType = "object"
	jsonArray       jsonType = "array"
	jsonTypeUnknown jsonType = "unknown"
)

func findType(j string) (jsonType, error) {
	j = strings.TrimSpace(j)
	if _, err := extractString(j); err == nil {
		return jsonString, nil
	}
	if _, err := extractNumber(j); err == nil {
		return jsonNumber, nil
	}
	if j == "null" {
		return jsonNull, nil
	}
	if _, err := extractObject(j); err == nil {
		return jsonObject, nil
	}
	if _, err := extractBoolean(j); err == nil {
		return jsonBoolean, nil
	}
	if _, err := extractArray(j); err == nil {
		return jsonArray, nil
	}
	return jsonTypeUnknown, fmt.Errorf(`unable to identify JSON type of "%s"`, j)
}

// *testing.T has a Helper() func that allow testing tools like this package to
// ignore their own frames when calling Errorf on *testing.T instances.
// This interface is here to avoid breaking backwards compatibility in terms of
// the interface we expect in New.
type tt interface {
	Printer
	Helper()
}
