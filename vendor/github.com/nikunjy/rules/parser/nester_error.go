package parser

import (
	"encoding/json"
	"fmt"
)

type ErrVals map[string]interface{}

func (e ErrVals) Dupe() ErrVals {
	ret := make(ErrVals)
	for k, v := range e {
		ret[k] = v
	}
	return ret

}
func (e ErrVals) Merge(vals ErrVals) {
	for k, v := range vals {
		e[k] = v
	}
}

type NestedError struct {
	Err  error
	Msg  string
	Vals ErrVals
}

func (e *NestedError) Original() error {
	switch val := e.Err.(type) {
	case *NestedError:
		return val.Original()
	default:
		return e.Err
	}
}

func (e *NestedError) Error() string {
	if e.Vals == nil {
		e.Vals = make(map[string]interface{})
	}
	e.Vals["err"] = e.Err.Error()
	e.Vals["msg"] = e.Msg
	data, err := json.Marshal(e.Vals.Dupe())
	if err != nil {
		return fmt.Sprintf("%s: %s", e.Msg, e.Err.Error())
	}
	return string(data)
}

func (e *NestedError) Set(vals ErrVals) *NestedError {
	if e.Vals == nil {
		e.Vals = make(ErrVals)
	}
	e.Vals.Merge(vals.Dupe())
	return e
}

func newNestedError(err error, msg string) *NestedError {
	return &NestedError{
		Err: err,
		Msg: msg,
	}
}
