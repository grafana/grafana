# HCL Native Syntax Specification

This is the specification of the syntax and semantics of the native syntax
for HCL. HCL is a system for defining configuration languages for applications.
The HCL information model is designed to support multiple concrete syntaxes
for configuration, but this native syntax is considered the primary format
and is optimized for human authoring and maintenance, as opposed to machine
generation of configuration.

The language consists of three integrated sub-languages:

- The _structural_ language defines the overall hierarchical configuration
  structure, and is a serialization of HCL bodies, blocks and attributes.

- The _expression_ language is used to express attribute values, either as
  literals or as derivations of other values.

- The _template_ language is used to compose values together into strings,
  as one of several types of expression in the expression language.

In normal use these three sub-languages are used together within configuration
files to describe an overall configuration, with the structural language
being used at the top level. The expression and template languages can also
be used in isolation, to implement features such as REPLs, debuggers, and
integration into more limited HCL syntaxes such as the JSON profile.

## Syntax Notation

Within this specification a semi-formal notation is used to illustrate the
details of syntax. This notation is intended for human consumption rather
than machine consumption, with the following conventions:

- A naked name starting with an uppercase letter is a global production,
  common to all of the syntax specifications in this document.
- A naked name starting with a lowercase letter is a local production,
  meaningful only within the specification where it is defined.
- Double and single quotes (`"` and `'`) are used to mark literal character
  sequences, which may be either punctuation markers or keywords.
- The default operator for combining items, which has no punctuation,
  is concatenation.
- The symbol `|` indicates that any one of its left and right operands may
  be present.
- The `*` symbol indicates zero or more repetitions of the item to its left.
- The `?` symbol indicates zero or one of the item to its left.
- Parentheses (`(` and `)`) are used to group items together to apply
  the `|`, `*` and `?` operators to them collectively.

The grammar notation does not fully describe the language. The prose may
augment or conflict with the illustrated grammar. In case of conflict, prose
has priority.

## Source Code Representation

Source code is unicode text expressed in the UTF-8 encoding. The language
itself does not perform unicode normalization, so syntax features such as
identifiers are sequences of unicode code points and so e.g. a precombined
accented character is distinct from a letter associated with a combining
accent. (String literals have some special handling with regard to Unicode
normalization which will be covered later in the relevant section.)

UTF-8 encoded Unicode byte order marks are not permitted. Invalid or
non-normalized UTF-8 encoding is always a parse error.

## Lexical Elements

### Comments and Whitespace

Comments and Whitespace are recognized as lexical elements but are ignored
except as described below.

Whitespace is defined as a sequence of zero or more space characters
(U+0020). Newline sequences (either U+000A or U+000D followed by U+000A)
are _not_ considered whitespace but are ignored as such in certain contexts.
Horizontal tab characters (U+0009) are also treated as whitespace, but are
counted only as one "column" for the purpose of reporting source positions.

Comments serve as program documentation and come in two forms:

- _Line comments_ start with either the `//` or `#` sequences and end with
  the next newline sequence. A line comment is considered equivalent to a
  newline sequence.

- _Inline comments_ start with the `/*` sequence and end with the `*/`
  sequence, and may have any characters within except the ending sequence.
  An inline comment is considered equivalent to a whitespace sequence.

Comments and whitespace cannot begin within other comments, or within
template literals except inside an interpolation sequence or template directive.

### Identifiers

