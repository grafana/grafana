package jsonschema

import (
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"regexp"
	"strconv"
	"strings"
)

// A Compiler represents a json-schema compiler.
type Compiler struct {
	// Draft represents the draft used when '$schema' attribute is missing.
	//
	// This defaults to latest supported draft (currently 2020-12).
	Draft     *Draft
	resources map[string]*resource

	// Extensions is used to register extensions.
	extensions map[string]extension

	// ExtractAnnotations tells whether schema annotations has to be extracted
	// in compiled Schema or not.
	ExtractAnnotations bool

	// LoadURL loads the document at given absolute URL.
	//
	// If nil, package global LoadURL is used.
	LoadURL func(s string) (io.ReadCloser, error)

	// Formats can be registered by adding to this map. Key is format name,
	// value is function that knows how to validate that format.
	Formats map[string]func(interface{}) bool

	// AssertFormat for specifications >= draft2019-09.
	AssertFormat bool

	// Decoders can be registered by adding to this map. Key is encoding name,
	// value is function that knows how to decode string in that format.
	Decoders map[string]func(string) ([]byte, error)

	// MediaTypes can be registered by adding to this map. Key is mediaType name,
	// value is function that knows how to validate that mediaType.
	MediaTypes map[string]func([]byte) error

	// AssertContent for specifications >= draft2019-09.
	AssertContent bool
}

// Compile parses json-schema at given url returns, if successful,
// a Schema object that can be used to match against json.
//
// Returned error can be *SchemaError
func Compile(url string) (*Schema, error) {
	return NewCompiler().Compile(url)
}

// MustCompile is like Compile but panics if the url cannot be compiled to *Schema.
// It simplifies safe initialization of global variables holding compiled Schemas.
func MustCompile(url string) *Schema {
	return NewCompiler().MustCompile(url)
}

// CompileString parses and compiles the given schema with given base url.
func CompileString(url, schema string) (*Schema, error) {
	c := NewCompiler()
	if err := c.AddResource(url, strings.NewReader(schema)); err != nil {
		return nil, err
	}
	return c.Compile(url)
}

// MustCompileString is like CompileString but panics on error.
// It simplified safe initialization of global variables holding compiled Schema.
func MustCompileString(url, schema string) *Schema {
	c := NewCompiler()
	if err := c.AddResource(url, strings.NewReader(schema)); err != nil {
		panic(err)
	}
	return c.MustCompile(url)
}

// NewCompiler returns a json-schema Compiler object.
// if '$schema' attribute is missing, it is treated as draft7. to change this
// behavior change Compiler.Draft value
func NewCompiler() *Compiler {
	return &Compiler{
		Draft:      latest,
		resources:  make(map[string]*resource),
		Formats:    make(map[string]func(interface{}) bool),
		Decoders:   make(map[string]func(string) ([]byte, error)),
		MediaTypes: make(map[string]func([]byte) error),
		extensions: make(map[string]extension),
	}
}

// AddResource adds in-memory resource to the compiler.
//
// Note that url must not have fragment
func (c *Compiler) AddResource(url string, r io.Reader) error {
	res, err := newResource(url, r)
	if err != nil {
		return err
	}
	c.resources[res.url] = res
	return nil
}

// MustCompile is like Compile but panics if the url cannot be compiled to *Schema.
// It simplifies safe initialization of global variables holding compiled Schemas.
func (c *Compiler) MustCompile(url string) *Schema {
	s, err := c.Compile(url)
	if err != nil {
		panic(fmt.Sprintf("jsonschema: %#v", err))
	}
	return s
}

// Compile parses json-schema at given url returns, if successful,
// a Schema object that can be used to match against json.
//
// error returned will be of type *SchemaError
func (c *Compiler) Compile(url string) (*Schema, error) {
	// make url absolute
	u, err := toAbs(url)
	if err != nil {
		return nil, &SchemaError{url, err}
	}
	url = u

	sch, err := c.compileURL(url, nil, "#")
	if err != nil {
		err = &SchemaError{url, err}
	}
	return sch, err
}

