// Copyright 2022 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package gcp

import (
	"context"
	"fmt"
	"strings"
)

const (
	// If the kubernetes.default.svc service exists in the cluster,
	// then the KUBERNETES_SERVICE_HOST env var will be populated.
	// Use this as an indication that we are running on kubernetes.
	k8sServiceHostEnv = "KUBERNETES_SERVICE_HOST"
	// See the available GKE metadata:
	// https://cloud.google.com/kubernetes-engine/docs/concepts/workload-identity#instance_metadata
	clusterNameMetadataAttr     = "cluster-name"
	clusterLocationMetadataAttr = "cluster-location"
)

func (d *Detector) onGKE() bool {
	// Check if we are on k8s first
	_, found := d.os.LookupEnv(k8sServiceHostEnv)
	if !found {
		return false
	}
	// If we are on k8s, make sure that we are actually on GKE, and not a
	// different managed k8s platform.
	_, err := d.metadata.InstanceAttributeValueWithContext(context.TODO(), clusterLocationMetadataAttr)
	return err == nil
}

// GKEHostID returns the instance ID of the instance on which this program is running.
func (d *Detector) GKEHostID() (string, error) {
	return d.GCEHostID()
}

// GKEClusterName returns the name if the GKE cluster in which this program is running.
func (d *Detector) GKEClusterName() (string, error) {
	return d.metadata.InstanceAttributeValueWithContext(context.TODO(), clusterNameMetadataAttr)
}

type LocationType int64

const (
	UndefinedLocation LocationType = iota
	Zone
	Region
)

// GKEAvailabilityZoneOrRegion returns the location of the cluster and whether the cluster is zonal or regional.
func (d *Detector) GKEAvailabilityZoneOrRegion() (string, LocationType, error) {
	clusterLocation, err := d.metadata.InstanceAttributeValueWithContext(context.TODO(), clusterLocationMetadataAttr)
	if err != nil {
		return "", UndefinedLocation, err
	}
	switch strings.Count(clusterLocation, "-") {
	case 1:
		return clusterLocation, Region, nil
	case 2:
		return clusterLocation, Zone, nil
	default:
		return "", UndefinedLocation, fmt.Errorf("unrecognized format for cluster location: %v", clusterLocation)
	}
}
