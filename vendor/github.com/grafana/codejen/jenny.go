package codejen

// A Jenny is a single codejen code generator.
//
// Each Jenny works with exactly one type of input to its code generation, as
// indicated by its I type parameter, which may be any. The type [Input] is used
// as an indicator to humans of the purpose of such type parameters.
//
// Each Jenny takes either one or many Inputs, and produces one or many
// output files. Jennies may also return nils to indicate zero outputs.
//
// It is a design tenet of codejen that, in code generation, good separation
// of concerns starts with keeping a single file to a single responsibility. Thus,
// where possible, most Jennies should aim for one input to one output.
//
// Unfortunately, Go's generic system does not (yet?) allow expression of the
// necessary abstraction over individual kinds of Jennies as part of the Jenny
// interface itself. As such, the actual, functional interface is split into four:
//
//   - [OneToOne]: one [Input] in, one [File] out
//   - [OneToMany]: one [Input] in, many [File]s out
//   - [ManyToOne]: many [Input]s in, one [File] out
//   - [ManyToMany]: many [Input]s in, many [File]s out
//
// All jennies will follow exactly one of these four interfaces.
type Jenny[I Input] interface {
	// JennyName returns the name of the generator.
	JennyName() string

	// if only the type system let us do something like this, the API surface of
	// this library would shrink to a quarter its current size. so much more crisp
	// OneToOne[I] | ManyToOne[I any] | OneToMany[I] | ManyToMany[I]
}

// NamedJenny includes just the JennyName method. We have to have this interface
// due to the limits on Go's type system.
type NamedJenny interface {
	JennyName() string
}

// Input is used in generic type parameters solely to indicate to
// human eyes that that type parameter is used to govern the type passed as input to
// a jenny's Generate method.
//
// Input is an alias for any, because the codejen framework takes no stance on
// what can be accepted as jenny inputs.
type Input = any

// This library was originally written with Jinspiration as the name instead of
// Input.
//
// It's preserved here because you, dear reader of source code, deserve to
// giggle today.
//
// type Jinspiration = any
