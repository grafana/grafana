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

import (
	"context"
	"errors"
	"fmt"

	sdkmetric "go.opentelemetry.io/otel/sdk/metric"

	monitoring "cloud.google.com/go/monitoring/apiv3/v2"
	"golang.org/x/oauth2/google"
)

// New creates a new Exporter thats implements metric.Exporter.
func New(opts ...Option) (sdkmetric.Exporter, error) {
	o := options{
		context:                 context.Background(),
		resourceAttributeFilter: DefaultResourceAttributesFilter,
	}
	for _, opt := range opts {
		opt(&o)
	}

	if o.projectID == "" {
		creds, err := google.FindDefaultCredentials(o.context, monitoring.DefaultAuthScopes()...)
		if err != nil {
			return nil, fmt.Errorf("failed to find Google Cloud credentials: %v", err)
		}
		if creds.ProjectID == "" {
			return nil, errors.New("google cloud monitoring: no project found with application default credentials")
		}
		o.projectID = creds.ProjectID
	}
	return newMetricExporter(&o)
}
