// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package gcp // import "go.opentelemetry.io/contrib/detectors/gcp"

import "github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp"

// gcpDetector can detect attributes of GCP environments.
type gcpDetector interface {
	ProjectID() (string, error)
	CloudPlatform() gcp.Platform
	GKEAvailabilityZoneOrRegion() (string, gcp.LocationType, error)
	GKEClusterName() (string, error)
	GKEHostID() (string, error)
	FaaSName() (string, error)
	FaaSVersion() (string, error)
	FaaSID() (string, error)
	FaaSCloudRegion() (string, error)
	AppEngineFlexAvailabilityZoneAndRegion() (string, string, error)
	AppEngineStandardAvailabilityZone() (string, error)
	AppEngineStandardCloudRegion() (string, error)
	AppEngineServiceName() (string, error)
	AppEngineServiceVersion() (string, error)
	AppEngineServiceInstance() (string, error)
	GCEAvailabilityZoneAndRegion() (string, string, error)
	GCEHostType() (string, error)
	GCEHostID() (string, error)
	GCEHostName() (string, error)
	GCEInstanceHostname() (string, error)
	GCEInstanceName() (string, error)
	CloudRunJobExecution() (string, error)
	CloudRunJobTaskIndex() (string, error)
}
