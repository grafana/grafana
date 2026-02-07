# Abstract JSON 

[![Build](https://github.com/spyzhov/ajson/actions/workflows/main.yml/badge.svg)](https://github.com/spyzhov/ajson/actions/workflows/main.yml)
[![Go Report Card](https://goreportcard.com/badge/github.com/spyzhov/ajson)](https://goreportcard.com/report/github.com/spyzhov/ajson)
[![GoDoc](https://godoc.org/github.com/spyzhov/ajson?status.svg)](https://godoc.org/github.com/spyzhov/ajson)
[![codecov](https://codecov.io/gh/spyzhov/ajson/branch/master/graph/badge.svg)](https://codecov.io/gh/spyzhov/ajson)
[![Awesome](https://cdn.rawgit.com/sindresorhus/awesome/d7305f38d29fed78fa85652e3a63e154dd8e8829/media/badge.svg)](https://github.com/avelino/awesome-go#json)

Abstract [JSON](https://www.json.org/) is a small golang package provides a parser for JSON with support of JSONPath, in case when you are not sure in its structure.

Method `Unmarshal` will scan all the byte slice to create a root node of JSON structure, with all its behaviors.

Method `Marshal` will serialize current `Node` object to JSON structure.

Each `Node` has its own type and calculated value, which will be calculated on demand. 
Calculated value saves in `atomic.Value`, so it's thread safe.

Method `JSONPath` will returns slice of found elements in current JSON data, by [JSONPath](http://goessner.net/articles/JsonPath/) request.

## Compare with other solutions

Check the [cburgmer/json-path-comparison](https://cburgmer.github.io/json-path-comparison/) project.

# Usage

[Playground](https://play.golang.com/p/iIxkktxN0SK)

```go
package main

import (
	"fmt"
	"github.com/spyzhov/ajson"
)

func main() {
	json := []byte(`...`)

	root, _ := ajson.Unmarshal(json)
	nodes, _ := root.JSONPath("$..price")
	for _, node := range nodes {
		node.SetNumeric(node.MustNumeric() * 1.25)
		node.Parent().AppendObject("currency", ajson.StringNode("", "EUR"))
	}
	result, _ := ajson.Marshal(root)

	fmt.Printf("%s", result)
}
```

# Console application

You can download `ajson` cli from the [release page](https://github.com/spyzhov/ajson/releases), or install from the source:

```shell script
go get github.com/spyzhov/ajson/cmd/ajson@v0.9.6
```

Usage:

```
Usage: ajson [-mq] "jsonpath" ["input"]
  Read JSON and evaluate it with JSONPath.
Parameters:
  -m, --multiline  Input file/stream will be read as a multiline JSON. Each line should have a full valid JSON.
  -q, --quiet      Do not print errors into the STDERR.
Argument:
  jsonpath         Valid JSONPath or evaluate string (Examples: "$..[?(@.price)]", "$..price", "avg($..price)")
  input            Path to the JSON file. Leave it blank to use STDIN.
```

Examples:

```shell script
  ajson "avg($..registered.age)" "https://randomuser.me/api/?results=5000"
  ajson "$.results.*.name" "https://randomuser.me/api/?results=10"
  curl -s "https://randomuser.me/api/?results=10" | ajson "$..coordinates"
  ajson "$" example.json
  echo "3" | ajson "2 * pi * $"
  docker logs image-name -f | ajson -qm 'root($[?(@=="ERROR" && key(@)=="severity")])'
```

# JSONPath

Current package supports JSONPath selection described at [http://goessner.net/articles/JsonPath/](http://goessner.net/articles/JsonPath/).

JSONPath expressions always refer to a JSON structure in the same way as XPath expression are used in combination with an XML document. 
Since a JSON structure is usually anonymous and doesn't necessarily have a "root member object" JSONPath assumes the abstract name $ assigned to the outer level object.

JSONPath expressions can use the dot–notation

`$.store.book[0].title`

or the bracket–notation

`$['store']['book'][0]['title']`

for input paths. Internal or output paths will always be converted to the more general bracket–notation.

JSONPath allows the wildcard symbol `*` for member names and array indices. 
It borrows the descendant operator `..` from E4X and the array slice syntax proposal `[start:end:step]` from ECMASCRIPT 4.

Expressions of the underlying scripting language `(<expr>)` can be used as an alternative to explicit names or indices as in

`$.store.book[(@.length-1)].title`

using the symbol `@` for the current object. Filter expressions are supported via the syntax `?(<boolean expr>)` as in

`$.store.book[?(@.price < 10)].title`

Here is a complete overview and a side by side comparison of the JSONPath syntax elements with its XPath counterparts.

| JSONPath | Description |
|----------|---|
| `$`      | the root object/element |
| `@`      | the current object/element |
| `.` or `[]` | child operator |
| `..`     | recursive descent. JSONPath borrows this syntax from E4X. |
| `*`      | wildcard. All objects/elements regardless their names. |
| `[]`     | subscript operator. XPath uses it to iterate over element collections and for predicates. In Javascript and JSON it is the native array operator. |
| `[,]`    | Union operator in XPath results in a combination of node sets. JSONPath allows alternate names or array indices as a set. |
| `[start:end:step]` | array slice operator borrowed from ES4. |
| `?()`    | applies a filter (script) expression. |
| `()`     | script expression, using the underlying script engine. |

## Script engine

### Predefined constant

Package has several predefined constants. 

     e       math.E     float64
     pi      math.Pi    float64
     phi     math.Phi   float64
     
     sqrt2     math.Sqrt2   float64
     sqrte     math.SqrtE   float64
     sqrtpi    math.SqrtPi  float64
     sqrtphi   math.SqrtPhi float64
     
     ln2     math.Ln2    float64
     log2e   math.Log2E  float64
     ln10    math.Ln10   float64
     log10e  math.Log10E float64
          
     true    true       bool
     false   false      bool
     null    nil        interface{}
     
You are free to add new one with function `AddConstant`:

```go
    AddConstant("c", NumericNode("speed of light in vacuum", 299_792_458))
```

#### Examples

<details>
<summary>Using `true` in path</summary>

[Playground](https://play.golang.org/p/h0oFLaE11Tn)

```go
package main

import (
	"fmt"
	
	"github.com/spyzhov/ajson"
)

func main() {
	json := []byte(`{"foo": [true, null, false, 1, "bar", true, 1e3], "bar": [true, "baz", false]}`)
	result, _ := ajson.JSONPath(json, `$..[?(@ == true)]`)
	fmt.Printf("Count of `true` values: %d", len(result))
}
```
Output:
```
Count of `true` values: 3
```
</details>
<details>
<summary>Using `null` in eval</summary>

[Playground](https://play.golang.org/p/wpqh1Fw5vWE)

```go
package main

import (
	"fmt"
	
	"github.com/spyzhov/ajson"
)

func main() {
	json := []byte(`{"foo": [true, null, false, 1, "bar", true, 1e3], "bar": [true, "baz", false]}`)
	result, _ := ajson.JSONPath(json, `$..[?(@ == true)]`)
	fmt.Printf("Count of `true` values: %d", len(result))
}
```
Output:
```
Count of `true` values: 3
```
</details>

### Supported operations

Package has several predefined operators.

[Operator precedence](https://golang.org/ref/spec#Operator_precedence)

	Precedence    Operator
	    6	    	  **
	    5             *  /  %  <<  >>  &  &^
	    4             +  -  |  ^
	    3             ==  !=  <  <=  >  >= =~
	    2             &&
	    1             ||

[Arithmetic operators](https://golang.org/ref/spec#Arithmetic_operators)

	**   power                  integers, floats
	+    sum                    integers, floats, strings
	-    difference             integers, floats
	*    product                integers, floats
	/    quotient               integers, floats
	%    remainder              integers

	&    bitwise AND            integers
	|    bitwise OR             integers
	^    bitwise XOR            integers
	&^   bit clear (AND NOT)    integers

	<<   left shift             integer << unsigned integer
	>>   right shift            integer >> unsigned integer

	==  equals                  any
	!=  not equals              any
	<   less                    any
	<=  less or equals          any
	>   larger                  any
	>=  larger or equals        any
	=~  equals regex string     strings

You are free to add new one with function `AddOperation`:

```go
	AddOperation("<>", 3, false, func(left *ajson.Node, right *ajson.Node) (node *ajson.Node, err error) {
		result, err := left.Eq(right)
		if err != nil {
			return nil, err
		}
		return BoolNode("neq", !result), nil
	})
```

#### Examples

<details>
<summary>Using `regex` operator</summary>

[Playground](https://play.golang.org/p/Lm_F4OGTMWl)

```go
package main

import (
	"fmt"
	
	"github.com/spyzhov/ajson"
)

func main() {
	json := []byte(`[{"name":"Foo","mail":"foo@example.com"},{"name":"bar","mail":"bar@example.org"}]`)
	result, err := ajson.JSONPath(json, `$.[?(@.mail =~ '.+@example\\.com')]`)
	if err != nil {
		panic(err)
	}
	fmt.Printf("JSON: %s", result[0].Source())
	// Output:
	// JSON: {"name":"Foo","mail":"foo@example.com"}
}

```
Output:
```
JSON: {"name":"Foo","mail":"foo@example.com"}
```
</details>

### Supported functions

Package has several predefined functions.

    abs          math.Abs           integers, floats
    acos         math.Acos          integers, floats
    acosh        math.Acosh         integers, floats
    asin         math.Asin          integers, floats
    asinh        math.Asinh         integers, floats
    atan         math.Atan          integers, floats
    atanh        math.Atanh         integers, floats
    avg          Average            array of integers or floats
    b64decode    b64 Decoding       string
    b64encode    b64 Encoding       string 
    b64encoden   b64 Encoding (no padding)    string
    cbrt         math.Cbrt          integers, floats
    ceil         math.Ceil          integers, floats
    cos          math.Cos           integers, floats
    cosh         math.Cosh          integers, floats
    erf          math.Erf           integers, floats
    erfc         math.Erfc          integers, floats
    erfcinv      math.Erfcinv       integers, floats
    erfinv       math.Erfinv        integers, floats
    exp          math.Exp           integers, floats
    exp2         math.Exp2          integers, floats
    expm1        math.Expm1         integers, floats
    factorial    N!                 unsigned integer
    first        Get first element  any
    floor        math.Floor         integers, floats
    gamma        math.Gamma         integers, floats
    is_array     Is type Array      any
    is_bool      Is type Bool       any
    is_float     Is type Float      any
    is_int       Is type Int        any
    is_null      Is type Null       any
    is_numeric   Is type Numeric    any
    is_object    Is type Object     any
    is_string    Is type String     any
    is_uint      Is type Uint       any
    j0           math.J0            integers, floats
    j1           math.J1            integers, floats
    key          Key of element     string
    last         Get last element   any
    length       Length of array    array, string
    log          math.Log           integers, floats
    log10        math.Log10         integers, floats
    log1p        math.Log1p         integers, floats
    log2         math.Log2          integers, floats
    logb         math.Logb          integers, floats
    not          not                any
    parent       Get parent element any
    pow10        math.Pow10         integer
    rand         N*rand.Float64     float
    randint      rand.Intn          integer
    root         Get root element   any
    round        math.Round         integers, floats
    roundtoeven  math.RoundToEven   integers, floats
    sin          math.Sin           integers, floats
    sinh         math.Sinh          integers, floats
    size         Count of elements  array, object
    sum          Sum                array of integers or floats
    sqrt         math.Sqrt          integers, floats
    tan          math.Tan           integers, floats
    tanh         math.Tanh          integers, floats
    trunc        math.Trunc         integers, floats
    y0           math.Y0            integers, floats
    y1           math.Y1            integers, floats

You are free to add new one with function `AddFunction`:

```go
	AddFunction("trim", func(node *ajson.Node) (result *Node, err error) {
		if node.IsString() {
			return StringNode("trim", strings.TrimSpace(node.MustString())), nil
		}
		return
	})
```

#### Examples

<details>
<summary>Using `avg` for array</summary>

[Playground](https://play.golang.org/p/cM66hTE-CX1)

```go
package main

import (
	"fmt"
	
	"github.com/spyzhov/ajson"
)

func main() {
	json := []byte(`{"prices": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}`)
	root, err := ajson.Unmarshal(json)
	if err != nil {
		panic(err)
	}
	result, err := ajson.Eval(root, `avg($.prices)`)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Avg price: %0.1f", result.MustNumeric())
	// Output:
	// Avg price: 5.5
}
```
Output:
```
Avg price: 5.5
```
</details>

# Examples

Calculating `AVG(price)` when object is heterogeneous.

```json
{
  "store": {
    "book": [
      {
        "category": "reference",
        "author": "Nigel Rees",
        "title": "Sayings of the Century",
        "price": 8.95
      },
      {
        "category": "fiction",
        "author": "Evelyn Waugh",
        "title": "Sword of Honour",
        "price": 12.99
      },
      {
        "category": "fiction",
        "author": "Herman Melville",
        "title": "Moby Dick",
        "isbn": "0-553-21311-3",
        "price": 8.99
      },
      {
        "category": "fiction",
        "author": "J. R. R. Tolkien",
        "title": "The Lord of the Rings",
        "isbn": "0-395-19395-8",
        "price": 22.99
      }
    ],
    "bicycle": {
      "color": "red",
      "price": 19.95
    },
    "tools": null
  }
}
```

## Unmarshal

[Playground](https://play.golang.org/p/xny93dzjZCK)
```go
package main

import (
	"fmt"
	"github.com/spyzhov/ajson"
)

func main() {
	data := []byte(`{"store": {"book": [
{"category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95}, 
{"category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99}, 
{"category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99}, 
{"category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "isbn": "0-395-19395-8", "price": 22.99}], 
"bicycle": {"color": "red", "price": 19.95}, "tools": null}}`)

	root, err := ajson.Unmarshal(data)
	if err != nil {
		panic(err)
	}

	store := root.MustKey("store").MustObject()

	var prices float64
	size := 0
	for _, objects := range store {
		if objects.IsArray() && objects.Size() > 0 {
			size += objects.Size()
			for _, object := range objects.MustArray() {
				prices += object.MustKey("price").MustNumeric()
			}
		} else if objects.IsObject() && objects.HasKey("price") {
			size++
			prices += objects.MustKey("price").MustNumeric()
		}
	}

	if size > 0 {
		fmt.Println("AVG price:", prices/float64(size))
	} else {
		fmt.Println("AVG price:", 0)
	}
}
```

## JSONPath:

[Playground](https://play.golang.org/p/7twZHOd6dbT)
```go
package main

import (
	"fmt"
	"github.com/spyzhov/ajson"
)

func main() {
	data := []byte(`{"store": {"book": [
{"category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95}, 
{"category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99}, 
{"category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99}, 
{"category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "isbn": "0-395-19395-8", "price": 22.99}], 
"bicycle": {"color": "red", "price": 19.95}, "tools": null}}`)

	nodes, err := ajson.JSONPath(data, "$..price")
	if err != nil {
		panic(err)
	}

	var prices float64
	size := len(nodes)
	for _, node := range nodes {
		prices += node.MustNumeric()
	}

	if size > 0 {
		fmt.Println("AVG price:", prices/float64(size))
	} else {
		fmt.Println("AVG price:", 0)
	}
}
```

## Eval

[Playground](https://play.golang.org/p/lTXnlRU3sgR)
```go
package main

import (
	"fmt"
	"github.com/spyzhov/ajson"
)

func main() {
	json := []byte(`{"store": {"book": [
{"category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95}, 
{"category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99}, 
{"category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99}, 
{"category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "isbn": "0-395-19395-8", "price": 22.99}], 
"bicycle": {"color": "red", "price": 19.95}, "tools": null}}`)
	root, err := ajson.Unmarshal(json)
	if err != nil {
		panic(err)
	}
	result, err := ajson.Eval(root, "avg($..price)")
	if err != nil {
		panic(err)
	}
	fmt.Println("AVG price:", result.MustNumeric())
}
```

## Marshal

[Playground](https://play.golang.org/p/i4gXXcA2VLU)
```go
package main

import (
	"fmt"
	"github.com/spyzhov/ajson"
)

func main() {
	json := []byte(`{"store": {"book": [
{"category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95}, 
{"category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99}, 
{"category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99}, 
{"category": "fiction", "author": "J. R. R. Tolkien", "title": "The Lord of the Rings", "isbn": "0-395-19395-8", "price": 22.99}], 
"bicycle": {"color": "red", "price": 19.95}, "tools": null}}`)
	root := ajson.Must(ajson.Unmarshal(json))
	result := ajson.Must(ajson.Eval(root, "avg($..price)"))
	err := root.AppendObject("price(avg)", result)
	if err != nil {
		panic(err)
	}
	marshalled, err := ajson.Marshal(root)
	if err != nil {
		panic(err)
	}
	fmt.Printf("%s", marshalled)
}
```

# Benchmarks

Current package is comparable with `encoding/json` package. 

Test data:
```json
{ "store": {
    "book": [ 
      { "category": "reference",
        "author": "Nigel Rees",
        "title": "Sayings of the Century",
        "price": 8.95
      },
      { "category": "fiction",
        "author": "Evelyn Waugh",
        "title": "Sword of Honour",
        "price": 12.99
      },
      { "category": "fiction",
        "author": "Herman Melville",
        "title": "Moby Dick",
        "isbn": "0-553-21311-3",
        "price": 8.99
      },
      { "category": "fiction",
        "author": "J. R. R. Tolkien",
        "title": "The Lord of the Rings",
        "isbn": "0-395-19395-8",
        "price": 22.99
      }
    ],
    "bicycle": {
      "color": "red",
      "price": 19.95
    }
  }
}
```
JSONPath: `$.store..price`

```
$ go test -bench=. -cpu=1 -benchmem
goos: linux
goarch: amd64
pkg: github.com/spyzhov/ajson
BenchmarkUnmarshal_AJSON          121656             10060 ns/op            5712 B/op        118 allocs/op
BenchmarkUnmarshal_JSON           102674             11381 ns/op             960 B/op         32 allocs/op
BenchmarkJSONPath_all_prices       63314             16385 ns/op            7496 B/op        178 allocs/op
```

# License

MIT licensed. See the [LICENSE](LICENSE) file for details.
