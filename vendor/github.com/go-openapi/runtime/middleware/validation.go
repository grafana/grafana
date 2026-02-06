// Copyright 2015 go-swagger maintainers
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package middleware

import (
	"mime"
	"net/http"
	"strings"

	"github.com/go-openapi/errors"
	"github.com/go-openapi/swag"

	"github.com/go-openapi/runtime"
)

type validation struct {
	context *Context
	result  []error
	request *http.Request
	route   *MatchedRoute
	bound   map[string]interface{}
}

// ContentType validates the content type of a request
func validateContentType(allowed []string, actual string) error {
	if len(allowed) == 0 {
		return nil
	}
	mt, _, err := mime.ParseMediaType(actual)
	if err != nil {
		return errors.InvalidContentType(actual, allowed)
	}
	if swag.ContainsStringsCI(allowed, mt) {
		return nil
	}
	if swag.ContainsStringsCI(allowed, "*/*") {
		return nil
	}
	parts := strings.Split(actual, "/")
	if len(parts) == 2 && swag.ContainsStringsCI(allowed, parts[0]+"/*") {
		return nil
	}
	return errors.InvalidContentType(actual, allowed)
}

func validateRequest(ctx *Context, request *http.Request, route *MatchedRoute) *validation {
	validate := &validation{
		context: ctx,
		request: request,
		route:   route,
		bound:   make(map[string]interface{}),
	}
	validate.debugLogf("validating request %s %s", request.Method, request.URL.EscapedPath())

	validate.contentType()
	if len(validate.result) == 0 {
		validate.responseFormat()
	}
	if len(validate.result) == 0 {
		validate.parameters()
	}

	return validate
}

func (v *validation) debugLogf(format string, args ...any) {
	v.context.debugLogf(format, args...)
}

func (v *validation) parameters() {
	v.debugLogf("validating request parameters for %s %s", v.request.Method, v.request.URL.EscapedPath())
	if result := v.route.Binder.Bind(v.request, v.route.Params, v.route.Consumer, v.bound); result != nil {
		if result.Error() == "validation failure list" {
			for _, e := range result.(*errors.Validation).Value.([]interface{}) {
				v.result = append(v.result, e.(error))
			}
			return
		}
		v.result = append(v.result, result)
	}
}

func (v *validation) contentType() {
	if len(v.result) == 0 && runtime.HasBody(v.request) {
		v.debugLogf("validating body content type for %s %s", v.request.Method, v.request.URL.EscapedPath())
		ct, _, req, err := v.context.ContentType(v.request)
		if err != nil {
			v.result = append(v.result, err)
		} else {
			v.request = req
		}

		if len(v.result) == 0 {
			v.debugLogf("validating content type for %q against [%s]", ct, strings.Join(v.route.Consumes, ", "))
			if err := validateContentType(v.route.Consumes, ct); err != nil {
				v.result = append(v.result, err)
			}
		}
		if ct != "" && v.route.Consumer == nil {
			cons, ok := v.route.Consumers[ct]
			if !ok {
				v.result = append(v.result, errors.New(500, "no consumer registered for %s", ct))
			} else {
				v.route.Consumer = cons
			}
		}
	}
}

func (v *validation) responseFormat() {
	// if the route provides values for Produces and no format could be identify then return an error.
	// if the route does not specify values for Produces then treat request as valid since the API designer
	// choose not to specify the format for responses.
	if str, rCtx := v.context.ResponseFormat(v.request, v.route.Produces); str == "" && len(v.route.Produces) > 0 {
		v.request = rCtx
		v.result = append(v.result, errors.InvalidResponseFormat(v.request.Header.Get(runtime.HeaderAccept), v.route.Produces))
	}
}
