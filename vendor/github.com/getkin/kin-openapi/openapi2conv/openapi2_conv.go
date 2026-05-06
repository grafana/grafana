package openapi2conv

import (
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/getkin/kin-openapi/openapi2"
	"github.com/getkin/kin-openapi/openapi3"
)

// ToV3 converts an OpenAPIv2 spec to an OpenAPIv3 spec
func ToV3(doc2 *openapi2.T) (*openapi3.T, error) {
	return ToV3WithLoader(doc2, openapi3.NewLoader(), nil)
}

func ToV3WithLoader(doc2 *openapi2.T, loader *openapi3.Loader, location *url.URL) (*openapi3.T, error) {
	doc3 := &openapi3.T{
		OpenAPI:      "3.0.3",
		Info:         &doc2.Info,
		Components:   &openapi3.Components{},
		Tags:         doc2.Tags,
		Extensions:   stripNonExtensions(doc2.Extensions),
		ExternalDocs: doc2.ExternalDocs,
	}

	if host := doc2.Host; host != "" {
		if strings.Contains(host, "/") {
			err := fmt.Errorf("invalid host %q. This MUST be the host only and does not include the scheme nor sub-paths.", host)
			return nil, err
		}
		schemes := doc2.Schemes
		if len(schemes) == 0 {
			schemes = []string{"https"}
		}
		basePath := doc2.BasePath
		if basePath == "" {
			basePath = "/"
		}
		for _, scheme := range schemes {
			u := url.URL{
				Scheme: scheme,
				Host:   host,
				Path:   basePath,
			}
			doc3.AddServer(&openapi3.Server{URL: u.String()})
		}
	}

	doc3.Components.Schemas = make(map[string]*openapi3.SchemaRef)
	if parameters := doc2.Parameters; len(parameters) != 0 {
		doc3.Components.Parameters = make(map[string]*openapi3.ParameterRef)
		doc3.Components.RequestBodies = make(map[string]*openapi3.RequestBodyRef)
		for k, parameter := range parameters {
			v3Parameter, v3RequestBody, v3SchemaMap, err := ToV3Parameter(doc3.Components, parameter, doc2.Consumes)
			switch {
			case err != nil:
				return nil, err
			case v3RequestBody != nil:
				doc3.Components.RequestBodies[k] = v3RequestBody
			case v3SchemaMap != nil:
				for _, v3Schema := range v3SchemaMap {
					doc3.Components.Schemas[k] = v3Schema
				}
			default:
				doc3.Components.Parameters[k] = v3Parameter
			}
		}
	}

	if paths := doc2.Paths; len(paths) != 0 {
		doc3.Paths = openapi3.NewPathsWithCapacity(len(paths))
		for path, pathItem := range paths {
			r, err := ToV3PathItem(doc2, doc3.Components, pathItem, doc2.Consumes)
			if err != nil {
				return nil, err
			}
			doc3.Paths.Set(path, r)
		}
	}

	if responses := doc2.Responses; len(responses) != 0 {
		doc3.Components.Responses = make(openapi3.ResponseBodies, len(responses))
		for k, response := range responses {
			r, err := ToV3Response(response, doc2.Produces)
			if err != nil {
				return nil, err
			}
			doc3.Components.Responses[k] = r
		}
	}

	for key, schema := range ToV3Schemas(doc2.Definitions) {
		doc3.Components.Schemas[key] = schema
	}

	if m := doc2.SecurityDefinitions; len(m) != 0 {
		doc3SecuritySchemes := make(map[string]*openapi3.SecuritySchemeRef)
		for k, v := range m {
			r, err := ToV3SecurityScheme(v)
			if err != nil {
				return nil, err
			}
			doc3SecuritySchemes[k] = r
		}
		doc3.Components.SecuritySchemes = doc3SecuritySchemes
	}

	doc3.Security = ToV3SecurityRequirements(doc2.Security)

	if err := loader.ResolveRefsIn(doc3, location); err != nil {
		return nil, err
	}

	return doc3, nil
}

func ToV3PathItem(doc2 *openapi2.T, components *openapi3.Components, pathItem *openapi2.PathItem, consumes []string) (*openapi3.PathItem, error) {
	doc3 := &openapi3.PathItem{
		Extensions: stripNonExtensions(pathItem.Extensions),
	}
	for method, operation := range pathItem.Operations() {
		doc3Operation, err := ToV3Operation(doc2, components, pathItem, operation, consumes)
		if err != nil {
			return nil, err
		}
		doc3.SetOperation(method, doc3Operation)
	}
	for _, parameter := range pathItem.Parameters {
		v3Parameter, v3RequestBody, v3Schema, err := ToV3Parameter(components, parameter, consumes)
		switch {
		case err != nil:
			return nil, err
		case v3RequestBody != nil:
			return nil, errors.New("pathItem must not have a body parameter")
		case v3Schema != nil:
			return nil, errors.New("pathItem must not have a schema parameter")
		default:
			doc3.Parameters = append(doc3.Parameters, v3Parameter)
		}
	}
	return doc3, nil
}

