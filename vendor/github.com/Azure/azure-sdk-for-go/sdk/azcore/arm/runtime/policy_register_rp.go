//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/arm/internal/resource"
	armpolicy "github.com/Azure/azure-sdk-for-go/sdk/azcore/arm/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	azpolicy "github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
)

const (
	// LogRPRegistration entries contain information specific to the automatic registration of an RP.
	// Entries of this classification are written IFF the policy needs to take any action.
	LogRPRegistration log.Event = "RPRegistration"
)

// init sets any default values
func setDefaults(r *armpolicy.RegistrationOptions) {
	if r.MaxAttempts == 0 {
		r.MaxAttempts = 3
	} else if r.MaxAttempts < 0 {
		r.MaxAttempts = 0
	}
	if r.PollingDelay == 0 {
		r.PollingDelay = 15 * time.Second
	} else if r.PollingDelay < 0 {
		r.PollingDelay = 0
	}
	if r.PollingDuration == 0 {
		r.PollingDuration = 5 * time.Minute
	}
	if len(r.StatusCodes) == 0 {
		r.StatusCodes = []int{http.StatusConflict}
	}
}

// NewRPRegistrationPolicy creates a policy object configured using the specified options.
// The policy controls whether an unregistered resource provider should automatically be
// registered. See https://aka.ms/rps-not-found for more information.
func NewRPRegistrationPolicy(cred azcore.TokenCredential, o *armpolicy.RegistrationOptions) (azpolicy.Policy, error) {
	if o == nil {
		o = &armpolicy.RegistrationOptions{}
	}
	conf, err := getConfiguration(&o.ClientOptions)
	if err != nil {
		return nil, err
	}
	authPolicy := NewBearerTokenPolicy(cred, &armpolicy.BearerTokenOptions{Scopes: []string{conf.Audience + "/.default"}})
	p := &rpRegistrationPolicy{
		endpoint: conf.Endpoint,
		pipeline: runtime.NewPipeline(shared.Module, shared.Version, runtime.PipelineOptions{PerRetry: []azpolicy.Policy{authPolicy}}, &o.ClientOptions),
		options:  *o,
	}
	// init the copy
	setDefaults(&p.options)
	return p, nil
}

type rpRegistrationPolicy struct {
	endpoint string
	pipeline runtime.Pipeline
	options  armpolicy.RegistrationOptions
}

func (r *rpRegistrationPolicy) Do(req *azpolicy.Request) (*http.Response, error) {
	if r.options.MaxAttempts == 0 {
		// policy is disabled
		return req.Next()
	}
	const registeredState = "Registered"
	var rp string
	var resp *http.Response
	for attempts := 0; attempts < r.options.MaxAttempts; attempts++ {
		var err error
		// make the original request
		resp, err = req.Next()
		// getting a 409 is the first indication that the RP might need to be registered, check error response
		if err != nil || !runtime.HasStatusCode(resp, r.options.StatusCodes...) {
			return resp, err
		}
		var reqErr requestError
		if err = runtime.UnmarshalAsJSON(resp, &reqErr); err != nil {
			return resp, err
		}
		if reqErr.ServiceError == nil {
			// missing service error info. just return the response
			// to the caller so its error unmarshalling will kick in
			return resp, err
		}
		if !isUnregisteredRPCode(reqErr.ServiceError.Code) {
			// not a 409 due to unregistered RP. just return the response
			// to the caller so its error unmarshalling will kick in
			return resp, err
		}
		res, err := resource.ParseResourceID(req.Raw().URL.Path)
		if err != nil {
			return resp, err
		}
		rp = res.ResourceType.Namespace
		logRegistrationExit := func(v any) {
			log.Writef(LogRPRegistration, "END registration for %s: %v", rp, v)
		}
		log.Writef(LogRPRegistration, "BEGIN registration for %s", rp)
		// create client and make the registration request
		// we use the scheme and host from the original request
		rpOps := &providersOperations{
			p:     r.pipeline,
			u:     r.endpoint,
			subID: res.SubscriptionID,
		}
		if _, err = rpOps.Register(&shared.ContextWithDeniedValues{Context: req.Raw().Context()}, rp); err != nil {
			logRegistrationExit(err)
			return resp, err
		}

		// RP was registered, however we need to wait for the registration to complete
		pollCtx, pollCancel := context.WithTimeout(&shared.ContextWithDeniedValues{Context: req.Raw().Context()}, r.options.PollingDuration)
		var lastRegState string
		for {
			// get the current registration state
			getResp, err := rpOps.Get(pollCtx, rp)
			if err != nil {
				pollCancel()
				logRegistrationExit(err)
				return resp, err
			}
			if getResp.Provider.RegistrationState != nil && !strings.EqualFold(*getResp.Provider.RegistrationState, lastRegState) {
				// registration state has changed, or was updated for the first time
				lastRegState = *getResp.Provider.RegistrationState
				log.Writef(LogRPRegistration, "registration state is %s", lastRegState)
			}
			if strings.EqualFold(lastRegState, registeredState) {
				// registration complete
				pollCancel()
				logRegistrationExit(lastRegState)
				break
			}
			// wait before trying again
			select {
			case <-time.After(r.options.PollingDelay):
				// continue polling
			case <-pollCtx.Done():
				pollCancel()
				logRegistrationExit(pollCtx.Err())
				return resp, pollCtx.Err()
			}
		}
		// RP was successfully registered, retry the original request
		err = req.RewindBody()
		if err != nil {
			return resp, err
		}
	}
	// if we get here it means we exceeded the number of attempts
	return resp, fmt.Errorf("exceeded attempts to register %s", rp)
}

