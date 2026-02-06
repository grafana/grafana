//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/log"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/pollers"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/pollers/async"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/pollers/body"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/pollers/fake"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/pollers/loc"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/pollers/op"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/tracing"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/poller"
)

// FinalStateVia is the enumerated type for the possible final-state-via values.
type FinalStateVia = pollers.FinalStateVia

const (
	// FinalStateViaAzureAsyncOp indicates the final payload comes from the Azure-AsyncOperation URL.
	FinalStateViaAzureAsyncOp = pollers.FinalStateViaAzureAsyncOp

	// FinalStateViaLocation indicates the final payload comes from the Location URL.
	FinalStateViaLocation = pollers.FinalStateViaLocation

	// FinalStateViaOriginalURI indicates the final payload comes from the original URL.
	FinalStateViaOriginalURI = pollers.FinalStateViaOriginalURI

	// FinalStateViaOpLocation indicates the final payload comes from the Operation-Location URL.
	FinalStateViaOpLocation = pollers.FinalStateViaOpLocation
)

// NewPollerOptions contains the optional parameters for NewPoller.
type NewPollerOptions[T any] struct {
	// FinalStateVia contains the final-state-via value for the LRO.
	// NOTE: used only for Azure-AsyncOperation and Operation-Location LROs.
	FinalStateVia FinalStateVia

	// OperationLocationResultPath contains the JSON path to the result's
	// payload when it's included with the terminal success response.
	// NOTE: only used for Operation-Location LROs.
	OperationLocationResultPath string

	// Response contains a preconstructed response type.
	// The final payload will be unmarshaled into it and returned.
	Response *T

	// Handler[T] contains a custom polling implementation.
	Handler PollingHandler[T]

	// Tracer contains the Tracer from the client that's creating the Poller.
	Tracer tracing.Tracer
}

// NewPoller creates a Poller based on the provided initial response.
func NewPoller[T any](resp *http.Response, pl exported.Pipeline, options *NewPollerOptions[T]) (*Poller[T], error) {
	if options == nil {
		options = &NewPollerOptions[T]{}
	}
	result := options.Response
	if result == nil {
		result = new(T)
	}
	if options.Handler != nil {
		return &Poller[T]{
			op:     options.Handler,
			resp:   resp,
			result: result,
			tracer: options.Tracer,
		}, nil
	}

	defer resp.Body.Close()
	// this is a back-stop in case the swagger is incorrect (i.e. missing one or more status codes for success).
	// ideally the codegen should return an error if the initial response failed and not even create a poller.
	if !poller.StatusCodeValid(resp) {
		return nil, exported.NewResponseError(resp)
	}

	// determine the polling method
	var opr PollingHandler[T]
	var err error
	if fake.Applicable(resp) {
		opr, err = fake.New[T](pl, resp)
	} else if async.Applicable(resp) {
		// async poller must be checked first as it can also have a location header
		opr, err = async.New[T](pl, resp, options.FinalStateVia)
	} else if op.Applicable(resp) {
		// op poller must be checked before loc as it can also have a location header
		opr, err = op.New[T](pl, resp, options.FinalStateVia, options.OperationLocationResultPath)
	} else if loc.Applicable(resp) {
		opr, err = loc.New[T](pl, resp)
	} else if body.Applicable(resp) {
		// must test body poller last as it's a subset of the other pollers.
		// TODO: this is ambiguous for PATCH/PUT if it returns a 200 with no polling headers (sync completion)
		opr, err = body.New[T](pl, resp)
	} else if m := resp.Request.Method; resp.StatusCode == http.StatusAccepted && (m == http.MethodDelete || m == http.MethodPost) {
		// if we get here it means we have a 202 with no polling headers.
		// for DELETE and POST this is a hard error per ARM RPC spec.
		return nil, errors.New("response is missing polling URL")
	} else {
		opr, err = pollers.NewNopPoller[T](resp)
	}

	if err != nil {
		return nil, err
	}
	return &Poller[T]{
		op:     opr,
		resp:   resp,
		result: result,
		tracer: options.Tracer,
	}, nil
}

// NewPollerFromResumeTokenOptions contains the optional parameters for NewPollerFromResumeToken.
type NewPollerFromResumeTokenOptions[T any] struct {
	// Response contains a preconstructed response type.
	// The final payload will be unmarshaled into it and returned.
	Response *T

	// Handler[T] contains a custom polling implementation.
	Handler PollingHandler[T]

	// Tracer contains the Tracer from the client that's creating the Poller.
	Tracer tracing.Tracer
}

