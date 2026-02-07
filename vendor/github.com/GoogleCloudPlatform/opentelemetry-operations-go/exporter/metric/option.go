// Copyright 2020-2021 Google LLC
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

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"

	monitoring "cloud.google.com/go/monitoring/apiv3/v2"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	apioption "google.golang.org/api/option"
)

var userAgent = fmt.Sprintf("opentelemetry-go %s; google-cloud-metric-exporter %s", otel.Version(), Version())

// MonitoredResourceDescription is the struct which holds information required to map OTel resource to specific
// Google Cloud MonitoredResource.
type MonitoredResourceDescription struct {
	mrLabels map[string]struct{}
	mrType   string
}

// Option is function type that is passed to the exporter initialization function.
type Option func(*options)

// options is the struct to hold options for metricExporter and its client instance.
type options struct {
	// context allows you to provide a custom context for API calls.
	//
	// This context will be used several times: first, to create Cloud Monitoring
	// clients, and then every time a new batch of metrics needs to be uploaded.
	//
	// If unset, context.Background() will be used.
	context context.Context
	// metricDescriptorTypeFormatter is the custom formtter for the MetricDescriptor.Type.
	// By default, the format string is "workload.googleapis.com/[metric name]".
	metricDescriptorTypeFormatter func(metricdata.Metrics) string
	// resourceAttributeFilter determinies which resource attributes to
	// add to metrics as metric labels. By default, it adds service.name,
	// service.namespace, and service.instance.id.
	resourceAttributeFilter attribute.Filter
	// monitoredResourceDescription sets whether to attempt mapping the OTel Resource to a specific
	// Google Cloud Monitored Resource. When provided, the exporter attempts to map only to the provided
	// monitored resource type.
	monitoredResourceDescription MonitoredResourceDescription
	// projectID is the identifier of the Cloud Monitoring
	// project the user is uploading the stats data to.
	// If not set, this will default to your "Application Default Credentials".
	// For details see: https://developers.google.com/accounts/docs/application-default-credentials.
	//
	// It will be used in the project_id label of a Google Cloud Monitoring monitored
	// resource if the resource does not inherently belong to a specific
	// project, e.g. on-premise resource like k8s_container or generic_task.
	projectID string
	// compression enables gzip compression on gRPC calls.
	compression string
	// monitoringClient is used as the default client when not nil. If
	// monitoringClient is nil, a client is created instead.
	monitoringClient *monitoring.MetricClient
	// monitoringClientOptions are additional options to be passed
	// to the underlying Cloud Monitoring API client.
	// Optional.
	monitoringClientOptions []apioption.ClientOption
	// destinationProjectQuota sets whether the request should use quota from
	// the destination project for the request.
	destinationProjectQuota bool

	// disableCreateMetricDescriptors disables automatic MetricDescriptor creation
	disableCreateMetricDescriptors bool

	// enableSumOfSquaredDeviation enables calculation of an estimated sum of squared
	// deviation.  It isn't correct, so we don't send it by default.
	enableSumOfSquaredDeviation bool

	// createServiceTimeSeries sets whether to create timeseries using `CreateServiceTimeSeries`.
	// Implicitly, this sets `disableCreateMetricDescriptors` to true.
	createServiceTimeSeries bool
}

// WithProjectID sets Google Cloud Platform project as projectID.
// Without using this option, it automatically detects the project ID
// from the default credential detection process.
// Please find the detailed order of the default credential detection process on the doc:
// https://godoc.org/golang.org/x/oauth2/google#FindDefaultCredentials
func WithProjectID(id string) func(o *options) {
	return func(o *options) {
		o.projectID = id
	}
}

// WithDestinationProjectQuota enables per-request usage of the destination
// project's quota. For example, when setting gcp.project.id on a metric.
func WithDestinationProjectQuota() func(o *options) {
	return func(o *options) {
		o.destinationProjectQuota = true
	}
}

