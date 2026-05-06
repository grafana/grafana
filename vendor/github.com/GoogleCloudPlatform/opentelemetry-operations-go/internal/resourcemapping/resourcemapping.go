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

package resourcemapping

import (
	"strings"

	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	monitoredrespb "google.golang.org/genproto/googleapis/api/monitoredres"
)

const (
	ProjectIDAttributeKey = "gcp.project.id"

	awsAccount           = "aws_account"
	awsEc2Instance       = "aws_ec2_instance"
	clusterName          = "cluster_name"
	containerName        = "container_name"
	gceInstance          = "gce_instance"
	genericNode          = "generic_node"
	genericTask          = "generic_task"
	instanceID           = "instance_id"
	job                  = "job"
	k8sCluster           = "k8s_cluster"
	k8sContainer         = "k8s_container"
	k8sNode              = "k8s_node"
	k8sPod               = "k8s_pod"
	location             = "location"
	namespace            = "namespace"
	namespaceName        = "namespace_name"
	nodeID               = "node_id"
	nodeName             = "node_name"
	podName              = "pod_name"
	region               = "region"
	taskID               = "task_id"
	zone                 = "zone"
	gaeInstance          = "gae_instance"
	gaeApp               = "gae_app"
	gaeModuleID          = "module_id"
	gaeVersionID         = "version_id"
	cloudRunRevision     = "cloud_run_revision"
	cloudFunction        = "cloud_function"
	cloudFunctionName    = "function_name"
	serviceName          = "service_name"
	configurationName    = "configuration_name"
	revisionName         = "revision_name"
	bmsInstance          = "baremetalsolution.googleapis.com/Instance"
	unknownServicePrefix = "unknown_service"
)