// NewPollerFromResumeToken creates a Poller from a resume token string.
func NewPollerFromResumeToken[T any](token string, pl exported.Pipeline, options *NewPollerFromResumeTokenOptions[T]) (*Poller[T], error) {
	if options == nil {
		options = &NewPollerFromResumeTokenOptions[T]{}
	}
	result := options.Response
	if result == nil {
		result = new(T)
	}

	if err := pollers.IsTokenValid[T](token); err != nil {
		return nil, err
	}
	raw, err := pollers.ExtractToken(token)
	if err != nil {
		return nil, err
	}
	var asJSON map[string]any
	if err := json.Unmarshal(raw, &asJSON); err != nil {
		return nil, err
	}

	opr := options.Handler
	// now rehydrate the poller based on the encoded poller type
	if fake.CanResume(asJSON) {
		opr, _ = fake.New[T](pl, nil)
	} else if opr != nil {
		log.Writef(log.EventLRO, "Resuming custom poller %T.", opr)
	} else if async.CanResume(asJSON) {
		opr, _ = async.New[T](pl, nil, "")
	} else if body.CanResume(asJSON) {
		opr, _ = body.New[T](pl, nil)
	} else if loc.CanResume(asJSON) {
		opr, _ = loc.New[T](pl, nil)
	} else if op.CanResume(asJSON) {
		opr, _ = op.New[T](pl, nil, "", "")
	} else {
		return nil, fmt.Errorf("unhandled poller token %s", string(raw))
	}
	if err := json.Unmarshal(raw, &opr); err != nil {
		return nil, err
	}
	return &Poller[T]{
		op:     opr,
		result: result,
		tracer: options.Tracer,
	}, nil
}

// PollingHandler[T] abstracts the differences among poller implementations.
type PollingHandler[T any] interface {
	// Done returns true if the LRO has reached a terminal state.
	Done() bool

	// Poll fetches the latest state of the LRO.
	Poll(context.Context) (*http.Response, error)

	// Result is called once the LRO has reached a terminal state. It populates the out parameter
	// with the result of the operation.
	Result(ctx context.Context, out *T) error
}

// Poller encapsulates a long-running operation, providing polling facilities until the operation reaches a terminal state.
// Methods on this type are not safe for concurrent use.
type Poller[T any] struct {
	op     PollingHandler[T]
	resp   *http.Response
	err    error
	result *T
	tracer tracing.Tracer
	done   bool
}

// PollUntilDoneOptions contains the optional values for the Poller[T].PollUntilDone() method.
type PollUntilDoneOptions struct {
	// Frequency is the time to wait between polling intervals in absence of a Retry-After header. Allowed minimum is one second.
	// Pass zero to accept the default value (30s).
	Frequency time.Duration
}

// PollUntilDone will poll the service endpoint until a terminal state is reached, an error is received, or the context expires.
// It internally uses Poll(), Done(), and Result() in its polling loop, sleeping for the specified duration between intervals.
// options: pass nil to accept the default values.
// NOTE: the default polling frequency is 30 seconds which works well for most operations.  However, some operations might
// benefit from a shorter or longer duration.
func (p *Poller[T]) PollUntilDone(ctx context.Context, options *PollUntilDoneOptions) (res T, err error) {
	if options == nil {
		options = &PollUntilDoneOptions{}
	}
	cp := *options
	if cp.Frequency == 0 {
		cp.Frequency = 30 * time.Second
	}

	ctx, endSpan := StartSpan(ctx, fmt.Sprintf("%s.PollUntilDone", shortenTypeName(reflect.TypeOf(*p).Name())), p.tracer, nil)
	defer func() { endSpan(err) }()

	// skip the floor check when executing tests so they don't take so long
	if isTest := flag.Lookup("test.v"); isTest == nil && cp.Frequency < time.Second {
		err = errors.New("polling frequency minimum is one second")
		return
	}

	start := time.Now()
	logPollUntilDoneExit := func(v any) {
		log.Writef(log.EventLRO, "END PollUntilDone() for %T: %v, total time: %s", p.op, v, time.Since(start))
	}
	log.Writef(log.EventLRO, "BEGIN PollUntilDone() for %T", p.op)
	if p.resp != nil {
		// initial check for a retry-after header existing on the initial response
		if retryAfter := shared.RetryAfter(p.resp); retryAfter > 0 {
			log.Writef(log.EventLRO, "initial Retry-After delay for %s", retryAfter.String())
			if err = shared.Delay(ctx, retryAfter); err != nil {
				logPollUntilDoneExit(err)
				return
			}
		}
	}
	// begin polling the endpoint until a terminal state is reached
	for {
		var resp *http.Response
		resp, err = p.Poll(ctx)
		if err != nil {
			logPollUntilDoneExit(err)
			return
		}
		if p.Done() {
			logPollUntilDoneExit("succeeded")
			res, err = p.Result(ctx)
			return
		}
		d := cp.Frequency
		if retryAfter := shared.RetryAfter(resp); retryAfter > 0 {
			log.Writef(log.EventLRO, "Retry-After delay for %s", retryAfter.String())
			d = retryAfter
		} else {
			log.Writef(log.EventLRO, "delay for %s", d.String())
		}
		if err = shared.Delay(ctx, d); err != nil {
			logPollUntilDoneExit(err)
			return
		}
	}
}

