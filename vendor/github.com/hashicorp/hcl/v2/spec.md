# HCL Syntax-Agnostic Information Model

This is the specification for the general information model (abstract types and
semantics) for hcl. HCL is a system for defining configuration languages for
applications. The HCL information model is designed to support multiple
concrete syntaxes for configuration, each with a mapping to the model defined
in this specification.

The two primary syntaxes intended for use in conjunction with this model are
[the HCL native syntax](./hclsyntax/spec.md) and [the JSON syntax](./json/spec.md).
In principle other syntaxes are possible as long as either their language model
is sufficiently rich to express the concepts described in this specification
or the language targets a well-defined subset of the specification.

## Structural Elements

The primary structural element is the _body_, which is a container representing
a set of zero or more _attributes_ and a set of zero or more _blocks_.

A _configuration file_ is the top-level object, and will usually be produced
by reading a file from disk and parsing it as a particular syntax. A
configuration file has its own _body_, representing the top-level attributes
and blocks.

An _attribute_ is a name and value pair associated with a body. Attribute names
are unique within a given body. Attribute values are provided as _expressions_,
which are discussed in detail in a later section.

A _block_ is a nested structure that has a _type name_, zero or more string
_labels_ (e.g. identifiers), and a nested body.

Together the structural elements create a hierarchical data structure, with
attributes intended to represent the direct properties of a particular object
in the calling application, and blocks intended to represent child objects
of a particular object.

## Body Content

To support the expression of the HCL concepts in languages whose information
model is a subset of HCL's, such as JSON, a _body_ is an opaque container
whose content can only be accessed by providing information on the expected
structure of the content.

The specification for each syntax must describe how its physical constructs
are mapped on to body content given a schema. For syntaxes that have
first-class syntax distinguishing attributes and bodies this can be relatively
straightforward, while more detailed mapping rules may be required in syntaxes
where the representation of attributes vs. blocks is ambiguous.

### Schema-driven Processing

Schema-driven processing is the primary way to access body content.
A _body schema_ is a description of what is expected within a particular body,
which can then be used to extract the _body content_, which then provides
access to the specific attributes and blocks requested.

A _body schema_ consists of a list of _attribute schemata_ and
_block header schemata_:

- An _attribute schema_ provides the name of an attribute and whether its
  presence is required.

- A _block header schema_ provides a block type name and the semantic names
  assigned to each of the labels of that block type, if any.

Within a schema, it is an error to request the same attribute name twice or
to request a block type whose name is also an attribute name. While this can
in principle be supported in some syntaxes, in other syntaxes the attribute
and block namespaces are combined and so an attribute cannot coexist with
a block whose type name is identical to the attribute name.

The result of applying a body schema to a body is _body content_, which
consists of an _attribute map_ and a _block sequence_:

- The _attribute map_ is a map data structure whose keys are attribute names
  and whose values are _expressions_ that represent the corresponding attribute
  values.

- The _block sequence_ is an ordered sequence of blocks, with each specifying
  a block _type name_, the sequence of _labels_ specified for the block,
  and the body object (not body _content_) representing the block's own body.

After obtaining _body content_, the calling application may continue processing
by evaluating attribute expressions and/or recursively applying further
schema-driven processing to the child block bodies.

**Note:** The _body schema_ is intentionally minimal, to reduce the set of
mapping rules that must be defined for each syntax. Higher-level utility
libraries may be provided to assist in the construction of a schema and
perform additional processing, such as automatically evaluating attribute
expressions and assigning their result values into a data structure, or
recursively applying a schema to child blocks. Such utilities are not part of
this core specification and will vary depending on the capabilities and idiom
of the implementation language.

### _Dynamic Attributes_ Processing

The _schema-driven_ processing model is useful when the expected structure
of a body is known by the calling application. Some blocks are
instead more free-form, such as a user-provided set of arbitrary key/value
pairs.

The alternative _dynamic attributes_ processing mode allows for this more
ad-hoc approach. Processing in this mode behaves as if a schema had been
constructed without any _block header schemata_ and with an attribute
schema for each distinct key provided within the physical representation
of the body.

