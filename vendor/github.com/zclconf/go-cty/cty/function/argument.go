package function

import (
	"github.com/zclconf/go-cty/cty"
)

// Parameter represents a parameter to a function.
type Parameter struct {
	// Name is an optional name for the argument. This package ignores this
	// value, but callers may use it for documentation, etc.
	Name string

	// Description is an optional description for the argument.
	Description string

	// A type that any argument for this parameter must conform to.
	// cty.DynamicPseudoType can be used, either at top-level or nested
	// in a parameterized type, to indicate that any type should be
	// permitted, to allow the definition of type-generic functions.
	Type cty.Type

	// If AllowNull is set then null values may be passed into this
	// argument's slot in both the type-check function and the implementation
	// function. If not set, such values are rejected by the built-in
	// checking rules.
	AllowNull bool

	// If AllowUnknown is set then unknown values may be passed into this
	// argument's slot in the implementation function. If not set, any
	// unknown values will cause the function to immediately return
	// an unkonwn value without calling the implementation function, thus
	// freeing the function implementer from dealing with this case.
	AllowUnknown bool

	// If AllowDynamicType is set then DynamicVal may be passed into this
	// argument's slot in the implementation function. If not set, any
	// dynamic values will cause the function to immediately return
	// DynamicVal value without calling the implementation function, thus
	// freeing the function implementer from dealing with this case.
	//
	// Note that DynamicVal is also unknown, so in order to receive dynamic
	// *values* it is also necessary to set AllowUnknown.
	//
	// However, it is valid to set AllowDynamicType without AllowUnknown, in
	// which case a dynamic value may be passed to the type checking function
	// but will not make it to the *implementation* function. Instead, an
	// unknown value of the type returned by the type-check function will be
	// returned. This is suggested for functions that have a static return
	// type since it allows the return value to be typed even if the input
	// values are not, thus improving the type-check accuracy of derived
	// values.
	AllowDynamicType bool

	// If AllowMarked is set then marked values may be passed into this
	// argument's slot in the implementation function. If not set, any
	// marked value will be unmarked before calling and then the markings
	// from that value will be applied automatically to the function result,
	// ensuring that the marks get propagated in a simplistic way even if
	// a function is unable to handle them.
	//
	// For any argument whose parameter has AllowMarked set, it's the
	// function implementation's responsibility to Unmark the given value
	// and propagate the marks appropriatedly to the result in order to
	// avoid losing the marks. Application-specific functions might use
	// special rules to selectively propagate particular marks.
	//
	// The automatic unmarking of values applies only to the main
	// implementation function. In an application that uses marked values,
	// the Type implementation for a function must always be prepared to accept
	// marked values, which is easy to achieve by consulting only the type
	// and ignoring the value itself.
	AllowMarked bool
}
