// Copyright 2016 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package translate provides access to the Translate API.
//
// See https://developers.google.com/translate/v2/using_rest
//
// Usage example:
//
//   import "cloud.google.com/go/translate/internal/translate/v2"
//   ...
//   translateService, err := translate.New(oauthHttpClient)
package translate // import "cloud.google.com/go/translate/internal/translate/v2"

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	context "golang.org/x/net/context"
	ctxhttp "golang.org/x/net/context/ctxhttp"
	gensupport "google.golang.org/api/gensupport"
	googleapi "google.golang.org/api/googleapi"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// Always reference these packages, just in case the auto-generated code
// below doesn't.
var _ = bytes.NewBuffer
var _ = strconv.Itoa
var _ = fmt.Sprintf
var _ = json.NewDecoder
var _ = io.Copy
var _ = url.Parse
var _ = gensupport.MarshalJSON
var _ = googleapi.Version
var _ = errors.New
var _ = strings.Replace
var _ = context.Canceled
var _ = ctxhttp.Do

const apiId = "translate:v2"
const apiName = "translate"
const apiVersion = "v2"
const basePath = "https://translation.googleapis.com/language/translate/"

// OAuth2 scopes used by this API.
const (
	// View and manage your data across Google Cloud Platform services
	CloudPlatformScope = "https://www.googleapis.com/auth/cloud-platform"
)

func New(client *http.Client) (*Service, error) {
	if client == nil {
		return nil, errors.New("client is nil")
	}
	s := &Service{client: client, BasePath: basePath}
	s.Detections = NewDetectionsService(s)
	s.Languages = NewLanguagesService(s)
	s.Translations = NewTranslationsService(s)
	return s, nil
}

type Service struct {
	client    *http.Client
	BasePath  string // API endpoint base URL
	UserAgent string // optional additional User-Agent fragment

	Detections *DetectionsService

	Languages *LanguagesService

	Translations *TranslationsService
}

func (s *Service) userAgent() string {
	if s.UserAgent == "" {
		return googleapi.UserAgent
	}
	return googleapi.UserAgent + " " + s.UserAgent
}

func NewDetectionsService(s *Service) *DetectionsService {
	rs := &DetectionsService{s: s}
	return rs
}

type DetectionsService struct {
	s *Service
}

func NewLanguagesService(s *Service) *LanguagesService {
	rs := &LanguagesService{s: s}
	return rs
}

type LanguagesService struct {
	s *Service
}

func NewTranslationsService(s *Service) *TranslationsService {
	rs := &TranslationsService{s: s}
	return rs
}

type TranslationsService struct {
	s *Service
}

type DetectionsListResponse struct {
	// Detections: A detections contains detection results of several text
	Detections [][]*DetectionsResourceItem `json:"detections,omitempty"`

	// ServerResponse contains the HTTP response code and headers from the
	// server.
	googleapi.ServerResponse `json:"-"`

	// ForceSendFields is a list of field names (e.g. "Detections") to
	// unconditionally include in API requests. By default, fields with
	// empty values are omitted from API requests. However, any non-pointer,
	// non-interface field appearing in ForceSendFields will be sent to the
	// server regardless of whether the field is empty or not. This may be
	// used to include empty fields in Patch requests.
	ForceSendFields []string `json:"-"`

	// NullFields is a list of field names (e.g. "Detections") to include in
	// API requests with the JSON null value. By default, fields with empty
	// values are omitted from API requests. However, any field with an
	// empty value appearing in NullFields will be sent to the server as
	// null. It is an error if a field in this list has a non-empty value.
	// This may be used to include null fields in Patch requests.
	NullFields []string `json:"-"`
}

func (s *DetectionsListResponse) MarshalJSON() ([]byte, error) {
	type noMethod DetectionsListResponse
	raw := noMethod(*s)
	return gensupport.MarshalJSON(raw, s.ForceSendFields, s.NullFields)
}