func (c *Compiler) findResource(url string) (*resource, error) {
	if _, ok := c.resources[url]; !ok {
		// load resource
		var rdr io.Reader
		if sch, ok := vocabSchemas[url]; ok {
			rdr = strings.NewReader(sch)
		} else {
			loadURL := LoadURL
			if c.LoadURL != nil {
				loadURL = c.LoadURL
			}
			r, err := loadURL(url)
			if err != nil {
				return nil, err
			}
			defer r.Close()
			rdr = r
		}
		if err := c.AddResource(url, rdr); err != nil {
			return nil, err
		}
	}

	r := c.resources[url]
	if r.draft != nil {
		return r, nil
	}

	// set draft
	r.draft = c.Draft
	if m, ok := r.doc.(map[string]interface{}); ok {
		if sch, ok := m["$schema"]; ok {
			sch, ok := sch.(string)
			if !ok {
				return nil, fmt.Errorf("jsonschema: invalid $schema in %s", url)
			}
			if !isURI(sch) {
				return nil, fmt.Errorf("jsonschema: $schema must be uri in %s", url)
			}
			r.draft = findDraft(sch)
			if r.draft == nil {
				sch, _ := split(sch)
				if sch == url {
					return nil, fmt.Errorf("jsonschema: unsupported draft in %s", url)
				}
				mr, err := c.findResource(sch)
				if err != nil {
					return nil, err
				}
				r.draft = mr.draft
			}
		}
	}

	id, err := r.draft.resolveID(r.url, r.doc)
	if err != nil {
		return nil, err
	}
	if id != "" {
		r.url = id
	}

	if err := r.fillSubschemas(c, r); err != nil {
		return nil, err
	}

	return r, nil
}

func (c *Compiler) compileURL(url string, stack []schemaRef, ptr string) (*Schema, error) {
	// if url points to a draft, return Draft.meta
	if d := findDraft(url); d != nil && d.meta != nil {
		return d.meta, nil
	}

	b, f := split(url)
	r, err := c.findResource(b)
	if err != nil {
		return nil, err
	}
	return c.compileRef(r, stack, ptr, r, f)
}

func (c *Compiler) compileRef(r *resource, stack []schemaRef, refPtr string, res *resource, ref string) (*Schema, error) {
	base := r.baseURL(res.floc)
	ref, err := resolveURL(base, ref)
	if err != nil {
		return nil, err
	}

	u, f := split(ref)
	sr := r.findResource(u)
	if sr == nil {
		// external resource
		return c.compileURL(ref, stack, refPtr)
	}

	// ensure root resource is always compiled first.
	// this is required to get schema.meta from root resource
	if r.schema == nil {
		r.schema = newSchema(r.url, r.floc, r.draft, r.doc)
		if _, err := c.compile(r, nil, schemaRef{"#", r.schema, false}, r); err != nil {
			return nil, err
		}
	}

	sr, err = r.resolveFragment(c, sr, f)
	if err != nil {
		return nil, err
	}
	if sr == nil {
		return nil, fmt.Errorf("jsonschema: %s not found", ref)
	}

	if sr.schema != nil {
		if err := checkLoop(stack, schemaRef{refPtr, sr.schema, false}); err != nil {
			return nil, err
		}
		return sr.schema, nil
	}

	sr.schema = newSchema(r.url, sr.floc, r.draft, sr.doc)
	return c.compile(r, stack, schemaRef{refPtr, sr.schema, false}, sr)
}

func (c *Compiler) compileDynamicAnchors(r *resource, res *resource) error {
	if r.draft.version < 2020 {
		return nil
	}

	rr := r.listResources(res)
	rr = append(rr, res)
	for _, sr := range rr {
		if m, ok := sr.doc.(map[string]interface{}); ok {
			if _, ok := m["$dynamicAnchor"]; ok {
				sch, err := c.compileRef(r, nil, "IGNORED", r, sr.floc)
				if err != nil {
					return err
				}
				res.schema.dynamicAnchors = append(res.schema.dynamicAnchors, sch)
			}
		}
	}
	return nil
}

