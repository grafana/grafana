// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Code generated from semantic convention specification. DO NOT EDIT.

package semconv

// The web browser in which the application represented by the resource is running. The `browser.*` attributes MUST be used only for resources that represent applications running in a web browser (regardless of whether running on a mobile or desktop device).
const (
	// Array of brand name and version separated by a space
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: ' Not A;Brand 99', 'Chromium 99', 'Chrome 99'
	// Note: This value is intended to be taken from the UA client hints API
	// (navigator.userAgentData.brands).
	AttributeBrowserBrands = "browser.brands"
	// The platform on which the browser is running
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Windows', 'macOS', 'Android'
	// Note: This value is intended to be taken from the UA client hints API
	// (navigator.userAgentData.platform). If unavailable, the legacy
	// navigator.platform API SHOULD NOT be used instead and this attribute SHOULD be
	// left unset in order for the values to be consistent.
	// The list of possible values is defined in the W3C User-Agent Client Hints
	// specification. Note that some (but not all) of these values can overlap with
	// values in the os.type and os.name attributes. However, for consistency, the
	// values in the browser.platform attribute should capture the exact value that
	// the user agent provides.
	AttributeBrowserPlatform = "browser.platform"
	// A boolean that is true if the browser is running on a mobile device
	//
	// Type: boolean
	// Requirement Level: Optional
	// Stability: stable
	// Note: This value is intended to be taken from the UA client hints API
	// (navigator.userAgentData.mobile). If unavailable, this attribute SHOULD be left
	// unset.
	AttributeBrowserMobile = "browser.mobile"
	// Full user-agent string provided by the browser
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
	// (KHTML, '
	//  'like Gecko) Chrome/95.0.4638.54 Safari/537.36'
	// Note: The user-agent value SHOULD be provided only from browsers that do not
	// have a mechanism to retrieve brands and platform individually from the User-
	// Agent Client Hints API. To retrieve the value, the legacy navigator.userAgent
	// API can be used.
	AttributeBrowserUserAgent = "browser.user_agent"
	// Preferred language of the user using the browser
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'en', 'en-US', 'fr', 'fr-FR'
	// Note: This value is intended to be taken from the Navigator API
	// navigator.language.
	AttributeBrowserLanguage = "browser.language"
)

// A cloud environment (e.g. GCP, Azure, AWS)
const (
	// Name of the cloud provider.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	AttributeCloudProvider = "cloud.provider"
	// The cloud account ID the resource is assigned to.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '111111111111', 'opentelemetry'
	AttributeCloudAccountID = "cloud.account.id"
	// The geographical region the resource is running.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'us-central1', 'us-east-1'
	// Note: Refer to your provider's docs to see the available regions, for example
	// Alibaba Cloud regions, AWS regions, Azure regions, Google Cloud regions, or
	// Tencent Cloud regions.
	AttributeCloudRegion = "cloud.region"
	// Cloud regions often have multiple, isolated locations known as zones to
	// increase availability. Availability zone represents the zone where the resource
	// is running.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'us-east-1c'
	// Note: Availability zones are called &quot;zones&quot; on Alibaba Cloud and
	// Google Cloud.
	AttributeCloudAvailabilityZone = "cloud.availability_zone"
	// The cloud platform in use.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	// Note: The prefix of the service SHOULD match the one specified in
	// cloud.provider.
	AttributeCloudPlatform = "cloud.platform"
)

const (
	// Alibaba Cloud
	AttributeCloudProviderAlibabaCloud = "alibaba_cloud"
	// Amazon Web Services
	AttributeCloudProviderAWS = "aws"
	// Microsoft Azure
	AttributeCloudProviderAzure = "azure"
	// Google Cloud Platform
	AttributeCloudProviderGCP = "gcp"
	// IBM Cloud
	AttributeCloudProviderIbmCloud = "ibm_cloud"
	// Tencent Cloud
	AttributeCloudProviderTencentCloud = "tencent_cloud"
)