func ToV3Operation(doc2 *openapi2.T, components *openapi3.Components, pathItem *openapi2.PathItem, operation *openapi2.Operation, consumes []string) (*openapi3.Operation, error) {
	if operation == nil {
		return nil, nil
	}
	doc3 := &openapi3.Operation{
		OperationID: operation.OperationID,
		Summary:     operation.Summary,
		Description: operation.Description,
		Deprecated:  operation.Deprecated,
		Tags:        operation.Tags,
		Extensions:  stripNonExtensions(operation.Extensions),
	}
	if v := operation.Security; v != nil {
		doc3Security := ToV3SecurityRequirements(*v)
		doc3.Security = &doc3Security
	}

	if len(operation.Consumes) > 0 {
		consumes = operation.Consumes
	}

	var reqBodies []*openapi3.RequestBodyRef
	formDataSchemas := make(map[string]*openapi3.SchemaRef)
	for _, parameter := range operation.Parameters {
		v3Parameter, v3RequestBody, v3SchemaMap, err := ToV3Parameter(components, parameter, consumes)
		switch {
		case err != nil:
			return nil, err
		case v3RequestBody != nil:
			reqBodies = append(reqBodies, v3RequestBody)
		case v3SchemaMap != nil:
			for key, v3Schema := range v3SchemaMap {
				formDataSchemas[key] = v3Schema
			}
		default:
			doc3.Parameters = append(doc3.Parameters, v3Parameter)
		}
	}
	var err error
	if doc3.RequestBody, err = onlyOneReqBodyParam(reqBodies, formDataSchemas, components, consumes); err != nil {
		return nil, err
	}

	if responses := operation.Responses; responses != nil {
		doc3.Responses = openapi3.NewResponsesWithCapacity(len(responses))
		for k, response := range responses {
			responseRef3, err := ToV3Response(response, operation.Produces)
			if err != nil {
				return nil, err
			}
			doc3.Responses.Set(k, responseRef3)
		}
	}
	return doc3, nil
}

func getParameterNameFromOldRef(ref string) string {
	cleanPath := strings.TrimPrefix(ref, "#/parameters/")
	pathSections := strings.SplitN(cleanPath, "/", 1)

	return pathSections[0]
}

func ToV3Parameter(components *openapi3.Components, parameter *openapi2.Parameter, consumes []string) (*openapi3.ParameterRef, *openapi3.RequestBodyRef, map[string]*openapi3.SchemaRef, error) {
	if ref := parameter.Ref; ref != "" {
		if strings.HasPrefix(ref, "#/parameters/") {
			name := getParameterNameFromOldRef(ref)
			if _, ok := components.RequestBodies[name]; ok {
				v3Ref := strings.Replace(ref, "#/parameters/", "#/components/requestBodies/", 1)
				return nil, &openapi3.RequestBodyRef{Ref: v3Ref}, nil, nil
			} else if schema, ok := components.Schemas[name]; ok {
				schemaRefMap := make(map[string]*openapi3.SchemaRef)
				if val, ok := schema.Value.Extensions["x-formData-name"]; ok {
					name = val.(string)
				}
				v3Ref := strings.Replace(ref, "#/parameters/", "#/components/schemas/", 1)
				schemaRefMap[name] = &openapi3.SchemaRef{Ref: v3Ref}
				return nil, nil, schemaRefMap, nil
			}
		}
		return &openapi3.ParameterRef{Ref: ToV3Ref(ref)}, nil, nil, nil
	}

	switch parameter.In {
	case "body":
		result := &openapi3.RequestBody{
			Description: parameter.Description,
			Required:    parameter.Required,
			Extensions:  stripNonExtensions(parameter.Extensions),
		}
		if parameter.Name != "" {
			if result.Extensions == nil {
				result.Extensions = make(map[string]any, 1)
			}
			result.Extensions["x-originalParamName"] = parameter.Name
		}

		if schemaRef := parameter.Schema; schemaRef != nil {
			result.WithSchemaRef(ToV3SchemaRef(schemaRef), consumes)
		}
		return nil, &openapi3.RequestBodyRef{Value: result}, nil, nil

	case "formData":
		format, typ := parameter.Format, parameter.Type
		if typ.Is("file") {
			format, typ = "binary", &openapi3.Types{"string"}
		}
		if parameter.Extensions == nil {
			parameter.Extensions = make(map[string]any, 1)
		}
		parameter.Extensions["x-formData-name"] = parameter.Name
		var required []string
		if parameter.Required {
			required = []string{parameter.Name}
		}
		schemaRef := &openapi3.SchemaRef{Value: &openapi3.Schema{
			Description:     parameter.Description,
			Type:            typ,
			Extensions:      stripNonExtensions(parameter.Extensions),
			Format:          format,
			Enum:            parameter.Enum,
			Min:             parameter.Minimum,
			Max:             parameter.Maximum,
			ExclusiveMin:    parameter.ExclusiveMin,
			ExclusiveMax:    parameter.ExclusiveMax,
			MinLength:       parameter.MinLength,
			MaxLength:       parameter.MaxLength,
			Default:         parameter.Default,
			MinItems:        parameter.MinItems,
			MaxItems:        parameter.MaxItems,
			Pattern:         parameter.Pattern,
			AllowEmptyValue: parameter.AllowEmptyValue,
			UniqueItems:     parameter.UniqueItems,
			MultipleOf:      parameter.MultipleOf,
			Required:        required,
		}}
		if parameter.Items != nil {
			schemaRef.Value.Items = ToV3SchemaRef(parameter.Items)
		}

		schemaRefMap := make(map[string]*openapi3.SchemaRef, 1)
		schemaRefMap[parameter.Name] = schemaRef
		return nil, nil, schemaRefMap, nil

	default:
		required := parameter.Required
		if parameter.In == openapi3.ParameterInPath {
			required = true
		}

		var schemaRefRef string
		if schemaRef := parameter.Schema; schemaRef != nil && schemaRef.Ref != "" {
			schemaRefRef = schemaRef.Ref
		}
		result := &openapi3.Parameter{
			In:          parameter.In,
			Name:        parameter.Name,
			Description: parameter.Description,
			Required:    required,
			Extensions:  stripNonExtensions(parameter.Extensions),
			Schema: ToV3SchemaRef(&openapi2.SchemaRef{Value: &openapi2.Schema{
				Type:            parameter.Type,
				Format:          parameter.Format,
				Enum:            parameter.Enum,
				Min:             parameter.Minimum,
				Max:             parameter.Maximum,
				ExclusiveMin:    parameter.ExclusiveMin,
				ExclusiveMax:    parameter.ExclusiveMax,
				MinLength:       parameter.MinLength,
				MaxLength:       parameter.MaxLength,
				Default:         parameter.Default,
				Items:           parameter.Items,
				MinItems:        parameter.MinItems,
				MaxItems:        parameter.MaxItems,
				Pattern:         parameter.Pattern,
				AllowEmptyValue: parameter.AllowEmptyValue,
				UniqueItems:     parameter.UniqueItems,
				MultipleOf:      parameter.MultipleOf,
			},
				Ref: schemaRefRef,
			}),
		}
		return &openapi3.ParameterRef{Value: result}, nil, nil, nil
	}
}

