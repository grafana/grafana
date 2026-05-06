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
	"strings"
)

const (
	// Cloud Functions env vars:
	// https://cloud.google.com/functions/docs/configuring/env-var#newer_runtimes
	//
	// Cloud Run env vars:
	// https://cloud.google.com/run/docs/container-contract#services-env-vars
	//
	// Cloud Run jobs env vars:
	// https://cloud.google.com/run/docs/container-contract#jobs-env-vars
	cloudFunctionsTargetEnv  = "FUNCTION_TARGET"
	cloudRunConfigurationEnv = "K_CONFIGURATION"
	cloudRunJobsEnv          = "CLOUD_RUN_JOB"
	faasServiceEnv           = "K_SERVICE"
	faasRevisionEnv          = "K_REVISION"
	cloudRunJobExecutionEnv  = "CLOUD_RUN_EXECUTION"
	cloudRunJobTaskIndexEnv  = "CLOUD_RUN_TASK_INDEX"
	regionMetadataAttr       = "instance/region"
)

func (d *Detector) onCloudFunctions() bool {
	_, found := d.os.LookupEnv(cloudFunctionsTargetEnv)
	return found
}

func (d *Detector) onCloudRun() bool {
	_, found := d.os.LookupEnv(cloudRunConfigurationEnv)
	return found
}

func (d *Detector) onCloudRunJob() bool {
	_, found := d.os.LookupEnv(cloudRunJobsEnv)
	return found
}

// FaaSName returns the name of the Cloud Run, Cloud Run jobs or Cloud Functions service.
func (d *Detector) FaaSName() (string, error) {
	if name, found := d.os.LookupEnv(faasServiceEnv); found {
		return name, nil
	}
	if name, found := d.os.LookupEnv(cloudRunJobsEnv); found {
		return name, nil
	}
	return "", errEnvVarNotFound
}

// FaaSVersion returns the revision of the Cloud Run or Cloud Functions service.
func (d *Detector) FaaSVersion() (string, error) {
	if version, found := d.os.LookupEnv(faasRevisionEnv); found {
		return version, nil
	}
	return "", errEnvVarNotFound
}

// CloudRunJobExecution returns the execution id of the Cloud Run jobs.
func (d *Detector) CloudRunJobExecution() (string, error) {
	if eid, found := d.os.LookupEnv(cloudRunJobExecutionEnv); found {
		return eid, nil
	}
	return "", errEnvVarNotFound
}

// CloudRunJobTaskIndex returns the task index for the execution of the Cloud Run jobs.
func (d *Detector) CloudRunJobTaskIndex() (string, error) {
	if tidx, found := d.os.LookupEnv(cloudRunJobTaskIndexEnv); found {
		return tidx, nil
	}
	return "", errEnvVarNotFound
}

// FaaSID returns the instance id of the Cloud Run or Cloud Function.
func (d *Detector) FaaSID() (string, error) {
	return d.instanceID()
}

// FaaSCloudRegion detects region from the metadata server.
// It is in the format /projects/<project_number>/regions/<region>.
//
// https://cloud.google.com/run/docs/reference/container-contract#metadata-server
func (d *Detector) FaaSCloudRegion() (string, error) {
	region, err := d.metadata.GetWithContext(context.TODO(), regionMetadataAttr)
	if err != nil {
		return "", err
	}
	return region[strings.LastIndex(region, "/")+1:], nil
}