const (
	// Alibaba Cloud Elastic Compute Service
	AttributeCloudPlatformAlibabaCloudECS = "alibaba_cloud_ecs"
	// Alibaba Cloud Function Compute
	AttributeCloudPlatformAlibabaCloudFc = "alibaba_cloud_fc"
	// Red Hat OpenShift on Alibaba Cloud
	AttributeCloudPlatformAlibabaCloudOpenshift = "alibaba_cloud_openshift"
	// AWS Elastic Compute Cloud
	AttributeCloudPlatformAWSEC2 = "aws_ec2"
	// AWS Elastic Container Service
	AttributeCloudPlatformAWSECS = "aws_ecs"
	// AWS Elastic Kubernetes Service
	AttributeCloudPlatformAWSEKS = "aws_eks"
	// AWS Lambda
	AttributeCloudPlatformAWSLambda = "aws_lambda"
	// AWS Elastic Beanstalk
	AttributeCloudPlatformAWSElasticBeanstalk = "aws_elastic_beanstalk"
	// AWS App Runner
	AttributeCloudPlatformAWSAppRunner = "aws_app_runner"
	// Red Hat OpenShift on AWS (ROSA)
	AttributeCloudPlatformAWSOpenshift = "aws_openshift"
	// Azure Virtual Machines
	AttributeCloudPlatformAzureVM = "azure_vm"
	// Azure Container Instances
	AttributeCloudPlatformAzureContainerInstances = "azure_container_instances"
	// Azure Kubernetes Service
	AttributeCloudPlatformAzureAKS = "azure_aks"
	// Azure Functions
	AttributeCloudPlatformAzureFunctions = "azure_functions"
	// Azure App Service
	AttributeCloudPlatformAzureAppService = "azure_app_service"
	// Azure Red Hat OpenShift
	AttributeCloudPlatformAzureOpenshift = "azure_openshift"
	// Google Cloud Compute Engine (GCE)
	AttributeCloudPlatformGCPComputeEngine = "gcp_compute_engine"
	// Google Cloud Run
	AttributeCloudPlatformGCPCloudRun = "gcp_cloud_run"
	// Google Cloud Kubernetes Engine (GKE)
	AttributeCloudPlatformGCPKubernetesEngine = "gcp_kubernetes_engine"
	// Google Cloud Functions (GCF)
	AttributeCloudPlatformGCPCloudFunctions = "gcp_cloud_functions"
	// Google Cloud App Engine (GAE)
	AttributeCloudPlatformGCPAppEngine = "gcp_app_engine"
	// Red Hat OpenShift on Google Cloud
	AttributeCloudPlatformGoogleCloudOpenshift = "google_cloud_openshift"
	// Red Hat OpenShift on IBM Cloud
	AttributeCloudPlatformIbmCloudOpenshift = "ibm_cloud_openshift"
	// Tencent Cloud Cloud Virtual Machine (CVM)
	AttributeCloudPlatformTencentCloudCvm = "tencent_cloud_cvm"
	// Tencent Cloud Elastic Kubernetes Service (EKS)
	AttributeCloudPlatformTencentCloudEKS = "tencent_cloud_eks"
	// Tencent Cloud Serverless Cloud Function (SCF)
	AttributeCloudPlatformTencentCloudScf = "tencent_cloud_scf"
)

// Resources used by AWS Elastic Container Service (ECS).
const (
	// The Amazon Resource Name (ARN) of an ECS container instance.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'arn:aws:ecs:us-
	// west-1:123456789123:container/32624152-9086-4f0e-acae-1a75b14fe4d9'
	AttributeAWSECSContainerARN = "aws.ecs.container.arn"
	// The ARN of an ECS cluster.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'arn:aws:ecs:us-west-2:123456789123:cluster/my-cluster'
	AttributeAWSECSClusterARN = "aws.ecs.cluster.arn"
	// The launch type for an ECS task.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	AttributeAWSECSLaunchtype = "aws.ecs.launchtype"
	// The ARN of an ECS task definition.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'arn:aws:ecs:us-
	// west-1:123456789123:task/10838bed-421f-43ef-870a-f43feacbbb5b'
	AttributeAWSECSTaskARN = "aws.ecs.task.arn"
	// The task definition family this task definition is a member of.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry-family'
	AttributeAWSECSTaskFamily = "aws.ecs.task.family"
	// The revision for this task definition.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '8', '26'
	AttributeAWSECSTaskRevision = "aws.ecs.task.revision"
)

const (
	// ec2
	AttributeAWSECSLaunchtypeEC2 = "ec2"
	// fargate
	AttributeAWSECSLaunchtypeFargate = "fargate"
)

// Resources used by AWS Elastic Kubernetes Service (EKS).
const (
	// The ARN of an EKS cluster.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'arn:aws:ecs:us-west-2:123456789123:cluster/my-cluster'
	AttributeAWSEKSClusterARN = "aws.eks.cluster.arn"
)

