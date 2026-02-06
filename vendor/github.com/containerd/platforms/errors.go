/*
   Copyright The containerd Authors.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

package platforms

import "errors"

// These errors mirror the errors defined in [github.com/containerd/containerd/errdefs],
// however, they are not exported as they are not expected to be used as sentinel
// errors by consumers of this package.
//
//nolint:unused // not all errors are used on all platforms.
var (
	errNotFound        = errors.New("not found")
	errInvalidArgument = errors.New("invalid argument")
	errNotImplemented  = errors.New("not implemented")
)
