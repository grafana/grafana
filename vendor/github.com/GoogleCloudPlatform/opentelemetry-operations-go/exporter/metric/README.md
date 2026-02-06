# OpenTelemetry Google Cloud Monitoring Exporter

[![Docs](https://godoc.org/github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric?status.svg)](https://pkg.go.dev/github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric)
[![Apache License][license-image]][license-url]

OpenTelemetry Google Cloud Monitoring Exporter allows the user to send collected metrics to Google Cloud.

To get started with instrumentation in Google Cloud, see [Generate traces and metrics with
Go](https://cloud.google.com/stackdriver/docs/instrumentation/setup/go).

To learn more about instrumentation and observability, including opinionated recommendations
for Google Cloud Observability, visit [Instrumentation and
observability](https://cloud.google.com/stackdriver/docs/instrumentation/overview).

[Google Cloud Monitoring](https://cloud.google.com/monitoring) provides visibility into the performance, uptime, and overall health of cloud-powered applications. It collects metrics, events, and metadata from Google Cloud, Amazon Web Services, hosted uptime probes, application instrumentation, and a variety of common application components including Cassandra, Nginx, Apache Web Server, Elasticsearch, and many others. Operations ingests that data and generates insights via dashboards, charts, and alerts. Cloud Monitoring alerting helps you collaborate by integrating with Slack, PagerDuty, and more.

## Setup

Google Cloud Monitoring is a managed service provided by Google Cloud Platform. Google Cloud Monitoring requires to set up "Workspace" in advance. The guide to create a new Workspace is available on [the official document](https://cloud.google.com/monitoring/workspaces/create).

## Authentication

The Google Cloud Monitoring exporter depends upon [`google.FindDefaultCredentials`](https://pkg.go.dev/golang.org/x/oauth2/google?tab=doc#FindDefaultCredentials), so the service account is automatically detected by default, but also the custom credential file (so called `service_account_key.json`) can be detected with specific conditions. Quoting from the document of `google.FindDefaultCredentials`:

* A JSON file whose path is specified by the `GOOGLE_APPLICATION_CREDENTIALS` environment variable.
* A JSON file in a location known to the gcloud command-line tool. On Windows, this is `%APPDATA%/gcloud/application_default_credentials.json`. On other systems, `$HOME/.config/gcloud/application_default_credentials.json`.

When running code locally, you may need to specify a Google Project ID in addition to `GOOGLE_APPLICATION_CREDENTIALS`. This is best done using an environment variable (e.g. `GOOGLE_CLOUD_PROJECT`) and the `metric.WithProjectID` method, e.g.:

```golang
projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
opts := []mexporter.Option{
    mexporter.WithProjectID(projectID),
}
```

## Useful links

* For more information on OpenTelemetry, visit: https://opentelemetry.io/
* For more about OpenTelemetry Go, visit: https://github.com/open-telemetry/opentelemetry-go
* Learn more about Google Cloud Monitoring at https://cloud.google.com/monitoring

[license-url]: https://github.com/GoogleCloudPlatform/opentelemetry-operations-go/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
