//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"errors"
	"reflect"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	armpolicy "github.com/Azure/azure-sdk-for-go/sdk/azcore/arm/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/cloud"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	azpolicy "github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	azruntime "github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
)

// NewPipeline creates a pipeline from connection options. Policies from ClientOptions are
// placed after policies from PipelineOptions. The telemetry policy, when enabled, will
// use the specified module and version info.
func NewPipeline(module, version string, cred azcore.TokenCredential, plOpts azruntime.PipelineOptions, options *armpolicy.ClientOptions) (azruntime.Pipeline, error) {
	if options == nil {
		options = &armpolicy.ClientOptions{}
	}
	conf, err := getConfiguration(&options.ClientOptions)
	if err != nil {
		return azruntime.Pipeline{}, err
	}
	authPolicy := NewBearerTokenPolicy(cred, &armpolicy.BearerTokenOptions{
		AuxiliaryTenants:                options.AuxiliaryTenants,
		InsecureAllowCredentialWithHTTP: options.InsecureAllowCredentialWithHTTP,
		Scopes:                          []string{conf.Audience + "/.default"},
	})
	// we don't want to modify the underlying array in plOpts.PerRetry
	perRetry := make([]azpolicy.Policy, len(plOpts.PerRetry), len(plOpts.PerRetry)+1)
	copy(perRetry, plOpts.PerRetry)
	perRetry = append(perRetry, authPolicy, exported.PolicyFunc(httpTraceNamespacePolicy))
	plOpts.PerRetry = perRetry
	if !options.DisableRPRegistration {
		regRPOpts := armpolicy.RegistrationOptions{ClientOptions: options.ClientOptions}
		regPolicy, err := NewRPRegistrationPolicy(cred, &regRPOpts)
		if err != nil {
			return azruntime.Pipeline{}, err
		}
		// we don't want to modify the underlying array in plOpts.PerCall
		perCall := make([]azpolicy.Policy, len(plOpts.PerCall), len(plOpts.PerCall)+1)
		copy(perCall, plOpts.PerCall)
		perCall = append(perCall, regPolicy)
		plOpts.PerCall = perCall
	}
	if plOpts.APIVersion.Name == "" {
		plOpts.APIVersion.Name = "api-version"
	}
	return azruntime.NewPipeline(module, version, plOpts, &options.ClientOptions), nil
}

func getConfiguration(o *azpolicy.ClientOptions) (cloud.ServiceConfiguration, error) {
	c := cloud.AzurePublic
	if !reflect.ValueOf(o.Cloud).IsZero() {
		c = o.Cloud
	}
	if conf, ok := c.Services[cloud.ResourceManager]; ok && conf.Endpoint != "" && conf.Audience != "" {
		return conf, nil
	} else {
		return conf, errors.New("provided Cloud field is missing Azure Resource Manager configuration")
	}
}
