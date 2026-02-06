# jsonschema v5.3.1

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GoDoc](https://godoc.org/github.com/santhosh-tekuri/jsonschema?status.svg)](https://pkg.go.dev/github.com/santhosh-tekuri/jsonschema/v5)
[![Go Report Card](https://goreportcard.com/badge/github.com/santhosh-tekuri/jsonschema/v5)](https://goreportcard.com/report/github.com/santhosh-tekuri/jsonschema/v5)
[![Build Status](https://github.com/santhosh-tekuri/jsonschema/actions/workflows/go.yaml/badge.svg?branch=master)](https://github.com/santhosh-tekuri/jsonschema/actions/workflows/go.yaml)
[![codecov](https://codecov.io/gh/santhosh-tekuri/jsonschema/branch/master/graph/badge.svg?token=JMVj1pFT2l)](https://codecov.io/gh/santhosh-tekuri/jsonschema)

Package jsonschema provides json-schema compilation and validation.

[Benchmarks](https://dev.to/vearutop/benchmarking-correctness-and-performance-of-go-json-schema-validators-3247)

### Features:
 - implements
   [draft 2020-12](https://json-schema.org/specification-links.html#2020-12),
   [draft 2019-09](https://json-schema.org/specification-links.html#draft-2019-09-formerly-known-as-draft-8),
   [draft-7](https://json-schema.org/specification-links.html#draft-7),
   [draft-6](https://json-schema.org/specification-links.html#draft-6),
   [draft-4](https://json-schema.org/specification-links.html#draft-4)
 - fully compliant with [JSON-Schema-Test-Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite), (excluding some optional)
   - list of optional tests that are excluded can be found in schema_test.go(variable [skipTests](https://github.com/santhosh-tekuri/jsonschema/blob/master/schema_test.go#L24))
 - validates schemas against meta-schema
 - full support of remote references
 - support of recursive references between schemas
 - detects infinite loop in schemas
 - thread safe validation
 - rich, intuitive hierarchial error messages with json-pointers to exact location
 - supports output formats flag, basic and detailed
 - supports enabling format and content Assertions in draft2019-09 or above
   - change `Compiler.AssertFormat`, `Compiler.AssertContent` to `true`
 - compiled schema can be introspected. easier to develop tools like generating go structs given schema
 - supports user-defined keywords via [extensions](https://pkg.go.dev/github.com/santhosh-tekuri/jsonschema/v5/#example-package-Extension)
 - implements following formats (supports [user-defined](https://pkg.go.dev/github.com/santhosh-tekuri/jsonschema/v5/#example-package-UserDefinedFormat))
   - date-time, date, time, duration, period (supports leap-second)
   - uuid, hostname, email
   - ip-address, ipv4, ipv6
   - uri, uriref, uri-template(limited validation)
   - json-pointer, relative-json-pointer
   - regex, format
 - implements following contentEncoding (supports [user-defined](https://pkg.go.dev/github.com/santhosh-tekuri/jsonschema/v5/#example-package-UserDefinedContent))
   - base64
 - implements following contentMediaType (supports [user-defined](https://pkg.go.dev/github.com/santhosh-tekuri/jsonschema/v5/#example-package-UserDefinedContent))
   - application/json
 - can load from files/http/https/[string](https://pkg.go.dev/github.com/santhosh-tekuri/jsonschema/v5/#example-package-FromString)/[]byte/io.Reader (supports [user-defined](https://pkg.go.dev/github.com/santhosh-tekuri/jsonschema/v5/#example-package-UserDefinedLoader))


see examples in [godoc](https://pkg.go.dev/github.com/santhosh-tekuri/jsonschema/v5)

The schema is compiled against the version specified in `$schema` property.
If "$schema" property is missing, it uses latest draft which currently implemented
by this library.

You can force to use specific version, when `$schema` is missing, as follows:

```go
compiler := jsonschema.NewCompiler()
compiler.Draft = jsonschema.Draft4
```

This package supports loading json-schema from filePath and fileURL.

To load json-schema from HTTPURL, add following import:

```go
import _ "github.com/santhosh-tekuri/jsonschema/v5/httploader"
```

## Rich Errors

The ValidationError returned by Validate method contains detailed context to understand why and where the error is.

schema.json:
```json
{
      "$ref": "t.json#/definitions/employee"
}
```

t.json:
```json
{
    "definitions": {
        "employee": {
            "type": "string"
        }
    }
}
```

doc.json:
```json
1
```

assuming `err` is the ValidationError returned when `doc.json` validated with `schema.json`,
```go
fmt.Printf("%#v\n", err) // using %#v prints errors hierarchy
```
Prints:
```
[I#] [S#] doesn't validate with file:///Users/santhosh/jsonschema/schema.json#
  [I#] [S#/$ref] doesn't validate with 'file:///Users/santhosh/jsonschema/t.json#/definitions/employee'
    [I#] [S#/definitions/employee/type] expected string, but got number
```

Here `I` stands for instance document and `S` stands for schema document.  
The json-fragments that caused error in instance and schema documents are represented using json-pointer notation.  
Nested causes are printed with indent.

To output `err` in `flag` output format:
```go
b, _ := json.MarshalIndent(err.FlagOutput(), "", "  ")
fmt.Println(string(b))
```
Prints:
```json
{
  "valid": false
}
```
To output `err` in `basic` output format:
```go
b, _ := json.MarshalIndent(err.BasicOutput(), "", "  ")
fmt.Println(string(b))
```
Prints:
```json
{
  "valid": false,
  "errors": [
    {
      "keywordLocation": "",
      "absoluteKeywordLocation": "file:///Users/santhosh/jsonschema/schema.json#",
      "instanceLocation": "",
      "error": "doesn't validate with file:///Users/santhosh/jsonschema/schema.json#"
    },
    {
      "keywordLocation": "/$ref",
      "absoluteKeywordLocation": "file:///Users/santhosh/jsonschema/schema.json#/$ref",
      "instanceLocation": "",
      "error": "doesn't validate with 'file:///Users/santhosh/jsonschema/t.json#/definitions/employee'"
    },
    {
      "keywordLocation": "/$ref/type",
      "absoluteKeywordLocation": "file:///Users/santhosh/jsonschema/t.json#/definitions/employee/type",
      "instanceLocation": "",
      "error": "expected string, but got number"
    }
  ]
}
```
To output `err` in `detailed` output format:
```go
b, _ := json.MarshalIndent(err.DetailedOutput(), "", "  ")
fmt.Println(string(b))
```
Prints:
```json
{
  "valid": false,
  "keywordLocation": "",
  "absoluteKeywordLocation": "file:///Users/santhosh/jsonschema/schema.json#",
  "instanceLocation": "",
  "errors": [
    {
      "valid": false,
      "keywordLocation": "/$ref",
      "absoluteKeywordLocation": "file:///Users/santhosh/jsonschema/schema.json#/$ref",
      "instanceLocation": "",
      "errors": [
        {
          "valid": false,
          "keywordLocation": "/$ref/type",
          "absoluteKeywordLocation": "file:///Users/santhosh/jsonschema/t.json#/definitions/employee/type",
          "instanceLocation": "",
          "error": "expected string, but got number"
        }
      ]
    }
  ]
}
```

## CLI

to install `go install github.com/santhosh-tekuri/jsonschema/cmd/jv@latest`

```bash
jv [-draft INT] [-output FORMAT] [-assertformat] [-assertcontent] <json-schema> [<json-or-yaml-doc>]...
  -assertcontent
    	enable content assertions with draft >= 2019
  -assertformat
    	enable format assertions with draft >= 2019
  -draft int
    	draft used when '$schema' attribute is missing. valid values 4, 5, 7, 2019, 2020 (default 2020)
  -output string
    	output format. valid values flag, basic, detailed
```

if no `<json-or-yaml-doc>` arguments are passed, it simply validates the `<json-schema>`.  
if `$schema` attribute is missing in schema, it uses latest version. this can be overridden by passing `-draft` flag

exit-code is 1, if there are any validation errors

`jv` can also validate yaml files. It also accepts schema from yaml files.

## Validating YAML Documents

since yaml supports non-string keys, such yaml documents are rendered as invalid json documents.  

most yaml parser use `map[interface{}]interface{}` for object,  
whereas json parser uses `map[string]interface{}`.  

so we need to manually convert them to `map[string]interface{}`.   
below code shows such conversion by `toStringKeys` function.

https://play.golang.org/p/Hhax3MrtD8r

NOTE: if you are using `gopkg.in/yaml.v3`, then you do not need such conversion. since this library
returns `map[string]interface{}` if all keys are strings.