// Resources specific to Amazon Web Services.
const (
	// The name(s) of the AWS log group(s) an application is writing to.
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '/aws/lambda/my-function', 'opentelemetry-service'
	// Note: Multiple log groups must be supported for cases like multi-container
	// applications, where a single application has sidecar containers, and each write
	// to their own log group.
	AttributeAWSLogGroupNames = "aws.log.group.names"
	// The Amazon Resource Name(s) (ARN) of the AWS log group(s).
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'arn:aws:logs:us-west-1:123456789012:log-group:/aws/my/group:*'
	// Note: See the log group ARN format documentation.
	AttributeAWSLogGroupARNs = "aws.log.group.arns"
	// The name(s) of the AWS log stream(s) an application is writing to.
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'logs/main/10838bed-421f-43ef-870a-f43feacbbb5b'
	AttributeAWSLogStreamNames = "aws.log.stream.names"
	// The ARN(s) of the AWS log stream(s).
	//
	// Type: string[]
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'arn:aws:logs:us-west-1:123456789012:log-group:/aws/my/group:log-
	// stream:logs/main/10838bed-421f-43ef-870a-f43feacbbb5b'
	// Note: See the log stream ARN format documentation. One log group can contain
	// several log streams, so these ARNs necessarily identify both a log group and a
	// log stream.
	AttributeAWSLogStreamARNs = "aws.log.stream.arns"
)

// A container instance.
const (
	// Container name used by container runtime.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry-autoconf'
	AttributeContainerName = "container.name"
	// Container ID. Usually a UUID, as for example used to identify Docker
	// containers. The UUID might be abbreviated.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'a3bf90e006b2'
	AttributeContainerID = "container.id"
	// The container runtime managing this container.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'docker', 'containerd', 'rkt'
	AttributeContainerRuntime = "container.runtime"
	// Name of the image the container was built on.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'gcr.io/opentelemetry/operator'
	AttributeContainerImageName = "container.image.name"
	// Container image tag.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '0.1'
	AttributeContainerImageTag = "container.image.tag"
)

// The software deployment.
const (
	// Name of the deployment environment (aka deployment tier).
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'staging', 'production'
	AttributeDeploymentEnvironment = "deployment.environment"
)

// The device on which the process represented by this resource is running.
const (
	// A unique identifier representing the device
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '2ab2916d-a51f-4ac8-80ee-45ac31a28092'
	// Note: The device identifier MUST only be defined using the values outlined
	// below. This value is not an advertising identifier and MUST NOT be used as
	// such. On iOS (Swift or Objective-C), this value MUST be equal to the vendor
	// identifier. On Android (Java or Kotlin), this value MUST be equal to the
	// Firebase Installation ID or a globally unique UUID which is persisted across
	// sessions in your application. More information can be found here on best
	// practices and exact implementation details. Caution should be taken when
	// storing personal data or anything which can identify a user. GDPR and data
	// protection laws may apply, ensure you do your own due diligence.
	AttributeDeviceID = "device.id"
	// The model identifier for the device
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'iPhone3,4', 'SM-G920F'
	// Note: It's recommended this value represents a machine readable version of the
	// model identifier rather than the market or consumer-friendly name of the
	// device.
	AttributeDeviceModelIdentifier = "device.model.identifier"
	// The marketing name for the device model
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'iPhone 6s Plus', 'Samsung Galaxy S6'
	// Note: It's recommended this value represents a human readable version of the
	// device model rather than a machine readable alternative.
	AttributeDeviceModelName = "device.model.name"
	// The name of the device manufacturer
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Apple', 'Samsung'
	// Note: The Android OS provides this field via Build. iOS apps SHOULD hardcode
	// the value Apple.
	AttributeDeviceManufacturer = "device.manufacturer"
)

