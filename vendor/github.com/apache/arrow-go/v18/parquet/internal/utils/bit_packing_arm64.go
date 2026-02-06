// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build !noasm
// +build !noasm

package utils

import (
	"github.com/klauspost/cpuid/v2"
	// import for side effect of initializing feature flags
	// based on ARM_ENABLE_EXT env var
	_ "github.com/apache/arrow-go/v18/parquet/internal/bmi"
)

func init() {
	if cpuid.CPU.Has(cpuid.ASIMD) {
		unpack32 = unpack32NEON
	} else { // default to the pure go implementation if no avx2 available
		unpack32 = unpack32Default
	}
}