The means by which _distinct keys_ are identified is dependent on the
physical syntax; this processing mode assumes that the syntax has a way
to enumerate keys provided by the author and identify expressions that
correspond with those keys, but does not define the means by which this is
done.

The result of _dynamic attributes_ processing is an _attribute map_ as
defined in the previous section. No _block sequence_ is produced in this
processing mode.

### Partial Processing of Body Content

Under _schema-driven processing_, by default the given schema is assumed
to be exhaustive, such that any attribute or block not matched by schema
elements is considered an error. This allows feedback about unsupported
attributes and blocks (such as typos) to be provided.

An alternative is _partial processing_, where any additional elements within
the body are not considered an error.

Under partial processing, the result is both body content as described
above _and_ a new body that represents any body elements that remain after
the schema has been processed.

Specifically:

- Any attribute whose name is specified in the schema is returned in body
  content and elided from the new body.

- Any block whose type is specified in the schema is returned in body content
  and elided from the new body.

- Any attribute or block _not_ meeting the above conditions is placed into
  the new body, unmodified.

The new body can then be recursively processed using any of the body
processing models. This facility allows different subsets of body content
to be processed by different parts of the calling application.

Processing a body in two steps — first partial processing of a source body,
then exhaustive processing of the returned body — is equivalent to single-step
processing with a schema that is the union of the schemata used
across the two steps.

## Expressions

Attribute values are represented by _expressions_. Depending on the concrete
syntax in use, an expression may just be a literal value or it may describe
a computation in terms of literal values, variables, and functions.

Each syntax defines its own representation of expressions. For syntaxes based
in languages that do not have any non-literal expression syntax, it is
recommended to embed the template language from
[the native syntax](./hclsyntax/spec.md) e.g. as a post-processing step on
string literals.

### Expression Evaluation

In order to obtain a concrete value, each expression must be _evaluated_.
Evaluation is performed in terms of an evaluation context, which
consists of the following:

- An _evaluation mode_, which is defined below.
- A _variable scope_, which provides a set of named variables for use in
  expressions.
- A _function table_, which provides a set of named functions for use in
  expressions.

The _evaluation mode_ allows for two different interpretations of an
expression:

- In _literal-only mode_, variables and functions are not available and it
  is assumed that the calling application's intent is to treat the attribute
  value as a literal.

- In _full expression mode_, variables and functions are defined and it is
  assumed that the calling application wishes to provide a full expression
  language for definition of the attribute value.

The actual behavior of these two modes depends on the syntax in use. For
languages with first-class expression syntax, these two modes may be considered
equivalent, with _literal-only mode_ simply not defining any variables or
functions. For languages that embed arbitrary expressions via string templates,
_literal-only mode_ may disable such processing, allowing literal strings to
pass through without interpretation as templates.

Since literal-only mode does not support variables and functions, it is an
error for the calling application to enable this mode and yet provide a
variable scope and/or function table.

## Values and Value Types

The result of expression evaluation is a _value_. Each value has a _type_,
which is dynamically determined during evaluation. The _variable scope_ in
the evaluation context is a map from variable name to value, using the same
definition of value.

The type system for HCL values is intended to be of a level abstraction
suitable for configuration of various applications. A well-defined,
implementation-language-agnostic type system is defined to allow for
consistent processing of configuration across many implementation languages.
Concrete implementations may provide additional functionality to lower
HCL values and types to corresponding native language types, which may then
impose additional constraints on the values outside of the scope of this
specification.

Two values are _equal_ if and only if they have identical types and their
values are equal according to the rules of their shared type.

### Primitive Types

The primitive types are _string_, _bool_, and _number_.