// A serverless instance.
const (
	// The name of the single function that this runtime instance executes.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'my-function', 'myazurefunctionapp/some-function-name'
	// Note: This is the name of the function as configured/deployed on the FaaS
	// platform and is usually different from the name of the callback
	// function (which may be stored in the
	// code.namespace/code.function
	// span attributes).For some cloud providers, the above definition is ambiguous.
	// The following
	// definition of function name MUST be used for this attribute
	// (and consequently the span name) for the listed cloud providers/products:<ul>
	// <li>Azure:  The full name <FUNCAPP>/<FUNC>, i.e., function app name
	// followed by a forward slash followed by the function name (this form
	// can also be seen in the resource JSON for the function).
	// This means that a span attribute MUST be used, as an Azure function
	// app can host multiple functions that would usually share
	// a TracerProvider (see also the faas.id attribute).</li>
	// </ul>
	AttributeFaaSName = "faas.name"
	// The unique ID of the single function that this runtime instance executes.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'arn:aws:lambda:us-west-2:123456789012:function:my-function'
	// Note: On some cloud providers, it may not be possible to determine the full ID
	// at startup,
	// so consider setting faas.id as a span attribute instead.The exact value to use
	// for faas.id depends on the cloud provider:<ul>
	// <li>AWS Lambda: The function ARN.
	// Take care not to use the &quot;invoked ARN&quot; directly but replace any
	// alias suffix
	// with the resolved function version, as the same runtime instance may be
	// invocable with
	// multiple different aliases.</li>
	// <li>GCP: The URI of the resource</li>
	// <li>Azure: The Fully Qualified Resource ID of the invoked function,
	// not the function app, having the form
	// /subscriptions/<SUBSCRIPTION_GUID>/resourceGroups/<RG>/providers/Microsoft.Web/s
	// ites/<FUNCAPP>/functions/<FUNC>.
	// This means that a span attribute MUST be used, as an Azure function app can
	// host multiple functions that would usually share
	// a TracerProvider.</li>
	// </ul>
	AttributeFaaSID = "faas.id"
	// The immutable version of the function being executed.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '26', 'pinkfroid-00002'
	// Note: Depending on the cloud provider and platform, use:<ul>
	// <li>AWS Lambda: The function version
	// (an integer represented as a decimal string).</li>
	// <li>Google Cloud Run: The revision
	// (i.e., the function name plus the revision suffix).</li>
	// <li>Google Cloud Functions: The value of the
	// K_REVISION environment variable.</li>
	// <li>Azure Functions: Not applicable. Do not set this attribute.</li>
	// </ul>
	AttributeFaaSVersion = "faas.version"
	// The execution environment ID as a string, that will be potentially reused for
	// other invocations to the same function/function version.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '2021/06/28/[$LATEST]2f399eb14537447da05ab2a2e39309de'
	// Note: <ul>
	// <li>AWS Lambda: Use the (full) log stream name.</li>
	// </ul>
	AttributeFaaSInstance = "faas.instance"
	// The amount of memory available to the serverless function in MiB.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 128
	// Note: It's recommended to set this attribute since e.g. too little memory can
	// easily stop a Java AWS Lambda function from working correctly. On AWS Lambda,
	// the environment variable AWS_LAMBDA_FUNCTION_MEMORY_SIZE provides this
	// information.
	AttributeFaaSMaxMemory = "faas.max_memory"
)

// A host is defined as a general computing instance.
const (
	// Unique host ID. For Cloud, this must be the instance_id assigned by the cloud
	// provider. For non-containerized Linux systems, the machine-id located in
	// /etc/machine-id or /var/lib/dbus/machine-id may be used.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'fdbf79e8af94cb7f9e8df36789187052'
	AttributeHostID = "host.id"
	// Name of the host. On Unix systems, it may contain what the hostname command
	// returns, or the fully qualified hostname, or another name specified by the
	// user.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry-test'
	AttributeHostName = "host.name"
	// Type of host. For Cloud, this must be the machine type.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'n1-standard-1'
	AttributeHostType = "host.type"
	// The CPU architecture the host system is running on.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	AttributeHostArch = "host.arch"
	// Name of the VM image or OS install the host was instantiated from.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'infra-ami-eks-worker-node-7d4ec78312', 'CentOS-8-x86_64-1905'
	AttributeHostImageName = "host.image.name"
	// VM image ID. For Cloud, this value is from the provider.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'ami-07b06b442921831e5'
	AttributeHostImageID = "host.image.id"
	// The version string of the VM image as defined in Version Attributes.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '0.1'
	AttributeHostImageVersion = "host.image.version"
)

const (
	// AMD64
	AttributeHostArchAMD64 = "amd64"
	// ARM32
	AttributeHostArchARM32 = "arm32"
	// ARM64
	AttributeHostArchARM64 = "arm64"
	// Itanium
	AttributeHostArchIA64 = "ia64"
	// 32-bit PowerPC
	AttributeHostArchPPC32 = "ppc32"
	// 64-bit PowerPC
	AttributeHostArchPPC64 = "ppc64"
	// IBM z/Architecture
	AttributeHostArchS390x = "s390x"
	// 32-bit x86
	AttributeHostArchX86 = "x86"
)

