govaluate
====

[![Build Status](https://travis-ci.org/Knetic/govaluate.svg?branch=master)](https://travis-ci.org/Knetic/govaluate)
[![Godoc](https://godoc.org/github.com/Knetic/govaluate?status.png)](https://godoc.org/github.com/Knetic/govaluate)


Provides support for evaluating arbitrary C-like artithmetic/string expressions.

Why can't you just write these expressions in code?
--

Sometimes, you can't know ahead-of-time what an expression will look like, or you want those expressions to be configurable.
Perhaps you've got a set of data running through your application, and you want to allow your users to specify some validations to run on it before committing it to a database. Or maybe you've written a monitoring framework which is capable of gathering a bunch of metrics, then evaluating a few expressions to see if any metrics should be alerted upon, but the conditions for alerting are different for each monitor.

A lot of people wind up writing their own half-baked style of evaluation language that fits their needs, but isn't complete. Or they wind up baking the expression into the actual executable, even if they know it's subject to change. These strategies may work, but they take time to implement, time for users to learn, and induce technical debt as requirements change. This library is meant to cover all the normal C-like expressions, so that you don't have to reinvent one of the oldest wheels on a computer.

How do I use it?
--

You create a new EvaluableExpression, then call "Evaluate" on it.

```go
	expression, err := govaluate.NewEvaluableExpression("10 > 0");
	result, err := expression.Evaluate(nil);
	// result is now set to "true", the bool value.
```

Cool, but how about with parameters?

```go
	expression, err := govaluate.NewEvaluableExpression("foo > 0");

	parameters := make(map[string]interface{}, 8)
	parameters["foo"] = -1;

	result, err := expression.Evaluate(parameters);
	// result is now set to "false", the bool value.
```

That's cool, but we can almost certainly have done all that in code. What about a complex use case that involves some math?

```go
	expression, err := govaluate.NewEvaluableExpression("(requests_made * requests_succeeded / 100) >= 90");

	parameters := make(map[string]interface{}, 8)
	parameters["requests_made"] = 100;
	parameters["requests_succeeded"] = 80;

	result, err := expression.Evaluate(parameters);
	// result is now set to "false", the bool value.
```

Or maybe you want to check the status of an alive check ("smoketest") page, which will be a string?

```go
	expression, err := govaluate.NewEvaluableExpression("http_response_body == 'service is ok'");

	parameters := make(map[string]interface{}, 8)
	parameters["http_response_body"] = "service is ok";

	result, err := expression.Evaluate(parameters);
	// result is now set to "true", the bool value.
```

These examples have all returned boolean values, but it's equally possible to return numeric ones.

```go
	expression, err := govaluate.NewEvaluableExpression("(mem_used / total_mem) * 100");

	parameters := make(map[string]interface{}, 8)
	parameters["total_mem"] = 1024;
	parameters["mem_used"] = 512;

	result, err := expression.Evaluate(parameters);
	// result is now set to "50.0", the float64 value.
```

You can also do date parsing, though the formats are somewhat limited. Stick to RF3339, ISO8061, unix date, or ruby date formats. If you're having trouble getting a date string to parse, check the list of formats actually used: [parsing.go:248](https://github.com/Knetic/govaluate/blob/0580e9b47a69125afa0e4ebd1cf93c49eb5a43ec/parsing.go#L258).

```go
	expression, err := govaluate.NewEvaluableExpression("'2014-01-02' > '2014-01-01 23:59:59'");
	result, err := expression.Evaluate(nil);

	// result is now set to true
```

Expressions are parsed once, and can be re-used multiple times. Parsing is the compute-intensive phase of the process, so if you intend to use the same expression with different parameters, just parse it once. Like so;

```go
	expression, err := govaluate.NewEvaluableExpression("response_time <= 100");
	parameters := make(map[string]interface{}, 8)

	for {
		parameters["response_time"] = pingSomething();
		result, err := expression.Evaluate(parameters)
	}
```

The normal C-standard order of operators is respected. When writing an expression, be sure that you either order the operators correctly, or use parenthesis to clarify which portions of an expression should be run first.

Escaping characters
--

Sometimes you'll have parameters that have spaces, slashes, pluses, ampersands or some other character
that this library interprets as something special. For example, the following expression will not
act as one might expect:

	"response-time < 100"

As written, the library will parse it as "[response] minus [time] is less than 100". In reality,
"response-time" is meant to be one variable that just happens to have a dash in it.

There are two ways to work around this. First, you can escape the entire parameter name:

 	"[response-time] < 100"

Or you can use backslashes to escape only the minus sign.

	"response\\-time < 100"

Backslashes can be used anywhere in an expression to escape the very next character. Square bracketed parameter names can be used instead of plain parameter names at any time.

Functions
--

You may have cases where you want to call a function on a parameter during execution of the expression. Perhaps you want to aggregate some set of data, but don't know the exact aggregation you want to use until you're writing the expression itself. Or maybe you have a mathematical operation you want to perform, for which there is no operator; like `log` or `tan` or `sqrt`. For cases like this, you can provide a map of functions to `NewEvaluableExpressionWithFunctions`, which will then be able to use them during execution. For instance;

```go
	functions := map[string]govaluate.ExpressionFunction {
		"strlen": func(args ...interface{}) (interface{}, error) {
			length := len(args[0].(string))
			return (float64)(length), nil
		},
	}

	expString := "strlen('someReallyLongInputString') <= 16"
	expression, _ := govaluate.NewEvaluableExpressionWithFunctions(expString, functions)

	result, _ := expression.Evaluate(nil)
	// result is now "false", the boolean value
```

Functions can accept any number of arguments, correctly handles nested functions, and arguments can be of any type (even if none of this library's operators support evaluation of that type). For instance, each of these usages of functions in an expression are valid (assuming that the appropriate functions and parameters are given):

```go
"sqrt(x1 ** y1, x2 ** y2)"
"max(someValue, abs(anotherValue), 10 * lastValue)"
```

Functions cannot be passed as parameters, they must be known at the time when the expression is parsed, and are unchangeable after parsing.

Accessors
--

If you have structs in your parameters, you can access their fields and methods in the usual way. For instance, given a struct that has a method "Echo", present in the parameters as `foo`, the following is valid:

	"foo.Echo('hello world')"

Fields are accessed in a similar way. Assuming `foo` has a field called "Length":

	"foo.Length > 9000"

Accessors can be nested to any depth, like the following

	"foo.Bar.Baz.SomeFunction()"

However it is not _currently_ supported to access values in `map`s. So the following will not work

	"foo.SomeMap['key']"

This may be convenient, but note that using accessors involves a _lot_ of reflection. This makes the expression about four times slower than just using a parameter (consult the benchmarks for more precise measurements on your system).
If at all reasonable, the author recommends extracting the values you care about into a parameter map beforehand, or defining a struct that implements the `Parameters` interface, and which grabs fields as required. If there are functions you want to use, it's better to pass them as expression functions (see the above section). These approaches use no reflection, and are designed to be fast and clean.

What operators and types does this support?
--

* Modifiers: `+` `-` `/` `*` `&` `|` `^` `**` `%` `>>` `<<`
* Comparators: `>` `>=` `<` `<=` `==` `!=` `=~` `!~`
* Logical ops: `||` `&&`
* Numeric constants, as 64-bit floating point (`12345.678`)
* String constants (single quotes: `'foobar'`)
* Date constants (single quotes, using any permutation of RFC3339, ISO8601, ruby date, or unix date; date parsing is automatically tried with any string constant)
* Boolean constants: `true` `false`
* Parenthesis to control order of evaluation `(` `)`
* Arrays (anything separated by `,` within parenthesis: `(1, 2, 'foo')`)
* Prefixes: `!` `-` `~`
* Ternary conditional: `?` `:`
* Null coalescence: `??`

See [MANUAL.md](https://github.com/Knetic/govaluate/blob/master/MANUAL.md) for exacting details on what types each operator supports.

Types
--

Some operators don't make sense when used with some types. For instance, what does it mean to get the modulo of a string? What happens if you check to see if two numbers are logically AND'ed together?

Everyone has a different intuition about the answers to these questions. To prevent confusion, this library will _refuse to operate_ upon types for which there is not an unambiguous meaning for the operation. See [MANUAL.md](https://github.com/Knetic/govaluate/blob/master/MANUAL.md) for details about what operators are valid for which types.

Benchmarks
--

If you're concerned about the overhead of this library, a good range of benchmarks are built into this repo. You can run them with `go test -bench=.`. The library is built with an eye towards being quick, but has not been aggressively profiled and optimized. For most applications, though, it is completely fine.

For a very rough idea of performance, here are the results output from a benchmark run on a 3rd-gen Macbook Pro (Linux Mint 17.1).

```
BenchmarkSingleParse-12                          1000000              1382 ns/op
BenchmarkSimpleParse-12                           200000             10771 ns/op
BenchmarkFullParse-12                              30000             49383 ns/op
BenchmarkEvaluationSingle-12                    50000000                30.1 ns/op
BenchmarkEvaluationNumericLiteral-12            10000000               119 ns/op
BenchmarkEvaluationLiteralModifiers-12          10000000               236 ns/op
BenchmarkEvaluationParameters-12                 5000000               260 ns/op
BenchmarkEvaluationParametersModifiers-12        3000000               547 ns/op
BenchmarkComplexExpression-12                    2000000               963 ns/op
BenchmarkRegexExpression-12                       100000             20357 ns/op
BenchmarkConstantRegexExpression-12              1000000              1392 ns/op
ok
```

API Breaks
--

While this library has very few cases which will ever result in an API break, it can (and [has](https://github.com/Knetic/govaluate/releases/tag/2.0.0)) happened. If you are using this in production, vendor the commit you've tested against, or use gopkg.in to redirect your import (e.g., `import "gopkg.in/Knetic/govaluate.v2"`). Master branch (while infrequent) _may_ at some point contain API breaking changes, and the author will have no way to communicate these to downstreams, other than creating a new major release.

Releases will explicitly state when an API break happens, and if they do not specify an API break it should be safe to upgrade.

License
--

This project is licensed under the MIT general use license. You're free to integrate, fork, and play with this code as you feel fit without consulting the author, as long as you provide proper credit to the author in your works.
