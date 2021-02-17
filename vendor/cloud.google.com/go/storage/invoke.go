// Copyright 2014 Google LLC
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

package storage

import (
	"context"

	"cloud.google.com/go/internal"
	gax "github.com/googleapis/gax-go/v2"
)

// runWithRetry calls the function until it returns nil or a non-retryable error, or
// the context is done.
func runWithRetry(ctx context.Context, call func() error) error {
	return internal.Retry(ctx, gax.Backoff{}, func() (stop bool, err error) {
		err = call()
		if err == nil {
			return true, nil
		}
		if shouldRetry(err) {
			return false, nil
		}
		return true, err
	})
}
