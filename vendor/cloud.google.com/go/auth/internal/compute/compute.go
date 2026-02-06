// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package compute

import (
	"log"
	"runtime"
	"strings"
	"sync"
)

var (
	vmOnGCEOnce sync.Once
	vmOnGCE     bool
)

// OnComputeEngine returns whether the client is running on GCE.
//
// This is a copy of the gRPC internal googlecloud.OnGCE() func at:
// https://github.com/grpc/grpc-go/blob/master/internal/googlecloud/googlecloud.go
// The functionality is similar to the metadata.OnGCE() func at:
// https://github.com/googleapis/google-cloud-go/blob/main/compute/metadata/metadata.go
// The difference is that OnComputeEngine() does not perform HTTP or DNS check on the metadata server.
// In particular, OnComputeEngine() will return false on Serverless.
func OnComputeEngine() bool {
	vmOnGCEOnce.Do(func() {
		mf, err := manufacturer()
		if err != nil {
			log.Printf("Failed to read manufacturer, vmOnGCE=false: %v", err)
			return
		}
		vmOnGCE = isRunningOnGCE(mf, runtime.GOOS)
	})
	return vmOnGCE
}

// isRunningOnGCE checks whether the local system, without doing a network request, is
// running on GCP.
func isRunningOnGCE(manufacturer []byte, goos string) bool {
	name := string(manufacturer)
	switch goos {
	case "linux":
		name = strings.TrimSpace(name)
		return name == "Google" || name == "Google Compute Engine"
	case "windows":
		name = strings.Replace(name, " ", "", -1)
		name = strings.Replace(name, "\n", "", -1)
		name = strings.Replace(name, "\r", "", -1)
		return name == "Google"
	default:
		return false
	}
}