func formDataBody(bodies map[string]*openapi3.SchemaRef, reqs map[string]bool, consumes []string) *openapi3.RequestBodyRef {
	if len(bodies) != len(reqs) {
		panic(`request bodies and them being required must match`)
	}
	requireds := make([]string, 0, len(reqs))
	for propName, req := range reqs {
		if _, ok := bodies[propName]; !ok {
			panic(`request bodies and them being required must match`)
		}
		if req {
			requireds = append(requireds, propName)
		}
	}
	for s, ref := range bodies {
		if ref.Value != nil && len(ref.Value.Required) > 0 {
			ref.Value.Required = nil
			bodies[s] = ref
		}
	}
	sort.Strings(requireds)
	schema := &openapi3.Schema{
		Type:       &openapi3.Types{"object"},
		Properties: bodies,
		Required:   requireds,
	}
	return &openapi3.RequestBodyRef{
		Value: openapi3.NewRequestBody().WithSchema(schema, consumes),
	}
}

func getParameterNameFromNewRef(ref string) string {
	cleanPath := strings.TrimPrefix(ref, "#/components/schemas/")
	pathSections := strings.SplitN(cleanPath, "/", 1)

	return pathSections[0]
}

func onlyOneReqBodyParam(bodies []*openapi3.RequestBodyRef, formDataSchemas map[string]*openapi3.SchemaRef, components *openapi3.Components, consumes []string) (*openapi3.RequestBodyRef, error) {
	if len(bodies) > 1 {
		return nil, errors.New("multiple body parameters cannot exist for the same operation")
	}

	if len(bodies) != 0 && len(formDataSchemas) != 0 {
		return nil, errors.New("body and form parameters cannot exist together for the same operation")
	}

	for _, requestBodyRef := range bodies {
		return requestBodyRef, nil
	}

	if len(formDataSchemas) > 0 {
		formDataParams := make(map[string]*openapi3.SchemaRef, len(formDataSchemas))
		formDataReqs := make(map[string]bool, len(formDataSchemas))
		for formDataName, formDataSchema := range formDataSchemas {
			if formDataSchema.Ref != "" {
				name := getParameterNameFromNewRef(formDataSchema.Ref)
				if schema := components.Schemas[name]; schema != nil && schema.Value != nil {
					if tempName, ok := schema.Value.Extensions["x-formData-name"]; ok {
						name = tempName.(string)
					}
					formDataParams[name] = formDataSchema
					formDataReqs[name] = false
					for _, req := range schema.Value.Required {
						if name == req {
							formDataReqs[name] = true
						}
					}
				}
			} else if formDataSchema.Value != nil {
				formDataParams[formDataName] = formDataSchema
				formDataReqs[formDataName] = false
				for _, req := range formDataSchema.Value.Required {
					if formDataName == req {
						formDataReqs[formDataName] = true
					}
				}
			}
		}

		return formDataBody(formDataParams, formDataReqs, consumes), nil
	}

	return nil, nil
}

func ToV3Response(response *openapi2.Response, produces []string) (*openapi3.ResponseRef, error) {
	if ref := response.Ref; ref != "" {
		return &openapi3.ResponseRef{Ref: ToV3Ref(ref)}, nil
	}
	result := &openapi3.Response{
		Description: &response.Description,
		Extensions:  stripNonExtensions(response.Extensions),
	}

	// Default to "application/json" if "produces" is not specified.
	if len(produces) == 0 {
		produces = []string{"application/json"}
	}

	if schemaRef := response.Schema; schemaRef != nil {
		schema := ToV3SchemaRef(schemaRef)
		result.Content = make(openapi3.Content, len(produces))
		for _, mime := range produces {
			result.Content[mime] = openapi3.NewMediaType().WithSchemaRef(schema)
		}
	}
	if headers := response.Headers; len(headers) > 0 {
		result.Headers = ToV3Headers(headers)
	}
	return &openapi3.ResponseRef{Value: result}, nil
}

func ToV3Headers(defs map[string]*openapi2.Header) openapi3.Headers {
	headers := make(openapi3.Headers, len(defs))
	for name, header := range defs {
		header.In = ""
		header.Name = ""
		if ref := header.Ref; ref != "" {
			headers[name] = &openapi3.HeaderRef{Ref: ToV3Ref(ref)}
		} else {
			parameter, _, _, _ := ToV3Parameter(nil, &header.Parameter, nil)
			headers[name] = &openapi3.HeaderRef{Value: &openapi3.Header{
				Parameter: *parameter.Value,
			}}
		}
	}
	return headers
}

func ToV3Schemas(defs map[string]*openapi2.SchemaRef) map[string]*openapi3.SchemaRef {
	schemas := make(map[string]*openapi3.SchemaRef, len(defs))
	for name, schema := range defs {
		schemas[name] = ToV3SchemaRef(schema)
	}
	return schemas
}

