package function

import (
	"github.com/zclconf/go-cty/cty"
)

// Unpredictable wraps a given function such that it retains the same arguments
// and type checking behavior but will return an unknown value when called.
//
// It is recommended that most functions be "pure", which is to say that they
// will always produce the same value given particular input. However,
// sometimes it is necessary to offer functions whose behavior depends on
// some external state, such as reading a file or determining the current time.
// In such cases, an unpredictable wrapper might be used to stand in for
// the function during some sort of prior "checking" phase in order to delay
// the actual effect until later.
//
// While Unpredictable can support a function that isn't pure in its
// implementation, it still expects a function to be pure in its type checking
// behavior, except for the special case of returning cty.DynamicPseudoType
// if it is not yet able to predict its return value based on current argument
// information.
func Unpredictable(f Function) Function {
	newSpec := *f.spec // shallow copy
	newSpec.Impl = unpredictableImpl
	return New(&newSpec)
}

func unpredictableImpl(args []cty.Value, retType cty.Type) (cty.Value, error) {
	return cty.UnknownVal(retType), nil
}
