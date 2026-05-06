package jsonschema

// ExtCompiler compiles custom keyword(s) into ExtSchema.
type ExtCompiler interface {
	// Compile compiles the custom keywords in schema m and returns its compiled representation.
	// if the schema m does not contain the keywords defined by this extension,
	// compiled representation nil should be returned.
	Compile(ctx CompilerContext, m map[string]interface{}) (ExtSchema, error)
}

// ExtSchema is schema representation of custom keyword(s)
type ExtSchema interface {
	// Validate validates the json value v with this ExtSchema.
	// Returned error must be *ValidationError.
	Validate(ctx ValidationContext, v interface{}) error
}

type extension struct {
	meta     *Schema
	compiler ExtCompiler
}

// RegisterExtension registers custom keyword(s) into this compiler.
//
// name is extension name, used only to avoid name collisions.
// meta captures the metaschema for the new keywords.
// This is used to validate the schema before calling ext.Compile.
func (c *Compiler) RegisterExtension(name string, meta *Schema, ext ExtCompiler) {
	c.extensions[name] = extension{meta, ext}
}

// CompilerContext ---

// CompilerContext provides additional context required in compiling for extension.
type CompilerContext struct {
	c     *Compiler
	r     *resource
	stack []schemaRef
	res   *resource
}

// Compile compiles given value at ptr into *Schema. This is useful in implementing
// keyword like allOf/not/patternProperties.
//
// schPath is the relative-json-pointer to the schema to be compiled from parent schema.
//
// applicableOnSameInstance tells whether current schema and the given schema
// are applied on same instance value. this is used to detect infinite loop in schema.
func (ctx CompilerContext) Compile(schPath string, applicableOnSameInstance bool) (*Schema, error) {
	var stack []schemaRef
	if applicableOnSameInstance {
		stack = ctx.stack
	}
	return ctx.c.compileRef(ctx.r, stack, schPath, ctx.res, ctx.r.url+ctx.res.floc+"/"+schPath)
}

// CompileRef compiles the schema referenced by ref uri
//
// refPath is the relative-json-pointer to ref.
//
// applicableOnSameInstance tells whether current schema and the given schema
// are applied on same instance value. this is used to detect infinite loop in schema.
func (ctx CompilerContext) CompileRef(ref string, refPath string, applicableOnSameInstance bool) (*Schema, error) {
	var stack []schemaRef
	if applicableOnSameInstance {
		stack = ctx.stack
	}
	return ctx.c.compileRef(ctx.r, stack, refPath, ctx.res, ref)
}

// ValidationContext ---

// ValidationContext provides additional context required in validating for extension.
type ValidationContext struct {
	result          validationResult
	validate        func(sch *Schema, schPath string, v interface{}, vpath string) error
	validateInplace func(sch *Schema, schPath string) error
	validationError func(keywordPath string, format string, a ...interface{}) *ValidationError
}

// EvaluatedProp marks given property of object as evaluated.
func (ctx ValidationContext) EvaluatedProp(prop string) {
	delete(ctx.result.unevalProps, prop)
}

// EvaluatedItem marks given index of array as evaluated.
func (ctx ValidationContext) EvaluatedItem(index int) {
	delete(ctx.result.unevalItems, index)
}

// Validate validates schema s with value v. Extension must use this method instead of
// *Schema.ValidateInterface method. This will be useful in implementing keywords like
// allOf/oneOf
//
// spath is relative-json-pointer to s
// vpath is relative-json-pointer to v.
func (ctx ValidationContext) Validate(s *Schema, spath string, v interface{}, vpath string) error {
	if vpath == "" {
		return ctx.validateInplace(s, spath)
	}
	return ctx.validate(s, spath, v, vpath)
}

// Error used to construct validation error by extensions.
//
// keywordPath is relative-json-pointer to keyword.
func (ctx ValidationContext) Error(keywordPath string, format string, a ...interface{}) *ValidationError {
	return ctx.validationError(keywordPath, format, a...)
}

// Group is used by extensions to group multiple errors as causes to parent error.
// This is useful in implementing keywords like allOf where each schema specified
// in allOf can result a validationError.
func (ValidationError) Group(parent *ValidationError, causes ...error) error {
	return parent.add(causes...)
}