// A Kubernetes Cluster.
const (
	// The name of the cluster.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry-cluster'
	AttributeK8SClusterName = "k8s.cluster.name"
)

// A Kubernetes Node object.
const (
	// The name of the Node.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'node-1'
	AttributeK8SNodeName = "k8s.node.name"
	// The UID of the Node.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '1eb3a0c6-0477-4080-a9cb-0cb7db65c6a2'
	AttributeK8SNodeUID = "k8s.node.uid"
)

// A Kubernetes Namespace.
const (
	// The name of the namespace that the pod is running in.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'default'
	AttributeK8SNamespaceName = "k8s.namespace.name"
)

// A Kubernetes Pod object.
const (
	// The UID of the Pod.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '275ecb36-5aa8-4c2a-9c47-d8bb681b9aff'
	AttributeK8SPodUID = "k8s.pod.uid"
	// The name of the Pod.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry-pod-autoconf'
	AttributeK8SPodName = "k8s.pod.name"
)

// A container in a [PodTemplate](https://kubernetes.io/docs/concepts/workloads/pods/#pod-templates).
const (
	// The name of the Container from Pod specification, must be unique within a Pod.
	// Container runtime usually uses different globally unique name (container.name).
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'redis'
	AttributeK8SContainerName = "k8s.container.name"
	// Number of times the container was restarted. This attribute can be used to
	// identify a particular container (running or stopped) within a container spec.
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 0, 2
	AttributeK8SContainerRestartCount = "k8s.container.restart_count"
)

// A Kubernetes ReplicaSet object.
const (
	// The UID of the ReplicaSet.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '275ecb36-5aa8-4c2a-9c47-d8bb681b9aff'
	AttributeK8SReplicaSetUID = "k8s.replicaset.uid"
	// The name of the ReplicaSet.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry'
	AttributeK8SReplicaSetName = "k8s.replicaset.name"
)

// A Kubernetes Deployment object.
const (
	// The UID of the Deployment.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '275ecb36-5aa8-4c2a-9c47-d8bb681b9aff'
	AttributeK8SDeploymentUID = "k8s.deployment.uid"
	// The name of the Deployment.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry'
	AttributeK8SDeploymentName = "k8s.deployment.name"
)

// A Kubernetes StatefulSet object.
const (
	// The UID of the StatefulSet.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '275ecb36-5aa8-4c2a-9c47-d8bb681b9aff'
	AttributeK8SStatefulSetUID = "k8s.statefulset.uid"
	// The name of the StatefulSet.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry'
	AttributeK8SStatefulSetName = "k8s.statefulset.name"
)

// A Kubernetes DaemonSet object.
const (
	// The UID of the DaemonSet.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '275ecb36-5aa8-4c2a-9c47-d8bb681b9aff'
	AttributeK8SDaemonSetUID = "k8s.daemonset.uid"
	// The name of the DaemonSet.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry'
	AttributeK8SDaemonSetName = "k8s.daemonset.name"
)

// A Kubernetes Job object.
const (
	// The UID of the Job.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '275ecb36-5aa8-4c2a-9c47-d8bb681b9aff'
	AttributeK8SJobUID = "k8s.job.uid"
	// The name of the Job.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry'
	AttributeK8SJobName = "k8s.job.name"
)

// A Kubernetes CronJob object.
const (
	// The UID of the CronJob.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '275ecb36-5aa8-4c2a-9c47-d8bb681b9aff'
	AttributeK8SCronJobUID = "k8s.cronjob.uid"
	// The name of the CronJob.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry'
	AttributeK8SCronJobName = "k8s.cronjob.name"
)

// The operating system (OS) on which the process represented by this resource is running.
const (
	// The operating system type.
	//
	// Type: Enum
	// Requirement Level: Required
	// Stability: stable
	AttributeOSType = "os.type"
	// Human readable (not intended to be parsed) OS version information, like e.g.
	// reported by ver or lsb_release -a commands.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Microsoft Windows [Version 10.0.18363.778]', 'Ubuntu 18.04.1 LTS'
	AttributeOSDescription = "os.description"
	// Human readable operating system name.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'iOS', 'Android', 'Ubuntu'
	AttributeOSName = "os.name"
	// The version string of the operating system as defined in Version Attributes.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '14.2.1', '18.04.1'
	AttributeOSVersion = "os.version"
)

