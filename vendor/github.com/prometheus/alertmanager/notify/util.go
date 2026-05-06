// Copyright 2019 Prometheus Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package notify

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/common/version"

	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

// truncationMarker is the character used to represent a truncation.
const truncationMarker = "…"

// UserAgentHeader is the default User-Agent for notification requests.
var UserAgentHeader = fmt.Sprintf("Alertmanager/%s", version.Version)

// RedactURL removes the URL part from an error of *url.Error type.
func RedactURL(err error) error {
	var e *url.Error
	if !errors.As(err, &e) {
		return err
	}
	e.URL = "<redacted>"
	return e
}

// Get sends a GET request to the given URL.
func Get(ctx context.Context, client *http.Client, url string) (*http.Response, error) {
	return request(ctx, client, http.MethodGet, url, "", nil)
}

// PostJSON sends a POST request with JSON payload to the given URL.
func PostJSON(ctx context.Context, client *http.Client, url string, body io.Reader) (*http.Response, error) {
	return post(ctx, client, url, "application/json", body)
}

// PostText sends a POST request with text payload to the given URL.
func PostText(ctx context.Context, client *http.Client, url string, body io.Reader) (*http.Response, error) {
	return post(ctx, client, url, "text/plain", body)
}

func post(ctx context.Context, client *http.Client, url, bodyType string, body io.Reader) (*http.Response, error) {
	return request(ctx, client, http.MethodPost, url, bodyType, body)
}

func request(ctx context.Context, client *http.Client, method, url, bodyType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", UserAgentHeader)
	if bodyType != "" {
		req.Header.Set("Content-Type", bodyType)
	}
	return client.Do(req.WithContext(ctx))
}

// Drain consumes and closes the response's body to make sure that the
// HTTP client can reuse existing connections.
func Drain(r *http.Response) {
	io.Copy(io.Discard, r.Body)
	r.Body.Close()
}

// TruncateInRunes truncates a string to fit the given size in Runes.
func TruncateInRunes(s string, n int) (string, bool) {
	r := []rune(s)
	if len(r) <= n {
		return s, false
	}

	if n <= 3 {
		return string(r[:n]), true
	}

	return string(r[:n-1]) + truncationMarker, true
}

// TruncateInBytes truncates a string to fit the given size in Bytes.
func TruncateInBytes(s string, n int) (string, bool) {
	// First, measure the string the w/o a to-rune conversion.
	if len(s) <= n {
		return s, false
	}

	// The truncationMarker itself is 3 bytes, we can't return any part of the string when it's less than 3.
	if n <= 3 {
		switch n {
		case 3:
			return truncationMarker, true
		default:
			return strings.Repeat(".", n), true
		}
	}

	// Now, to ensure we don't butcher the string we need to remove using runes.
	r := []rune(s)
	truncationTarget := n - 3

	// Next, let's truncate the runes to the lower possible number.
	truncatedRunes := r[:truncationTarget]
	for len(string(truncatedRunes)) > truncationTarget {
		truncatedRunes = r[:len(truncatedRunes)-1]
	}

	return string(truncatedRunes) + truncationMarker, true
}

// TmplText is using monadic error handling in order to make string templating
// less verbose. Use with care as the final error checking is easily missed.
func TmplText(tmpl *template.Template, data *template.Data, err *error) func(string) string {
	return func(name string) (s string) {
		if *err != nil {
			return
		}
		s, *err = tmpl.ExecuteTextString(name, data)
		return s
	}
}

// TmplHTML is using monadic error handling in order to make string templating
// less verbose. Use with care as the final error checking is easily missed.
func TmplHTML(tmpl *template.Template, data *template.Data, err *error) func(string) string {
	return func(name string) (s string) {
		if *err != nil {
			return
		}
		s, *err = tmpl.ExecuteHTMLString(name, data)
		return s
	}
}

// Key is a string that can be hashed.
type Key string

