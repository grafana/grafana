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

// Package platforms provides a toolkit for normalizing, matching and
// specifying container platforms.
//
// Centered around OCI platform specifications, we define a string-based
// specifier syntax that can be used for user input. With a specifier, users
// only need to specify the parts of the platform that are relevant to their
// context, providing an operating system or architecture or both.
//
// How do I use this package?
//
// The vast majority of use cases should simply use the match function with
// user input. The first step is to parse a specifier into a matcher:
//
//	m, err := Parse("linux")
//	if err != nil { ... }
//
// Once you have a matcher, use it to match against the platform declared by a
// component, typically from an image or runtime. Since extracting an images
// platform is a little more involved, we'll use an example against the
// platform default:
//
//	if ok := m.Match(Default()); !ok { /* doesn't match */ }
//
// This can be composed in loops for resolving runtimes or used as a filter for
// fetch and select images.
//
// More details of the specifier syntax and platform spec follow.
//
// # Declaring Platform Support
//
// Components that have strict platform requirements should use the OCI
// platform specification to declare their support. Typically, this will be
// images and runtimes that should make these declaring which platform they
// support specifically. This looks roughly as follows:
//
//	  type Platform struct {
//		   Architecture string
//		   OS           string
//		   Variant      string
//	  }
//
// Most images and runtimes should at least set Architecture and OS, according
// to their GOARCH and GOOS values, respectively (follow the OCI image
// specification when in doubt). ARM should set variant under certain
// discussions, which are outlined below.
//
// # Platform Specifiers
//
// While the OCI platform specifications provide a tool for components to
// specify structured information, user input typically doesn't need the full
// context and much can be inferred. To solve this problem, we introduced
// "specifiers". A specifier has the format
// `<os>|<arch>|<os>/<arch>[/<variant>]`.  The user can provide either the
// operating system or the architecture or both.
//
// An example of a common specifier is `linux/amd64`. If the host has a default
// of runtime that matches this, the user can simply provide the component that
// matters. For example, if a image provides amd64 and arm64 support, the
// operating system, `linux` can be inferred, so they only have to provide
// `arm64` or `amd64`. Similar behavior is implemented for operating systems,
// where the architecture may be known but a runtime may support images from
// different operating systems.
//
// # Normalization
//
// Because not all users are familiar with the way the Go runtime represents
// platforms, several normalizations have been provided to make this package
// easier to user.
//
// The following are performed for architectures:
//
//	Value    Normalized
//	aarch64  arm64
//	armhf    arm
//	armel    arm/v6
//	i386     386
//	x86_64   amd64
//	x86-64   amd64
//
// We also normalize the operating system `macos` to `darwin`.
//
// # ARM Support
//
// To qualify ARM architecture, the Variant field is used to qualify the arm
// version. The most common arm version, v7, is represented without the variant
// unless it is explicitly provided. This is treated as equivalent to armhf. A
// previous architecture, armel, will be normalized to arm/v6.
//
// Similarly, the most common arm64 version v8, and most common amd64 version v1
// are represented without the variant.
//
// While these normalizations are provided, their support on arm platforms has
// not yet been fully implemented and tested.
package platforms

import (
	"fmt"
	"path"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	specs "github.com/opencontainers/image-spec/specs-go/v1"
)

var (
	specifierRe    = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
	osAndVersionRe = regexp.MustCompile(`^([A-Za-z0-9_-]+)(?:\(([A-Za-z0-9_.-]*)\))?$`)
)

const osAndVersionFormat = "%s(%s)"

// Platform is a type alias for convenience, so there is no need to import image-spec package everywhere.
type Platform = specs.Platform

// Matcher matches platforms specifications, provided by an image or runtime.
type Matcher interface {
	Match(platform specs.Platform) bool
}

// NewMatcher returns a simple matcher based on the provided platform
// specification. The returned matcher only looks for equality based on os,
// architecture and variant.
//
// One may implement their own matcher if this doesn't provide the required
// functionality.
//
// Applications should opt to use `Match` over directly parsing specifiers.
func NewMatcher(platform specs.Platform) Matcher {
	return newDefaultMatcher(platform)
}

type matcher struct {
	specs.Platform
}

func (m *matcher) Match(platform specs.Platform) bool {
	normalized := Normalize(platform)
	return m.OS == normalized.OS &&
		m.Architecture == normalized.Architecture &&
		m.Variant == normalized.Variant
}

func (m *matcher) String() string {
	return FormatAll(m.Platform)
}

// ParseAll parses a list of platform specifiers into a list of platform.
func ParseAll(specifiers []string) ([]specs.Platform, error) {
	platforms := make([]specs.Platform, len(specifiers))
	for i, s := range specifiers {
		p, err := Parse(s)
		if err != nil {
			return nil, fmt.Errorf("invalid platform %s: %w", s, err)
		}
		platforms[i] = p
	}
	return platforms, nil
}

