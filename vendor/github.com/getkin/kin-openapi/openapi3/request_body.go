package openapi3

import (
	"context"
	"encoding/json"
	"errors"
)

// RequestBody is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#request-body-object
type RequestBody struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	Description string  `json:"description,omitempty" yaml:"description,omitempty"`
	Required    bool    `json:"required,omitempty" yaml:"required,omitempty"`
	Content     Content `json:"content" yaml:"content"`
}

func NewRequestBody() *RequestBody {
	return &RequestBody{}
}

func (requestBody *RequestBody) WithDescription(value string) *RequestBody {
	requestBody.Description = value
	return requestBody
}

func (requestBody *RequestBody) WithRequired(value bool) *RequestBody {
	requestBody.Required = value
	return requestBody
}

func (requestBody *RequestBody) WithContent(content Content) *RequestBody {
	requestBody.Content = content
	return requestBody
}

func (requestBody *RequestBody) WithSchemaRef(value *SchemaRef, consumes []string) *RequestBody {
	requestBody.Content = NewContentWithSchemaRef(value, consumes)
	return requestBody
}

func (requestBody *RequestBody) WithSchema(value *Schema, consumes []string) *RequestBody {
	requestBody.Content = NewContentWithSchema(value, consumes)
	return requestBody
}

func (requestBody *RequestBody) WithJSONSchemaRef(value *SchemaRef) *RequestBody {
	requestBody.Content = NewContentWithJSONSchemaRef(value)
	return requestBody
}

func (requestBody *RequestBody) WithJSONSchema(value *Schema) *RequestBody {
	requestBody.Content = NewContentWithJSONSchema(value)
	return requestBody
}

func (requestBody *RequestBody) WithFormDataSchemaRef(value *SchemaRef) *RequestBody {
	requestBody.Content = NewContentWithFormDataSchemaRef(value)
	return requestBody
}

func (requestBody *RequestBody) WithFormDataSchema(value *Schema) *RequestBody {
	requestBody.Content = NewContentWithFormDataSchema(value)
	return requestBody
}

func (requestBody *RequestBody) GetMediaType(mediaType string) *MediaType {
	m := requestBody.Content
	if m == nil {
		return nil
	}
	return m[mediaType]
}

// MarshalJSON returns the JSON encoding of RequestBody.
func (requestBody RequestBody) MarshalJSON() ([]byte, error) {
	x, err := requestBody.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of RequestBody.
func (requestBody RequestBody) MarshalYAML() (any, error) {
	m := make(map[string]any, 3+len(requestBody.Extensions))
	for k, v := range requestBody.Extensions {
		m[k] = v
	}
	if x := requestBody.Description; x != "" {
		m["description"] = requestBody.Description
	}
	if x := requestBody.Required; x {
		m["required"] = x
	}
	if x := requestBody.Content; true {
		m["content"] = x
	}
	return m, nil
}

// UnmarshalJSON sets RequestBody to a copy of data.
func (requestBody *RequestBody) UnmarshalJSON(data []byte) error {
	type RequestBodyBis RequestBody
	var x RequestBodyBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, originKey)
	delete(x.Extensions, "description")
	delete(x.Extensions, "required")
	delete(x.Extensions, "content")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*requestBody = RequestBody(x)
	return nil
}

// Validate returns an error if RequestBody does not comply with the OpenAPI spec.
func (requestBody *RequestBody) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if requestBody.Content == nil {
		return errors.New("content of the request body is required")
	}

	if vo := getValidationOptions(ctx); !vo.examplesValidationDisabled {
		vo.examplesValidationAsReq, vo.examplesValidationAsRes = true, false
	}

	if err := requestBody.Content.Validate(ctx); err != nil {
		return err
	}

	return validateExtensions(ctx, requestBody.Extensions)
}

// UnmarshalJSON sets RequestBodies to a copy of data.
func (requestBodies *RequestBodies) UnmarshalJSON(data []byte) (err error) {
	*requestBodies, _, err = unmarshalStringMapP[RequestBodyRef](data)
	return
}
