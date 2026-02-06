//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/tracing"
)

// PagingHandler contains the required data for constructing a Pager.
type PagingHandler[T any] struct {
	// More returns a boolean indicating if there are more pages to fetch.
	// It uses the provided page to make the determination.
	More func(T) bool

	// Fetcher fetches the first and subsequent pages.
	Fetcher func(context.Context, *T) (T, error)

	// Tracer contains the Tracer from the client that's creating the Pager.
	Tracer tracing.Tracer
}

// Pager provides operations for iterating over paged responses.
// Methods on this type are not safe for concurrent use.
type Pager[T any] struct {
	current   *T
	handler   PagingHandler[T]
	tracer    tracing.Tracer
	firstPage bool
}

// NewPager creates an instance of Pager using the specified PagingHandler.
// Pass a non-nil T for firstPage if the first page has already been retrieved.
func NewPager[T any](handler PagingHandler[T]) *Pager[T] {
	return &Pager[T]{
		handler:   handler,
		tracer:    handler.Tracer,
		firstPage: true,
	}
}

// More returns true if there are more pages to retrieve.
func (p *Pager[T]) More() bool {
	if p.current != nil {
		return p.handler.More(*p.current)
	}
	return true
}

// NextPage advances the pager to the next page.
func (p *Pager[T]) NextPage(ctx context.Context) (T, error) {
	if p.current != nil {
		if p.firstPage {
			// we get here if it's an LRO-pager, we already have the first page
			p.firstPage = false
			return *p.current, nil
		} else if !p.handler.More(*p.current) {
			return *new(T), errors.New("no more pages")
		}
	} else {
		// non-LRO case, first page
		p.firstPage = false
	}

	var err error
	ctx, endSpan := StartSpan(ctx, fmt.Sprintf("%s.NextPage", shortenTypeName(reflect.TypeOf(*p).Name())), p.tracer, nil)
	defer func() { endSpan(err) }()

	resp, err := p.handler.Fetcher(ctx, p.current)
	if err != nil {
		return *new(T), err
	}
	p.current = &resp
	return *p.current, nil
}

// UnmarshalJSON implements the json.Unmarshaler interface for Pager[T].
func (p *Pager[T]) UnmarshalJSON(data []byte) error {
	return json.Unmarshal(data, &p.current)
}

// FetcherForNextLinkOptions contains the optional values for [FetcherForNextLink].
type FetcherForNextLinkOptions struct {
	// NextReq is the func to be called when requesting subsequent pages.
	// Used for paged operations that have a custom next link operation.
	NextReq func(context.Context, string) (*policy.Request, error)

	// StatusCodes contains additional HTTP status codes indicating success.
	// The default value is http.StatusOK.
	StatusCodes []int
}

// FetcherForNextLink is a helper containing boilerplate code to simplify creating a PagingHandler[T].Fetcher from a next link URL.
//   - ctx is the [context.Context] controlling the lifetime of the HTTP operation
//   - pl is the [Pipeline] used to dispatch the HTTP request
//   - nextLink is the URL used to fetch the next page. the empty string indicates the first page is to be requested
//   - firstReq is the func to be called when creating the request for the first page
//   - options contains any optional parameters, pass nil to accept the default values
func FetcherForNextLink(ctx context.Context, pl Pipeline, nextLink string, firstReq func(context.Context) (*policy.Request, error), options *FetcherForNextLinkOptions) (*http.Response, error) {
	var req *policy.Request
	var err error
	if options == nil {
		options = &FetcherForNextLinkOptions{}
	}
	if nextLink == "" {
		req, err = firstReq(ctx)
	} else if nextLink, err = EncodeQueryParams(nextLink); err == nil {
		if options.NextReq != nil {
			req, err = options.NextReq(ctx, nextLink)
		} else {
			req, err = NewRequest(ctx, http.MethodGet, nextLink)
		}
	}
	if err != nil {
		return nil, err
	}
	resp, err := pl.Do(req)
	if err != nil {
		return nil, err
	}
	successCodes := []int{http.StatusOK}
	successCodes = append(successCodes, options.StatusCodes...)
	if !HasStatusCode(resp, successCodes...) {
		return nil, NewResponseError(resp)
	}
	return resp, nil
}