type DetectionsResourceItem struct {
	// Confidence: The confidence of the detection resul of this language.
	Confidence float64 `json:"confidence,omitempty"`

	// IsReliable: A boolean to indicate is the language detection result
	// reliable.
	IsReliable bool `json:"isReliable,omitempty"`

	// Language: The language we detect
	Language string `json:"language,omitempty"`

	// ForceSendFields is a list of field names (e.g. "Confidence") to
	// unconditionally include in API requests. By default, fields with
	// empty values are omitted from API requests. However, any non-pointer,
	// non-interface field appearing in ForceSendFields will be sent to the
	// server regardless of whether the field is empty or not. This may be
	// used to include empty fields in Patch requests.
	ForceSendFields []string `json:"-"`

	// NullFields is a list of field names (e.g. "Confidence") to include in
	// API requests with the JSON null value. By default, fields with empty
	// values are omitted from API requests. However, any field with an
	// empty value appearing in NullFields will be sent to the server as
	// null. It is an error if a field in this list has a non-empty value.
	// This may be used to include null fields in Patch requests.
	NullFields []string `json:"-"`
}

func (s *DetectionsResourceItem) MarshalJSON() ([]byte, error) {
	type noMethod DetectionsResourceItem
	raw := noMethod(*s)
	return gensupport.MarshalJSON(raw, s.ForceSendFields, s.NullFields)
}

type LanguagesListResponse struct {
	// Languages: List of source/target languages supported by the
	// translation API. If target parameter is unspecified, the list is
	// sorted by the ASCII code point order of the language code. If target
	// parameter is specified, the list is sorted by the collation order of
	// the language name in the target language.
	Languages []*LanguagesResource `json:"languages,omitempty"`

	// ServerResponse contains the HTTP response code and headers from the
	// server.
	googleapi.ServerResponse `json:"-"`

	// ForceSendFields is a list of field names (e.g. "Languages") to
	// unconditionally include in API requests. By default, fields with
	// empty values are omitted from API requests. However, any non-pointer,
	// non-interface field appearing in ForceSendFields will be sent to the
	// server regardless of whether the field is empty or not. This may be
	// used to include empty fields in Patch requests.
	ForceSendFields []string `json:"-"`

	// NullFields is a list of field names (e.g. "Languages") to include in
	// API requests with the JSON null value. By default, fields with empty
	// values are omitted from API requests. However, any field with an
	// empty value appearing in NullFields will be sent to the server as
	// null. It is an error if a field in this list has a non-empty value.
	// This may be used to include null fields in Patch requests.
	NullFields []string `json:"-"`
}

func (s *LanguagesListResponse) MarshalJSON() ([]byte, error) {
	type noMethod LanguagesListResponse
	raw := noMethod(*s)
	return gensupport.MarshalJSON(raw, s.ForceSendFields, s.NullFields)
}

type LanguagesResource struct {
	// Language: The language code.
	Language string `json:"language,omitempty"`

	// Name: The localized name of the language if target parameter is
	// given.
	Name string `json:"name,omitempty"`

	// ForceSendFields is a list of field names (e.g. "Language") to
	// unconditionally include in API requests. By default, fields with
	// empty values are omitted from API requests. However, any non-pointer,
	// non-interface field appearing in ForceSendFields will be sent to the
	// server regardless of whether the field is empty or not. This may be
	// used to include empty fields in Patch requests.
	ForceSendFields []string `json:"-"`

	// NullFields is a list of field names (e.g. "Language") to include in
	// API requests with the JSON null value. By default, fields with empty
	// values are omitted from API requests. However, any field with an
	// empty value appearing in NullFields will be sent to the server as
	// null. It is an error if a field in this list has a non-empty value.
	// This may be used to include null fields in Patch requests.
	NullFields []string `json:"-"`
}

func (s *LanguagesResource) MarshalJSON() ([]byte, error) {
	type noMethod LanguagesResource
	raw := noMethod(*s)
	return gensupport.MarshalJSON(raw, s.ForceSendFields, s.NullFields)
}

type TranslationsListResponse struct {
	// Translations: Translations contains list of translation results of
	// given text
	Translations []*TranslationsResource `json:"translations,omitempty"`

	// ServerResponse contains the HTTP response code and headers from the
	// server.
	googleapi.ServerResponse `json:"-"`

	// ForceSendFields is a list of field names (e.g. "Translations") to
	// unconditionally include in API requests. By default, fields with
	// empty values are omitted from API requests. However, any non-pointer,
	// non-interface field appearing in ForceSendFields will be sent to the
	// server regardless of whether the field is empty or not. This may be
	// used to include empty fields in Patch requests.
	ForceSendFields []string `json:"-"`

	// NullFields is a list of field names (e.g. "Translations") to include
	// in API requests with the JSON null value. By default, fields with
	// empty values are omitted from API requests. However, any field with
	// an empty value appearing in NullFields will be sent to the server as
	// null. It is an error if a field in this list has a non-empty value.
	// This may be used to include null fields in Patch requests.
	NullFields []string `json:"-"`
}