const (
	// Microsoft Windows
	AttributeOSTypeWindows = "windows"
	// Linux
	AttributeOSTypeLinux = "linux"
	// Apple Darwin
	AttributeOSTypeDarwin = "darwin"
	// FreeBSD
	AttributeOSTypeFreeBSD = "freebsd"
	// NetBSD
	AttributeOSTypeNetBSD = "netbsd"
	// OpenBSD
	AttributeOSTypeOpenBSD = "openbsd"
	// DragonFly BSD
	AttributeOSTypeDragonflyBSD = "dragonflybsd"
	// HP-UX (Hewlett Packard Unix)
	AttributeOSTypeHPUX = "hpux"
	// AIX (Advanced Interactive eXecutive)
	AttributeOSTypeAIX = "aix"
	// SunOS, Oracle Solaris
	AttributeOSTypeSolaris = "solaris"
	// IBM z/OS
	AttributeOSTypeZOS = "z_os"
)

// An operating system process.
const (
	// Process identifier (PID).
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 1234
	AttributeProcessPID = "process.pid"
	// Parent Process identifier (PID).
	//
	// Type: int
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 111
	AttributeProcessParentPID = "process.parent_pid"
	// The name of the process executable. On Linux based systems, can be set to the
	// Name in proc/[pid]/status. On Windows, can be set to the base name of
	// GetProcessImageFileNameW.
	//
	// Type: string
	// Requirement Level: Conditionally Required - See alternative attributes below.
	// Stability: stable
	// Examples: 'otelcol'
	AttributeProcessExecutableName = "process.executable.name"
	// The full path to the process executable. On Linux based systems, can be set to
	// the target of proc/[pid]/exe. On Windows, can be set to the result of
	// GetProcessImageFileNameW.
	//
	// Type: string
	// Requirement Level: Conditionally Required - See alternative attributes below.
	// Stability: stable
	// Examples: '/usr/bin/cmd/otelcol'
	AttributeProcessExecutablePath = "process.executable.path"
	// The command used to launch the process (i.e. the command name). On Linux based
	// systems, can be set to the zeroth string in proc/[pid]/cmdline. On Windows, can
	// be set to the first parameter extracted from GetCommandLineW.
	//
	// Type: string
	// Requirement Level: Conditionally Required - See alternative attributes below.
	// Stability: stable
	// Examples: 'cmd/otelcol'
	AttributeProcessCommand = "process.command"
	// The full command used to launch the process as a single string representing the
	// full command. On Windows, can be set to the result of GetCommandLineW. Do not
	// set this if you have to assemble it just for monitoring; use
	// process.command_args instead.
	//
	// Type: string
	// Requirement Level: Conditionally Required - See alternative attributes below.
	// Stability: stable
	// Examples: 'C:\\cmd\\otecol --config="my directory\\config.yaml"'
	AttributeProcessCommandLine = "process.command_line"
	// All the command arguments (including the command/executable itself) as received
	// by the process. On Linux-based systems (and some other Unixoid systems
	// supporting procfs), can be set according to the list of null-delimited strings
	// extracted from proc/[pid]/cmdline. For libc-based executables, this would be
	// the full argv vector passed to main.
	//
	// Type: string[]
	// Requirement Level: Conditionally Required - See alternative attributes below.
	// Stability: stable
	// Examples: 'cmd/otecol', '--config=config.yaml'
	AttributeProcessCommandArgs = "process.command_args"
	// The username of the user that owns the process.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'root'
	AttributeProcessOwner = "process.owner"
)

// The single (language) runtime instance which is monitored.
const (
	// The name of the runtime of this process. For compiled native binaries, this
	// SHOULD be the name of the compiler.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'OpenJDK Runtime Environment'
	AttributeProcessRuntimeName = "process.runtime.name"
	// The version of the runtime of this process, as returned by the runtime without
	// modification.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '14.0.2'
	AttributeProcessRuntimeVersion = "process.runtime.version"
	// An additional description about the runtime of the process, for example a
	// specific vendor customization of the runtime environment.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Eclipse OpenJ9 Eclipse OpenJ9 VM openj9-0.21.0'
	AttributeProcessRuntimeDescription = "process.runtime.description"
)

