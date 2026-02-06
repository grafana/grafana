//go:build !linux

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

import (
	"fmt"
	"runtime"
)

func getCPUVariant() (string, error) {

	var variant string

	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" {
		// Windows/Darwin only supports v7 for ARM32 and v8 for ARM64 and so we can use
		// runtime.GOARCH to determine the variants
		switch runtime.GOARCH {
		case "arm64":
			variant = "v8"
		case "arm":
			variant = "v7"
		default:
			variant = "unknown"
		}
	} else if runtime.GOOS == "freebsd" {
		// FreeBSD supports ARMv6 and ARMv7 as well as ARMv4 and ARMv5 (though deprecated)
		// detecting those variants is currently unimplemented
		switch runtime.GOARCH {
		case "arm64":
			variant = "v8"
		default:
			variant = "unknown"
		}
	} else {
		return "", fmt.Errorf("getCPUVariant for OS %s: %v", runtime.GOOS, errNotImplemented)
	}

	return variant, nil
}