// WithMonitoringClient configures the client used by the exporter to write
// metrics to Cloud Monitoring. This option is mutually exclusive with
// WithMonitoringClientOptions. If both options are provided,
// WithMonitoringClient is used and WithMonitoringClientOptions is ignored.
func WithMonitoringClient(cl *monitoring.MetricClient) func(o *options) {
	return func(o *options) {
		o.monitoringClient = cl
	}
}

// WithMonitoringClientOptions add the options for Cloud Monitoring client instance.
// Available options are defined in.
func WithMonitoringClientOptions(opts ...apioption.ClientOption) func(o *options) {
	return func(o *options) {
		o.monitoringClientOptions = append(o.monitoringClientOptions, opts...)
	}
}

// WithMetricDescriptorTypeFormatter sets the custom formatter for MetricDescriptor.
// Note that the format has to follow the convention defined in the official document.
// The default is "workload.googleapis.com/[metric name]".
// ref. https://cloud.google.com/monitoring/custom-metrics/creating-metrics#custom_metric_names
func WithMetricDescriptorTypeFormatter(f func(metricdata.Metrics) string) func(o *options) {
	return func(o *options) {
		o.metricDescriptorTypeFormatter = f
	}
}

// WithFilteredResourceAttributes determinies which resource attributes to
// add to metrics as metric labels. By default, it adds service.name,
// service.namespace, and service.instance.id. This is recommended to avoid
// writing duplicate timeseries against the same monitored resource. Use
// WithFilteredResourceAttributes(NoAttributes()) to disable the addition of
// resource attributes to metric labels.
func WithFilteredResourceAttributes(filter attribute.Filter) func(o *options) {
	return func(o *options) {
		o.resourceAttributeFilter = filter
	}
}

// DefaultResourceAttributesFilter is the default filter applied to resource
// attributes.
func DefaultResourceAttributesFilter(kv attribute.KeyValue) bool {
	return (kv.Key == semconv.ServiceNameKey ||
		kv.Key == semconv.ServiceNamespaceKey ||
		kv.Key == semconv.ServiceInstanceIDKey) && len(kv.Value.AsString()) > 0
}

// NoAttributes can be passed to WithFilteredResourceAttributes to disable
// adding resource attributes as metric labels.
func NoAttributes(attribute.KeyValue) bool {
	return false
}

// WithDisableCreateMetricDescriptors will disable the automatic creation of
// MetricDescriptors when an unknown metric is set to be exported.
func WithDisableCreateMetricDescriptors() func(o *options) {
	return func(o *options) {
		o.disableCreateMetricDescriptors = true
	}
}

// WithCompression sets the compression to use for gRPC requests.
func WithCompression(c string) func(o *options) {
	return func(o *options) {
		o.compression = c
	}
}

// WithSumOfSquaredDeviation sets the SumOfSquaredDeviation field on histograms.
// It is an estimate, and is not the actual sum of squared deviations.
func WithSumOfSquaredDeviation() func(o *options) {
	return func(o *options) {
		o.enableSumOfSquaredDeviation = true
	}
}

// WithCreateServiceTimeSeries configures the exporter to use `CreateServiceTimeSeries` for creating timeseries.
// If this is used, metric descriptors are not exported.
func WithCreateServiceTimeSeries() func(o *options) {
	return func(o *options) {
		o.createServiceTimeSeries = true
		o.disableCreateMetricDescriptors = true
	}
}

// WithMonitoredResourceDescription configures the exporter to attempt to map the OpenTelemetry Resource to the provided
// Google MonitoredResource. The provided mrLabels would be searched for in the OpenTelemetry Resource Attributes and if
// found, would be included in the MonitoredResource labels.
func WithMonitoredResourceDescription(mrType string, mrLabels []string) func(o *options) {
	return func(o *options) {
		mrLabelSet := make(map[string]struct{})
		for _, label := range mrLabels {
			mrLabelSet[label] = struct{}{}
		}
		o.monitoredResourceDescription = MonitoredResourceDescription{
			mrType:   mrType,
			mrLabels: mrLabelSet,
		}
	}
}
