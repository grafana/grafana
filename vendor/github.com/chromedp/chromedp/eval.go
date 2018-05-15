package chromedp

import (
	"context"
	"encoding/json"

	"github.com/chromedp/cdproto/cdp"
	rundom "github.com/chromedp/cdproto/runtime"
)

// Evaluate is an action to evaluate the Javascript expression, unmarshaling
// the result of the script evaluation to res.
//
// When res is a type other than *[]byte, or **chromedp/cdp/runtime.RemoteObject,
// then the result of the script evaluation will be returned "by value" (ie,
// JSON-encoded), and subsequently an attempt will be made to json.Unmarshal
// the script result to res.
//
// Otherwise, when res is a *[]byte, the raw JSON-encoded value of the script
// result will be placed in res. Similarly, if res is a *runtime.RemoteObject,
// then res will be set to the low-level protocol type, and no attempt will be
// made to convert the result.
//
// Note: any exception encountered will be returned as an error.
func Evaluate(expression string, res interface{}, opts ...EvaluateOption) Action {
	if res == nil {
		panic("res cannot be nil")
	}

	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		// set up parameters
		p := rundom.Evaluate(expression)
		switch res.(type) {
		case **rundom.RemoteObject:
		default:
			p = p.WithReturnByValue(true)
		}

		// apply opts
		for _, o := range opts {
			p = o(p)
		}

		// evaluate
		v, exp, err := p.Do(ctxt, h)
		if err != nil {
			return err
		}
		if exp != nil {
			return exp
		}

		switch x := res.(type) {
		case **rundom.RemoteObject:
			*x = v
			return nil

		case *[]byte:
			*x = []byte(v.Value)
			return nil
		}

		// unmarshal
		return json.Unmarshal(v.Value, res)
	})
}

// EvaluateAsDevTools is an action that evaluates a Javascript expression as
// Chrome DevTools would, evaluating the expression in the "console" context,
// and making the Command Line API available to the script.
//
// Note: this should not be used with untrusted Javascript.
func EvaluateAsDevTools(expression string, res interface{}, opts ...EvaluateOption) Action {
	return Evaluate(expression, res, append(opts, EvalObjectGroup("console"), EvalWithCommandLineAPI)...)
}

// EvaluateOption is the type for script evaluation options.
type EvaluateOption func(*rundom.EvaluateParams) *rundom.EvaluateParams

// EvalObjectGroup is a evaluate option to set the object group.
func EvalObjectGroup(objectGroup string) EvaluateOption {
	return func(p *rundom.EvaluateParams) *rundom.EvaluateParams {
		return p.WithObjectGroup(objectGroup)
	}
}

// EvalWithCommandLineAPI is an evaluate option to make the DevTools Command
// Line API available to the evaluated script.
//
// Note: this should not be used with untrusted Javascript.
func EvalWithCommandLineAPI(p *rundom.EvaluateParams) *rundom.EvaluateParams {
	return p.WithIncludeCommandLineAPI(true)
}

// EvalIgnoreExceptions is a evaluate option that will cause script evaluation
// to ignore exceptions.
func EvalIgnoreExceptions(p *rundom.EvaluateParams) *rundom.EvaluateParams {
	return p.WithSilent(true)
}

// EvalAsValue is a evaluate option that will cause the evaluated script to
// encode the result of the expression as a JSON-encoded value.
func EvalAsValue(p *rundom.EvaluateParams) *rundom.EvaluateParams {
	return p.WithReturnByValue(true)
}
