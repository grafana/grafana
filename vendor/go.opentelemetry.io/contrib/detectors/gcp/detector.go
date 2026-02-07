// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package gcp // import "go.opentelemetry.io/contrib/detectors/gcp"

import (
	"context"
	"fmt"
	"strconv"

	"cloud.google.com/go/compute/metadata"
	"github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0"
)

// NewDetector returns a resource detector which detects resource attributes on:
// * Google Compute Engine (GCE).
// * Google Kubernetes Engine (GKE).
// * Google App Engine (GAE).
// * Cloud Run.
// * Cloud Functions.
func NewDetector() resource.Detector {
	return &detector{detector: gcp.NewDetector()}
}

type detector struct {
	detector gcpDetector
}

// Detect detects associated resources when running on GCE, GKE, GAE,
// Cloud Run, and Cloud functions.
func (d *detector) Detect(context.Context) (*resource.Resource, error) {
	if !metadata.OnGCE() {
		return nil, nil
	}
	b := &resourceBuilder{}
	b.attrs = append(b.attrs, semconv.CloudProviderGCP)
	b.add(semconv.CloudAccountIDKey, d.detector.ProjectID)

	switch d.detector.CloudPlatform() {
	case gcp.GKE:
		b.attrs = append(b.attrs, semconv.CloudPlatformGCPKubernetesEngine)
		b.addZoneOrRegion(d.detector.GKEAvailabilityZoneOrRegion)
		b.add(semconv.K8SClusterNameKey, d.detector.GKEClusterName)
		b.add(semconv.HostIDKey, d.detector.GKEHostID)
	case gcp.CloudRun:
		b.attrs = append(b.attrs, semconv.CloudPlatformGCPCloudRun)
		b.add(semconv.FaaSNameKey, d.detector.FaaSName)
		b.add(semconv.FaaSVersionKey, d.detector.FaaSVersion)
		b.add(semconv.FaaSInstanceKey, d.detector.FaaSID)
		b.add(semconv.CloudRegionKey, d.detector.FaaSCloudRegion)
	case gcp.CloudRunJob:
		b.attrs = append(b.attrs, semconv.CloudPlatformGCPCloudRun)
		b.add(semconv.FaaSNameKey, d.detector.FaaSName)
		b.add(semconv.FaaSInstanceKey, d.detector.FaaSID)
		b.add(semconv.GCPCloudRunJobExecutionKey, d.detector.CloudRunJobExecution)
		b.addInt(semconv.GCPCloudRunJobTaskIndexKey, d.detector.CloudRunJobTaskIndex)
		b.add(semconv.CloudRegionKey, d.detector.FaaSCloudRegion)
	case gcp.CloudFunctions:
		b.attrs = append(b.attrs, semconv.CloudPlatformGCPCloudFunctions)
		b.add(semconv.FaaSNameKey, d.detector.FaaSName)
		b.add(semconv.FaaSVersionKey, d.detector.FaaSVersion)
		b.add(semconv.FaaSInstanceKey, d.detector.FaaSID)
		b.add(semconv.CloudRegionKey, d.detector.FaaSCloudRegion)
	case gcp.AppEngineFlex:
		b.attrs = append(b.attrs, semconv.CloudPlatformGCPAppEngine)
		b.addZoneAndRegion(d.detector.AppEngineFlexAvailabilityZoneAndRegion)
		b.add(semconv.FaaSNameKey, d.detector.AppEngineServiceName)
		b.add(semconv.FaaSVersionKey, d.detector.AppEngineServiceVersion)
		b.add(semconv.FaaSInstanceKey, d.detector.AppEngineServiceInstance)
	case gcp.AppEngineStandard:
		b.attrs = append(b.attrs, semconv.CloudPlatformGCPAppEngine)
		b.add(semconv.CloudAvailabilityZoneKey, d.detector.AppEngineStandardAvailabilityZone)
		b.add(semconv.CloudRegionKey, d.detector.AppEngineStandardCloudRegion)
		b.add(semconv.FaaSNameKey, d.detector.AppEngineServiceName)
		b.add(semconv.FaaSVersionKey, d.detector.AppEngineServiceVersion)
		b.add(semconv.FaaSInstanceKey, d.detector.AppEngineServiceInstance)
	case gcp.GCE:
		b.attrs = append(b.attrs, semconv.CloudPlatformGCPComputeEngine)
		b.addZoneAndRegion(d.detector.GCEAvailabilityZoneAndRegion)
		b.add(semconv.HostTypeKey, d.detector.GCEHostType)
		b.add(semconv.HostIDKey, d.detector.GCEHostID)
		b.add(semconv.HostNameKey, d.detector.GCEHostName)
		b.add(semconv.GCPGCEInstanceNameKey, d.detector.GCEInstanceName)
		b.add(semconv.GCPGCEInstanceHostnameKey, d.detector.GCEInstanceHostname)
	default:
		// We don't support this platform yet, so just return with what we have
	}
	return b.build()
}

// resourceBuilder simplifies constructing resources using GCP detection
// library functions.
type resourceBuilder struct {
	errs  []error
	attrs []attribute.KeyValue
}

func (r *resourceBuilder) add(key attribute.Key, detect func() (string, error)) {
	if v, err := detect(); err == nil {
		r.attrs = append(r.attrs, key.String(v))
	} else {
		r.errs = append(r.errs, err)
	}
}

func (r *resourceBuilder) addInt(key attribute.Key, detect func() (string, error)) {
	if v, err := detect(); err == nil {
		if vi, err := strconv.Atoi(v); err == nil {
			r.attrs = append(r.attrs, key.Int(vi))
		} else {
			r.errs = append(r.errs, err)
		}
	} else {
		r.errs = append(r.errs, err)
	}
}

// zoneAndRegion functions are expected to return zone, region, err.
func (r *resourceBuilder) addZoneAndRegion(detect func() (string, string, error)) {
	if zone, region, err := detect(); err == nil {
		r.attrs = append(
			r.attrs,
			semconv.CloudAvailabilityZone(zone),
			semconv.CloudRegion(region),
		)
	} else {
		r.errs = append(r.errs, err)
	}
}

func (r *resourceBuilder) addZoneOrRegion(detect func() (string, gcp.LocationType, error)) {
	if v, locType, err := detect(); err == nil {
		switch locType {
		case gcp.Zone:
			r.attrs = append(r.attrs, semconv.CloudAvailabilityZone(v))
		case gcp.Region:
			r.attrs = append(r.attrs, semconv.CloudRegion(v))
		default:
			r.errs = append(r.errs, fmt.Errorf("location must be zone or region. Got %v", locType))
		}
	} else {
		r.errs = append(r.errs, err)
	}
}

func (r *resourceBuilder) build() (*resource.Resource, error) {
	var err error
	if len(r.errs) > 0 {
		err = fmt.Errorf("%w: %s", resource.ErrPartialResource, r.errs)
	}
	return resource.NewWithAttributes(semconv.SchemaURL, r.attrs...), err
}
