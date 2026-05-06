package semver

import (
	"strings"

	"golang.org/x/mod/semver"
)

type Version struct {
	version string
}

func Parse(version string) Version {
	return Version{
		version: version,
	}
}

// ParseTolerant turns a "v10.2.x" input (version string coming from the
// kind-registry) into a semver-compatible version "10.2.0"
func ParseTolerant(version string) Version {
	version = strings.TrimPrefix(version, "release-")

	if !strings.HasPrefix(version, "v") {
		version = "v" + version
	}

	if strings.HasSuffix(version, "x") {
		version = version[:len(version)-1] + "0"
	}

	return Parse(version)
}

func (v Version) Equal(other Version) bool {
	return semver.Compare(v.version, other.version) == 0
}

func (v Version) LessThan(other Version) bool {
	return semver.Compare(v.version, other.version) == -1
}

func (v Version) LessThanEqual(other Version) bool {
	cmp := semver.Compare(v.version, other.version)
	return cmp == -1 || cmp == 0
}

func (v Version) MoreThan(other Version) bool {
	return semver.Compare(v.version, other.version) == 1
}

func (v Version) MoreThanEqual(other Version) bool {
	cmp := semver.Compare(v.version, other.version)
	return cmp == 1 || cmp == 0
}