A _string_ is a sequence of unicode characters. Two strings are equal if
NFC normalization ([UAX#15](http://unicode.org/reports/tr15/)
of each string produces two identical sequences of characters.
NFC normalization ensures that, for example, a precomposed combination of a
latin letter and a diacritic compares equal with the letter followed by
a combining diacritic.

The _bool_ type has only two non-null values: _true_ and _false_. Two bool
values are equal if and only if they are either both true or both false.

A _number_ is an arbitrary-precision floating point value. An implementation
_must_ make the full-precision values available to the calling application
for interpretation into any suitable number representation. An implementation
may in practice implement numbers with limited precision so long as the
following constraints are met:

- Integers are represented with at least 256 bits.
- Non-integer numbers are represented as floating point values with a
  mantissa of at least 256 bits and a signed binary exponent of at least
  16 bits.
- An error is produced if an integer value given in source cannot be
  represented precisely.
- An error is produced if a non-integer value cannot be represented due to
  overflow.
- A non-integer number is rounded to the nearest possible value when a
  value is of too high a precision to be represented.

The _number_ type also requires representation of both positive and negative
infinity. A "not a number" (NaN) value is _not_ provided nor used.

Two number values are equal if they are numerically equal to the precision
associated with the number. Positive infinity and negative infinity are
equal to themselves but not to each other. Positive infinity is greater than
any other number value, and negative infinity is less than any other number
value.

Some syntaxes may be unable to represent numeric literals of arbitrary
precision. This must be defined in the syntax specification as part of its
description of mapping numeric literals to HCL values.

### Structural Types

_Structural types_ are types that are constructed by combining other types.
Each distinct combination of other types is itself a distinct type. There
are two structural type _kinds_:

- _Object types_ are constructed of a set of named attributes, each of which
  has a type. Attribute names are always strings. (_Object_ attributes are a
  distinct idea from _body_ attributes, though calling applications
  may choose to blur the distinction by use of common naming schemes.)
- _Tuple types_ are constructed of a sequence of elements, each of which
  has a type.

Values of structural types are compared for equality in terms of their
attributes or elements. A structural type value is equal to another if and
only if all of the corresponding attributes or elements are equal.

Two structural types are identical if they are of the same kind and
have attributes or elements with identical types.

### Collection Types

_Collection types_ are types that combine together an arbitrary number of
values of some other single type. There are three collection type _kinds_:

- _List types_ represent ordered sequences of values of their element type.
- _Map types_ represent values of their element type accessed via string keys.
- _Set types_ represent unordered sets of distinct values of their element type.

For each of these kinds and each distinct element type there is a distinct
collection type. For example, "list of string" is a distinct type from
"set of string", and "list of number" is a distinct type from "list of string".

Values of collection types are compared for equality in terms of their
elements. A collection type value is equal to another if and only if both
have the same number of elements and their corresponding elements are equal.

Two collection types are identical if they are of the same kind and have
the same element type.

### Null values

Each type has a null value. The null value of a type represents the absence
of a value, but with type information retained to allow for type checking.

Null values are used primarily to represent the conditional absence of a
body attribute. In a syntax with a conditional operator, one of the result
values of that conditional may be null to indicate that the attribute should be
considered not present in that case.

Calling applications _should_ consider an attribute with a null value as
equivalent to the value not being present at all.

A null value of a particular type is equal to itself.

### Unknown Values and the Dynamic Pseudo-type

An _unknown value_ is a placeholder for a value that is not yet known.
Operations on unknown values themselves return unknown values that have a
type appropriate to the operation. For example, adding together two unknown
numbers yields an unknown number, while comparing two unknown values of any
type for equality yields an unknown bool.

Each type has a distinct unknown value. For example, an unknown _number_ is
a distinct value from an unknown _string_.

_The dynamic pseudo-type_ is a placeholder for a type that is not yet known.
The only values of this type are its null value and its unknown value. It is
referred to as a _pseudo-type_ because it should not be considered a type in
its own right, but rather as a placeholder for a type yet to be established.
The unknown value of the dynamic pseudo-type is referred to as _the dynamic
value_.

Operations on values of the dynamic pseudo-type behave as if it is a value
of the expected type, optimistically assuming that once the value and type
are known they will be valid for the operation. For example, adding together
a number and the dynamic value produces an unknown number.

Unknown values and the dynamic pseudo-type can be used as a mechanism for
partial type checking and semantic checking: by evaluating an expression with
all variables set to an unknown value, the expression can be evaluated to
produce an unknown value of a given type, or produce an error if any operation
is provably invalid with only type information.

Unknown values and the dynamic pseudo-type must never be returned from
operations unless at least one operand is unknown or dynamic. Calling
applications are guaranteed that unless the global scope includes unknown
values, or the function table includes functions that return unknown values,
no expression will evaluate to an unknown value. The calling application is
thus in total control over the use and meaning of unknown values.

The dynamic pseudo-type is identical only to itself.

### Capsule Types

A _capsule type_ is a custom type defined by the calling application. A value
of a capsule type is considered opaque to HCL, but may be accepted
by functions provided by the calling application.

A particular capsule type is identical only to itself. The equality of two
values of the same capsule type is defined by the calling application. No
other operations are supported for values of capsule types.

Support for capsule types in a HCL implementation is optional. Capsule types
are intended to allow calling applications to pass through values that are
not part of the standard type system. For example, an application that
deals with raw binary data may define a capsule type representing a byte
array, and provide functions that produce or operate on byte arrays.

### Type Specifications

In certain situations it is necessary to define expectations about the expected
type of a value. Whereas two _types_ have a commutative _identity_ relationship,
a type has a non-commutative _matches_ relationship with a _type specification_.
A type specification is, in practice, just a different interpretation of a
type such that:

- Any type _matches_ any type that it is identical to.

- Any type _matches_ the dynamic pseudo-type.

For example, given a type specification "list of dynamic pseudo-type", the
concrete types "list of string" and "list of map" match, but the
type "set of string" does not.

## Functions and Function Calls

The evaluation context used to evaluate an expression includes a function
table, which represents an application-defined set of named functions
available for use in expressions.

Each syntax defines whether function calls are supported and how they are
physically represented in source code, but the semantics of function calls are
defined here to ensure consistent results across syntaxes and to allow
applications to provide functions that are interoperable with all syntaxes.

A _function_ is defined from the following elements:

- Zero or more _positional parameters_, each with a name used for documentation,
  a type specification for expected argument values, and a flag for whether
  each of null values, unknown values, and values of the dynamic pseudo-type
  are accepted.

- Zero or one _variadic parameters_, with the same structure as the _positional_
  parameters, which if present collects any additional arguments provided at
  the function call site.

- A _result type definition_, which specifies the value type returned for each
  valid sequence of argument values.

- A _result value definition_, which specifies the value returned for each
  valid sequence of argument values.

A _function call_, regardless of source syntax, consists of a sequence of
argument values. The argument values are each mapped to a corresponding
parameter as follows:

- For each of the function's positional parameters in sequence, take the next
  argument. If there are no more arguments, the call is erroneous.

- If the function has a variadic parameter, take all remaining arguments that
  where not yet assigned to a positional parameter and collect them into
  a sequence of variadic arguments that each correspond to the variadic
  parameter.

- If the function has _no_ variadic parameter, it is an error if any arguments
  remain after taking one argument for each positional parameter.

After mapping each argument to a parameter, semantic checking proceeds
for each argument:

- If the argument value corresponding to a parameter does not match the
  parameter's type specification, the call is erroneous.

- If the argument value corresponding to a parameter is null and the parameter
  is not specified as accepting nulls, the call is erroneous.

- If the argument value corresponding to a parameter is the dynamic value
  and the parameter is not specified as accepting values of the dynamic
  pseudo-type, the call is valid but its _result type_ is forced to be the
  dynamic pseudo type.

- If neither of the above conditions holds for any argument, the call is
  valid and the function's value type definition is used to determine the
  call's _result type_. A function _may_ vary its result type depending on
  the argument _values_ as well as the argument _types_; for example, a
  function that decodes a JSON value will return a different result type
  depending on the data structure described by the given JSON source code.

If semantic checking succeeds without error, the call is _executed_:

- For each argument, if its value is unknown and its corresponding parameter
  is not specified as accepting unknowns, the _result value_ is forced to be an
  unknown value of the result type.

- If the previous condition does not apply, the function's result value
  definition is used to determine the call's _result value_.

The result of a function call expression is either an error, if one of the
erroneous conditions above applies, or the _result value_.

## Type Conversions and Unification

Values given in configuration may not always match the expectations of the
operations applied to them or to the calling application. In such situations,
automatic type conversion is attempted as a convenience to the user.

Along with conversions to a _specified_ type, it is sometimes necessary to
ensure that a selection of values are all of the _same_ type, without any
constraint on which type that is. This is the process of _type unification_,
which attempts to find the most general type that all of the given types can
be converted to.

Both type conversions and unification are defined in the syntax-agnostic
model to ensure consistency of behavior between syntaxes.

Type conversions are broadly characterized into two categories: _safe_ and
_unsafe_. A conversion is "safe" if any distinct value of the source type
has a corresponding distinct value in the target type. A conversion is
"unsafe" if either the target type values are _not_ distinct (information
may be lost in conversion) or if some values of the source type do not have
any corresponding value in the target type. An unsafe conversion may result
in an error.

A given type can always be converted to itself, which is a no-op.

### Conversion of Null Values

All null values are safely convertable to a null value of any other type,
regardless of other type-specific rules specified in the sections below.

### Conversion to and from the Dynamic Pseudo-type

Conversion _from_ the dynamic pseudo-type _to_ any other type always succeeds,
producing an unknown value of the target type.

Conversion of any value _to_ the dynamic pseudo-type is a no-op. The result
is the input value, verbatim. This is the only situation where the conversion
result value is not of the given target type.

### Primitive Type Conversions

Bidirectional conversions are available between the string and number types,
and between the string and boolean types.

The bool value true corresponds to the string containing the characters "true",
while the bool value false corresponds to the string containing the characters
"false". Conversion from bool to string is safe, while the converse is
unsafe. The strings "1" and "0" are alternative string representations
of true and false respectively. It is an error to convert a string other than
the four in this paragraph to type bool.

A number value is converted to string by translating its integer portion
into a sequence of decimal digits (`0` through `9`), and then if it has a
non-zero fractional part, a period `.` followed by a sequence of decimal
digits representing its fractional part. No exponent portion is included.
The number is converted at its full precision. Conversion from number to
string is safe.

A string is converted to a number value by reversing the above mapping.
No exponent portion is allowed. Conversion from string to number is unsafe.
It is an error to convert a string that does not comply with the expected
syntax to type number.

No direct conversion is available between the bool and number types.

### Collection and Structural Type Conversions

Conversion from set types to list types is _safe_, as long as their
element types are safely convertable. If the element types are _unsafely_
convertable, then the collection conversion is also unsafe. Each set element
becomes a corresponding list element, in an undefined order. Although no
particular ordering is required, implementations _should_ produce list
elements in a consistent order for a given input set, as a convenience
to calling applications.

Conversion from list types to set types is _unsafe_, as long as their element
types are convertable. Each distinct list item becomes a distinct set item.
If two list items are equal, one of the two is lost in the conversion.

Conversion from tuple types to list types permitted if all of the
tuple element types are convertable to the target list element type.
The safety of the conversion depends on the safety of each of the element
conversions. Each element in turn is converted to the list element type,
producing a list of identical length.

Conversion from tuple types to set types is permitted, behaving as if the
tuple type was first converted to a list of the same element type and then
that list converted to the target set type.

Conversion from object types to map types is permitted if all of the object
attribute types are convertable to the target map element type. The safety
of the conversion depends on the safety of each of the attribute conversions.
Each attribute in turn is converted to the map element type, and map element
keys are set to the name of each corresponding object attribute.

Conversion from list and set types to tuple types is permitted, following
the opposite steps as the converse conversions. Such conversions are _unsafe_.
It is an error to convert a list or set to a tuple type whose number of
elements does not match the list or set length.

Conversion from map types to object types is permitted if each map key
corresponds to an attribute in the target object type. It is an error to
convert from a map value whose set of keys does not exactly match the target
type's attributes. The conversion takes the opposite steps of the converse
conversion.

Conversion from one object type to another is permitted as long as the
common attribute names have convertable types. Any attribute present in the
target type but not in the source type is populated with a null value of
the appropriate type.

Conversion from one tuple type to another is permitted as long as the
tuples have the same length and the elements have convertable types.

### Type Unification

Type unification is an operation that takes a list of types and attempts
to find a single type to which they can all be converted. Since some
type pairs have bidirectional conversions, preference is given to _safe_
conversions. In technical terms, all possible types are arranged into
a lattice, from which a most general supertype is selected where possible.

The type resulting from type unification may be one of the input types, or
it may be an entirely new type produced by combination of two or more
input types.

The following rules do not guarantee a valid result. In addition to these
rules, unification fails if any of the given types are not convertable
(per the above rules) to the selected result type.

The following unification rules apply transitively. That is, if a rule is
defined from A to B, and one from B to C, then A can unify to C.

Number and bool types both unify with string by preferring string.

Two collection types of the same kind unify according to the unification
of their element types.

List and set types unify by preferring the list type.

Map and object types unify by preferring the object type.

List, set and tuple types unify by preferring the tuple type.

The dynamic pseudo-type unifies with any other type by selecting that other
type. The dynamic pseudo-type is the result type only if _all_ input types
are the dynamic pseudo-type.

Two object types unify by constructing a new type whose attributes are
the union of those of the two input types. Any common attributes themselves
have their types unified.

Two tuple types of the same length unify constructing a new type of the
same length whose elements are the unification of the corresponding elements
in the two input types.

## Static Analysis

In most applications, full expression evaluation is sufficient for understanding
the provided configuration. However, some specialized applications require more
direct access to the physical structures in the expressions, which can for
example allow the construction of new language constructs in terms of the
existing syntax elements.

Since static analysis analyses the physical structure of configuration, the
details will vary depending on syntax. Each syntax must decide which of its
physical structures corresponds to the following analyses, producing error
diagnostics if they are applied to inappropriate expressions.

The following are the required static analysis functions:

- **Static List**: Require list/tuple construction syntax to be used and
  return a list of expressions for each of the elements given.

- **Static Map**: Require map/object construction syntax to be used and
  return a list of key/value pairs -- both expressions -- for each of
  the elements given. The usual constraint that a map key must be a string
  must not apply to this analysis, thus allowing applications to interpret
  arbitrary keys as they see fit.

- **Static Call**: Require function call syntax to be used and return an
  object describing the called function name and a list of expressions
  representing each of the call arguments.

- **Static Traversal**: Require a reference to a symbol in the variable
  scope and return a description of the path from the root scope to the
  accessed attribute or index.

The intent of a calling application using these features is to require a more
rigid interpretation of the configuration than in expression evaluation.
Syntax implementations should make use of the extra contextual information
provided in order to make an intuitive mapping onto the constructs of the
underlying syntax, possibly interpreting the expression slightly differently
than it would be interpreted in normal evaluation.

Each syntax must define which of its expression elements each of the analyses
above applies to, and how those analyses behave given those expression elements.

## Implementation Considerations

Implementations of this specification are free to adopt any strategy that
produces behavior consistent with the specification. This non-normative
section describes some possible implementation strategies that are consistent
with the goals of this specification.

### Language-agnosticism

The language-agnosticism of this specification assumes that certain behaviors
are implemented separately for each syntax:

- Matching of a body schema with the physical elements of a body in the
  source language, to determine correspondence between physical constructs
  and schema elements.

- Implementing the _dynamic attributes_ body processing mode by either
  interpreting all physical constructs as attributes or producing an error
  if non-attribute constructs are present.

- Providing an evaluation function for all possible expressions that produces
  a value given an evaluation context.

- Providing the static analysis functionality described above in a manner that
  makes sense within the convention of the syntax.

The suggested implementation strategy is to use an implementation language's
closest concept to an _abstract type_, _virtual type_ or _interface type_
to represent both Body and Expression. Each language-specific implementation
can then provide an implementation of each of these types wrapping AST nodes
or other physical constructs from the language parser.