var (
	// monitoredResourceMappings contains mappings of GCM resource label keys onto mapping config from OTel
	// resource for a given monitored resource type.
	monitoredResourceMappings = map[string]map[string]struct {
		// If none of the otelKeys are present in the Resource, fallback to this literal value
		fallbackLiteral string
		// OTel resource keys to try and populate the resource label from. For entries with
		// multiple OTel resource keys, the keys' values will be coalesced in order until there
		// is a non-empty value.
		otelKeys []string
	}{
		gceInstance: {
			zone:       {otelKeys: []string{string(semconv.CloudAvailabilityZoneKey)}},
			instanceID: {otelKeys: []string{string(semconv.HostIDKey)}},
		},
		k8sContainer: {
			location: {otelKeys: []string{
				string(semconv.CloudAvailabilityZoneKey),
				string(semconv.CloudRegionKey),
			}},
			clusterName:   {otelKeys: []string{string(semconv.K8SClusterNameKey)}},
			namespaceName: {otelKeys: []string{string(semconv.K8SNamespaceNameKey)}},
			podName:       {otelKeys: []string{string(semconv.K8SPodNameKey)}},
			containerName: {otelKeys: []string{string(semconv.K8SContainerNameKey)}},
		},
		k8sPod: {
			location: {otelKeys: []string{
				string(semconv.CloudAvailabilityZoneKey),
				string(semconv.CloudRegionKey),
			}},
			clusterName:   {otelKeys: []string{string(semconv.K8SClusterNameKey)}},
			namespaceName: {otelKeys: []string{string(semconv.K8SNamespaceNameKey)}},
			podName:       {otelKeys: []string{string(semconv.K8SPodNameKey)}},
		},
		k8sNode: {
			location: {otelKeys: []string{
				string(semconv.CloudAvailabilityZoneKey),
				string(semconv.CloudRegionKey),
			}},
			clusterName: {otelKeys: []string{string(semconv.K8SClusterNameKey)}},
			nodeName:    {otelKeys: []string{string(semconv.K8SNodeNameKey)}},
		},
		k8sCluster: {
			location: {otelKeys: []string{
				string(semconv.CloudAvailabilityZoneKey),
				string(semconv.CloudRegionKey),
			}},
			clusterName: {otelKeys: []string{string(semconv.K8SClusterNameKey)}},
		},
		gaeInstance: {
			location: {otelKeys: []string{
				string(semconv.CloudAvailabilityZoneKey),
				string(semconv.CloudRegionKey),
			}},
			gaeModuleID:  {otelKeys: []string{string(semconv.FaaSNameKey)}},
			gaeVersionID: {otelKeys: []string{string(semconv.FaaSVersionKey)}},
			instanceID:   {otelKeys: []string{string(semconv.FaaSInstanceKey)}},
		},
		gaeApp: {
			location: {otelKeys: []string{
				string(semconv.CloudAvailabilityZoneKey),
				string(semconv.CloudRegionKey),
			}},
			gaeModuleID:  {otelKeys: []string{string(semconv.FaaSNameKey)}},
			gaeVersionID: {otelKeys: []string{string(semconv.FaaSVersionKey)}},
		},
		awsEc2Instance: {
			instanceID: {otelKeys: []string{string(semconv.HostIDKey)}},
			region: {
				otelKeys: []string{
					string(semconv.CloudAvailabilityZoneKey),
					string(semconv.CloudRegionKey),
				},
			},
			awsAccount: {otelKeys: []string{string(semconv.CloudAccountIDKey)}},
		},
		bmsInstance: {
			location:   {otelKeys: []string{string(semconv.CloudRegionKey)}},
			instanceID: {otelKeys: []string{string(semconv.HostIDKey)}},
		},
		genericTask: {
			location: {
				otelKeys: []string{
					string(semconv.CloudAvailabilityZoneKey),
					string(semconv.CloudRegionKey),
				},
				fallbackLiteral: "global",
			},
			namespace: {otelKeys: []string{string(semconv.ServiceNamespaceKey)}},
			job:       {otelKeys: []string{string(semconv.ServiceNameKey), string(semconv.FaaSNameKey)}},
			taskID:    {otelKeys: []string{string(semconv.ServiceInstanceIDKey), string(semconv.FaaSInstanceKey)}},
		},
		genericNode: {
			location: {
				otelKeys: []string{
					string(semconv.CloudAvailabilityZoneKey),
					string(semconv.CloudRegionKey),
				},
				fallbackLiteral: "global",
			},
			namespace: {otelKeys: []string{string(semconv.ServiceNamespaceKey)}},
			nodeID:    {otelKeys: []string{string(semconv.HostIDKey), string(semconv.HostNameKey)}},
		},
	}
)

// ReadOnlyAttributes is an interface to abstract between pulling attributes from PData library or OTEL SDK.
type ReadOnlyAttributes interface {
	GetString(string) (string, bool)
}

// ResourceAttributesToLoggingMonitoredResource converts from a set of OTEL resource attributes into a
// GCP monitored resource type and label set for Cloud Logging.
// E.g.
// This may output `gce_instance` type with appropriate labels.
func ResourceAttributesToLoggingMonitoredResource(attrs ReadOnlyAttributes) *monitoredrespb.MonitoredResource {
	cloudPlatform, _ := attrs.GetString(string(semconv.CloudPlatformKey))
	switch cloudPlatform {
	case semconv.CloudPlatformGCPAppEngine.Value.AsString():
		return createMonitoredResource(gaeApp, attrs)
	default:
		return commonResourceAttributesToMonitoredResource(cloudPlatform, attrs)
	}
}

// ResourceAttributesToMonitoringMonitoredResource converts from a set of OTEL resource attributes into a
// GCP monitored resource type and label set for Cloud Monitoring
// E.g.
// This may output `gce_instance` type with appropriate labels.
func ResourceAttributesToMonitoringMonitoredResource(attrs ReadOnlyAttributes) *monitoredrespb.MonitoredResource {
	cloudPlatform, _ := attrs.GetString(string(semconv.CloudPlatformKey))
	switch cloudPlatform {
	case semconv.CloudPlatformGCPAppEngine.Value.AsString():
		return createMonitoredResource(gaeInstance, attrs)
	default:
		return commonResourceAttributesToMonitoredResource(cloudPlatform, attrs)
	}
}

