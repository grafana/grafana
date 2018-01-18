// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

// checkResponse will return an error if the request/response indicates
// an error returned from Elasticsearch.
//
// HTTP status codes between in the range [200..299] are considered successful.
// All other errors are considered errors except they are specified in
// ignoreErrors. This is necessary because for some services, HTTP status 404
// is a valid response from Elasticsearch (e.g. the Exists service).
//
// The func tries to parse error details as returned from Elasticsearch
// and encapsulates them in type elastic.Error.
func checkResponse(req *http.Request, res *http.Response, ignoreErrors ...int) error {
	// 200-299 are valid status codes
	if res.StatusCode >= 200 && res.StatusCode <= 299 {
		return nil
	}
	// Ignore certain errors?
	for _, code := range ignoreErrors {
		if code == res.StatusCode {
			return nil
		}
	}
	return createResponseError(res)
}

// createResponseError creates an Error structure from the HTTP response,
// its status code and the error information sent by Elasticsearch.
func createResponseError(res *http.Response) error {
	if res.Body == nil {
		return &Error{Status: res.StatusCode}
	}
	data, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return &Error{Status: res.StatusCode}
	}
	errReply := new(Error)
	err = json.Unmarshal(data, errReply)
	if err != nil {
		return &Error{Status: res.StatusCode}
	}
	if errReply != nil {
		if errReply.Status == 0 {
			errReply.Status = res.StatusCode
		}
		return errReply
	}
	return &Error{Status: res.StatusCode}
}

// Error encapsulates error details as returned from Elasticsearch.
type Error struct {
	Status  int           `json:"status"`
	Details *ErrorDetails `json:"error,omitempty"`
}

// ErrorDetails encapsulate error details from Elasticsearch.
// It is used in e.g. elastic.Error and elastic.BulkResponseItem.
type ErrorDetails struct {
	Type         string                   `json:"type"`
	Reason       string                   `json:"reason"`
	ResourceType string                   `json:"resource.type,omitempty"`
	ResourceId   string                   `json:"resource.id,omitempty"`
	Index        string                   `json:"index,omitempty"`
	Phase        string                   `json:"phase,omitempty"`
	Grouped      bool                     `json:"grouped,omitempty"`
	CausedBy     map[string]interface{}   `json:"caused_by,omitempty"`
	RootCause    []*ErrorDetails          `json:"root_cause,omitempty"`
	FailedShards []map[string]interface{} `json:"failed_shards,omitempty"`
}

// Error returns a string representation of the error.
func (e *Error) Error() string {
	if e.Details != nil && e.Details.Reason != "" {
		return fmt.Sprintf("elastic: Error %d (%s): %s [type=%s]", e.Status, http.StatusText(e.Status), e.Details.Reason, e.Details.Type)
	} else {
		return fmt.Sprintf("elastic: Error %d (%s)", e.Status, http.StatusText(e.Status))
	}
}

// IsNotFound returns true if the given error indicates that Elasticsearch
// returned HTTP status 404. The err parameter can be of type *elastic.Error,
// elastic.Error, *http.Response or int (indicating the HTTP status code).
func IsNotFound(err interface{}) bool {
	return IsStatusCode(err, http.StatusNotFound)
}

// IsTimeout returns true if the given error indicates that Elasticsearch
// returned HTTP status 408. The err parameter can be of type *elastic.Error,
// elastic.Error, *http.Response or int (indicating the HTTP status code).
func IsTimeout(err interface{}) bool {
	return IsStatusCode(err, http.StatusRequestTimeout)
}

// IsConflict returns true if the given error indicates that the Elasticsearch
// operation resulted in a version conflict. This can occur in operations like
// `update` or `index` with `op_type=create`. The err parameter can be of
// type *elastic.Error, elastic.Error, *http.Response or int (indicating the
// HTTP status code).
func IsConflict(err interface{}) bool {
	return IsStatusCode(err, http.StatusConflict)
}

// IsStatusCode returns true if the given error indicates that the Elasticsearch
// operation returned the specified HTTP status code. The err parameter can be of
// type *http.Response, *Error, Error, or int (indicating the HTTP status code).
func IsStatusCode(err interface{}, code int) bool {
	switch e := err.(type) {
	case *http.Response:
		return e.StatusCode == code
	case *Error:
		return e.Status == code
	case Error:
		return e.Status == code
	case int:
		return e == code
	}
	return false
}

// -- General errors --

// shardsInfo represents information from a shard.
type shardsInfo struct {
	Total      int `json:"total"`
	Successful int `json:"successful"`
	Failed     int `json:"failed"`
}

// shardOperationFailure represents a shard failure.
type shardOperationFailure struct {
	Shard  int    `json:"shard"`
	Index  string `json:"index"`
	Status string `json:"status"`
	// "reason"
}
