// Copyright 2017 Google LLC. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package compiler

import (
	"github.com/google/gnostic-models/compiler"
)

// EnableFileCache turns on file caching.
var EnableFileCache = compiler.EnableFileCache

// EnableInfoCache turns on parsed info caching.
var EnableInfoCache = compiler.EnableInfoCache

// DisableFileCache turns off file caching.
var DisableFileCache = compiler.DisableFileCache

// DisableInfoCache turns off parsed info caching.
var DisableInfoCache = compiler.DisableInfoCache

// RemoveFromFileCache removes an entry from the file cache.
var RemoveFromFileCache = compiler.RemoveFromFileCache

// RemoveFromInfoCache removes an entry from the info cache.
var RemoveFromInfoCache = compiler.RemoveFromInfoCache

// GetInfoCache returns the info cache map.
var GetInfoCache = compiler.GetInfoCache

// ClearFileCache clears the file cache.
var ClearFileCache = compiler.ClearFileCache

// ClearInfoCache clears the info cache.
var ClearInfoCache = compiler.ClearInfoCache

// ClearCaches clears all caches.
var ClearCaches = compiler.ClearCaches

// FetchFile gets a specified file from the local filesystem or a remote location.
var FetchFile = compiler.FetchFile

// ReadBytesForFile reads the bytes of a file.
var ReadBytesForFile = compiler.ReadBytesForFile

// ReadInfoFromBytes unmarshals a file as a *yaml.Node.
var ReadInfoFromBytes = compiler.ReadInfoFromBytes

// ReadInfoForRef reads a file and return the fragment needed to resolve a $ref.
var ReadInfoForRef = compiler.ReadInfoForRef