func (s *TranslationsListResponse) MarshalJSON() ([]byte, error) {
	type noMethod TranslationsListResponse
	raw := noMethod(*s)
	return gensupport.MarshalJSON(raw, s.ForceSendFields, s.NullFields)
}

type TranslationsResource struct {
	// DetectedSourceLanguage: Detected source language if source parameter
	// is unspecified.
	DetectedSourceLanguage string `json:"detectedSourceLanguage,omitempty"`

	// Model: Model used for translation.
	Model string `json:"model,omitempty"`

	// TranslatedText: The translation.
	TranslatedText string `json:"translatedText,omitempty"`

	// ForceSendFields is a list of field names (e.g.
	// "DetectedSourceLanguage") to unconditionally include in API requests.
	// By default, fields with empty values are omitted from API requests.
	// However, any non-pointer, non-interface field appearing in
	// ForceSendFields will be sent to the server regardless of whether the
	// field is empty or not. This may be used to include empty fields in
	// Patch requests.
	ForceSendFields []string `json:"-"`

	// NullFields is a list of field names (e.g. "DetectedSourceLanguage")
	// to include in API requests with the JSON null value. By default,
	// fields with empty values are omitted from API requests. However, any
	// field with an empty value appearing in NullFields will be sent to the
	// server as null. It is an error if a field in this list has a
	// non-empty value. This may be used to include null fields in Patch
	// requests.
	NullFields []string `json:"-"`
}

func (s *TranslationsResource) MarshalJSON() ([]byte, error) {
	type noMethod TranslationsResource
	raw := noMethod(*s)
	return gensupport.MarshalJSON(raw, s.ForceSendFields, s.NullFields)
}

// method id "language.detections.list":

type DetectionsListCall struct {
	s            *Service
	urlParams_   gensupport.URLParams
	ifNoneMatch_ string
	ctx_         context.Context
	header_      http.Header
}

// List: Detect the language of text.
func (r *DetectionsService) List(q []string) *DetectionsListCall {
	c := &DetectionsListCall{s: r.s, urlParams_: make(gensupport.URLParams)}
	c.urlParams_.SetMulti("q", append([]string{}, q...))
	return c
}

// Fields allows partial responses to be retrieved. See
// https://developers.google.com/gdata/docs/2.0/basics#PartialResponse
// for more information.
func (c *DetectionsListCall) Fields(s ...googleapi.Field) *DetectionsListCall {
	c.urlParams_.Set("fields", googleapi.CombineFields(s))
	return c
}

// IfNoneMatch sets the optional parameter which makes the operation
// fail if the object's ETag matches the given value. This is useful for
// getting updates only after the object has changed since the last
// request. Use googleapi.IsNotModified to check whether the response
// error from Do is the result of In-None-Match.
func (c *DetectionsListCall) IfNoneMatch(entityTag string) *DetectionsListCall {
	c.ifNoneMatch_ = entityTag
	return c
}

// Context sets the context to be used in this call's Do method. Any
// pending HTTP request will be aborted if the provided context is
// canceled.
func (c *DetectionsListCall) Context(ctx context.Context) *DetectionsListCall {
	c.ctx_ = ctx
	return c
}

// Header returns an http.Header that can be modified by the caller to
// add HTTP headers to the request.
func (c *DetectionsListCall) Header() http.Header {
	if c.header_ == nil {
		c.header_ = make(http.Header)
	}
	return c.header_
}

func (c *DetectionsListCall) doRequest(alt string) (*http.Response, error) {
	reqHeaders := make(http.Header)
	for k, v := range c.header_ {
		reqHeaders[k] = v
	}
	reqHeaders.Set("User-Agent", c.s.userAgent())
	if c.ifNoneMatch_ != "" {
		reqHeaders.Set("If-None-Match", c.ifNoneMatch_)
	}
	var body io.Reader = nil
	c.urlParams_.Set("alt", alt)
	urls := googleapi.ResolveRelative(c.s.BasePath, "v2/detect")
	urls += "?" + c.urlParams_.Encode()
	req, _ := http.NewRequest("GET", urls, body)
	req.Header = reqHeaders
	return gensupport.SendRequest(c.ctx_, c.s.client, req)
}