// Parse parses the platform specifier syntax into a platform declaration.
//
// Platform specifiers are in the format `<os>[(<OSVersion>)]|<arch>|<os>[(<OSVersion>)]/<arch>[/<variant>]`.
// The minimum required information for a platform specifier is the operating
// system or architecture. The OSVersion can be part of the OS like `windows(10.0.17763)`
// When an OSVersion is specified, then specs.Platform.OSVersion is populated with that value,
// and an empty string otherwise.
// If there is only a single string (no slashes), the
// value will be matched against the known set of operating systems, then fall
// back to the known set of architectures. The missing component will be
// inferred based on the local environment.
func Parse(specifier string) (specs.Platform, error) {
	if strings.Contains(specifier, "*") {
		// TODO(stevvooe): need to work out exact wildcard handling
		return specs.Platform{}, fmt.Errorf("%q: wildcards not yet supported: %w", specifier, errInvalidArgument)
	}

	// Limit to 4 elements to prevent unbounded split
	parts := strings.SplitN(specifier, "/", 4)

	var p specs.Platform
	for i, part := range parts {
		if i == 0 {
			// First element is <os>[(<OSVersion>)]
			osVer := osAndVersionRe.FindStringSubmatch(part)
			if osVer == nil {
				return specs.Platform{}, fmt.Errorf("%q is an invalid OS component of %q: OSAndVersion specifier component must match %q: %w", part, specifier, osAndVersionRe.String(), errInvalidArgument)
			}

			p.OS = normalizeOS(osVer[1])
			p.OSVersion = osVer[2]
		} else {
			if !specifierRe.MatchString(part) {
				return specs.Platform{}, fmt.Errorf("%q is an invalid component of %q: platform specifier component must match %q: %w", part, specifier, specifierRe.String(), errInvalidArgument)
			}
		}
	}

	switch len(parts) {
	case 1:
		// in this case, we will test that the value might be an OS (with or
		// without the optional OSVersion specified) and look it up.
		// If it is not known, we'll treat it as an architecture. Since
		// we have very little information about the platform here, we are
		// going to be a little more strict if we don't know about the argument
		// value.
		if isKnownOS(p.OS) {
			// picks a default architecture
			p.Architecture = runtime.GOARCH
			if p.Architecture == "arm" && cpuVariant() != "v7" {
				p.Variant = cpuVariant()
			}

			return p, nil
		}

		p.Architecture, p.Variant = normalizeArch(parts[0], "")
		if p.Architecture == "arm" && p.Variant == "v7" {
			p.Variant = ""
		}
		if isKnownArch(p.Architecture) {
			p.OS = runtime.GOOS
			return p, nil
		}

		return specs.Platform{}, fmt.Errorf("%q: unknown operating system or architecture: %w", specifier, errInvalidArgument)
	case 2:
		// In this case, we treat as a regular OS[(OSVersion)]/arch pair. We don't care
		// about whether or not we know of the platform.
		p.Architecture, p.Variant = normalizeArch(parts[1], "")
		if p.Architecture == "arm" && p.Variant == "v7" {
			p.Variant = ""
		}

		return p, nil
	case 3:
		// we have a fully specified variant, this is rare
		p.Architecture, p.Variant = normalizeArch(parts[1], parts[2])
		if p.Architecture == "arm64" && p.Variant == "" {
			p.Variant = "v8"
		}

		return p, nil
	}

	return specs.Platform{}, fmt.Errorf("%q: cannot parse platform specifier: %w", specifier, errInvalidArgument)
}

// MustParse is like Parses but panics if the specifier cannot be parsed.
// Simplifies initialization of global variables.
func MustParse(specifier string) specs.Platform {
	p, err := Parse(specifier)
	if err != nil {
		panic("platform: Parse(" + strconv.Quote(specifier) + "): " + err.Error())
	}
	return p
}

// Format returns a string specifier from the provided platform specification.
func Format(platform specs.Platform) string {
	if platform.OS == "" {
		return "unknown"
	}

	return path.Join(platform.OS, platform.Architecture, platform.Variant)
}

// FormatAll returns a string specifier that also includes the OSVersion from the
// provided platform specification.
func FormatAll(platform specs.Platform) string {
	if platform.OS == "" {
		return "unknown"
	}

	if platform.OSVersion != "" {
		OSAndVersion := fmt.Sprintf(osAndVersionFormat, platform.OS, platform.OSVersion)
		return path.Join(OSAndVersion, platform.Architecture, platform.Variant)
	}
	return path.Join(platform.OS, platform.Architecture, platform.Variant)
}

// Normalize validates and translate the platform to the canonical value.
//
// For example, if "Aarch64" is encountered, we change it to "arm64" or if
// "x86_64" is encountered, it becomes "amd64".
func Normalize(platform specs.Platform) specs.Platform {
	platform.OS = normalizeOS(platform.OS)
	platform.Architecture, platform.Variant = normalizeArch(platform.Architecture, platform.Variant)

	return platform
}