func (c *Compiler) compile(r *resource, stack []schemaRef, sref schemaRef, res *resource) (*Schema, error) {
	if err := c.compileDynamicAnchors(r, res); err != nil {
		return nil, err
	}

	switch v := res.doc.(type) {
	case bool:
		res.schema.Always = &v
		return res.schema, nil
	default:
		return res.schema, c.compileMap(r, stack, sref, res)
	}
}

func (c *Compiler) compileMap(r *resource, stack []schemaRef, sref schemaRef, res *resource) error {
	m := res.doc.(map[string]interface{})

	if err := checkLoop(stack, sref); err != nil {
		return err
	}
	stack = append(stack, sref)

	var s = res.schema
	var err error

	if r == res { // root schema
		if sch, ok := m["$schema"]; ok {
			sch := sch.(string)
			if d := findDraft(sch); d != nil {
				s.meta = d.meta
			} else {
				if s.meta, err = c.compileRef(r, stack, "$schema", res, sch); err != nil {
					return err
				}
			}
		}
	}

	if ref, ok := m["$ref"]; ok {
		s.Ref, err = c.compileRef(r, stack, "$ref", res, ref.(string))
		if err != nil {
			return err
		}
		if r.draft.version < 2019 {
			// All other properties in a "$ref" object MUST be ignored
			return nil
		}
	}

	if r.draft.version >= 2019 {
		if r == res { // root schema
			if vocab, ok := m["$vocabulary"]; ok {
				for url, reqd := range vocab.(map[string]interface{}) {
					if reqd, ok := reqd.(bool); ok && !reqd {
						continue
					}
					if !r.draft.isVocab(url) {
						return fmt.Errorf("jsonschema: unsupported vocab %q in %s", url, res)
					}
					s.vocab = append(s.vocab, url)
				}
			} else {
				s.vocab = r.draft.defaultVocab
			}
		}

		if ref, ok := m["$recursiveRef"]; ok {
			s.RecursiveRef, err = c.compileRef(r, stack, "$recursiveRef", res, ref.(string))
			if err != nil {
				return err
			}
		}
	}
	if r.draft.version >= 2020 {
		if dref, ok := m["$dynamicRef"]; ok {
			s.DynamicRef, err = c.compileRef(r, stack, "$dynamicRef", res, dref.(string))
			if err != nil {
				return err
			}
			if dref, ok := dref.(string); ok {
				_, frag := split(dref)
				if frag != "#" && !strings.HasPrefix(frag, "#/") {
					// frag is anchor
					s.dynamicRefAnchor = frag[1:]
				}
			}
		}
	}

	loadInt := func(pname string) int {
		if num, ok := m[pname]; ok {
			i, _ := num.(json.Number).Float64()
			return int(i)
		}
		return -1
	}

	loadRat := func(pname string) *big.Rat {
		if num, ok := m[pname]; ok {
			r, _ := new(big.Rat).SetString(string(num.(json.Number)))
			return r
		}
		return nil
	}

	if r.draft.version < 2019 || r.schema.meta.hasVocab("validation") {
		if t, ok := m["type"]; ok {
			switch t := t.(type) {
			case string:
				s.Types = []string{t}
			case []interface{}:
				s.Types = toStrings(t)
			}
		}

		if e, ok := m["enum"]; ok {
			s.Enum = e.([]interface{})
			allPrimitives := true
			for _, item := range s.Enum {
				switch jsonType(item) {
				case "object", "array":
					allPrimitives = false
					break
				}
			}
			s.enumError = "enum failed"
			if allPrimitives {
				if len(s.Enum) == 1 {
					s.enumError = fmt.Sprintf("value must be %#v", s.Enum[0])
				} else {
					strEnum := make([]string, len(s.Enum))
					for i, item := range s.Enum {
						strEnum[i] = fmt.Sprintf("%#v", item)
					}
					s.enumError = fmt.Sprintf("value must be one of %s", strings.Join(strEnum, ", "))
				}
			}
		}

		s.Minimum = loadRat("minimum")
		if exclusive, ok := m["exclusiveMinimum"]; ok {
			if exclusive, ok := exclusive.(bool); ok {
				if exclusive {
					s.Minimum, s.ExclusiveMinimum = nil, s.Minimum
				}
			} else {
				s.ExclusiveMinimum = loadRat("exclusiveMinimum")
			}
		}

		s.Maximum = loadRat("maximum")
		if exclusive, ok := m["exclusiveMaximum"]; ok {
			if exclusive, ok := exclusive.(bool); ok {
				if exclusive {
					s.Maximum, s.ExclusiveMaximum = nil, s.Maximum
				}
			} else {
				s.ExclusiveMaximum = loadRat("exclusiveMaximum")
			}
		}

		s.MultipleOf = loadRat("multipleOf")

		s.MinProperties, s.MaxProperties = loadInt("minProperties"), loadInt("maxProperties")

		if req, ok := m["required"]; ok {
			s.Required = toStrings(req.([]interface{}))
		}

		s.MinItems, s.MaxItems = loadInt("minItems"), loadInt("maxItems")

		if unique, ok := m["uniqueItems"]; ok {
			s.UniqueItems = unique.(bool)
		}

		s.MinLength, s.MaxLength = loadInt("minLength"), loadInt("maxLength")

		if pattern, ok := m["pattern"]; ok {
			s.Pattern = regexp.MustCompile(pattern.(string))
		}

		if r.draft.version >= 2019 {
			s.MinContains, s.MaxContains = loadInt("minContains"), loadInt("maxContains")
			if s.MinContains == -1 {
				s.MinContains = 1
			}

			if deps, ok := m["dependentRequired"]; ok {
				deps := deps.(map[string]interface{})
				s.DependentRequired = make(map[string][]string, len(deps))
				for pname, pvalue := range deps {
					s.DependentRequired[pname] = toStrings(pvalue.([]interface{}))
				}
			}
		}
	}

	compile := func(stack []schemaRef, ptr string) (*Schema, error) {
		return c.compileRef(r, stack, ptr, res, r.url+res.floc+"/"+ptr)
	}

	loadSchema := func(pname string, stack []schemaRef) (*Schema, error) {
		if _, ok := m[pname]; ok {
			return compile(stack, escape(pname))
		}
		return nil, nil
	}

	loadSchemas := func(pname string, stack []schemaRef) ([]*Schema, error) {
		if pvalue, ok := m[pname]; ok {
			pvalue := pvalue.([]interface{})
			schemas := make([]*Schema, len(pvalue))
			for i := range pvalue {
				sch, err := compile(stack, escape(pname)+"/"+strconv.Itoa(i))
				if err != nil {
					return nil, err
				}
				schemas[i] = sch
			}
			return schemas, nil
		}
		return nil, nil
	}

	if r.draft.version < 2019 || r.schema.meta.hasVocab("applicator") {
		if s.Not, err = loadSchema("not", stack); err != nil {
			return err
		}
		if s.AllOf, err = loadSchemas("allOf", stack); err != nil {
			return err
		}
		if s.AnyOf, err = loadSchemas("anyOf", stack); err != nil {
			return err
		}
		if s.OneOf, err = loadSchemas("oneOf", stack); err != nil {
			return err
		}

		if props, ok := m["properties"]; ok {
			props := props.(map[string]interface{})
			s.Properties = make(map[string]*Schema, len(props))
			for pname := range props {
				s.Properties[pname], err = compile(nil, "properties/"+escape(pname))
				if err != nil {
					return err
				}
			}
		}

		if regexProps, ok := m["regexProperties"]; ok {
			s.RegexProperties = regexProps.(bool)
		}

		if patternProps, ok := m["patternProperties"]; ok {
			patternProps := patternProps.(map[string]interface{})
			s.PatternProperties = make(map[*regexp.Regexp]*Schema, len(patternProps))
			for pattern := range patternProps {
				s.PatternProperties[regexp.MustCompile(pattern)], err = compile(nil, "patternProperties/"+escape(pattern))
				if err != nil {
					return err
				}
			}
		}

		if additionalProps, ok := m["additionalProperties"]; ok {
			switch additionalProps := additionalProps.(type) {
			case bool:
				s.AdditionalProperties = additionalProps
			case map[string]interface{}:
				s.AdditionalProperties, err = compile(nil, "additionalProperties")
				if err != nil {
					return err
				}
			}
		}

		if deps, ok := m["dependencies"]; ok {
			deps := deps.(map[string]interface{})
			s.Dependencies = make(map[string]interface{}, len(deps))
			for pname, pvalue := range deps {
				switch pvalue := pvalue.(type) {
				case []interface{}:
					s.Dependencies[pname] = toStrings(pvalue)
				default:
					s.Dependencies[pname], err = compile(stack, "dependencies/"+escape(pname))
					if err != nil {
						return err
					}
				}
			}
		}

		if r.draft.version >= 6 {
			if s.PropertyNames, err = loadSchema("propertyNames", nil); err != nil {
				return err
			}
			if s.Contains, err = loadSchema("contains", nil); err != nil {
				return err
			}
		}

		if r.draft.version >= 7 {
			if m["if"] != nil {
				if s.If, err = loadSchema("if", stack); err != nil {
					return err
				}
				if s.Then, err = loadSchema("then", stack); err != nil {
					return err
				}
				if s.Else, err = loadSchema("else", stack); err != nil {
					return err
				}
			}
		}
		if r.draft.version >= 2019 {
			if deps, ok := m["dependentSchemas"]; ok {
				deps := deps.(map[string]interface{})
				s.DependentSchemas = make(map[string]*Schema, len(deps))
				for pname := range deps {
					s.DependentSchemas[pname], err = compile(stack, "dependentSchemas/"+escape(pname))
					if err != nil {
						return err
					}
				}
			}
		}

		if r.draft.version >= 2020 {
			if s.PrefixItems, err = loadSchemas("prefixItems", nil); err != nil {
				return err
			}
			if s.Items2020, err = loadSchema("items", nil); err != nil {
				return err
			}
		} else {
			if items, ok := m["items"]; ok {
				switch items.(type) {
				case []interface{}:
					s.Items, err = loadSchemas("items", nil)
					if err != nil {
						return err
					}
					if additionalItems, ok := m["additionalItems"]; ok {
						switch additionalItems := additionalItems.(type) {
						case bool:
							s.AdditionalItems = additionalItems
						case map[string]interface{}:
							s.AdditionalItems, err = compile(nil, "additionalItems")
							if err != nil {
								return err
							}
						}
					}
				default:
					s.Items, err = compile(nil, "items")
					if err != nil {
						return err
					}
				}
			}
		}

	}

	// unevaluatedXXX keywords were in "applicator" vocab in 2019, but moved to new vocab "unevaluated" in 2020
	if (r.draft.version == 2019 && r.schema.meta.hasVocab("applicator")) || (r.draft.version >= 2020 && r.schema.meta.hasVocab("unevaluated")) {
		if s.UnevaluatedProperties, err = loadSchema("unevaluatedProperties", nil); err != nil {
			return err
		}
		if s.UnevaluatedItems, err = loadSchema("unevaluatedItems", nil); err != nil {
			return err
		}
		if r.draft.version >= 2020 {
			// any item in an array that passes validation of the contains schema is considered "evaluated"
			s.ContainsEval = true
		}
	}

	if format, ok := m["format"]; ok {
		s.Format = format.(string)
		if r.draft.version < 2019 || c.AssertFormat || r.schema.meta.hasVocab("format-assertion") {
			if format, ok := c.Formats[s.Format]; ok {
				s.format = format
			} else {
				s.format, _ = Formats[s.Format]
			}
		}
	}

	if c.ExtractAnnotations {
		if title, ok := m["title"]; ok {
			s.Title = title.(string)
		}
		if description, ok := m["description"]; ok {
			s.Description = description.(string)
		}
		s.Default = m["default"]
	}

	if r.draft.version >= 6 {
		if c, ok := m["const"]; ok {
			s.Constant = []interface{}{c}
		}
	}

	if r.draft.version >= 7 {
		if encoding, ok := m["contentEncoding"]; ok {
			s.ContentEncoding = encoding.(string)
			if decoder, ok := c.Decoders[s.ContentEncoding]; ok {
				s.decoder = decoder
			} else {
				s.decoder, _ = Decoders[s.ContentEncoding]
			}
		}
		if mediaType, ok := m["contentMediaType"]; ok {
			s.ContentMediaType = mediaType.(string)
			if mediaType, ok := c.MediaTypes[s.ContentMediaType]; ok {
				s.mediaType = mediaType
			} else {
				s.mediaType, _ = MediaTypes[s.ContentMediaType]
			}
			if s.ContentSchema, err = loadSchema("contentSchema", stack); err != nil {
				return err
			}
		}
		if c.ExtractAnnotations {
			if comment, ok := m["$comment"]; ok {
				s.Comment = comment.(string)
			}
			if readOnly, ok := m["readOnly"]; ok {
				s.ReadOnly = readOnly.(bool)
			}
			if writeOnly, ok := m["writeOnly"]; ok {
				s.WriteOnly = writeOnly.(bool)
			}
			if examples, ok := m["examples"]; ok {
				s.Examples = examples.([]interface{})
			}
		}
	}

	if r.draft.version >= 2019 {
		if !c.AssertContent {
			s.decoder = nil
			s.mediaType = nil
			s.ContentSchema = nil
		}
		if c.ExtractAnnotations {
			if deprecated, ok := m["deprecated"]; ok {
				s.Deprecated = deprecated.(bool)
			}
		}
	}

	for name, ext := range c.extensions {
		es, err := ext.compiler.Compile(CompilerContext{c, r, stack, res}, m)
		if err != nil {
			return err
		}
		if es != nil {
			if s.Extensions == nil {
				s.Extensions = make(map[string]ExtSchema)
			}
			s.Extensions[name] = es
		}
	}

	return nil
}