Identifiers name entities such as blocks, attributes and expression variables.
Identifiers are interpreted as per [UAX #31][uax31] Section 2. Specifically,
their syntax is defined in terms of the `ID_Start` and `ID_Continue`
character properties as follows:

```ebnf
Identifier = ID_Start (ID_Continue | '-')*;
```

The Unicode specification provides the normative requirements for identifier
parsing. Non-normatively, the spirit of this specification is that `ID_Start`
consists of Unicode letter and certain unambiguous punctuation tokens, while
`ID_Continue` augments that set with Unicode digits, combining marks, etc.

The dash character `-` is additionally allowed in identifiers, even though
that is not part of the unicode `ID_Continue` definition. This is to allow
attribute names and block type names to contain dashes, although underscores
as word separators are considered the idiomatic usage.

[uax31]: http://unicode.org/reports/tr31/ "Unicode Identifier and Pattern Syntax"

### Keywords

There are no globally-reserved words, but in some contexts certain identifiers
are reserved to function as keywords. These are discussed further in the
relevant documentation sections that follow. In such situations, the
identifier's role as a keyword supersedes any other valid interpretation that
may be possible. Outside of these specific situations, the keywords have no
special meaning and are interpreted as regular identifiers.

### Operators and Delimiters

The following character sequences represent operators, delimiters, and other
special tokens:

```
+    &&   ==   <    :    {    [    (    ${
-    ||   !=   >    ?    }    ]    )    %{
*    !         <=        =         .
/              >=        =>        ,
%                                  ...
```

### Numeric Literals

A numeric literal is a decimal representation of a
real number. It has an integer part, a fractional part,
and an exponent part.

```ebnf
NumericLit = decimal+ ("." decimal+)? (expmark decimal+)?;
decimal    = '0' .. '9';
expmark    = ('e' | 'E') ("+" | "-")?;
```

## Structural Elements

The structural language consists of syntax representing the following
constructs:

- _Attributes_, which assign a value to a specified name.
- _Blocks_, which create a child body annotated by a type and optional labels.
- _Body Content_, which consists of a collection of attributes and blocks.

These constructs correspond to the similarly-named concepts in the
language-agnostic HCL information model.

```ebnf
ConfigFile   = Body;
Body         = (Attribute | Block | OneLineBlock)*;
Attribute    = Identifier "=" Expression Newline;
Block        = Identifier (StringLit|Identifier)* "{" Newline Body "}" Newline;
OneLineBlock = Identifier (StringLit|Identifier)* "{" (Identifier "=" Expression)? "}" Newline;
```

### Configuration Files

A _configuration file_ is a sequence of characters whose top-level is
interpreted as a Body.

### Bodies

A _body_ is a collection of associated attributes and blocks. The meaning of
this association is defined by the calling application.

### Attribute Definitions

An _attribute definition_ assigns a value to a particular attribute name within
a body. Each distinct attribute name may be defined no more than once within a
single body.

The attribute value is given as an expression, which is retained literally
for later evaluation by the calling application.

### Blocks

A _block_ creates a child body that is annotated with a block _type_ and
zero or more block _labels_. Blocks create a structural hierarchy which can be
interpreted by the calling application.

Block labels can either be quoted literal strings or naked identifiers.

## Expressions

The expression sub-language is used within attribute definitions to specify
values.

```ebnf
Expression = (
    ExprTerm |
    Operation |
    Conditional
);
```

### Types

The value types used within the expression language are those defined by the
syntax-agnostic HCL information model. An expression may return any valid
type, but only a subset of the available types have first-class syntax.
A calling application may make other types available via _variables_ and
_functions_.

### Expression Terms

Expression _terms_ are the operands for unary and binary expressions, as well
as acting as expressions in their own right.

```ebnf
ExprTerm = (
    LiteralValue |
    CollectionValue |
    TemplateExpr |
    VariableExpr |
    FunctionCall |
    ForExpr |
    ExprTerm Index |
    ExprTerm GetAttr |
    ExprTerm Splat |
    "(" Expression ")"
);
```

The productions for these different term types are given in their corresponding
sections.

Between the `(` and `)` characters denoting a sub-expression, newline
characters are ignored as whitespace.

### Literal Values

A _literal value_ immediately represents a particular value of a primitive
type.

```ebnf
LiteralValue = (
  NumericLit |
  "true" |
  "false" |
  "null"
);
```

- Numeric literals represent values of type _number_.
- The `true` and `false` keywords represent values of type _bool_.
- The `null` keyword represents a null value of the dynamic pseudo-type.

String literals are not directly available in the expression sub-language, but
are available via the template sub-language, which can in turn be incorporated
via _template expressions_.

### Collection Values

A _collection value_ combines zero or more other expressions to produce a
collection value.

```ebnf
CollectionValue = tuple | object;
tuple = "[" (
    (Expression (("," | Newline) Expression)* ","?)?
) "]";
object = "{" (
    (objectelem (( "," | Newline) objectelem)* ","?)?
) "}";
objectelem = (Identifier | Expression) ("=" | ":") Expression;
```

Only tuple and object values can be directly constructed via native syntax.
Tuple and object values can in turn be converted to list, set and map values
with other operations, which behaves as defined by the syntax-agnostic HCL
information model.

When specifying an object element, an identifier is interpreted as a literal
attribute name as opposed to a variable reference. To populate an item key
from a variable, use parentheses to disambiguate:

- `{foo = "baz"}` is interpreted as an attribute literally named `foo`.
- `{(foo) = "baz"}` is interpreted as an attribute whose name is taken
  from the variable named `foo`.

Between the open and closing delimiters of these sequences, newline sequences
are ignored as whitespace.

There is a syntax ambiguity between _for expressions_ and collection values
whose first element starts with an identifier named `for`. The _for expression_
interpretation has priority, so to write a key literally named `for`
or an expression derived from a variable named `for` you must use parentheses
or quotes to disambiguate:

- `[for, foo, baz]` is a syntax error.
- `[(for), foo, baz]` is a tuple whose first element is the value of variable
  `for`.
- `{for = 1, baz = 2}` is a syntax error.
- `{"for" = 1, baz = 2}` is an object with an attribute literally named `for`.
- `{baz = 2, for = 1}` is equivalent to the previous example, and resolves the
  ambiguity by reordering.
- `{(for) = 1, baz = 2}` is an object with a key with the same value as the
  variable `for`.

### Template Expressions

A _template expression_ embeds a program written in the template sub-language
as an expression. Template expressions come in two forms:

- A _quoted_ template expression is delimited by quote characters (`"`) and
  defines a template as a single-line expression with escape characters.
- A _heredoc_ template expression is introduced by a `<<` sequence and
  defines a template via a multi-line sequence terminated by a user-chosen
  delimiter.

In both cases the template interpolation and directive syntax is available for
use within the delimiters, and any text outside of these special sequences is
interpreted as a literal string.

In _quoted_ template expressions any literal string sequences within the
template behave in a special way: literal newline sequences are not permitted
and instead _escape sequences_ can be included, starting with the
backslash `\`:

```
    \n         Unicode newline control character
    \r         Unicode carriage return control character
    \t         Unicode tab control character
    \"         Literal quote mark, used to prevent interpretation as end of string
    \\         Literal backslash, used to prevent interpretation as escape sequence
    \uNNNN     Unicode character from Basic Multilingual Plane (NNNN is four hexadecimal digits)
    \UNNNNNNNN Unicode character from supplementary planes (NNNNNNNN is eight hexadecimal digits)
```

The _heredoc_ template expression type is introduced by either `<<` or `<<-`,
followed by an identifier. The template expression ends when the given
identifier subsequently appears again on a line of its own.

If a heredoc template is introduced with the `<<-` symbol, any literal string
at the start of each line is analyzed to find the minimum number of leading
spaces, and then that number of prefix spaces is removed from all line-leading
literal strings. The final closing marker may also have an arbitrary number
of spaces preceding it on its line.

```ebnf
TemplateExpr = quotedTemplate | heredocTemplate;
quotedTemplate = (as defined in prose above);
heredocTemplate = (
    ("<<" | "<<-") Identifier Newline
    (content as defined in prose above)
    Identifier Newline
);
```

A quoted template expression containing only a single literal string serves
as a syntax for defining literal string _expressions_. In certain contexts
the template syntax is restricted in this manner:

```ebnf
StringLit = '"' (quoted literals as defined in prose above) '"';
```

The `StringLit` production permits the escape sequences discussed for quoted
template expressions as above, but does _not_ permit template interpolation
or directive sequences.

### Variables and Variable Expressions

A _variable_ is a value that has been assigned a symbolic name. Variables are
made available for use in expressions by the calling application, by populating
the _global scope_ used for expression evaluation.

Variables can also be created by expressions themselves, which always creates
a _child scope_ that incorporates the variables from its parent scope but
(re-)defines zero or more names with new values.

The value of a variable is accessed using a _variable expression_, which is
a standalone `Identifier` whose name corresponds to a defined variable:

```ebnf
VariableExpr = Identifier;
```

Variables in a particular scope are immutable, but child scopes may _hide_
a variable from an ancestor scope by defining a new variable of the same name.
When looking up variables, the most locally-defined variable of the given name
is used, and ancestor-scoped variables of the same name cannot be accessed.

No direct syntax is provided for declaring or assigning variables, but other
expression constructs implicitly create child scopes and define variables as
part of their evaluation.

### Functions and Function Calls

A _function_ is an operation that has been assigned a symbolic name. Functions
are made available for use in expressions by the calling application, by
populating the _function table_ used for expression evaluation.

The namespace of functions is distinct from the namespace of variables. A
function and a variable may share the same name with no implication that they
are in any way related.

A function can be executed via a _function call_ expression:

```ebnf
FunctionCall = Identifier "(" arguments ")";
Arguments = (
    () ||
    (Expression ("," Expression)* ("," | "...")?)
);
```

The definition of functions and the semantics of calling them are defined by
the language-agnostic HCL information model. The given arguments are mapped
onto the function's _parameters_ and the result of a function call expression
is the return value of the named function when given those arguments.

If the final argument expression is followed by the ellipsis symbol (`...`),
the final argument expression must evaluate to either a list or tuple value.
The elements of the value are each mapped to a single parameter of the
named function, beginning at the first parameter remaining after all other
argument expressions have been mapped.

Within the parentheses that delimit the function arguments, newline sequences
are ignored as whitespace.

### For Expressions

A _for expression_ is a construct for constructing a collection by projecting
the items from another collection.

```ebnf
ForExpr = forTupleExpr | forObjectExpr;
forTupleExpr = "[" forIntro Expression forCond? "]";
forObjectExpr = "{" forIntro Expression "=>" Expression "..."? forCond? "}";
forIntro = "for" Identifier ("," Identifier)? "in" Expression ":";
forCond = "if" Expression;
```

The punctuation used to delimit a for expression decide whether it will produce
a tuple value (`[` and `]`) or an object value (`{` and `}`).

The "introduction" is equivalent in both cases: the keyword `for` followed by
either one or two identifiers separated by a comma which define the temporary
variable names used for iteration, followed by the keyword `in` and then
an expression that must evaluate to a value that can be iterated. The
introduction is then terminated by the colon (`:`) symbol.

If only one identifier is provided, it is the name of a variable that will
be temporarily assigned the value of each element during iteration. If both
are provided, the first is the key and the second is the value.

Tuple, object, list, map, and set types are iterable. The type of collection
used defines how the key and value variables are populated:

- For tuple and list types, the _key_ is the zero-based index into the
  sequence for each element, and the _value_ is the element value. The
  elements are visited in index order.
- For object and map types, the _key_ is the string attribute name or element
  key, and the _value_ is the attribute or element value. The elements are
  visited in the order defined by a lexicographic sort of the attribute names
  or keys.
- For set types, the _key_ and _value_ are both the element value. The elements
  are visited in an undefined but consistent order.

The expression after the colon and (in the case of object `for`) the expression
after the `=>` are both evaluated once for each element of the source
collection, in a local scope that defines the key and value variable names
specified.

The results of evaluating these expressions for each input element are used
to populate an element in the new collection. In the case of tuple `for`, the
single expression becomes an element, appending values to the tuple in visit
order. In the case of object `for`, the pair of expressions is used as an
attribute name and value respectively, creating an element in the resulting
object.

In the case of object `for`, it is an error if two input elements produce
the same result from the attribute name expression, since duplicate
attributes are not possible. If the ellipsis symbol (`...`) appears
immediately after the value expression, this activates the grouping mode in
which each value in the resulting object is a _tuple_ of all of the values
that were produced against each distinct key.

- `[for v in ["a", "b"]: v]` returns `["a", "b"]`.
- `[for i, v in ["a", "b"]: i]` returns `[0, 1]`.
- `{for i, v in ["a", "b"]: v => i}` returns `{a = 0, b = 1}`.
- `{for i, v in ["a", "a", "b"]: v => i}` produces an error, because attribute
  `a` is defined twice.
- `{for i, v in ["a", "a", "b"]: v => i...}` returns `{a = [0, 1], b = [2]}`.

If the `if` keyword is used after the element expression(s), it applies an
additional predicate that can be used to conditionally filter elements from
the source collection from consideration. The expression following `if` is
evaluated once for each source element, in the same scope used for the
element expression(s). It must evaluate to a boolean value; if `true`, the
element will be evaluated as normal, while if `false` the element will be
skipped.

- `[for i, v in ["a", "b", "c"]: v if i < 2]` returns `["a", "b"]`.

If the collection value, element expression(s) or condition expression return
unknown values that are otherwise type-valid, the result is a value of the
dynamic pseudo-type.

### Index Operator

The _index_ operator returns the value of a single element of a collection
value. It is a postfix operator and can be applied to any value that has
a tuple, object, map, or list type.

```ebnf
Index = "[" Expression "]";
```

The expression delimited by the brackets is the _key_ by which an element
will be looked up.

If the index operator is applied to a value of tuple or list type, the
key expression must be an non-negative integer number representing the
zero-based element index to access. If applied to a value of object or map
type, the key expression must be a string representing the attribute name
or element key. If the given key value is not of the appropriate type, a
conversion is attempted using the conversion rules from the HCL
syntax-agnostic information model.

An error is produced if the given key expression does not correspond to
an element in the collection, either because it is of an unconvertable type,
because it is outside the range of elements for a tuple or list, or because
the given attribute or key does not exist.

If either the collection or the key are an unknown value of an
otherwise-suitable type, the return value is an unknown value whose type
matches what type would be returned given known values, or a value of the
dynamic pseudo-type if type information alone cannot determine a suitable
return type.

Within the brackets that delimit the index key, newline sequences are ignored
as whitespace.

The HCL native syntax also includes a _legacy_ index operator that exists
only for compatibility with the precursor language HIL:

```ebnf
LegacyIndex = '.' digit+
```

This legacy index operator must be supported by parser for compatibility but
should not be used in new configurations. This allows an attribute-access-like
syntax for indexing, must still be interpreted as an index operation rather
than attribute access.

The legacy syntax does not support chaining of index operations, like
`foo.0.0.bar`, because the interpretation of `0.0` as a number literal token
takes priority and thus renders the resulting sequence invalid.

### Attribute Access Operator

The _attribute access_ operator returns the value of a single attribute in
an object value. It is a postfix operator and can be applied to any value
that has an object type.

```ebnf
GetAttr = "." Identifier;
```

The given identifier is interpreted as the name of the attribute to access.
An error is produced if the object to which the operator is applied does not
have an attribute with the given name.

If the object is an unknown value of a type that has the attribute named, the
result is an unknown value of the attribute's type.

### Splat Operators

The _splat operators_ allow convenient access to attributes or elements of
elements in a tuple, list, or set value.

There are two kinds of "splat" operator:

- The _attribute-only_ splat operator supports only attribute lookups into
  the elements from a list, but supports an arbitrary number of them.

- The _full_ splat operator additionally supports indexing into the elements
  from a list, and allows any combination of attribute access and index
  operations.

```ebnf
Splat = attrSplat | fullSplat;
attrSplat = "." "*" GetAttr*;
fullSplat = "[" "*" "]" (GetAttr | Index)*;
```

The splat operators can be thought of as shorthands for common operations that
could otherwise be performed using _for expressions_:

- `tuple.*.foo.bar[0]` is approximately equivalent to
  `[for v in tuple: v.foo.bar][0]`.
- `tuple[*].foo.bar[0]` is approximately equivalent to
  `[for v in tuple: v.foo.bar[0]]`

Note the difference in how the trailing index operator is interpreted in
each case. This different interpretation is the key difference between the
_attribute-only_ and _full_ splat operators.

Splat operators have one additional behavior compared to the equivalent
_for expressions_ shown above: if a splat operator is applied to a value that
is _not_ of tuple, list, or set type, the value is coerced automatically into
a single-value list of the value type:

- `any_object.*.id` is equivalent to `[any_object.id]`, assuming that `any_object`
  is a single object.
- `any_number.*` is equivalent to `[any_number]`, assuming that `any_number`
  is a single number.

If applied to a null value that is not tuple, list, or set, the result is always
an empty tuple, which allows conveniently converting a possibly-null scalar
value into a tuple of zero or one elements. It is illegal to apply a splat
operator to a null value of tuple, list, or set type.

### Operations

Operations apply a particular operator to either one or two expression terms.

```ebnf
Operation = unaryOp | binaryOp;
unaryOp = ("-" | "!") ExprTerm;
binaryOp = ExprTerm binaryOperator ExprTerm;
binaryOperator = compareOperator | arithmeticOperator | logicOperator;
compareOperator = "==" | "!=" | "<" | ">" | "<=" | ">=";
arithmeticOperator = "+" | "-" | "*" | "/" | "%";
logicOperator = "&&" | "||";
```

The unary operators have the highest precedence.

The binary operators are grouped into the following precedence levels:

```
Level    Operators
  6      * / %
  5      + -
  4      > >= < <=
  3      == !=
  2      &&
  1      ||
```

Higher values of "level" bind tighter. Operators within the same precedence
level have left-to-right associativity. For example, `x / y * z` is equivalent
to `(x / y) * z`.

### Comparison Operators

Comparison operators always produce boolean values, as a result of testing
the relationship between two values.

The two equality operators apply to values of any type:

```
a == b  equal
a != b  not equal
```

Two values are equal if the are of identical types and their values are
equal as defined in the HCL syntax-agnostic information model. The equality
operators are commutative and opposite, such that `(a == b) == !(a != b)`
and `(a == b) == (b == a)` for all values `a` and `b`.

The four numeric comparison operators apply only to numbers:

```
a < b   less than
a <= b  less than or equal to
a > b   greater than
a >= b  greater than or equal to
```

If either operand of a comparison operator is a correctly-typed unknown value
or a value of the dynamic pseudo-type, the result is an unknown boolean.

### Arithmetic Operators

Arithmetic operators apply only to number values and always produce number
values as results.

```
a + b   sum        (addition)
a - b   difference (subtraction)
a * b   product    (multiplication)
a / b   quotient   (division)
a % b   remainder  (modulo)
-a      negation
```

Arithmetic operations are considered to be performed in an arbitrary-precision
number space.

If either operand of an arithmetic operator is an unknown number or a value
of the dynamic pseudo-type, the result is an unknown number.

### Logic Operators

Logic operators apply only to boolean values and always produce boolean values
as results.

```
a && b   logical AND
a || b   logical OR
!a       logical NOT
```

If either operand of a logic operator is an unknown bool value or a value
of the dynamic pseudo-type, the result is an unknown bool value.

### Conditional Operator

The conditional operator allows selecting from one of two expressions based on
the outcome of a boolean expression.

```ebnf
Conditional = Expression "?" Expression ":" Expression;
```

The first expression is the _predicate_, which is evaluated and must produce
a boolean result. If the predicate value is `true`, the result of the second
expression is the result of the conditional. If the predicate value is
`false`, the result of the third expression is the result of the conditional.

The second and third expressions must be of the same type or must be able to
unify into a common type using the type unification rules defined in the
HCL syntax-agnostic information model. This unified type is the result type
of the conditional, with both expressions converted as necessary to the
unified type.

If the predicate is an unknown boolean value or a value of the dynamic
pseudo-type then the result is an unknown value of the unified type of the
other two expressions.

If either the second or third expressions produce errors when evaluated,
these errors are passed through only if the erroneous expression is selected.
This allows for expressions such as
`length(some_list) > 0 ? some_list[0] : default` (given some suitable `length`
function) without producing an error when the predicate is `false`.

## Templates

The template sub-language is used within template expressions to concisely
combine strings and other values to produce other strings. It can also be
used in isolation as a standalone template language.

```ebnf
Template = (
    TemplateLiteral |
    TemplateInterpolation |
    TemplateDirective
)*
TemplateDirective = TemplateIf | TemplateFor;
```

A template behaves like an expression that always returns a string value.
The different elements of the template are evaluated and combined into a
single string to return. If any of the elements produce an unknown string
or a value of the dynamic pseudo-type, the result is an unknown string.

An important use-case for standalone templates is to enable the use of
expressions in alternative HCL syntaxes where a native expression grammar is
not available. For example, the HCL JSON profile treats the values of JSON
strings as standalone templates when attributes are evaluated in expression
mode.

### Template Literals

A template literal is a literal sequence of characters to include in the
resulting string. When the template sub-language is used standalone, a
template literal can contain any unicode character, with the exception
of the sequences that introduce interpolations and directives, and for the
sequences that escape those introductions.

The interpolation and directive introductions are escaped by doubling their
leading characters. The `${` sequence is escaped as `$${` and the `%{`
sequence is escaped as `%%{`.

When the template sub-language is embedded in the expression language via
_template expressions_, additional constraints and transforms are applied to
template literals as described in the definition of template expressions.

The value of a template literal can be modified by _strip markers_ in any
interpolations or directives that are adjacent to it. A strip marker is
a tilde (`~`) placed immediately after the opening `{` or before the closing
`}` of a template sequence:

- `hello ${~ "world" }` produces `"helloworld"`.
- `%{ if true ~} hello %{~ endif }` produces `"hello"`.

When a strip marker is present, any spaces adjacent to it in the corresponding
string literal (if any) are removed before producing the final value. Space
characters are interpreted as per Unicode's definition.

Stripping is done at syntax level rather than value level. Values returned
by interpolations or directives are not subject to stripping:

- `${"hello" ~}${" world"}` produces `"hello world"`, and not `"helloworld"`,
  because the space is not in a template literal directly adjacent to the
  strip marker.

### Template Interpolations

An _interpolation sequence_ evaluates an expression (written in the
expression sub-language), converts the result to a string value, and
replaces itself with the resulting string.

```ebnf
TemplateInterpolation = ("${" | "${~") Expression ("}" | "~}";
```

If the expression result cannot be converted to a string, an error is
produced.

### Template If Directive

The template `if` directive is the template equivalent of the
_conditional expression_, allowing selection of one of two sub-templates based
on the value of a predicate expression.

```ebnf
TemplateIf = (
    ("%{" | "%{~") "if" Expression ("}" | "~}")
    Template
    (
        ("%{" | "%{~") "else" ("}" | "~}")
        Template
    )?
    ("%{" | "%{~") "endif" ("}" | "~}")
);
```

The evaluation of the `if` directive is equivalent to the conditional
expression, with the following exceptions:

- The two sub-templates always produce strings, and thus the result value is
  also always a string.
- The `else` clause may be omitted, in which case the conditional's third
  expression result is implied to be the empty string.

### Template For Directive

The template `for` directive is the template equivalent of the _for expression_,
producing zero or more copies of its sub-template based on the elements of
a collection.

```ebnf
TemplateFor = (
    ("%{" | "%{~") "for" Identifier ("," Identifier) "in" Expression ("}" | "~}")
    Template
    ("%{" | "%{~") "endfor" ("}" | "~}")
);
```

The evaluation of the `for` directive is equivalent to the _for expression_
when producing a tuple, with the following exceptions:

- The sub-template always produces a string.
- There is no equivalent of the "if" clause on the for expression.
- The elements of the resulting tuple are all converted to strings and
  concatenated to produce a flat string result.

### Template Interpolation Unwrapping

As a special case, a template that consists only of a single interpolation,
with no surrounding literals, directives or other interpolations, is
"unwrapped". In this case, the result of the interpolation expression is
returned verbatim, without conversion to string.

This special case exists primarily to enable the native template language
to be used inside strings in alternative HCL syntaxes that lack a first-class
template or expression syntax. Unwrapping allows arbitrary expressions to be
used to populate attributes when strings in such languages are interpreted
as templates.

- `${true}` produces the boolean value `true`
- `${"${true}"}` produces the boolean value `true`, because both the inner
  and outer interpolations are subject to unwrapping.
- `hello ${true}` produces the string `"hello true"`
- `${""}${true}` produces the string `"true"` because there are two
  interpolation sequences, even though one produces an empty result.
- `%{ for v in [true] }${v}%{ endfor }` produces the string `true` because
  the presence of the `for` directive circumvents the unwrapping even though
  the final result is a single value.

In some contexts this unwrapping behavior may be circumvented by the calling
application, by converting the final template result to string. This is
necessary, for example, if a standalone template is being used to produce
the direct contents of a file, since the result in that case must always be a
string.

## Static Analysis

The HCL static analysis operations are implemented for some expression types
in the native syntax, as described in the following sections.

A goal for static analysis of the native syntax is for the interpretation to
be as consistent as possible with the dynamic evaluation interpretation of
the given expression, though some deviations are intentionally made in order
to maximize the potential for analysis.

### Static List

The tuple construction syntax can be interpreted as a static list. All of
the expression elements given are returned as the static list elements,
with no further interpretation.

### Static Map

The object construction syntax can be interpreted as a static map. All of the
key/value pairs given are returned as the static pairs, with no further
interpretation.

The usual requirement that an attribute name be interpretable as a string
does not apply to this static analysis, allowing callers to provide map-like
constructs with different key types by building on the map syntax.

### Static Call

The function call syntax can be interpreted as a static call. The called
function name is returned verbatim and the given argument expressions are
returned as the static arguments, with no further interpretation.

### Static Traversal

A variable expression and any attached attribute access operations and
constant index operations can be interpreted as a static traversal.

The keywords `true`, `false` and `null` can also be interpreted as
static traversals, behaving as if they were references to variables of those
names, to allow callers to redefine the meaning of those keywords in certain
contexts.
