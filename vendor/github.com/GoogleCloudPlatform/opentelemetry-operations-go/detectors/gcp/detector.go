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
	"errors"
	"os"
	"strings"

	"cloud.google.com/go/compute/metadata"
)

var errEnvVarNotFound = errors.New("environment variable not found")

// NewDetector returns a *Detector which can get detect the platform,
// and fetch attributes of the platform on which it is running.
func NewDetector() *Detector {
	return &Detector{metadata: metadata.NewClient(nil), os: realOSProvider{}}
}

type Platform int64

const (
	UnknownPlatform Platform = iota
	GKE
	GCE
	CloudRun
	CloudRunJob
	CloudFunctions
	AppEngineStandard
	AppEngineFlex
	BareMetalSolution
)

// CloudPlatform returns the platform on which this program is running.
func (d *Detector) CloudPlatform() Platform {
	switch {
	case d.onBareMetalSolution():
		return BareMetalSolution
	case d.onGKE():
		return GKE
	case d.onCloudFunctions():
		return CloudFunctions
	case d.onCloudRun():
		return CloudRun
	case d.onCloudRunJob():
		return CloudRunJob
	case d.onAppEngineStandard():
		return AppEngineStandard
	case d.onAppEngine():
		return AppEngineFlex
	case d.onGCE():
		return GCE
	}
	return UnknownPlatform
}

// ProjectID returns the ID of the project in which this program is running.
func (d *Detector) ProjectID() (string, error) {
	// N.B. d.metadata.ProjectIDWithContext(context.TODO()) is cached globally, so if we use it here it's untestable.
	s, err := d.metadata.GetWithContext(context.TODO(), "project/project-id")
	return strings.TrimSpace(s), err
}

// instanceID returns the ID of the project in which this program is running.
func (d *Detector) instanceID() (string, error) {
	// N.B. d.metadata.InstanceIDWithContext(context.TODO()) is cached globally, so if we use it here it's untestable.
	s, err := d.metadata.GetWithContext(context.TODO(), "instance/id")
	return strings.TrimSpace(s), err
}

// Detector collects resource information for all GCP platforms.
type Detector struct {
	metadata *metadata.Client
	os       osProvider
}

// osProvider contains the subset of the os package functions used by.
type osProvider interface {
	LookupEnv(string) (string, bool)
}

// realOSProvider uses the os package to lookup env vars.
type realOSProvider struct{}

func (realOSProvider) LookupEnv(env string) (string, bool) {
	return os.LookupEnv(env)
}
