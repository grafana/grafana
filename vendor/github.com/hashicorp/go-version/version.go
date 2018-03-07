package version

import (
	"bytes"
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"strings"
)

// The compiled regular expression used to test the validity of a version.
var versionRegexp *regexp.Regexp

// The raw regular expression string used for testing the validity
// of a version.
const VersionRegexpRaw string = `([0-9]+(\.[0-9]+){0,2})` +
	`(-([0-9A-Za-z\-]+(\.[0-9A-Za-z\-]+)*))?` +
	`(\+([0-9A-Za-z\-]+(\.[0-9A-Za-z\-]+)*))?` +
	`?`

// Version represents a single version.
type Version struct {
	metadata string
	pre      string
	segments []int
	si       int
}

func init() {
	versionRegexp = regexp.MustCompile("^" + VersionRegexpRaw + "$")
}

// NewVersion parses the given version and returns a new
// Version.
func NewVersion(v string) (*Version, error) {
	matches := versionRegexp.FindStringSubmatch(v)
	if matches == nil {
		return nil, fmt.Errorf("Malformed version: %s", v)
	}

	segmentsStr := strings.Split(matches[1], ".")
	segments := make([]int, len(segmentsStr), 3)
	si := 0
	for i, str := range segmentsStr {
		val, err := strconv.ParseInt(str, 10, 32)
		if err != nil {
			return nil, fmt.Errorf(
				"Error parsing version: %s", err)
		}

		segments[i] = int(val)
		si += 1
	}
	for i := len(segments); i < 3; i++ {
		segments = append(segments, 0)
	}

	return &Version{
		metadata: matches[7],
		pre:      matches[4],
		segments: segments,
		si:       si,
	}, nil
}

// Must is a helper that wraps a call to a function returning (*Version, error)
// and panics if error is non-nil.
func Must(v *Version, err error) *Version {
	if err != nil {
		panic(err)
	}

	return v
}

// Compare compares this version to another version. This
// returns -1, 0, or 1 if this version is smaller, equal,
// or larger than the other version, respectively.
//
// If you want boolean results, use the LessThan, Equal,
// or GreaterThan methods.
func (v *Version) Compare(other *Version) int {
	// A quick, efficient equality check
	if v.String() == other.String() {
		return 0
	}

	segmentsSelf := v.Segments()
	segmentsOther := other.Segments()

	// If the segments are the same, we must compare on prerelease info
	if reflect.DeepEqual(segmentsSelf, segmentsOther) {
		preSelf := v.Prerelease()
		preOther := other.Prerelease()
		if preSelf == "" && preOther == "" {
			return 0
		}
		if preSelf == "" {
			return 1
		}
		if preOther == "" {
			return -1
		}

		return comparePrereleases(preSelf, preOther)
	}

	// Compare the segments
	for i := 0; i < len(segmentsSelf); i++ {
		lhs := segmentsSelf[i]
		rhs := segmentsOther[i]

		if lhs == rhs {
			continue
		} else if lhs < rhs {
			return -1
		} else {
			return 1
		}
	}

	panic("should not be reached")
}

func comparePart(preSelf string, preOther string) int {
	if preSelf == preOther {
		return 0
	}

	// if a part is empty, we use the other to decide
	if preSelf == "" {
		_, notIsNumeric := strconv.ParseInt(preOther, 10, 64)
		if notIsNumeric == nil {
			return -1
		}
		return 1
	}

	if preOther == "" {
		_, notIsNumeric := strconv.ParseInt(preSelf, 10, 64)
		if notIsNumeric == nil {
			return 1
		}
		return -1
	}

	if preSelf > preOther {
		return 1
	}

	return -1
}

func comparePrereleases(v string, other string) int {
	// the same pre release!
	if v == other {
		return 0
	}

	// split both pre releases for analyse their parts
	selfPreReleaseMeta := strings.Split(v, ".")
	otherPreReleaseMeta := strings.Split(other, ".")

	selfPreReleaseLen := len(selfPreReleaseMeta)
	otherPreReleaseLen := len(otherPreReleaseMeta)

	biggestLen := otherPreReleaseLen
	if selfPreReleaseLen > otherPreReleaseLen {
		biggestLen = selfPreReleaseLen
	}

	// loop for parts to find the first difference
	for i := 0; i < biggestLen; i = i + 1 {
		partSelfPre := ""
		if i < selfPreReleaseLen {
			partSelfPre = selfPreReleaseMeta[i]
		}

		partOtherPre := ""
		if i < otherPreReleaseLen {
			partOtherPre = otherPreReleaseMeta[i]
		}

		compare := comparePart(partSelfPre, partOtherPre)
		// if parts are equals, continue the loop
		if compare != 0 {
			return compare
		}
	}

	return 0
}

// Equal tests if two versions are equal.
func (v *Version) Equal(o *Version) bool {
	return v.Compare(o) == 0
}

// GreaterThan tests if this version is greater than another version.
func (v *Version) GreaterThan(o *Version) bool {
	return v.Compare(o) > 0
}

// LessThan tests if this version is less than another version.
func (v *Version) LessThan(o *Version) bool {
	return v.Compare(o) < 0
}

// Metadata returns any metadata that was part of the version
// string.
//
// Metadata is anything that comes after the "+" in the version.
// For example, with "1.2.3+beta", the metadata is "beta".
func (v *Version) Metadata() string {
	return v.metadata
}

// Prerelease returns any prerelease data that is part of the version,
// or blank if there is no prerelease data.
//
// Prerelease information is anything that comes after the "-" in the
// version (but before any metadata). For example, with "1.2.3-beta",
// the prerelease information is "beta".
func (v *Version) Prerelease() string {
	return v.pre
}

// Segments returns the numeric segments of the version as a slice.
//
// This excludes any metadata or pre-release information. For example,
// for a version "1.2.3-beta", segments will return a slice of
// 1, 2, 3.
func (v *Version) Segments() []int {
	return v.segments
}

// String returns the full version string included pre-release
// and metadata information.
func (v *Version) String() string {
	var buf bytes.Buffer
	fmt.Fprintf(&buf, "%d.%d.%d", v.segments[0], v.segments[1], v.segments[2])
	if v.pre != "" {
		fmt.Fprintf(&buf, "-%s", v.pre)
	}
	if v.metadata != "" {
		fmt.Fprintf(&buf, "+%s", v.metadata)
	}

	return buf.String()
}
