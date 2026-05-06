// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Package gcp provides a resource detector for GCP Cloud Function.
package gcp // import "go.opentelemetry.io/contrib/detectors/gcp"

import (
	"context"
	"os"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0"
)

const (
	gcpFunctionNameKey = "K_SERVICE"
)

// NewCloudFunction will return a GCP Cloud Function resource detector.
//
// Deprecated: Use gcp.NewDetector() instead, which sets the same resource attributes.
func NewCloudFunction() resource.Detector {
	return &cloudFunction{
		cloudRun: NewCloudRun(),
	}
}

// cloudFunction collects resource information of GCP Cloud Function.
type cloudFunction struct {
	cloudRun *CloudRun
}

// Detect detects associated resources when running in GCP Cloud Function.
func (f *cloudFunction) Detect(context.Context) (*resource.Resource, error) {
	functionName, ok := f.googleCloudFunctionName()
	if !ok {
		return nil, nil
	}

	projectID, err := f.cloudRun.mc.ProjectID()
	if err != nil {
		return nil, err
	}
	region, err := f.cloudRun.cloudRegion()
	if err != nil {
		return nil, err
	}

	attributes := []attribute.KeyValue{
		semconv.CloudProviderGCP,
		semconv.CloudPlatformGCPCloudFunctions,
		semconv.FaaSName(functionName),
		semconv.CloudAccountID(projectID),
		semconv.CloudRegion(region),
	}
	return resource.NewWithAttributes(semconv.SchemaURL, attributes...), nil
}

func (*cloudFunction) googleCloudFunctionName() (string, bool) {
	return os.LookupEnv(gcpFunctionNameKey)
}