// Poll fetches the latest state of the LRO.  It returns an HTTP response or error.
// If Poll succeeds, the poller's state is updated and the HTTP response is returned.
// If Poll fails, the poller's state is unmodified and the error is returned.
// Calling Poll on an LRO that has reached a terminal state will return the last HTTP response.
func (p *Poller[T]) Poll(ctx context.Context) (resp *http.Response, err error) {
	if p.Done() {
		// the LRO has reached a terminal state, don't poll again
		resp = p.resp
		return
	}

	ctx, endSpan := StartSpan(ctx, fmt.Sprintf("%s.Poll", shortenTypeName(reflect.TypeOf(*p).Name())), p.tracer, nil)
	defer func() { endSpan(err) }()

	resp, err = p.op.Poll(ctx)
	if err != nil {
		return
	}
	p.resp = resp
	return
}

// Done returns true if the LRO has reached a terminal state.
// Once a terminal state is reached, call Result().
func (p *Poller[T]) Done() bool {
	return p.op.Done()
}

// Result returns the result of the LRO and is meant to be used in conjunction with Poll and Done.
// If the LRO completed successfully, a populated instance of T is returned.
// If the LRO failed or was canceled, an *azcore.ResponseError error is returned.
// Calling this on an LRO in a non-terminal state will return an error.
func (p *Poller[T]) Result(ctx context.Context) (res T, err error) {
	if !p.Done() {
		err = errors.New("poller is in a non-terminal state")
		return
	}
	if p.done {
		// the result has already been retrieved, return the cached value
		if p.err != nil {
			err = p.err
			return
		}
		res = *p.result
		return
	}

	ctx, endSpan := StartSpan(ctx, fmt.Sprintf("%s.Result", shortenTypeName(reflect.TypeOf(*p).Name())), p.tracer, nil)
	defer func() { endSpan(err) }()

	err = p.op.Result(ctx, p.result)
	var respErr *exported.ResponseError
	if errors.As(err, &respErr) {
		if pollers.IsNonTerminalHTTPStatusCode(respErr.RawResponse) {
			// the request failed in a non-terminal way.
			// don't cache the error or mark the Poller as done
			return
		}
		// the LRO failed. record the error
		p.err = err
	} else if err != nil {
		// the call to Result failed, don't cache anything in this case
		return
	}
	p.done = true
	if p.err != nil {
		err = p.err
		return
	}
	res = *p.result
	return
}

// ResumeToken returns a value representing the poller that can be used to resume
// the LRO at a later time. ResumeTokens are unique per service operation.
// The token's format should be considered opaque and is subject to change.
// Calling this on an LRO in a terminal state will return an error.
func (p *Poller[T]) ResumeToken() (string, error) {
	if p.Done() {
		return "", errors.New("poller is in a terminal state")
	}
	tk, err := pollers.NewResumeToken[T](p.op)
	if err != nil {
		return "", err
	}
	return tk, err
}

// extracts the type name from the string returned from reflect.Value.Name()
func shortenTypeName(s string) string {
	// the value is formatted as follows
	// Poller[module/Package.Type].Method
	// we want to shorten the generic type parameter string to Type
	// anything we don't recognize will be left as-is
	begin := strings.Index(s, "[")
	end := strings.Index(s, "]")
	if begin == -1 || end == -1 {
		return s
	}

	typeName := s[begin+1 : end]
	if i := strings.LastIndex(typeName, "."); i > -1 {
		typeName = typeName[i+1:]
	}
	return s[:begin+1] + typeName + s[end:]
}
