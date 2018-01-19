// Copyright 2017, Google LLC All rights reserved.
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

// AUTO-GENERATED CODE. DO NOT EDIT.

// Package errorreporting is an auto-generated package for the
// Stackdriver Error Reporting API.
//
//   NOTE: This package is in alpha. It is not stable, and is likely to change.
//
// Stackdriver Error Reporting groups and counts similar errors from cloud
// services. The Stackdriver Error Reporting API provides a way to report new
// errors and read access to error groups and their associated errors.
//
// Use the client at cloud.google.com/go/errorreporting in preference to this.
package errorreporting // import "cloud.google.com/go/errorreporting/apiv1beta1"

import (
	"golang.org/x/net/context"
	"google.golang.org/grpc/metadata"
)

func insertMetadata(ctx context.Context, mds ...metadata.MD) context.Context {
	out, _ := metadata.FromOutgoingContext(ctx)
	out = out.Copy()
	for _, md := range mds {
		for k, v := range md {
			out[k] = append(out[k], v...)
		}
	}
	return metadata.NewOutgoingContext(ctx, out)
}

// DefaultAuthScopes reports the default set of authentication scopes to use with this package.
func DefaultAuthScopes() []string {
	return []string{
		"https://www.googleapis.com/auth/cloud-platform",
	}
}