func ToV3SchemaRef(schema *openapi2.SchemaRef) *openapi3.SchemaRef {
	if schema == nil {
		return &openapi3.SchemaRef{}
	}

	if ref := schema.Ref; ref != "" {
		return &openapi3.SchemaRef{Ref: ToV3Ref(ref)}
	}

	if schema.Value == nil {
		return &openapi3.SchemaRef{
			Extensions: schema.Extensions,
		}
	}

	v3Schema := &openapi3.Schema{
		Extensions:           schema.Extensions,
		Type:                 schema.Value.Type,
		Title:                schema.Value.Title,
		Format:               schema.Value.Format,
		Description:          schema.Value.Description,
		Enum:                 schema.Value.Enum,
		Default:              schema.Value.Default,
		Example:              schema.Value.Example,
		ExternalDocs:         schema.Value.ExternalDocs,
		UniqueItems:          schema.Value.UniqueItems,
		ExclusiveMin:         schema.Value.ExclusiveMin,
		ExclusiveMax:         schema.Value.ExclusiveMax,
		ReadOnly:             schema.Value.ReadOnly,
		WriteOnly:            schema.Value.WriteOnly,
		AllowEmptyValue:      schema.Value.AllowEmptyValue,
		Deprecated:           schema.Value.Deprecated,
		XML:                  schema.Value.XML,
		Min:                  schema.Value.Min,
		Max:                  schema.Value.Max,
		MultipleOf:           schema.Value.MultipleOf,
		MinLength:            schema.Value.MinLength,
		MaxLength:            schema.Value.MaxLength,
		Pattern:              schema.Value.Pattern,
		MinItems:             schema.Value.MinItems,
		MaxItems:             schema.Value.MaxItems,
		Required:             schema.Value.Required,
		MinProps:             schema.Value.MinProps,
		MaxProps:             schema.Value.MaxProps,
		AllOf:                make(openapi3.SchemaRefs, len(schema.Value.AllOf)),
		Properties:           make(openapi3.Schemas),
		AdditionalProperties: toV3AdditionalProperties(schema.Value.AdditionalProperties),
	}

	if schema.Value.Discriminator != "" {
		v3Schema.Discriminator = &openapi3.Discriminator{
			PropertyName: schema.Value.Discriminator,
		}
	}

	if schema.Value.Items != nil {
		v3Schema.Items = ToV3SchemaRef(schema.Value.Items)
	}
	if schema.Value.Type.Is("file") {
		v3Schema.Format, v3Schema.Type = "binary", &openapi3.Types{"string"}
	}
	for k, v := range schema.Value.Properties {
		v3Schema.Properties[k] = ToV3SchemaRef(v)
	}
	for i, v := range schema.Value.AllOf {
		v3Schema.AllOf[i] = ToV3SchemaRef(v)
	}
	if val, ok := schema.Value.Extensions["x-nullable"]; ok {
		if nullable, valid := val.(bool); valid {
			v3Schema.Nullable = nullable
			delete(v3Schema.Extensions, "x-nullable")
		}
	}

	return &openapi3.SchemaRef{
		Extensions: schema.Extensions,
		Value:      v3Schema,
	}
}

func toV3AdditionalProperties(from openapi3.AdditionalProperties) openapi3.AdditionalProperties {
	return openapi3.AdditionalProperties{
		Has:    from.Has,
		Schema: convertRefsInV3SchemaRef(from.Schema),
	}
}

func convertRefsInV3SchemaRef(from *openapi3.SchemaRef) *openapi3.SchemaRef {
	if from == nil {
		return nil
	}
	to := *from
	to.Ref = ToV3Ref(to.Ref)
	if to.Value != nil {
		v := *from.Value
		to.Value = &v
		if to.Value.Items != nil {
			to.Value.Items.Ref = ToV3Ref(to.Value.Items.Ref)
		}
		to.Value.AdditionalProperties = toV3AdditionalProperties(to.Value.AdditionalProperties)
	}
	return &to
}

var ref2To3 = map[string]string{
	"#/definitions/": "#/components/schemas/",
	"#/responses/":   "#/components/responses/",
	"#/parameters/":  "#/components/parameters/",
}

func ToV3Ref(ref string) string {
	for old, new := range ref2To3 {
		if strings.HasPrefix(ref, old) {
			ref = strings.Replace(ref, old, new, 1)
		}
	}
	return ref
}

func FromV3Ref(ref string) string {
	for new, old := range ref2To3 {
		if strings.HasPrefix(ref, old) {
			ref = strings.Replace(ref, old, new, 1)
		} else if strings.HasPrefix(ref, "#/components/requestBodies/") {
			ref = strings.Replace(ref, "#/components/requestBodies/", "#/parameters/", 1)
		}
	}
	return ref
}

func ToV3SecurityRequirements(requirements openapi2.SecurityRequirements) openapi3.SecurityRequirements {
	if requirements == nil {
		return nil
	}
	result := make(openapi3.SecurityRequirements, len(requirements))
	for i, item := range requirements {
		result[i] = item
	}
	return result
}

func ToV3SecurityScheme(securityScheme *openapi2.SecurityScheme) (*openapi3.SecuritySchemeRef, error) {
	if securityScheme == nil {
		return nil, nil
	}
	result := &openapi3.SecurityScheme{
		Description: securityScheme.Description,
		Extensions:  stripNonExtensions(securityScheme.Extensions),
	}
	switch securityScheme.Type {
	case "basic":
		result.Type = "http"
		result.Scheme = "basic"
	case "apiKey":
		result.Type = "apiKey"
		result.In = securityScheme.In
		result.Name = securityScheme.Name
	case "oauth2":
		result.Type = "oauth2"
		flows := &openapi3.OAuthFlows{}
		result.Flows = flows
		scopesMap := make(map[string]string)
		for scope, desc := range securityScheme.Scopes {
			scopesMap[scope] = desc
		}
		flow := &openapi3.OAuthFlow{
			AuthorizationURL: securityScheme.AuthorizationURL,
			TokenURL:         securityScheme.TokenURL,
			Scopes:           scopesMap,
		}
		switch securityScheme.Flow {
		case "implicit":
			flows.Implicit = flow
		case "accessCode":
			flows.AuthorizationCode = flow
		case "password":
			flows.Password = flow
		case "application":
			flows.ClientCredentials = flow
		default:
			return nil, fmt.Errorf("unsupported flow %q", securityScheme.Flow)
		}
	}
	return &openapi3.SecuritySchemeRef{
		Ref:   ToV3Ref(securityScheme.Ref),
		Value: result,
	}, nil
}

