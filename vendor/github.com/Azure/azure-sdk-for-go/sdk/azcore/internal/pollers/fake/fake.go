//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package fake

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/log"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/pollers"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/poller"
)

// Applicable returns true if the LRO is a fake.
func Applicable(resp *http.Response) bool {
	return resp.Header.Get(shared.HeaderFakePollerStatus) != ""
}

// CanResume returns true if the token can rehydrate this poller type.
func CanResume(token map[string]any) bool {
	_, ok := token["fakeURL"]
	return ok
}

// Poller is an LRO poller that uses the Core-Fake-Poller pattern.
type Poller[T any] struct {
	pl exported.Pipeline

	resp *http.Response

	// The API name from CtxAPINameKey
	APIName string `json:"apiName"`

	// The URL from Core-Fake-Poller header.
	FakeURL string `json:"fakeURL"`

	// The LRO's current state.
	FakeStatus string `json:"status"`
}

// lroStatusURLSuffix is the URL path suffix for a faked LRO.
const lroStatusURLSuffix = "/get/fake/status"

// New creates a new Poller from the provided initial response.
// Pass nil for response to create an empty Poller for rehydration.
func New[T any](pl exported.Pipeline, resp *http.Response) (*Poller[T], error) {
	if resp == nil {
		log.Write(log.EventLRO, "Resuming Core-Fake-Poller poller.")
		return &Poller[T]{pl: pl}, nil
	}

	log.Write(log.EventLRO, "Using Core-Fake-Poller poller.")
	fakeStatus := resp.Header.Get(shared.HeaderFakePollerStatus)
	if fakeStatus == "" {
		return nil, errors.New("response is missing Fake-Poller-Status header")
	}

	ctxVal := resp.Request.Context().Value(shared.CtxAPINameKey{})
	if ctxVal == nil {
		return nil, errors.New("missing value for CtxAPINameKey")
	}

	apiName, ok := ctxVal.(string)
	if !ok {
		return nil, fmt.Errorf("expected string for CtxAPINameKey, the type was %T", ctxVal)
	}

	qp := ""
	if resp.Request.URL.RawQuery != "" {
		qp = "?" + resp.Request.URL.RawQuery
	}

	p := &Poller[T]{
		pl:      pl,
		resp:    resp,
		APIName: apiName,
		// NOTE: any changes to this path format MUST be reflected in SanitizePollerPath()
		FakeURL:    fmt.Sprintf("%s://%s%s%s%s", resp.Request.URL.Scheme, resp.Request.URL.Host, resp.Request.URL.Path, lroStatusURLSuffix, qp),
		FakeStatus: fakeStatus,
	}
	return p, nil
}

// Done returns true if the LRO is in a terminal state.
func (p *Poller[T]) Done() bool {
	return poller.IsTerminalState(p.FakeStatus)
}

// Poll retrieves the current state of the LRO.
func (p *Poller[T]) Poll(ctx context.Context) (*http.Response, error) {
	ctx = context.WithValue(ctx, shared.CtxAPINameKey{}, p.APIName)
	err := pollers.PollHelper(ctx, p.FakeURL, p.pl, func(resp *http.Response) (string, error) {
		if !poller.StatusCodeValid(resp) {
			p.resp = resp
			return "", exported.NewResponseError(resp)
		}
		fakeStatus := resp.Header.Get(shared.HeaderFakePollerStatus)
		if fakeStatus == "" {
			return "", errors.New("response is missing Fake-Poller-Status header")
		}
		p.resp = resp
		p.FakeStatus = fakeStatus
		return p.FakeStatus, nil
	})
	if err != nil {
		return nil, err
	}
	return p.resp, nil
}

func (p *Poller[T]) Result(ctx context.Context, out *T) error {
	if p.resp.StatusCode == http.StatusNoContent {
		return nil
	} else if poller.Failed(p.FakeStatus) {
		return exported.NewResponseError(p.resp)
	}

	return pollers.ResultHelper(p.resp, poller.Failed(p.FakeStatus), "", out)
}

// SanitizePollerPath removes any fake-appended suffix from a URL's path.
func SanitizePollerPath(path string) string {
	return strings.TrimSuffix(path, lroStatusURLSuffix)
}
