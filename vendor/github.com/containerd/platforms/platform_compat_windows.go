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

// osVersion is a wrapper for Windows version information
// https://msdn.microsoft.com/en-us/library/windows/desktop/ms724439(v=vs.85).aspx
type osVersion struct {
	Version      uint32
	MajorVersion uint8
	MinorVersion uint8
	Build        uint16
}

// Windows Client and Server build numbers.
//
// See:
// https://learn.microsoft.com/en-us/windows/release-health/release-information
// https://learn.microsoft.com/en-us/windows/release-health/windows-server-release-info
// https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information
const (
	// rs5 (version 1809, codename "Redstone 5") corresponds to Windows Server
	// 2019 (ltsc2019), and Windows 10 (October 2018 Update).
	rs5 = 17763

	// v21H2Server corresponds to Windows Server 2022 (ltsc2022).
	v21H2Server = 20348

	// v22H2Win11 corresponds to Windows 11 (2022 Update).
	v22H2Win11 = 22621
)

// List of stable ABI compliant ltsc releases
// Note: List must be sorted in ascending order
var compatLTSCReleases = []uint16{
	v21H2Server,
}

// CheckHostAndContainerCompat checks if given host and container
// OS versions are compatible.
// It includes support for stable ABI compliant versions as well.
// Every release after WS 2022 will support the previous ltsc
// container image. Stable ABI is in preview mode for windows 11 client.
// Refer: https://learn.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/version-compatibility?tabs=windows-server-2022%2Cwindows-10#windows-server-host-os-compatibility
func checkHostAndContainerCompat(host, ctr osVersion) bool {
	// check major minor versions of host and guest
	if host.MajorVersion != ctr.MajorVersion ||
		host.MinorVersion != ctr.MinorVersion {
		return false
	}

	// If host is < WS 2022, exact version match is required
	if host.Build < v21H2Server {
		return host.Build == ctr.Build
	}

	var supportedLtscRelease uint16
	for i := len(compatLTSCReleases) - 1; i >= 0; i-- {
		if host.Build >= compatLTSCReleases[i] {
			supportedLtscRelease = compatLTSCReleases[i]
			break
		}
	}
	return ctr.Build >= supportedLtscRelease && ctr.Build <= host.Build
}
