package interpreter

import (
	"errors"
	"fmt"

	jperror "github.com/jmespath-community/go-jmespath/pkg/error"
	"github.com/jmespath-community/go-jmespath/pkg/functions"
	"github.com/jmespath-community/go-jmespath/pkg/util"
)

type FunctionCaller interface {
	CallFunction(string, []interface{}) (interface{}, error)
}

type functionEntry struct {
	arguments []functions.ArgSpec
	handler   functions.JpFunction
}

type functionCaller struct {
	functionTable map[string]functionEntry
}

func NewFunctionCaller(funcs ...functions.FunctionEntry) *functionCaller {
	fTable := map[string]functionEntry{}
	for _, f := range funcs {
		fTable[f.Name] = functionEntry{
			arguments: f.Arguments,
			handler:   f.Handler,
		}
	}
	return &functionCaller{
		functionTable: fTable,
	}
}

func resolveArgs(name string, function functionEntry, arguments []interface{}) ([]interface{}, error) {
	if len(function.arguments) == 0 {
		return arguments, nil
	}

	variadic := isVariadic(function.arguments)
	minExpected := getMinExpected(function.arguments)
	maxExpected, hasMax := getMaxExpected(function.arguments)
	count := len(arguments)

	if count < minExpected {
		return nil, jperror.NotEnoughArgumentsSupplied(name, count, minExpected, variadic)
	}

	if hasMax && count > maxExpected {
		return nil, jperror.TooManyArgumentsSupplied(name, count, maxExpected)
	}

	for i, spec := range function.arguments {
		if !spec.Optional || i <= len(arguments)-1 {
			userArg := arguments[i]
			err := typeCheck(spec, userArg)
			if err != nil {
				return nil, err
			}
		}
	}
	lastIndex := len(function.arguments) - 1
	lastArg := function.arguments[lastIndex]
	if lastArg.Variadic {
		for i := len(function.arguments) - 1; i < len(arguments); i++ {
			userArg := arguments[i]
			err := typeCheck(lastArg, userArg)
			if err != nil {
				return nil, err
			}
		}
	}
	return arguments, nil
}

func isVariadic(arguments []functions.ArgSpec) bool {
	for _, spec := range arguments {
		if spec.Variadic {
			return true
		}
	}
	return false
}

func getMinExpected(arguments []functions.ArgSpec) int {
	expected := 0
	for _, spec := range arguments {
		if !spec.Optional {
			expected++
		}
	}
	return expected
}

func getMaxExpected(arguments []functions.ArgSpec) (int, bool) {
	if isVariadic(arguments) {
		return 0, false
	}
	return len(arguments), true
}

func typeCheck(a functions.ArgSpec, arg interface{}) error {
	for _, t := range a.Types {
		switch t {
		case functions.JpNumber:
			if _, ok := arg.(float64); ok {
				return nil
			}
		case functions.JpString:
			if _, ok := arg.(string); ok {
				return nil
			}
		case functions.JpArray:
			if util.IsSliceType(arg) {
				return nil
			}
		case functions.JpObject:
			if _, ok := arg.(map[string]interface{}); ok {
				return nil
			}
		case functions.JpArrayArray:
			if util.IsSliceType(arg) {
				if _, ok := arg.([]interface{}); ok {
					return nil
				}
			}
		case functions.JpArrayNumber:
			if _, ok := util.ToArrayNum(arg); ok {
				return nil
			}
		case functions.JpArrayString:
			if _, ok := util.ToArrayStr(arg); ok {
				return nil
			}
		case functions.JpAny:
			return nil
		case functions.JpExpref:
			if _, ok := arg.(functions.ExpRef); ok {
				return nil
			}
		}
	}
	return fmt.Errorf("invalid type for: %v, expected: %#v", arg, a.Types)
}

func (f *functionCaller) CallFunction(name string, arguments []interface{}) (interface{}, error) {
	entry, ok := f.functionTable[name]
	if !ok {
		return nil, errors.New("unknown function: " + name)
	}
	resolvedArgs, err := resolveArgs(name, entry, arguments)
	if err != nil {
		return nil, err
	}
	return entry.handler(resolvedArgs)
}
