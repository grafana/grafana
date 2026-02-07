package openapi3

import "context"

// ValidationOption allows the modification of how the OpenAPI document is validated.
type ValidationOption func(options *ValidationOptions)

// ValidationOptions provides configuration for validating OpenAPI documents.
type ValidationOptions struct {
	examplesValidationAsReq, examplesValidationAsRes bool
	examplesValidationDisabled                       bool
	schemaDefaultsValidationDisabled                 bool
	schemaFormatValidationEnabled                    bool
	schemaPatternValidationDisabled                  bool
	schemaExtensionsInRefProhibited                  bool
	regexCompilerFunc                                RegexCompilerFunc
	extraSiblingFieldsAllowed                        map[string]struct{}
}

type validationOptionsKey struct{}

// AllowExtraSiblingFields called as AllowExtraSiblingFields("description") makes Validate not return an error when said field appears next to a $ref.
func AllowExtraSiblingFields(fields ...string) ValidationOption {
	return func(options *ValidationOptions) {
		if options.extraSiblingFieldsAllowed == nil && len(fields) != 0 {
			options.extraSiblingFieldsAllowed = make(map[string]struct{}, len(fields))
		}
		for _, field := range fields {
			options.extraSiblingFieldsAllowed[field] = struct{}{}
		}
	}
}

// EnableSchemaFormatValidation makes Validate not return an error when validating documents that mention schema formats that are not defined by the OpenAPIv3 specification.
// By default, schema format validation is disabled.
func EnableSchemaFormatValidation() ValidationOption {
	return func(options *ValidationOptions) {
		options.schemaFormatValidationEnabled = true
	}
}

// DisableSchemaFormatValidation does the opposite of EnableSchemaFormatValidation.
// By default, schema format validation is disabled.
func DisableSchemaFormatValidation() ValidationOption {
	return func(options *ValidationOptions) {
		options.schemaFormatValidationEnabled = false
	}
}

// EnableSchemaPatternValidation does the opposite of DisableSchemaPatternValidation.
// By default, schema pattern validation is enabled.
func EnableSchemaPatternValidation() ValidationOption {
	return func(options *ValidationOptions) {
		options.schemaPatternValidationDisabled = false
	}
}

// DisableSchemaPatternValidation makes Validate not return an error when validating patterns that are not supported by the Go regexp engine.
func DisableSchemaPatternValidation() ValidationOption {
	return func(options *ValidationOptions) {
		options.schemaPatternValidationDisabled = true
	}
}

// EnableSchemaDefaultsValidation does the opposite of DisableSchemaDefaultsValidation.
// By default, schema default values are validated against their schema.
func EnableSchemaDefaultsValidation() ValidationOption {
	return func(options *ValidationOptions) {
		options.schemaDefaultsValidationDisabled = false
	}
}

// DisableSchemaDefaultsValidation disables schemas' default field validation.
// By default, schema default values are validated against their schema.
func DisableSchemaDefaultsValidation() ValidationOption {
	return func(options *ValidationOptions) {
		options.schemaDefaultsValidationDisabled = true
	}
}

// EnableExamplesValidation does the opposite of DisableExamplesValidation.
// By default, all schema examples are validated.
func EnableExamplesValidation() ValidationOption {
	return func(options *ValidationOptions) {
		options.examplesValidationDisabled = false
	}
}

// DisableExamplesValidation disables all example schema validation.
// By default, all schema examples are validated.
func DisableExamplesValidation() ValidationOption {
	return func(options *ValidationOptions) {
		options.examplesValidationDisabled = true
	}
}

// AllowExtensionsWithRef allows extensions (fields starting with 'x-')
// as siblings for $ref fields. This is the default.
// Non-extension fields are prohibited unless allowed explicitly with the
// AllowExtraSiblingFields option.
func AllowExtensionsWithRef() ValidationOption {
	return func(options *ValidationOptions) {
		options.schemaExtensionsInRefProhibited = false
	}
}

// ProhibitExtensionsWithRef causes the validation to return an
// error if extensions (fields starting with 'x-') are found as
// siblings for $ref fields. Non-extension fields are prohibited
// unless allowed explicitly with the AllowExtraSiblingFields option.
func ProhibitExtensionsWithRef() ValidationOption {
	return func(options *ValidationOptions) {
		options.schemaExtensionsInRefProhibited = true
	}
}

// SetRegexCompiler allows to override the regex implementation used to validate
// field "pattern".
func SetRegexCompiler(c RegexCompilerFunc) ValidationOption {
	return func(options *ValidationOptions) {
		options.regexCompilerFunc = c
	}
}

// WithValidationOptions allows adding validation options to a context object that can be used when validating any OpenAPI type.
func WithValidationOptions(ctx context.Context, opts ...ValidationOption) context.Context {
	if len(opts) == 0 {
		return ctx
	}
	options := &ValidationOptions{}
	for _, opt := range opts {
		opt(options)
	}
	return context.WithValue(ctx, validationOptionsKey{}, options)
}

func getValidationOptions(ctx context.Context) *ValidationOptions {
	if options, ok := ctx.Value(validationOptionsKey{}).(*ValidationOptions); ok {
		return options
	}
	return &ValidationOptions{}
}