// A service instance.
const (
	// Logical name of the service.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'shoppingcart'
	// Note: MUST be the same for all instances of horizontally scaled services. If
	// the value was not specified, SDKs MUST fallback to unknown_service:
	// concatenated with process.executable.name, e.g. unknown_service:bash. If
	// process.executable.name is not available, the value MUST be set to
	// unknown_service.
	AttributeServiceName = "service.name"
	// A namespace for service.name.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'Shop'
	// Note: A string value having a meaning that helps to distinguish a group of
	// services, for example the team name that owns a group of services. service.name
	// is expected to be unique within the same namespace. If service.namespace is not
	// specified in the Resource then service.name is expected to be unique for all
	// services that have no explicit namespace defined (so the empty/unspecified
	// namespace is simply one more valid namespace). Zero-length namespace string is
	// assumed equal to unspecified namespace.
	AttributeServiceNamespace = "service.namespace"
	// The string ID of the service instance.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '627cc493-f310-47de-96bd-71410b7dec09'
	// Note: MUST be unique for each instance of the same
	// service.namespace,service.name pair (in other words
	// service.namespace,service.name,service.instance.id triplet MUST be globally
	// unique). The ID helps to distinguish instances of the same service that exist
	// at the same time (e.g. instances of a horizontally scaled service). It is
	// preferable for the ID to be persistent and stay the same for the lifetime of
	// the service instance, however it is acceptable that the ID is ephemeral and
	// changes during important lifetime events for the service (e.g. service
	// restarts). If the service has no inherent unique ID that can be used as the
	// value of this attribute it is recommended to generate a random Version 1 or
	// Version 4 RFC 4122 UUID (services aiming for reproducible UUIDs may also use
	// Version 5, see RFC 4122 for more recommendations).
	AttributeServiceInstanceID = "service.instance.id"
	// The version string of the service API or implementation.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '2.0.0'
	AttributeServiceVersion = "service.version"
)

// The telemetry SDK used to capture data recorded by the instrumentation libraries.
const (
	// The name of the telemetry SDK as defined above.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'opentelemetry'
	AttributeTelemetrySDKName = "telemetry.sdk.name"
	// The language of the telemetry SDK.
	//
	// Type: Enum
	// Requirement Level: Optional
	// Stability: stable
	AttributeTelemetrySDKLanguage = "telemetry.sdk.language"
	// The version string of the telemetry SDK.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '1.2.3'
	AttributeTelemetrySDKVersion = "telemetry.sdk.version"
	// The version string of the auto instrumentation agent, if used.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '1.2.3'
	AttributeTelemetryAutoVersion = "telemetry.auto.version"
)

const (
	// cpp
	AttributeTelemetrySDKLanguageCPP = "cpp"
	// dotnet
	AttributeTelemetrySDKLanguageDotnet = "dotnet"
	// erlang
	AttributeTelemetrySDKLanguageErlang = "erlang"
	// go
	AttributeTelemetrySDKLanguageGo = "go"
	// java
	AttributeTelemetrySDKLanguageJava = "java"
	// nodejs
	AttributeTelemetrySDKLanguageNodejs = "nodejs"
	// php
	AttributeTelemetrySDKLanguagePHP = "php"
	// python
	AttributeTelemetrySDKLanguagePython = "python"
	// ruby
	AttributeTelemetrySDKLanguageRuby = "ruby"
	// webjs
	AttributeTelemetrySDKLanguageWebjs = "webjs"
	// swift
	AttributeTelemetrySDKLanguageSwift = "swift"
)

// Resource describing the packaged software running the application code. Web engines are typically executed using process.runtime.
const (
	// The name of the web engine.
	//
	// Type: string
	// Requirement Level: Required
	// Stability: stable
	// Examples: 'WildFly'
	AttributeWebEngineName = "webengine.name"
	// The version of the web engine.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '21.0.0'
	AttributeWebEngineVersion = "webengine.version"
	// Additional description of the web engine (e.g. detailed version and edition
	// information).
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'WildFly Full 21.0.0.Final (WildFly Core 13.0.1.Final) - 2.2.2.Final'
	AttributeWebEngineDescription = "webengine.description"
)