// ExtractGroupKey gets the group key from the context.
func ExtractGroupKey(ctx context.Context) (Key, error) {
	key, ok := GroupKey(ctx)
	if !ok {
		return "", fmt.Errorf("group key missing")
	}
	return Key(key), nil
}

// Hash returns the sha256 for a group key as integrations may have
// maximum length requirements on deduplication keys.
func (k Key) Hash() string {
	h := sha256.New()
	// hash.Hash.Write never returns an error.
	//nolint: errcheck
	h.Write([]byte(string(k)))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func (k Key) String() string {
	return string(k)
}

// GetTemplateData creates the template data from the context and the alerts.
func GetTemplateData(ctx context.Context, tmpl *template.Template, alerts []*types.Alert, l log.Logger) *template.Data {
	recv, ok := ReceiverName(ctx)
	if !ok {
		level.Error(l).Log("msg", "Missing receiver")
	}
	groupLabels, ok := GroupLabels(ctx)
	if !ok {
		level.Error(l).Log("msg", "Missing group labels")
	}
	return tmpl.Data(recv, groupLabels, alerts...)
}

func readAll(r io.Reader) string {
	if r == nil {
		return ""
	}
	bs, err := io.ReadAll(r)
	if err != nil {
		return ""
	}
	return string(bs)
}

// Retrier knows when to retry an HTTP request to a receiver. 2xx status codes
// are successful, anything else is a failure and only 5xx status codes should
// be retried.
type Retrier struct {
	// Function to return additional information in the error message.
	CustomDetailsFunc func(code int, body io.Reader) string
	// Additional HTTP status codes that should be retried.
	RetryCodes []int
}

// Check returns a boolean indicating whether the request should be retried
// and an optional error if the request has failed. If body is not nil, it will
// be included in the error message.
func (r *Retrier) Check(statusCode int, body io.Reader) (bool, error) {
	// 2xx responses are considered to be always successful.
	if statusCode/100 == 2 {
		return false, nil
	}

	// 5xx responses are considered to be always retried.
	retry := statusCode/100 == 5
	if !retry {
		for _, code := range r.RetryCodes {
			if code == statusCode {
				retry = true
				break
			}
		}
	}

	s := fmt.Sprintf("unexpected status code %v", statusCode)
	var details string
	if r.CustomDetailsFunc != nil {
		details = r.CustomDetailsFunc(statusCode, body)
	} else {
		details = readAll(body)
	}
	if details != "" {
		s = fmt.Sprintf("%s: %s", s, details)
	}
	return retry, errors.New(s)
}

type ErrorWithReason struct {
	Err error

	Reason Reason
}

func NewErrorWithReason(reason Reason, err error) *ErrorWithReason {
	return &ErrorWithReason{
		Err:    err,
		Reason: reason,
	}
}

func (e *ErrorWithReason) Error() string {
	return e.Err.Error()
}

// Reason is the failure reason.
type Reason int

const (
	DefaultReason Reason = iota
	ClientErrorReason
	ServerErrorReason
	ContextCanceledReason
	ContextDeadlineExceededReason
)

func (s Reason) String() string {
	switch s {
	case DefaultReason:
		return "other"
	case ClientErrorReason:
		return "clientError"
	case ServerErrorReason:
		return "serverError"
	case ContextCanceledReason:
		return "contextCanceled"
	case ContextDeadlineExceededReason:
		return "contextDeadlineExceeded"
	default:
		panic(fmt.Sprintf("unknown Reason: %d", s))
	}
}

// possibleFailureReasonCategory is a list of possible failure reason.
var possibleFailureReasonCategory = []string{DefaultReason.String(), ClientErrorReason.String(), ServerErrorReason.String(), ContextCanceledReason.String(), ContextDeadlineExceededReason.String()}

// GetFailureReasonFromStatusCode returns the reason for the failure based on the status code provided.
func GetFailureReasonFromStatusCode(statusCode int) Reason {
	if statusCode/100 == 4 {
		return ClientErrorReason
	}
	if statusCode/100 == 5 {
		return ServerErrorReason
	}

	return DefaultReason
}