// Do executes the "language.detections.list" call.
// Exactly one of *DetectionsListResponse or error will be non-nil. Any
// non-2xx status code is an error. Response headers are in either
// *DetectionsListResponse.ServerResponse.Header or (if a response was
// returned at all) in error.(*googleapi.Error).Header. Use
// googleapi.IsNotModified to check whether the returned error was
// because http.StatusNotModified was returned.
func (c *DetectionsListCall) Do(opts ...googleapi.CallOption) (*DetectionsListResponse, error) {
	gensupport.SetOptions(c.urlParams_, opts...)
	res, err := c.doRequest("json")
	if res != nil && res.StatusCode == http.StatusNotModified {
		if res.Body != nil {
			res.Body.Close()
		}
		return nil, &googleapi.Error{
			Code:   res.StatusCode,
			Header: res.Header,
		}
	}
	if err != nil {
		return nil, err
	}
	defer googleapi.CloseBody(res)
	if err := googleapi.CheckResponse(res); err != nil {
		return nil, err
	}
	ret := &DetectionsListResponse{
		ServerResponse: googleapi.ServerResponse{
			Header:         res.Header,
			HTTPStatusCode: res.StatusCode,
		},
	}
	target := &struct {
		Data *DetectionsListResponse `json:"data"`
	}{ret}
	if err := json.NewDecoder(res.Body).Decode(target); err != nil {
		return nil, err
	}
	return ret, nil
	// {
	//   "description": "Detect the language of text.",
	//   "httpMethod": "GET",
	//   "id": "language.detections.list",
	//   "parameterOrder": [
	//     "q"
	//   ],
	//   "parameters": {
	//     "q": {
	//       "description": "The text to detect",
	//       "location": "query",
	//       "repeated": true,
	//       "required": true,
	//       "type": "string"
	//     }
	//   },
	//   "path": "v2/detect",
	//   "response": {
	//     "$ref": "DetectionsListResponse"
	//   }
	// }

}

// method id "language.languages.list":

type LanguagesListCall struct {
	s            *Service
	urlParams_   gensupport.URLParams
	ifNoneMatch_ string
	ctx_         context.Context
	header_      http.Header
}

// List: List the source/target languages supported by the API
func (r *LanguagesService) List() *LanguagesListCall {
	c := &LanguagesListCall{s: r.s, urlParams_: make(gensupport.URLParams)}
	return c
}

// Target sets the optional parameter "target": the language and
// collation in which the localized results should be returned
func (c *LanguagesListCall) Target(target string) *LanguagesListCall {
	c.urlParams_.Set("target", target)
	return c
}

// Fields allows partial responses to be retrieved. See
// https://developers.google.com/gdata/docs/2.0/basics#PartialResponse
// for more information.
func (c *LanguagesListCall) Fields(s ...googleapi.Field) *LanguagesListCall {
	c.urlParams_.Set("fields", googleapi.CombineFields(s))
	return c
}

// IfNoneMatch sets the optional parameter which makes the operation
// fail if the object's ETag matches the given value. This is useful for
// getting updates only after the object has changed since the last
// request. Use googleapi.IsNotModified to check whether the response
// error from Do is the result of In-None-Match.
func (c *LanguagesListCall) IfNoneMatch(entityTag string) *LanguagesListCall {
	c.ifNoneMatch_ = entityTag
	return c
}

// Context sets the context to be used in this call's Do method. Any
// pending HTTP request will be aborted if the provided context is
// canceled.
func (c *LanguagesListCall) Context(ctx context.Context) *LanguagesListCall {
	c.ctx_ = ctx
	return c
}

// Header returns an http.Header that can be modified by the caller to
// add HTTP headers to the request.
func (c *LanguagesListCall) Header() http.Header {
	if c.header_ == nil {
		c.header_ = make(http.Header)
	}
	return c.header_
}