// FromV3 converts an OpenAPIv3 spec to an OpenAPIv2 spec
func FromV3(doc3 *openapi3.T) (*openapi2.T, error) {
	doc2Responses, err := FromV3Responses(doc3.Components.Responses, doc3.Components)
	if err != nil {
		return nil, err
	}
	schemas, parameters := FromV3Schemas(doc3.Components.Schemas, doc3.Components)
	doc2 := &openapi2.T{
		Swagger:      "2.0",
		Info:         *doc3.Info,
		Definitions:  schemas,
		Parameters:   parameters,
		Responses:    doc2Responses,
		Tags:         doc3.Tags,
		Extensions:   stripNonExtensions(doc3.Extensions),
		ExternalDocs: doc3.ExternalDocs,
	}

	isHTTPS := false
	isHTTP := false
	servers := doc3.Servers
	for i, server := range servers {
		parsedURL, err := url.Parse(server.URL)
		if err == nil {
			// See which schemes seem to be supported
			if parsedURL.Scheme == "https" {
				isHTTPS = true
			} else if parsedURL.Scheme == "http" {
				isHTTP = true
			}
			// The first server is assumed to provide the base path
			if i == 0 {
				doc2.Host = parsedURL.Host
				doc2.BasePath = parsedURL.Path
			}
		}
	}

	if isHTTPS {
		doc2.Schemes = append(doc2.Schemes, "https")
	}
	if isHTTP {
		doc2.Schemes = append(doc2.Schemes, "http")
	}

	for path, pathItem := range doc3.Paths.Map() {
		if pathItem == nil {
			continue
		}
		doc2.AddOperation(path, "GET", nil)
		addPathExtensions(doc2, path, stripNonExtensions(pathItem.Extensions))
		for method, operation := range pathItem.Operations() {
			if operation == nil {
				continue
			}
			doc2Operation, err := FromV3Operation(doc3, operation)
			if err != nil {
				return nil, err
			}
			doc2.AddOperation(path, method, doc2Operation)
		}
		params := openapi2.Parameters{}
		for _, param := range pathItem.Parameters {
			p, err := FromV3Parameter(param, doc3.Components)
			if err != nil {
				return nil, err
			}
			params = append(params, p)
		}
		sort.Sort(params)
		doc2.Paths[path].Parameters = params
	}

	for name, param := range doc3.Components.Parameters {
		if doc2.Parameters[name], err = FromV3Parameter(param, doc3.Components); err != nil {
			return nil, err
		}
	}

	for name, requestBodyRef := range doc3.Components.RequestBodies {
		bodyOrRefParameters, formDataParameters, consumes, err := fromV3RequestBodies(name, requestBodyRef, doc3.Components)
		if err != nil {
			return nil, err
		}
		if len(formDataParameters) != 0 {
			for _, param := range formDataParameters {
				doc2.Parameters[param.Name] = param
			}
		} else if len(bodyOrRefParameters) != 0 {
			for _, param := range bodyOrRefParameters {
				doc2.Parameters[name] = param
			}
		}

		if len(consumes) != 0 {
			doc2.Consumes = consumesToArray(consumes)
		}
	}

	if m := doc3.Components.SecuritySchemes; m != nil {
		doc2SecuritySchemes := make(map[string]*openapi2.SecurityScheme)
		for id, securityScheme := range m {
			v, err := FromV3SecurityScheme(doc3, securityScheme)
			if err != nil {
				return nil, err
			}
			doc2SecuritySchemes[id] = v
		}
		doc2.SecurityDefinitions = doc2SecuritySchemes
	}
	doc2.Security = FromV3SecurityRequirements(doc3.Security)

	return doc2, nil
}

func consumesToArray(consumes map[string]struct{}) []string {
	consumesArr := make([]string, 0, len(consumes))
	for key := range consumes {
		consumesArr = append(consumesArr, key)
	}
	sort.Strings(consumesArr)
	return consumesArr
}

func fromV3RequestBodies(name string, requestBodyRef *openapi3.RequestBodyRef, components *openapi3.Components) (
	bodyOrRefParameters openapi2.Parameters,
	formParameters openapi2.Parameters,
	consumes map[string]struct{},
	err error,
) {
	if ref := requestBodyRef.Ref; ref != "" {
		bodyOrRefParameters = append(bodyOrRefParameters, &openapi2.Parameter{Ref: FromV3Ref(ref)})
		return
	}

	// Only select one formData or request body for an individual requestBody as OpenAPI 2 does not support multiples
	if requestBodyRef.Value != nil {
		for contentType, mediaType := range requestBodyRef.Value.Content {
			if consumes == nil {
				consumes = make(map[string]struct{})
			}
			consumes[contentType] = struct{}{}
			if contentType == "application/x-www-form-urlencoded" || contentType == "multipart/form-data" {
				formParameters = FromV3RequestBodyFormData(mediaType)
				continue
			}

			paramName := name
			if originalName, ok := requestBodyRef.Value.Extensions["x-originalParamName"]; ok {
				paramName = originalName.(string)
			}

			var r *openapi2.Parameter
			if r, err = FromV3RequestBody(paramName, requestBodyRef, mediaType, components); err != nil {
				return
			}

			bodyOrRefParameters = append(bodyOrRefParameters, r)
		}
	}
	return
}