var unregisteredRPCodes = []string{
	"MissingSubscriptionRegistration",
	"MissingRegistrationForResourceProvider",
	"Subscription Not Registered",
	"SubscriptionNotRegistered",
}

func isUnregisteredRPCode(errorCode string) bool {
	for _, code := range unregisteredRPCodes {
		if strings.EqualFold(errorCode, code) {
			return true
		}
	}
	return false
}

// minimal error definitions to simplify detection
type requestError struct {
	ServiceError *serviceError `json:"error"`
}

type serviceError struct {
	Code string `json:"code"`
}

///////////////////////////////////////////////////////////////////////////////////////////////
// the following code was copied from module armresources, providers.go and models.go
// only the minimum amount of code was copied to get this working and some edits were made.
///////////////////////////////////////////////////////////////////////////////////////////////

type providersOperations struct {
	p     runtime.Pipeline
	u     string
	subID string
}

// Get - Gets the specified resource provider.
func (client *providersOperations) Get(ctx context.Context, resourceProviderNamespace string) (providerResponse, error) {
	req, err := client.getCreateRequest(ctx, resourceProviderNamespace)
	if err != nil {
		return providerResponse{}, err
	}
	resp, err := client.p.Do(req)
	if err != nil {
		return providerResponse{}, err
	}
	result, err := client.getHandleResponse(resp)
	if err != nil {
		return providerResponse{}, err
	}
	return result, nil
}

// getCreateRequest creates the Get request.
func (client *providersOperations) getCreateRequest(ctx context.Context, resourceProviderNamespace string) (*azpolicy.Request, error) {
	urlPath := "/subscriptions/{subscriptionId}/providers/{resourceProviderNamespace}"
	urlPath = strings.ReplaceAll(urlPath, "{resourceProviderNamespace}", url.PathEscape(resourceProviderNamespace))
	urlPath = strings.ReplaceAll(urlPath, "{subscriptionId}", url.PathEscape(client.subID))
	req, err := runtime.NewRequest(ctx, http.MethodGet, runtime.JoinPaths(client.u, urlPath))
	if err != nil {
		return nil, err
	}
	query := req.Raw().URL.Query()
	query.Set("api-version", "2019-05-01")
	req.Raw().URL.RawQuery = query.Encode()
	return req, nil
}

// getHandleResponse handles the Get response.
func (client *providersOperations) getHandleResponse(resp *http.Response) (providerResponse, error) {
	if !runtime.HasStatusCode(resp, http.StatusOK) {
		return providerResponse{}, exported.NewResponseError(resp)
	}
	result := providerResponse{RawResponse: resp}
	err := runtime.UnmarshalAsJSON(resp, &result.Provider)
	if err != nil {
		return providerResponse{}, err
	}
	return result, err
}

// Register - Registers a subscription with a resource provider.
func (client *providersOperations) Register(ctx context.Context, resourceProviderNamespace string) (providerResponse, error) {
	req, err := client.registerCreateRequest(ctx, resourceProviderNamespace)
	if err != nil {
		return providerResponse{}, err
	}
	resp, err := client.p.Do(req)
	if err != nil {
		return providerResponse{}, err
	}
	result, err := client.registerHandleResponse(resp)
	if err != nil {
		return providerResponse{}, err
	}
	return result, nil
}

// registerCreateRequest creates the Register request.
func (client *providersOperations) registerCreateRequest(ctx context.Context, resourceProviderNamespace string) (*azpolicy.Request, error) {
	urlPath := "/subscriptions/{subscriptionId}/providers/{resourceProviderNamespace}/register"
	urlPath = strings.ReplaceAll(urlPath, "{resourceProviderNamespace}", url.PathEscape(resourceProviderNamespace))
	urlPath = strings.ReplaceAll(urlPath, "{subscriptionId}", url.PathEscape(client.subID))
	req, err := runtime.NewRequest(ctx, http.MethodPost, runtime.JoinPaths(client.u, urlPath))
	if err != nil {
		return nil, err
	}
	query := req.Raw().URL.Query()
	query.Set("api-version", "2019-05-01")
	req.Raw().URL.RawQuery = query.Encode()
	return req, nil
}

// registerHandleResponse handles the Register response.
func (client *providersOperations) registerHandleResponse(resp *http.Response) (providerResponse, error) {
	if !runtime.HasStatusCode(resp, http.StatusOK) {
		return providerResponse{}, exported.NewResponseError(resp)
	}
	result := providerResponse{RawResponse: resp}
	err := runtime.UnmarshalAsJSON(resp, &result.Provider)
	if err != nil {
		return providerResponse{}, err
	}
	return result, err
}

// ProviderResponse is the response envelope for operations that return a Provider type.
type providerResponse struct {
	// Resource provider information.
	Provider *provider

	// RawResponse contains the underlying HTTP response.
	RawResponse *http.Response
}

// Provider - Resource provider information.
type provider struct {
	// The provider ID.
	ID *string `json:"id,omitempty"`

	// The namespace of the resource provider.
	Namespace *string `json:"namespace,omitempty"`

	// The registration policy of the resource provider.
	RegistrationPolicy *string `json:"registrationPolicy,omitempty"`

	// The registration state of the resource provider.
	RegistrationState *string `json:"registrationState,omitempty"`
}