func (c *Compiler) validateSchema(r *resource, v interface{}, vloc string) error {
	validate := func(meta *Schema) error {
		if meta == nil {
			return nil
		}
		return meta.validateValue(v, vloc)
	}

	if err := validate(r.draft.meta); err != nil {
		return err
	}
	for _, ext := range c.extensions {
		if err := validate(ext.meta); err != nil {
			return err
		}
	}
	return nil
}

func toStrings(arr []interface{}) []string {
	s := make([]string, len(arr))
	for i, v := range arr {
		s[i] = v.(string)
	}
	return s
}

// SchemaRef captures schema and the path referring to it.
type schemaRef struct {
	path    string  // relative-json-pointer to schema
	schema  *Schema // target schema
	discard bool    // true when scope left
}

func (sr schemaRef) String() string {
	return fmt.Sprintf("(%s)%v", sr.path, sr.schema)
}

func checkLoop(stack []schemaRef, sref schemaRef) error {
	for _, ref := range stack {
		if ref.schema == sref.schema {
			return infiniteLoopError(stack, sref)
		}
	}
	return nil
}

func keywordLocation(stack []schemaRef, path string) string {
	var loc string
	for _, ref := range stack[1:] {
		loc += "/" + ref.path
	}
	if path != "" {
		loc = loc + "/" + path
	}
	return loc
}