func commonResourceAttributesToMonitoredResource(cloudPlatform string, attrs ReadOnlyAttributes) *monitoredrespb.MonitoredResource {
	switch cloudPlatform {
	case semconv.CloudPlatformGCPComputeEngine.Value.AsString():
		return createMonitoredResource(gceInstance, attrs)
	case semconv.CloudPlatformAWSEC2.Value.AsString():
		return createMonitoredResource(awsEc2Instance, attrs)
	// TODO(alex-basinov): replace this string literal with semconv.CloudPlatformGCPBareMetalSolution
	// once https://github.com/open-telemetry/semantic-conventions/pull/64 makes its way
	// into the semconv module.
	case "gcp_bare_metal_solution":
		return createMonitoredResource(bmsInstance, attrs)
	default:
		// if k8s.cluster.name is set, pattern match for various k8s resources.
		// this will also match non-cloud k8s platforms like minikube.
		if _, ok := attrs.GetString(string(semconv.K8SClusterNameKey)); ok {
			// Try for most to least specific k8s_container, k8s_pod, etc
			if _, ok := attrs.GetString(string(semconv.K8SContainerNameKey)); ok {
				return createMonitoredResource(k8sContainer, attrs)
			} else if _, ok := attrs.GetString(string(semconv.K8SPodNameKey)); ok {
				return createMonitoredResource(k8sPod, attrs)
			} else if _, ok := attrs.GetString(string(semconv.K8SNodeNameKey)); ok {
				return createMonitoredResource(k8sNode, attrs)
			}
			return createMonitoredResource(k8sCluster, attrs)
		}

		// Fallback to generic_task
		_, hasServiceName := attrs.GetString(string(semconv.ServiceNameKey))
		_, hasFaaSName := attrs.GetString(string(semconv.FaaSNameKey))
		_, hasServiceInstanceID := attrs.GetString(string(semconv.ServiceInstanceIDKey))
		_, hasFaaSInstance := attrs.GetString(string(semconv.FaaSInstanceKey))
		if (hasServiceName && hasServiceInstanceID) || (hasFaaSInstance && hasFaaSName) {
			return createMonitoredResource(genericTask, attrs)
		}

		// Everything else fallback to generic_node
		return createMonitoredResource(genericNode, attrs)
	}
}

func createMonitoredResource(
	monitoredResourceType string,
	resourceAttrs ReadOnlyAttributes,
) *monitoredrespb.MonitoredResource {
	mappings := monitoredResourceMappings[monitoredResourceType]
	mrLabels := make(map[string]string, len(mappings))

	for mrKey, mappingConfig := range mappings {
		mrValue := ""
		ok := false
		// Coalesce the possible keys in order
		for _, otelKey := range mappingConfig.otelKeys {
			mrValue, ok = resourceAttrs.GetString(otelKey)
			if mrValue != "" && !strings.HasPrefix(mrValue, unknownServicePrefix) {
				break
			}
		}
		if mrValue == "" && contains(mappingConfig.otelKeys, string(semconv.ServiceNameKey)) {
			// the service name started with unknown_service, and was ignored above
			mrValue, ok = resourceAttrs.GetString(string(semconv.ServiceNameKey))
		}
		if !ok || mrValue == "" {
			mrValue = mappingConfig.fallbackLiteral
		}
		mrLabels[mrKey] = sanitizeUTF8(mrValue)
	}
	return &monitoredrespb.MonitoredResource{
		Type:   monitoredResourceType,
		Labels: mrLabels,
	}
}

func contains(list []string, element string) bool {
	for _, item := range list {
		if item == element {
			return true
		}
	}
	return false
}

func sanitizeUTF8(s string) string {
	return strings.ToValidUTF8(s, "�")
}