func (c *LanguagesListCall) doRequest(alt string) (*http.Response, error) {
	reqHeaders := make(http.Header)
	for k, v := range c.header_ {
		reqHeaders[k] = v
	}
	reqHeaders.Set("User-Agent", c.s.userAgent())
	if c.ifNoneMatch_ != "" {
		reqHeaders.Set("If-None-Match", c.ifNoneMatch_)
	}
	var body io.Reader = nil
	c.urlParams_.Set("alt", alt)
	urls := googleapi.ResolveRelative(c.s.BasePath, "v2/languages")
	urls += "?" + c.urlParams_.Encode()
	req, _ := http.NewRequest("GET", urls, body)
	req.Header = reqHeaders
	return gensupport.SendRequest(c.ctx_, c.s.client, req)
}

// Do executes the "language.languages.list" call.
// Exactly one of *LanguagesListResponse or error will be non-nil. Any
// non-2xx status code is an error. Response headers are in either
// *LanguagesListResponse.ServerResponse.Header or (if a response was
// returned at all) in error.(*googleapi.Error).Header. Use
// googleapi.IsNotModified to check whether the returned error was
// because http.StatusNotModified was returned.
func (c *LanguagesListCall) Do(opts ...googleapi.CallOption) (*LanguagesListResponse, error) {
	gensupport.SetOptions(c.urlParams_, opts...)
	res, err := c.doRequest("json")
	if res != nil && res.StatusCode == http.StatusNotModified {
		if res.Body != nil {
			res.Body.Close()
		}
		return nil, &googleapi.Error{
			Code:   res.StatusCode,
			Header: res.Header,
		}
	}
	if err != nil {
		return nil, err
	}
	defer googleapi.CloseBody(res)
	if err := googleapi.CheckResponse(res); err != nil {
		return nil, err
	}
	ret := &LanguagesListResponse{
		ServerResponse: googleapi.ServerResponse{
			Header:         res.Header,
			HTTPStatusCode: res.StatusCode,
		},
	}
	target := &struct {
		Data *LanguagesListResponse `json:"data"`
	}{ret}
	if err := json.NewDecoder(res.Body).Decode(target); err != nil {
		return nil, err
	}
	return ret, nil
	// {
	//   "description": "List the source/target languages supported by the API",
	//   "httpMethod": "GET",
	//   "id": "language.languages.list",
	//   "parameters": {
	//     "target": {
	//       "description": "the language and collation in which the localized results should be returned",
	//       "location": "query",
	//       "type": "string"
	//     }
	//   },
	//   "path": "v2/languages",
	//   "response": {
	//     "$ref": "LanguagesListResponse"
	//   }
	// }

}

// method id "language.translations.list":

type TranslationsListCall struct {
	s            *Service
	urlParams_   gensupport.URLParams
	ifNoneMatch_ string
	ctx_         context.Context
	header_      http.Header
}

// List: Returns text translations from one language to another.
func (r *TranslationsService) List(q []string, target string) *TranslationsListCall {
	c := &TranslationsListCall{s: r.s, urlParams_: make(gensupport.URLParams)}
	c.urlParams_.SetMulti("q", append([]string{}, q...))
	c.urlParams_.Set("target", target)
	return c
}

// Cid sets the optional parameter "cid": The customization id for
// translate
func (c *TranslationsListCall) Cid(cid ...string) *TranslationsListCall {
	c.urlParams_.SetMulti("cid", append([]string{}, cid...))
	return c
}

// Format sets the optional parameter "format": The format of the text
//
// Possible values:
//   "html" - Specifies the input is in HTML
//   "text" - Specifies the input is in plain textual format
func (c *TranslationsListCall) Format(format string) *TranslationsListCall {
	c.urlParams_.Set("format", format)
	return c
}

// Model sets the optional parameter "model": the model to use for
// translation
func (c *TranslationsListCall) Model(model string) *TranslationsListCall {
	c.urlParams_.Set("model", model)
	return c
}

// Source sets the optional parameter "source": The source language of
// the text
func (c *TranslationsListCall) Source(source string) *TranslationsListCall {
	c.urlParams_.Set("source", source)
	return c
}

// Fields allows partial responses to be retrieved. See
// https://developers.google.com/gdata/docs/2.0/basics#PartialResponse
// for more information.
func (c *TranslationsListCall) Fields(s ...googleapi.Field) *TranslationsListCall {
	c.urlParams_.Set("fields", googleapi.CombineFields(s))
	return c
}

// IfNoneMatch sets the optional parameter which makes the operation
// fail if the object's ETag matches the given value. This is useful for
// getting updates only after the object has changed since the last
// request. Use googleapi.IsNotModified to check whether the response
// error from Do is the result of In-None-Match.
func (c *TranslationsListCall) IfNoneMatch(entityTag string) *TranslationsListCall {
	c.ifNoneMatch_ = entityTag
	return c
}

