// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

// Copyright (c) 2021 The Jaeger Authors.
// Copyright (c) 2017 Uber Technologies, Inc.
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

package jaegerremote // import "go.opentelemetry.io/contrib/samplers/jaegerremote"

import (
	"fmt"
)

const (
	// defaultSamplingServerPort is the default port to fetch sampling config from, via http.
	defaultSamplingServerPort = 5778
)

// defaultSamplingServerURL is the default url to fetch sampling config from, via http.
var defaultSamplingServerURL = fmt.Sprintf("http://127.0.0.1:%d/sampling", defaultSamplingServerPort)
