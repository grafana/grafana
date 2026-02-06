// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package gcp // import "go.opentelemetry.io/contrib/detectors/gcp"

import (
	"context"
	"fmt"
	"os"
	"strings"

	"cloud.google.com/go/compute/metadata"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0"
)

const serviceNamespace = "cloud-run-managed"

// The minimal list of metadata.Client methods we use. Use an interface so we
// can replace it with a fake implementation in the unit test.
type metadataClient interface {
	ProjectID() (string, error)
	Get(string) (string, error)
	InstanceID() (string, error)
}

// CloudRun collects resource information of Cloud Run instance.
//
// Deprecated: Use gcp.NewDetector() instead. Note that it sets faas.* resource attributes instead of service.* attributes.
type CloudRun struct {
	mc     metadataClient
	onGCE  func() bool
	getenv func(string) string
}

// compile time assertion that CloudRun implements the resource.Detector
// interface.
var _ resource.Detector = (*CloudRun)(nil)

// NewCloudRun creates a CloudRun detector.
//
// Deprecated: Use gcp.NewDetector() instead. Note that it sets faas.* resource attributes instead of service.* attributes.
func NewCloudRun() *CloudRun {
	return &CloudRun{
		mc:     metadata.NewClient(nil),
		onGCE:  metadata.OnGCE,
		getenv: os.Getenv,
	}
}

func (c *CloudRun) cloudRegion() (string, error) {
	region, err := c.mc.Get("instance/region")
	if err != nil {
		return "", err
	}
	// Region from the metadata server is in the format /projects/123/regions/r.
	// https://cloud.google.com/run/docs/reference/container-contract#metadata-server
	return region[strings.LastIndex(region, "/")+1:], nil
}

// Detect detects associated resources when running on Cloud Run hosts.
// NOTE: the service.namespace attribute is currently hardcoded to be
// "cloud-run-managed". This may change in the future, please do not rely on
// this behavior yet.
func (c *CloudRun) Detect(context.Context) (*resource.Resource, error) {
	// .OnGCE is actually testing whether the metadata server is available.
	// Metadata server is supported on Cloud Run.
	if !c.onGCE() {
		return nil, nil
	}

	attributes := []attribute.KeyValue{
		semconv.CloudProviderGCP,
		semconv.ServiceNamespace(serviceNamespace),
	}

	var errInfo []string

	if projectID, err := c.mc.ProjectID(); hasProblem(err) {
		errInfo = append(errInfo, err.Error())
	} else if projectID != "" {
		attributes = append(attributes, semconv.CloudAccountID(projectID))
	}

	if region, err := c.cloudRegion(); hasProblem(err) {
		errInfo = append(errInfo, err.Error())
	} else if region != "" {
		attributes = append(attributes, semconv.CloudRegion(region))
	}

	if instanceID, err := c.mc.InstanceID(); hasProblem(err) {
		errInfo = append(errInfo, err.Error())
	} else if instanceID != "" {
		attributes = append(attributes, semconv.ServiceInstanceID(instanceID))
	}

	// Part of Cloud Run container runtime contract.
	// See https://cloud.google.com/run/docs/reference/container-contract
	if service := c.getenv("K_SERVICE"); service == "" {
		errInfo = append(errInfo, "envvar K_SERVICE contains empty string.")
	} else {
		attributes = append(attributes, semconv.ServiceName(service))
	}
	res := resource.NewWithAttributes(semconv.SchemaURL, attributes...)

	var aggregatedErr error
	if len(errInfo) > 0 {
		aggregatedErr = fmt.Errorf("detecting Cloud Run resources: %s", errInfo)
	}

	return res, aggregatedErr
}
