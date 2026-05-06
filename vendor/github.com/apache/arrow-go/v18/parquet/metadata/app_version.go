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

package metadata

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

var (
	// Regular expression for the version format
	// major . minor . patch unknown - prerelease.x + build info
	// Eg: 1.5.0ab-cdh5.5.0+cd
	versionRx = regexp.MustCompile(`^(\d+)\.(\d+)\.(\d+)([^-+]*)?(?:-([^+]*))?(?:\+(.*))?$`)
	// Regular expression for the application format
	// application_name version VERSION_FORMAT (build build_name)
	// Eg: parquet-cpp version 1.5.0ab-xyz5.5.0+cd (build abcd)
	applicationRx = regexp.MustCompile(`^(.*?)\s*(?:(version\s*(?:([^(]*?)\s*(?:\(\s*build\s*([^)]*?)\s*\))?)?)?)$`)

	// Parquet816FixedVersion is the version used for fixing PARQUET-816
	// that changed the padding calculations for dictionary headers on row groups.
	Parquet816FixedVersion      = NewAppVersionExplicit("parquet-mr", 1, 2, 9)
	parquet251FixedVersion      = NewAppVersionExplicit("parquet-mr", 1, 8, 0)
	parquetCPPFixedStatsVersion = NewAppVersionExplicit("parquet-cpp", 1, 3, 0)
	parquetMRFixedStatsVersion  = NewAppVersionExplicit("parquet-mr", 1, 10, 0)
	// parquet1655FixedVersion is the version used for fixing PARQUET-1655
	// which fixed min/max stats comparisons for Decimal types
	parquet1655FixedVersion = NewAppVersionExplicit("parquet-cpp-arrow", 4, 0, 0)
)

// AppVersion represents a specific application version either read from
// or written to a parquet file.
type AppVersion struct {
	App     string
	Build   string
	Version struct {
		Major      int
		Minor      int
		Patch      int
		Unknown    string
		PreRelease string
		BuildInfo  string
	}
}

// NewAppVersionExplicit is a convenience function to construct a specific
// application version from the given app string and version
func NewAppVersionExplicit(app string, major, minor, patch int) *AppVersion {
	v := &AppVersion{App: app}
	v.Version.Major = major
	v.Version.Minor = minor
	v.Version.Patch = patch
	return v
}

// NewAppVersion parses a "created by" string such as "parquet-go 1.0.0".
//
// It also supports handling pre-releases and build info such as
//
//	parquet-cpp version 1.5.0ab-xyz5.5.0+cd (build abcd)
func NewAppVersion(createdby string) *AppVersion {
	v := &AppVersion{}

	var ver []string

	m := applicationRx.FindStringSubmatch(strings.ToLower(createdby))
	if len(m) >= 4 {
		v.App = m[1]
		v.Build = m[4]
		ver = versionRx.FindStringSubmatch(m[3])
	} else {
		v.App = "unknown"
	}

	if len(ver) >= 7 {
		v.Version.Major, _ = strconv.Atoi(ver[1])
		v.Version.Minor, _ = strconv.Atoi(ver[2])
		v.Version.Patch, _ = strconv.Atoi(ver[3])
		v.Version.Unknown = ver[4]
		v.Version.PreRelease = ver[5]
		v.Version.BuildInfo = ver[6]
	}
	return v
}

// LessThan compares the app versions and returns true if this version
// is "less than" the passed version.
//
// If the apps don't match, this always returns false. Otherwise it compares
// the major versions first, then the minor versions, and finally the patch
// versions.
//
// Pre-release and build info are not considered.
func (v AppVersion) LessThan(other *AppVersion) bool {
	switch {
	case v.App != other.App:
		return false
	case v.Version.Major < other.Version.Major:
		return true
	case v.Version.Major > other.Version.Major:
		return false
	case v.Version.Minor < other.Version.Minor:
		return true
	case v.Version.Minor > other.Version.Minor:
		return false
	}

	return v.Version.Patch < other.Version.Patch
}

// Equal only compares the Application and major/minor/patch versions.
//
// Pre-release and build info are not considered.
func (v AppVersion) Equal(other *AppVersion) bool {
	return v.App == other.App &&
		v.Version.Major == other.Version.Major &&
		v.Version.Minor == other.Version.Minor &&
		v.Version.Patch == other.Version.Patch
}

// HasCorrectStatistics checks whether or not the statistics are valid to be used
// based on the primitive type and the version since previous versions had issues with
// properly computing stats.
//
// Reference: parquet-cpp/src/parquet/metadata.cc
//
// PARQUET-686 has more discussion on statistics
func (v AppVersion) HasCorrectStatistics(coltype parquet.Type, logicalType schema.LogicalType, stats EncodedStatistics, sort schema.SortOrder) bool {
	// parquet-cpp version 1.3.0 and parquet-mr 1.10.0 onwards stats are computed correctly for all types except decimal
	if (v.App == "parquet-cpp" && v.LessThan(parquetCPPFixedStatsVersion)) ||
		(v.App == "parquet-mr" && v.LessThan(parquetMRFixedStatsVersion)) {
		// only SIGNED are valid unless max and min are the same (in which case the sort order doesn't matter)
		var maxEqualsMin bool
		if stats.HasMin && stats.HasMax {
			maxEqualsMin = string(stats.Min) == string(stats.Max)
		}
		if sort != schema.SortSIGNED && !maxEqualsMin {
			return false
		}

		if coltype != parquet.Types.FixedLenByteArray && coltype != parquet.Types.ByteArray {
			return true
		}
	}

	// parquet-cpp-arrow version 4.0.0 fixed Decimal comparisons for creating min/max stats
	// parquet-cpp also becomes parquet-cpp-arrow as of version 4.0.0
	if v.App == "parquet-cpp" || (v.App == "parquet-cpp-arrow" && v.LessThan(parquet1655FixedVersion)) {
		if _, ok := logicalType.(schema.DecimalLogicalType); ok && coltype == parquet.Types.FixedLenByteArray {
			return false
		}
	}

	// created_by is not populated, which could have been caused by
	// parquet-mr during the same time as PARQUET-251, see PARQUET-297
	if v.App == "unknown" {
		return true
	}

	// unknown sort order has incorrect stats
	if sort == schema.SortUNKNOWN {
		return false
	}

	// PARQUET-251
	return !v.LessThan(parquet251FixedVersion)
}
