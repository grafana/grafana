/*
Package jsonschema provides json-schema compilation and validation.

Features:
  - implements draft 2020-12, 2019-09, draft-7, draft-6, draft-4
  - fully compliant with JSON-Schema-Test-Suite, (excluding some optional)
  - list of optional tests that are excluded can be found in schema_test.go(variable skipTests)
  - validates schemas against meta-schema
  - full support of remote references
  - support of recursive references between schemas
  - detects infinite loop in schemas
  - thread safe validation
  - rich, intuitive hierarchial error messages with json-pointers to exact location
  - supports output formats flag, basic and detailed
  - supports enabling format and content Assertions in draft2019-09 or above
  - change Compiler.AssertFormat, Compiler.AssertContent to true
  - compiled schema can be introspected. easier to develop tools like generating go structs given schema
  - supports user-defined keywords via extensions
  - implements following formats (supports user-defined)
  - date-time, date, time, duration (supports leap-second)
  - uuid, hostname, email
  - ip-address, ipv4, ipv6
  - uri, uriref, uri-template(limited validation)
  - json-pointer, relative-json-pointer
  - regex, format
  - implements following contentEncoding (supports user-defined)
  - base64
  - implements following contentMediaType (supports user-defined)
  - application/json
  - can load from files/http/https/string/[]byte/io.Reader (supports user-defined)

The schema is compiled against the version specified in "$schema" property.
If "$schema" property is missing, it uses latest draft which currently implemented
by this library.

You can force to use specific draft,  when "$schema" is missing, as follows:

	compiler := jsonschema.NewCompiler()
	compiler.Draft = jsonschema.Draft4

This package supports loading json-schema from filePath and fileURL.

To load json-schema from HTTPURL, add following import:

	import _ "github.com/santhosh-tekuri/jsonschema/v5/httploader"

you can validate yaml documents. see https://play.golang.org/p/sJy1qY7dXgA
*/
package jsonschema
