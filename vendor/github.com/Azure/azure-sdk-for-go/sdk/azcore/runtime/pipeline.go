//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
)

// PipelineOptions contains Pipeline options for SDK developers
type PipelineOptions struct {
	// AllowedHeaders is the slice of headers to log with their values intact.
	// All headers not in the slice will have their values REDACTED.
	// Applies to request and response headers.
	AllowedHeaders []string

	// AllowedQueryParameters is the slice of query parameters to log with their values intact.
	// All query parameters not in the slice will have their values REDACTED.
	AllowedQueryParameters []string

	// APIVersion overrides the default version requested of the service.
	// Set with caution as this package version has not been tested with arbitrary service versions.
	APIVersion APIVersionOptions

	// PerCall contains custom policies to inject into the pipeline.
	// Each policy is executed once per request.
	PerCall []policy.Policy

	// PerRetry contains custom policies to inject into the pipeline.
	// Each policy is executed once per request, and for each retry of that request.
	PerRetry []policy.Policy

	// Tracing contains options used to configure distributed tracing.
	Tracing TracingOptions
}

// TracingOptions contains tracing options for SDK developers.
type TracingOptions struct {
	// Namespace contains the value to use for the az.namespace span attribute.
	Namespace string
}

// Pipeline represents a primitive for sending HTTP requests and receiving responses.
// Its behavior can be extended by specifying policies during construction.
type Pipeline = exported.Pipeline

// NewPipeline creates a pipeline from connection options, with any additional policies as specified.
// Policies from ClientOptions are placed after policies from PipelineOptions.
// The module and version parameters are used by the telemetry policy, when enabled.
func NewPipeline(module, version string, plOpts PipelineOptions, options *policy.ClientOptions) Pipeline {
	cp := policy.ClientOptions{}
	if options != nil {
		cp = *options
	}
	if len(plOpts.AllowedHeaders) > 0 {
		headers := make([]string, len(plOpts.AllowedHeaders)+len(cp.Logging.AllowedHeaders))
		copy(headers, plOpts.AllowedHeaders)
		headers = append(headers, cp.Logging.AllowedHeaders...)
		cp.Logging.AllowedHeaders = headers
	}
	if len(plOpts.AllowedQueryParameters) > 0 {
		qp := make([]string, len(plOpts.AllowedQueryParameters)+len(cp.Logging.AllowedQueryParams))
		copy(qp, plOpts.AllowedQueryParameters)
		qp = append(qp, cp.Logging.AllowedQueryParams...)
		cp.Logging.AllowedQueryParams = qp
	}
	// we put the includeResponsePolicy at the very beginning so that the raw response
	// is populated with the final response (some policies might mutate the response)
	policies := []policy.Policy{exported.PolicyFunc(includeResponsePolicy)}
	if cp.APIVersion != "" {
		policies = append(policies, newAPIVersionPolicy(cp.APIVersion, &plOpts.APIVersion))
	}
	if !cp.Telemetry.Disabled {
		policies = append(policies, NewTelemetryPolicy(module, version, &cp.Telemetry))
	}
	policies = append(policies, plOpts.PerCall...)
	policies = append(policies, cp.PerCallPolicies...)
	policies = append(policies, NewRetryPolicy(&cp.Retry))
	policies = append(policies, plOpts.PerRetry...)
	policies = append(policies, cp.PerRetryPolicies...)
	policies = append(policies, exported.PolicyFunc(httpHeaderPolicy))
	policies = append(policies, newHTTPTracePolicy(cp.Logging.AllowedQueryParams))
	policies = append(policies, NewLogPolicy(&cp.Logging))
	policies = append(policies, exported.PolicyFunc(bodyDownloadPolicy))
	transport := cp.Transport
	if transport == nil {
		transport = defaultHTTPClient
	}
	return exported.NewPipeline(transport, policies...)
}
