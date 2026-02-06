//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package pollers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"

	azexported "github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/log"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/poller"
)

// getTokenTypeName creates a type name from the type parameter T.
func getTokenTypeName[T any]() (string, error) {
	tt := shared.TypeOfT[T]()
	var n string
	if tt.Kind() == reflect.Pointer {
		n = "*"
		tt = tt.Elem()
	}
	n += tt.Name()
	if n == "" {
		return "", errors.New("nameless types are not allowed")
	}
	return n, nil
}

type resumeTokenWrapper[T any] struct {
	Type  string `json:"type"`
	Token T      `json:"token"`
}

// NewResumeToken creates a resume token from the specified type.
// An error is returned if the generic type has no name (e.g. struct{}).
func NewResumeToken[TResult, TSource any](from TSource) (string, error) {
	n, err := getTokenTypeName[TResult]()
	if err != nil {
		return "", err
	}
	b, err := json.Marshal(resumeTokenWrapper[TSource]{
		Type:  n,
		Token: from,
	})
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// ExtractToken returns the poller-specific token information from the provided token value.
func ExtractToken(token string) ([]byte, error) {
	raw := map[string]json.RawMessage{}
	if err := json.Unmarshal([]byte(token), &raw); err != nil {
		return nil, err
	}
	// this is dependent on the type resumeTokenWrapper[T]
	tk, ok := raw["token"]
	if !ok {
		return nil, errors.New("missing token value")
	}
	return tk, nil
}

// IsTokenValid returns an error if the specified token isn't applicable for generic type T.
func IsTokenValid[T any](token string) error {
	raw := map[string]any{}
	if err := json.Unmarshal([]byte(token), &raw); err != nil {
		return err
	}
	t, ok := raw["type"]
	if !ok {
		return errors.New("missing type value")
	}
	tt, ok := t.(string)
	if !ok {
		return fmt.Errorf("invalid type format %T", t)
	}
	n, err := getTokenTypeName[T]()
	if err != nil {
		return err
	}
	if tt != n {
		return fmt.Errorf("cannot resume from this poller token. token is for type %s, not %s", tt, n)
	}
	return nil
}

// used if the operation synchronously completed
type NopPoller[T any] struct {
	resp   *http.Response
	result T
}

// NewNopPoller creates a NopPoller from the provided response.
// It unmarshals the response body into an instance of T.
func NewNopPoller[T any](resp *http.Response) (*NopPoller[T], error) {
	np := &NopPoller[T]{resp: resp}
	if resp.StatusCode == http.StatusNoContent {
		return np, nil
	}
	payload, err := exported.Payload(resp, nil)
	if err != nil {
		return nil, err
	}
	if len(payload) == 0 {
		return np, nil
	}
	if err = json.Unmarshal(payload, &np.result); err != nil {
		return nil, err
	}
	return np, nil
}

func (*NopPoller[T]) Done() bool {
	return true
}

func (p *NopPoller[T]) Poll(context.Context) (*http.Response, error) {
	return p.resp, nil
}

func (p *NopPoller[T]) Result(ctx context.Context, out *T) error {
	*out = p.result
	return nil
}

// PollHelper creates and executes the request, calling update() with the response.
// If the request fails, the update func is not called.
// The update func returns the state of the operation for logging purposes or an error
// if it fails to extract the required state from the response.
func PollHelper(ctx context.Context, endpoint string, pl azexported.Pipeline, update func(resp *http.Response) (string, error)) error {
	req, err := azexported.NewRequest(ctx, http.MethodGet, endpoint)
	if err != nil {
		return err
	}
	resp, err := pl.Do(req)
	if err != nil {
		return err
	}
	state, err := update(resp)
	if err != nil {
		return err
	}
	log.Writef(log.EventLRO, "State %s", state)
	return nil
}

// ResultHelper processes the response as success or failure.
// In the success case, it unmarshals the payload into either a new instance of T or out.
// In the failure case, it creates an *azcore.Response error from the response.
func ResultHelper[T any](resp *http.Response, failed bool, jsonPath string, out *T) error {
	// short-circuit the simple success case with no response body to unmarshal
	if resp.StatusCode == http.StatusNoContent {
		return nil
	}

	defer resp.Body.Close()
	if !poller.StatusCodeValid(resp) || failed {
		// the LRO failed.  unmarshall the error and update state
		return azexported.NewResponseError(resp)
	}

	// success case
	payload, err := exported.Payload(resp, nil)
	if err != nil {
		return err
	}

	if jsonPath != "" && len(payload) > 0 {
		// extract the payload from the specified JSON path.
		// do this before the zero-length check in case there
		// is no payload.
		jsonBody := map[string]json.RawMessage{}
		if err = json.Unmarshal(payload, &jsonBody); err != nil {
			return err
		}
		payload = jsonBody[jsonPath]
	}

	if len(payload) == 0 {
		return nil
	}

	if err = json.Unmarshal(payload, out); err != nil {
		return err
	}
	return nil
}

// IsNonTerminalHTTPStatusCode returns true if the HTTP status code should be
// considered non-terminal thus eligible for retry.
func IsNonTerminalHTTPStatusCode(resp *http.Response) bool {
	return exported.HasStatusCode(resp,
		http.StatusRequestTimeout,      // 408
		http.StatusTooManyRequests,     // 429
		http.StatusInternalServerError, // 500
		http.StatusBadGateway,          // 502
		http.StatusServiceUnavailable,  // 503
		http.StatusGatewayTimeout,      // 504
	)
}
