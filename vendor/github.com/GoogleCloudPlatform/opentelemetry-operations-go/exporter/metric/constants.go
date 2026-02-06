// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package metric

// TODO: remove this file when the constants are ready in the Go SDK

// Mappings for the well-known OpenTelemetry resource label keys
// to applicable Monitored Resource label keys.
// A uniquely identifying name for the Kubernetes cluster. Kubernetes
// does not have cluster names as an internal concept so this may be
// set to any meaningful value within the environment. For example,
// GKE clusters have a name which can be used for this label.
const (
	// Deprecated: use semconv.CloudProviderKey instead.
	CloudKeyProvider = "cloud.provider"
	// Deprecated: use semconv.CloudAccountIDKey instead.
	CloudKeyAccountID = "cloud.account.id"
	// Deprecated: use semconv.CloudRegionKey instead.
	CloudKeyRegion = "cloud.region"
	// Deprecated: use semconv.CloudAvailabilityZoneKey instead.
	CloudKeyZone = "cloud.availability_zone"

	// Deprecated: use semconv.ServiceNamespaceKey instead.
	ServiceKeyNamespace = "service.namespace"
	// Deprecated: use semconv.ServiceInstanceIDKey instead.
	ServiceKeyInstanceID = "service.instance.id"
	// Deprecated: use semconv.ServiceNameKey instead.
	ServiceKeyName = "service.name"

	// Deprecated: HostType is not needed.
	HostType = "host"
	// A uniquely identifying name for the host.
	// Deprecated: use semconv.HostNameKey instead.
	HostKeyName = "host.name"
	// A hostname as returned by the 'hostname' command on host machine.
	// Deprecated: HostKeyHostName is not needed.
	HostKeyHostName = "host.hostname"
	// Deprecated: use semconv.HostIDKey instead.
	HostKeyID = "host.id"
	// Deprecated: use semconv.HostTypeKey instead.
	HostKeyType = "host.type"

	// A uniquely identifying name for the Container.
	// Deprecated: use semconv.ContainerNameKey instead.
	ContainerKeyName = "container.name"
	// Deprecated: use semconv.ContainerImageNameKey instead.
	ContainerKeyImageName = "container.image.name"
	// Deprecated: use semconv.ContainerImageTagKey instead.
	ContainerKeyImageTag = "container.image.tag"

	// Cloud Providers
	// Deprecated: use semconv.CloudProviderAWS instead.
	CloudProviderAWS = "aws"
	// Deprecated: use semconv.CloudProviderGCP instead.
	CloudProviderGCP = "gcp"
	// Deprecated: use semconv.CloudProviderAzure instead.
	CloudProviderAZURE = "azure"

	// Deprecated: Use "k8s" instead. This should not be needed.
	K8S = "k8s"
	// Deprecated: use semconv.K8SClusterNameKey instead.
	K8SKeyClusterName = "k8s.cluster.name"
	// Deprecated: use semconv.K8SNamespaceNameKey instead.
	K8SKeyNamespaceName = "k8s.namespace.name"
	// Deprecated: use semconv.K8SPodNameKey instead.
	K8SKeyPodName = "k8s.pod.name"
	// Deprecated: use semconv.K8SDeploymentNameKey instead.
	K8SKeyDeploymentName = "k8s.deployment.name"

	// Monitored Resources types
	// Deprecated: Use "k8s_container" instead.
	K8SContainer = "k8s_container"
	// Deprecated: Use "k8s_node" instead.
	K8SNode = "k8s_node"
	// Deprecated: Use "k8s_pod" instead.
	K8SPod = "k8s_pod"
	// Deprecated: Use "k8s_cluster" instead.
	K8SCluster = "k8s_cluster"
	// Deprecated: Use "gce_instance" instead.
	GCEInstance = "gce_instance"
	// Deprecated: Use "aws_ec2_instance" instead.
	AWSEC2Instance = "aws_ec2_instance"
	// Deprecated: Use "generic_task" instead.
	GenericTask = "generic_task"
)
