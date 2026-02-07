// Package exporter defines the data exporter of go-feature-flag
//
// These exporters are usable in your init configuration.
//
//	ffclient.Init(ffclient.Config{
//	  //...
//	   DataExporter: ffclient.DataExporter{
//	   FlushInterval:   10 * time.Second,
//	   MaxEventInMemory: 1000,
//	   Exporter: &s3exporterv2.Exporter{
//			Format:    "json",
//			Bucket:    "my-test-bucket",
//			S3Path:    "/go-feature-flag/variations/",
//			Filename:  "flag-variation-{{ .Timestamp}}.{{ .Format}}",
//			AwsConfig: &awsConfig,
//		},
//	 },
//	 //...
//	})
package exporter