// Context sets the context to be used in this call's Do method. Any
// pending HTTP request will be aborted if the provided context is
// canceled.
func (c *TranslationsListCall) Context(ctx context.Context) *TranslationsListCall {
	c.ctx_ = ctx
	return c
}

// Header returns an http.Header that can be modified by the caller to
// add HTTP headers to the request.
func (c *TranslationsListCall) Header() http.Header {
	if c.header_ == nil {
		c.header_ = make(http.Header)
	}
	return c.header_
}

func (c *TranslationsListCall) doRequest(alt string) (*http.Response, error) {
	reqHeaders := make(http.Header)
	for k, v := range c.header_ {
		reqHeaders[k] = v
	}
	reqHeaders.Set("User-Agent", c.s.userAgent())
	if c.ifNoneMatch_ != "" {
		reqHeaders.Set("If-None-Match", c.ifNoneMatch_)
	}
	var body io.Reader = nil
	c.urlParams_.Set("alt", alt)
	urls := googleapi.ResolveRelative(c.s.BasePath, "v2")
	urls += "?" + c.urlParams_.Encode()
	req, _ := http.NewRequest("GET", urls, body)
	req.Header = reqHeaders
	return gensupport.SendRequest(c.ctx_, c.s.client, req)
}

// Do executes the "language.translations.list" call.
// Exactly one of *TranslationsListResponse or error will be non-nil.
// Any non-2xx status code is an error. Response headers are in either
// *TranslationsListResponse.ServerResponse.Header or (if a response was
// returned at all) in error.(*googleapi.Error).Header. Use
// googleapi.IsNotModified to check whether the returned error was
// because http.StatusNotModified was returned.
func (c *TranslationsListCall) Do(opts ...googleapi.CallOption) (*TranslationsListResponse, error) {
	gensupport.SetOptions(c.urlParams_, opts...)
	res, err := c.doRequest("json")
	if res != nil && res.StatusCode == http.StatusNotModified {
		if res.Body != nil {
			res.Body.Close()
		}
		return nil, &googleapi.Error{
			Code:   res.StatusCode,
			Header: res.Header,
		}
	}
	if err != nil {
		return nil, err
	}
	defer googleapi.CloseBody(res)
	if err := googleapi.CheckResponse(res); err != nil {
		return nil, err
	}
	ret := &TranslationsListResponse{
		ServerResponse: googleapi.ServerResponse{
			Header:         res.Header,
			HTTPStatusCode: res.StatusCode,
		},
	}
	target := &struct {
		Data *TranslationsListResponse `json:"data"`
	}{ret}
	if err := json.NewDecoder(res.Body).Decode(target); err != nil {
		return nil, err
	}
	return ret, nil
	// {
	//   "description": "Returns text translations from one language to another.",
	//   "httpMethod": "GET",
	//   "id": "language.translations.list",
	//   "parameterOrder": [
	//     "q",
	//     "target"
	//   ],
	//   "parameters": {
	//     "cid": {
	//       "description": "The customization id for translate",
	//       "location": "query",
	//       "repeated": true,
	//       "type": "string"
	//     },
	//     "format": {
	//       "description": "The format of the text",
	//       "enum": [
	//         "html",
	//         "text"
	//       ],
	//       "enumDescriptions": [
	//         "Specifies the input is in HTML",
	//         "Specifies the input is in plain textual format"
	//       ],
	//       "location": "query",
	//       "type": "string"
	//     },
	//     "model": {
	//       "description": "the model to use for translation",
	//       "location": "query",
	//       "type": "string"
	//     },
	//     "q": {
	//       "description": "The text to translate",
	//       "location": "query",
	//       "repeated": true,
	//       "required": true,
	//       "type": "string"
	//     },
	//     "source": {
	//       "description": "The source language of the text",
	//       "location": "query",
	//       "type": "string"
	//     },
	//     "target": {
	//       "description": "The target language into which the text should be translated",
	//       "location": "query",
	//       "required": true,
	//       "type": "string"
	//     }
	//   },
	//   "path": "v2",
	//   "response": {
	//     "$ref": "TranslationsListResponse"
	//   }
	// }

}
