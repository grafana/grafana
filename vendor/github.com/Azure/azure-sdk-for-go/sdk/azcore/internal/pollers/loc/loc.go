//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package loc

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/log"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/pollers"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/poller"
)

// Kind is the identifier of this type in a resume token.
const kind = "loc"

// Applicable returns true if the LRO is using Location.
func Applicable(resp *http.Response) bool {
	return resp.Header.Get(shared.HeaderLocation) != ""
}

// CanResume returns true if the token can rehydrate this poller type.
func CanResume(token map[string]any) bool {
	t, ok := token["type"]
	if !ok {
		return false
	}
	tt, ok := t.(string)
	if !ok {
		return false
	}
	return tt == kind
}

// Poller is an LRO poller that uses the Location pattern.
type Poller[T any] struct {
	pl   exported.Pipeline
	resp *http.Response

	Type     string `json:"type"`
	PollURL  string `json:"pollURL"`
	CurState string `json:"state"`
}

// New creates a new Poller from the provided initial response.
// Pass nil for response to create an empty Poller for rehydration.
func New[T any](pl exported.Pipeline, resp *http.Response) (*Poller[T], error) {
	if resp == nil {
		log.Write(log.EventLRO, "Resuming Location poller.")
		return &Poller[T]{pl: pl}, nil
	}
	log.Write(log.EventLRO, "Using Location poller.")
	locURL := resp.Header.Get(shared.HeaderLocation)
	if locURL == "" {
		return nil, errors.New("response is missing Location header")
	}
	if !poller.IsValidURL(locURL) {
		return nil, fmt.Errorf("invalid polling URL %s", locURL)
	}
	// check for provisioning state.  if the operation is a RELO
	// and terminates synchronously this will prevent extra polling.
	// it's ok if there's no provisioning state.
	state, _ := poller.GetProvisioningState(resp)
	if state == "" {
		state = poller.StatusInProgress
	}
	return &Poller[T]{
		pl:       pl,
		resp:     resp,
		Type:     kind,
		PollURL:  locURL,
		CurState: state,
	}, nil
}

func (p *Poller[T]) Done() bool {
	return poller.IsTerminalState(p.CurState)
}

func (p *Poller[T]) Poll(ctx context.Context) (*http.Response, error) {
	err := pollers.PollHelper(ctx, p.PollURL, p.pl, func(resp *http.Response) (string, error) {
		// location polling can return an updated polling URL
		if h := resp.Header.Get(shared.HeaderLocation); h != "" {
			p.PollURL = h
		}
		// if provisioning state is available, use that.  this is only
		// for some ARM LRO scenarios (e.g. DELETE with a Location header)
		// so if it's missing then use HTTP status code.
		provState, _ := poller.GetProvisioningState(resp)
		p.resp = resp
		if provState != "" {
			p.CurState = provState
		} else if resp.StatusCode == http.StatusAccepted {
			p.CurState = poller.StatusInProgress
		} else if resp.StatusCode > 199 && resp.StatusCode < 300 {
			// any 2xx other than a 202 indicates success
			p.CurState = poller.StatusSucceeded
		} else if pollers.IsNonTerminalHTTPStatusCode(resp) {
			// the request timed out or is being throttled.
			// DO NOT include this as a terminal failure. preserve
			// the existing state and return the response.
		} else {
			p.CurState = poller.StatusFailed
		}
		return p.CurState, nil
	})
	if err != nil {
		return nil, err
	}
	return p.resp, nil
}

func (p *Poller[T]) Result(ctx context.Context, out *T) error {
	return pollers.ResultHelper(p.resp, poller.Failed(p.CurState), "", out)
}