// Attributes used by non-OTLP exporters to represent OpenTelemetry Scope's concepts.
const (
	// The name of the instrumentation scope - (InstrumentationScope.Name in OTLP).
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: 'io.opentelemetry.contrib.mongodb'
	AttributeOtelScopeName = "otel.scope.name"
	// The version of the instrumentation scope - (InstrumentationScope.Version in
	// OTLP).
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: stable
	// Examples: '1.0.0'
	AttributeOtelScopeVersion = "otel.scope.version"
)

// Span attributes used by non-OTLP exporters to represent OpenTelemetry Scope's concepts.
const (
	// Deprecated, use the otel.scope.name attribute.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: deprecated
	// Examples: 'io.opentelemetry.contrib.mongodb'
	AttributeOtelLibraryName = "otel.library.name"
	// Deprecated, use the otel.scope.version attribute.
	//
	// Type: string
	// Requirement Level: Optional
	// Stability: deprecated
	// Examples: '1.0.0'
	AttributeOtelLibraryVersion = "otel.library.version"
)

func GetResourceSemanticConventionAttributeNames() []string {
	return []string{
		AttributeBrowserBrands,
		AttributeBrowserPlatform,
		AttributeBrowserMobile,
		AttributeBrowserUserAgent,
		AttributeBrowserLanguage,
		AttributeCloudProvider,
		AttributeCloudAccountID,
		AttributeCloudRegion,
		AttributeCloudAvailabilityZone,
		AttributeCloudPlatform,
		AttributeAWSECSContainerARN,
		AttributeAWSECSClusterARN,
		AttributeAWSECSLaunchtype,
		AttributeAWSECSTaskARN,
		AttributeAWSECSTaskFamily,
		AttributeAWSECSTaskRevision,
		AttributeAWSEKSClusterARN,
		AttributeAWSLogGroupNames,
		AttributeAWSLogGroupARNs,
		AttributeAWSLogStreamNames,
		AttributeAWSLogStreamARNs,
		AttributeContainerName,
		AttributeContainerID,
		AttributeContainerRuntime,
		AttributeContainerImageName,
		AttributeContainerImageTag,
		AttributeDeploymentEnvironment,
		AttributeDeviceID,
		AttributeDeviceModelIdentifier,
		AttributeDeviceModelName,
		AttributeDeviceManufacturer,
		AttributeFaaSName,
		AttributeFaaSID,
		AttributeFaaSVersion,
		AttributeFaaSInstance,
		AttributeFaaSMaxMemory,
		AttributeHostID,
		AttributeHostName,
		AttributeHostType,
		AttributeHostArch,
		AttributeHostImageName,
		AttributeHostImageID,
		AttributeHostImageVersion,
		AttributeK8SClusterName,
		AttributeK8SNodeName,
		AttributeK8SNodeUID,
		AttributeK8SNamespaceName,
		AttributeK8SPodUID,
		AttributeK8SPodName,
		AttributeK8SContainerName,
		AttributeK8SContainerRestartCount,
		AttributeK8SReplicaSetUID,
		AttributeK8SReplicaSetName,
		AttributeK8SDeploymentUID,
		AttributeK8SDeploymentName,
		AttributeK8SStatefulSetUID,
		AttributeK8SStatefulSetName,
		AttributeK8SDaemonSetUID,
		AttributeK8SDaemonSetName,
		AttributeK8SJobUID,
		AttributeK8SJobName,
		AttributeK8SCronJobUID,
		AttributeK8SCronJobName,
		AttributeOSType,
		AttributeOSDescription,
		AttributeOSName,
		AttributeOSVersion,
		AttributeProcessPID,
		AttributeProcessParentPID,
		AttributeProcessExecutableName,
		AttributeProcessExecutablePath,
		AttributeProcessCommand,
		AttributeProcessCommandLine,
		AttributeProcessCommandArgs,
		AttributeProcessOwner,
		AttributeProcessRuntimeName,
		AttributeProcessRuntimeVersion,
		AttributeProcessRuntimeDescription,
		AttributeServiceName,
		AttributeServiceNamespace,
		AttributeServiceInstanceID,
		AttributeServiceVersion,
		AttributeTelemetrySDKName,
		AttributeTelemetrySDKLanguage,
		AttributeTelemetrySDKVersion,
		AttributeTelemetryAutoVersion,
		AttributeWebEngineName,
		AttributeWebEngineVersion,
		AttributeWebEngineDescription,
		AttributeOtelScopeName,
		AttributeOtelScopeVersion,
		AttributeOtelLibraryName,
		AttributeOtelLibraryVersion,
	}
}