func FromV3Schemas(schemas map[string]*openapi3.SchemaRef, components *openapi3.Components) (map[string]*openapi2.SchemaRef, map[string]*openapi2.Parameter) {
	v2Defs := make(map[string]*openapi2.SchemaRef)
	v2Params := make(map[string]*openapi2.Parameter)
	for name, schema := range schemas {
		schemaConv, parameterConv := FromV3SchemaRef(schema, components)
		if schemaConv != nil {
			v2Defs[name] = schemaConv
		} else if parameterConv != nil {
			if parameterConv.Name == "" {
				parameterConv.Name = name
			}
			v2Params[name] = parameterConv
		}
	}
	return v2Defs, v2Params
}

func FromV3SchemaRef(schema *openapi3.SchemaRef, components *openapi3.Components) (*openapi2.SchemaRef, *openapi2.Parameter) {
	if ref := schema.Ref; ref != "" {
		name := getParameterNameFromNewRef(ref)
		if val, ok := components.Schemas[name]; ok {
			if val.Value.Format == "binary" {
				v2Ref := strings.Replace(ref, "#/components/schemas/", "#/parameters/", 1)
				return nil, &openapi2.Parameter{Ref: v2Ref}
			}
		}

		return &openapi2.SchemaRef{Ref: FromV3Ref(ref)}, nil
	}
	if schema.Value == nil {
		return &openapi2.SchemaRef{
			Extensions: schema.Extensions,
		}, nil
	}

	if schema.Value != nil {
		if schema.Value.Type.Is("string") && schema.Value.Format == "binary" {
			paramType := &openapi3.Types{"file"}
			required := false

			value, _ := schema.Value.Extensions["x-formData-name"]
			originalName, _ := value.(string)
			for _, prop := range schema.Value.Required {
				if originalName == prop {
					required = true
					break
				}
			}
			return nil, &openapi2.Parameter{
				In:           "formData",
				Name:         originalName,
				Description:  schema.Value.Description,
				Type:         paramType,
				Enum:         schema.Value.Enum,
				Minimum:      schema.Value.Min,
				Maximum:      schema.Value.Max,
				ExclusiveMin: schema.Value.ExclusiveMin,
				ExclusiveMax: schema.Value.ExclusiveMax,
				MinLength:    schema.Value.MinLength,
				MaxLength:    schema.Value.MaxLength,
				Default:      schema.Value.Default,
				// Items:           schema.Value.Items,
				MinItems:        schema.Value.MinItems,
				MaxItems:        schema.Value.MaxItems,
				AllowEmptyValue: schema.Value.AllowEmptyValue,
				UniqueItems:     schema.Value.UniqueItems,
				MultipleOf:      schema.Value.MultipleOf,
				Extensions:      stripNonExtensions(schema.Value.Extensions),
				Required:        required,
			}
		}
	}

	v2Schema := &openapi2.Schema{
		Extensions:           schema.Value.Extensions,
		Type:                 schema.Value.Type,
		Title:                schema.Value.Title,
		Format:               schema.Value.Format,
		Description:          schema.Value.Description,
		Enum:                 schema.Value.Enum,
		Default:              schema.Value.Default,
		Example:              schema.Value.Example,
		ExternalDocs:         schema.Value.ExternalDocs,
		UniqueItems:          schema.Value.UniqueItems,
		ExclusiveMin:         schema.Value.ExclusiveMin,
		ExclusiveMax:         schema.Value.ExclusiveMax,
		ReadOnly:             schema.Value.ReadOnly,
		WriteOnly:            schema.Value.WriteOnly,
		AllowEmptyValue:      schema.Value.AllowEmptyValue,
		Deprecated:           schema.Value.Deprecated,
		XML:                  schema.Value.XML,
		Min:                  schema.Value.Min,
		Max:                  schema.Value.Max,
		MultipleOf:           schema.Value.MultipleOf,
		MinLength:            schema.Value.MinLength,
		MaxLength:            schema.Value.MaxLength,
		Pattern:              schema.Value.Pattern,
		MinItems:             schema.Value.MinItems,
		MaxItems:             schema.Value.MaxItems,
		Required:             schema.Value.Required,
		MinProps:             schema.Value.MinProps,
		MaxProps:             schema.Value.MaxProps,
		Properties:           make(openapi2.Schemas),
		AllOf:                make(openapi2.SchemaRefs, len(schema.Value.AllOf)),
		AdditionalProperties: schema.Value.AdditionalProperties,
	}

	if v := schema.Value.Items; v != nil {
		v2Schema.Items, _ = FromV3SchemaRef(v, components)
	}

	keys := make([]string, 0, len(schema.Value.Properties))
	for k := range schema.Value.Properties {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, key := range keys {
		property, _ := FromV3SchemaRef(schema.Value.Properties[key], components)
		if property != nil {
			v2Schema.Properties[key] = property
		}
	}

	for i, v := range schema.Value.AllOf {
		v2Schema.AllOf[i], _ = FromV3SchemaRef(v, components)
	}
	if schema.Value.PermitsNull() {
		schema.Value.Nullable = false
		if schema.Value.Extensions == nil {
			v2Schema.Extensions = make(map[string]any)
		}
		v2Schema.Extensions["x-nullable"] = true
	}

	return &openapi2.SchemaRef{
		Extensions: schema.Extensions,
		Value:      v2Schema,
	}, nil
}

func FromV3SecurityRequirements(requirements openapi3.SecurityRequirements) openapi2.SecurityRequirements {
	if requirements == nil {
		return nil
	}
	result := make([]map[string][]string, 0, len(requirements))
	for _, item := range requirements {
		result = append(result, item)
	}
	return result
}

func FromV3PathItem(doc3 *openapi3.T, pathItem *openapi3.PathItem) (*openapi2.PathItem, error) {
	result := &openapi2.PathItem{
		Extensions: stripNonExtensions(pathItem.Extensions),
	}
	for method, operation := range pathItem.Operations() {
		r, err := FromV3Operation(doc3, operation)
		if err != nil {
			return nil, err
		}
		result.SetOperation(method, r)
	}
	for _, parameter := range pathItem.Parameters {
		p, err := FromV3Parameter(parameter, doc3.Components)
		if err != nil {
			return nil, err
		}
		result.Parameters = append(result.Parameters, p)
	}
	return result, nil
}

func findNameForRequestBody(operation *openapi3.Operation) string {
nameSearch:
	for _, name := range attemptedBodyParameterNames {
		for _, parameterRef := range operation.Parameters {
			parameter := parameterRef.Value
			if parameter != nil && parameter.Name == name {
				continue nameSearch
			}
		}
		return name
	}
	return ""
}

func FromV3RequestBodyFormData(mediaType *openapi3.MediaType) openapi2.Parameters {
	parameters := openapi2.Parameters{}
	for propName, schemaRef := range mediaType.Schema.Value.Properties {
		if ref := schemaRef.Ref; ref != "" {
			v2Ref := strings.Replace(ref, "#/components/schemas/", "#/parameters/", 1)
			parameters = append(parameters, &openapi2.Parameter{Ref: v2Ref})
			continue
		}
		val := schemaRef.Value
		typ := val.Type
		if val.Format == "binary" {
			typ = &openapi3.Types{"file"}
		}
		required := false
		for _, name := range val.Required {
			if name == propName {
				required = true
				break
			}
		}

		var v2Items *openapi2.SchemaRef
		if val.Items != nil {
			v2Items, _ = FromV3SchemaRef(val.Items, nil)
		}
		parameter := &openapi2.Parameter{
			Name:         propName,
			Description:  val.Description,
			Type:         typ,
			In:           "formData",
			Extensions:   stripNonExtensions(val.Extensions),
			Enum:         val.Enum,
			ExclusiveMin: val.ExclusiveMin,
			ExclusiveMax: val.ExclusiveMax,
			MinLength:    val.MinLength,
			MaxLength:    val.MaxLength,
			Default:      val.Default,
			Items:        v2Items,
			MinItems:     val.MinItems,
			MaxItems:     val.MaxItems,
			Maximum:      val.Max,
			Minimum:      val.Min,
			Pattern:      val.Pattern,
			// CollectionFormat: val.CollectionFormat,
			// Format:          val.Format,
			AllowEmptyValue: val.AllowEmptyValue,
			Required:        required,
			UniqueItems:     val.UniqueItems,
			MultipleOf:      val.MultipleOf,
		}
		parameters = append(parameters, parameter)
	}
	return parameters
}

func FromV3Operation(doc3 *openapi3.T, operation *openapi3.Operation) (*openapi2.Operation, error) {
	if operation == nil {
		return nil, nil
	}
	result := &openapi2.Operation{
		OperationID: operation.OperationID,
		Summary:     operation.Summary,
		Description: operation.Description,
		Deprecated:  operation.Deprecated,
		Tags:        operation.Tags,
		Extensions:  stripNonExtensions(operation.Extensions),
	}
	if v := operation.Security; v != nil {
		resultSecurity := FromV3SecurityRequirements(*v)
		result.Security = &resultSecurity
	}
	for _, parameter := range operation.Parameters {
		r, err := FromV3Parameter(parameter, doc3.Components)
		if err != nil {
			return nil, err
		}
		result.Parameters = append(result.Parameters, r)
	}
	if v := operation.RequestBody; v != nil {
		// Find parameter name that we can use for the body
		name := findNameForRequestBody(operation)
		if name == "" {
			return nil, errors.New("could not find a name for request body")
		}

		bodyOrRefParameters, formDataParameters, consumes, err := fromV3RequestBodies(name, v, doc3.Components)
		if err != nil {
			return nil, err
		}
		if len(formDataParameters) != 0 {
			result.Parameters = append(result.Parameters, formDataParameters...)
		} else if len(bodyOrRefParameters) != 0 {
			for _, param := range bodyOrRefParameters {
				result.Parameters = append(result.Parameters, param)
				break // add a single request body
			}

		}

		if len(consumes) != 0 {
			result.Consumes = consumesToArray(consumes)
		}
	}
	sort.Sort(result.Parameters)

	if responses := operation.Responses; responses != nil {
		resultResponses, err := FromV3Responses(responses.Map(), doc3.Components)
		if err != nil {
			return nil, err
		}
		result.Responses = resultResponses
	}
	return result, nil
}

func FromV3RequestBody(name string, requestBodyRef *openapi3.RequestBodyRef, mediaType *openapi3.MediaType, components *openapi3.Components) (*openapi2.Parameter, error) {
	requestBody := requestBodyRef.Value

	result := &openapi2.Parameter{
		In:          "body",
		Name:        name,
		Description: requestBody.Description,
		Required:    requestBody.Required,
		Extensions:  stripNonExtensions(requestBody.Extensions),
	}

	if mediaType != nil {
		result.Schema, _ = FromV3SchemaRef(mediaType.Schema, components)
	}
	return result, nil
}

func FromV3Parameter(ref *openapi3.ParameterRef, components *openapi3.Components) (*openapi2.Parameter, error) {
	if ref := ref.Ref; ref != "" {
		return &openapi2.Parameter{Ref: FromV3Ref(ref)}, nil
	}
	parameter := ref.Value
	if parameter == nil {
		return nil, nil
	}
	result := &openapi2.Parameter{
		Description: parameter.Description,
		In:          parameter.In,
		Name:        parameter.Name,
		Required:    parameter.Required,
		Extensions:  stripNonExtensions(parameter.Extensions),
	}
	if schemaRef := parameter.Schema; schemaRef != nil {
		schemaRefV2, _ := FromV3SchemaRef(schemaRef, components)
		if ref := schemaRefV2.Ref; ref != "" {
			result.Schema = &openapi2.SchemaRef{Ref: FromV3Ref(ref)}
			return result, nil
		}
		schema := schemaRefV2.Value
		result.Type = schema.Type
		result.Format = schema.Format
		result.Enum = schema.Enum
		result.Minimum = schema.Min
		result.Maximum = schema.Max
		result.ExclusiveMin = schema.ExclusiveMin
		result.ExclusiveMax = schema.ExclusiveMax
		result.MinLength = schema.MinLength
		result.MaxLength = schema.MaxLength
		result.Pattern = schema.Pattern
		result.Default = schema.Default
		result.Items = schema.Items
		result.MinItems = schema.MinItems
		result.MaxItems = schema.MaxItems
		result.AllowEmptyValue = schema.AllowEmptyValue
		// result.CollectionFormat = schema.CollectionFormat
		result.UniqueItems = schema.UniqueItems
		result.MultipleOf = schema.MultipleOf
	}
	return result, nil
}

func FromV3Responses(responses map[string]*openapi3.ResponseRef, components *openapi3.Components) (map[string]*openapi2.Response, error) {
	v2Responses := make(map[string]*openapi2.Response, len(responses))
	for k, response := range responses {
		r, err := FromV3Response(response, components)
		if err != nil {
			return nil, err
		}
		v2Responses[k] = r
	}
	return v2Responses, nil
}

func FromV3Response(ref *openapi3.ResponseRef, components *openapi3.Components) (*openapi2.Response, error) {
	if ref := ref.Ref; ref != "" {
		return &openapi2.Response{Ref: FromV3Ref(ref)}, nil
	}

	response := ref.Value
	if response == nil {
		return nil, nil
	}
	description := ""
	if desc := response.Description; desc != nil {
		description = *desc
	}
	result := &openapi2.Response{
		Description: description,
		Extensions:  stripNonExtensions(response.Extensions),
	}
	if content := response.Content; content != nil {
		if ct := content["application/json"]; ct != nil {
			result.Schema, _ = FromV3SchemaRef(ct.Schema, components)
		}
	}
	if headers := response.Headers; len(headers) > 0 {
		var err error
		if result.Headers, err = FromV3Headers(headers, components); err != nil {
			return nil, err
		}
	}
	return result, nil
}

func FromV3Headers(defs openapi3.Headers, components *openapi3.Components) (map[string]*openapi2.Header, error) {
	headers := make(map[string]*openapi2.Header, len(defs))
	for name, header := range defs {
		ref := openapi3.ParameterRef{Ref: header.Ref, Value: &header.Value.Parameter}
		parameter, err := FromV3Parameter(&ref, components)
		if err != nil {
			return nil, err
		}
		parameter.In = ""
		parameter.Name = ""
		headers[name] = &openapi2.Header{Parameter: *parameter}
	}
	return headers, nil
}

func FromV3SecurityScheme(doc3 *openapi3.T, ref *openapi3.SecuritySchemeRef) (*openapi2.SecurityScheme, error) {
	securityScheme := ref.Value
	if securityScheme == nil {
		return nil, nil
	}
	result := &openapi2.SecurityScheme{
		Ref:         FromV3Ref(ref.Ref),
		Description: securityScheme.Description,
		Extensions:  stripNonExtensions(securityScheme.Extensions),
	}
	switch securityScheme.Type {
	case "http":
		switch securityScheme.Scheme {
		case "basic":
			result.Type = "basic"
		default:
			result.Type = "apiKey"
			result.In = "header"
			result.Name = "Authorization"
		}
	case "apiKey":
		result.Type = "apiKey"
		result.In = securityScheme.In
		result.Name = securityScheme.Name
	case "oauth2":
		result.Type = "oauth2"
		flows := securityScheme.Flows
		if flows != nil {
			var flow *openapi3.OAuthFlow
			// TODO: Is this the right priority? What if multiple defined?
			switch {
			case flows.Implicit != nil:
				result.Flow = "implicit"
				flow = flows.Implicit
				result.AuthorizationURL = flow.AuthorizationURL

			case flows.AuthorizationCode != nil:
				result.Flow = "accessCode"
				flow = flows.AuthorizationCode
				result.AuthorizationURL = flow.AuthorizationURL
				result.TokenURL = flow.TokenURL

			case flows.Password != nil:
				result.Flow = "password"
				flow = flows.Password
				result.TokenURL = flow.TokenURL

			case flows.ClientCredentials != nil:
				result.Flow = "application"
				flow = flows.ClientCredentials
				result.TokenURL = flow.TokenURL

			default:
				return nil, nil
			}

			result.Scopes = make(map[string]string, len(flow.Scopes))
			for scope, desc := range flow.Scopes {
				result.Scopes[scope] = desc
			}
		}
	default:
		return nil, fmt.Errorf("unsupported security scheme type %q", securityScheme.Type)
	}
	return result, nil
}

var attemptedBodyParameterNames = []string{
	"body",
	"requestBody",
}

// stripNonExtensions removes invalid extensions: those not prefixed by "x-" and returns them
func stripNonExtensions(extensions map[string]any) map[string]any {
	for extName := range extensions {
		if !strings.HasPrefix(extName, "x-") {
			delete(extensions, extName)
		}
	}
	return extensions
}

func addPathExtensions(doc2 *openapi2.T, path string, extensions map[string]any) {
	if doc2.Paths == nil {
		doc2.Paths = make(map[string]*openapi2.PathItem)
	}
	pathItem := doc2.Paths[path]
	if pathItem == nil {
		pathItem = &openapi2.PathItem{}
		doc2.Paths[path] = pathItem
	}
	pathItem.Extensions = extensions
}
