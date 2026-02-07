// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package analysis

import "github.com/go-openapi/spec"

// FixEmptyResponseDescriptions replaces empty ("") response
// descriptions in the input with "(empty)" to ensure that the
// resulting Swagger is stays valid.  The problem appears to arise
// from reading in valid specs that have a explicit response
// description of "" (valid, response.description is required), but
// due to zero values being omitted upon re-serializing (omitempty) we
// lose them unless we stick some chars in there.
func FixEmptyResponseDescriptions(s *spec.Swagger) {
	for k, v := range s.Responses {
		FixEmptyDesc(&v) //#nosec
		s.Responses[k] = v
	}

	if s.Paths == nil {
		return
	}

	for _, v := range s.Paths.Paths {
		if v.Get != nil {
			FixEmptyDescs(v.Get.Responses)
		}
		if v.Put != nil {
			FixEmptyDescs(v.Put.Responses)
		}
		if v.Post != nil {
			FixEmptyDescs(v.Post.Responses)
		}
		if v.Delete != nil {
			FixEmptyDescs(v.Delete.Responses)
		}
		if v.Options != nil {
			FixEmptyDescs(v.Options.Responses)
		}
		if v.Head != nil {
			FixEmptyDescs(v.Head.Responses)
		}
		if v.Patch != nil {
			FixEmptyDescs(v.Patch.Responses)
		}
	}
}

// FixEmptyDescs adds "(empty)" as the description for any Response in
// the given Responses object that doesn't already have one.
func FixEmptyDescs(rs *spec.Responses) {
	FixEmptyDesc(rs.Default)
	for k, v := range rs.StatusCodeResponses {
		FixEmptyDesc(&v) //#nosec
		rs.StatusCodeResponses[k] = v
	}
}

// FixEmptyDesc adds "(empty)" as the description to the given
// Response object if it doesn't already have one and isn't a
// ref. No-op on nil input.
func FixEmptyDesc(rs *spec.Response) {
	if rs == nil || rs.Description != "" || rs.Ref.GetURL() != nil {
		return
	}
	rs.Description = "(empty)"
}
