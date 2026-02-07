package useragent

import (
	"errors"
	"regexp"
)

var (
	userAgentRegex   = regexp.MustCompile(`^Grafana/([0-9]+\.[0-9]+\.[0-9]+(?:[^\s]+)?) \(([a-zA-Z0-9]+); ([a-zA-Z0-9]+)\)$`)
	errInvalidFormat = errors.New("invalid user agent format")
)

// UserAgent represents a Grafana user agent.
// Its format is "Grafana/<version> (<os>; <arch>)"
// Example: "Grafana/7.0.0-beta1 (darwin; amd64)", "Grafana/10.0.0 (windows; x86)"
type UserAgent struct {
	grafanaVersion string
	arch           string
	os             string
}

// New creates a new UserAgent.
// The version must be a valid semver string, and the os and arch must be valid strings.
func New(grafanaVersion, os, arch string) (*UserAgent, error) {
	ua := &UserAgent{
		grafanaVersion: grafanaVersion,
		os:             os,
		arch:           arch,
	}

	return Parse(ua.String())
}

// Parse creates a new UserAgent from a string.
func Parse(s string) (*UserAgent, error) {
	matches := userAgentRegex.FindStringSubmatch(s)
	if len(matches) != 4 {
		return nil, errInvalidFormat
	}

	return &UserAgent{
		grafanaVersion: matches[1],
		os:             matches[2],
		arch:           matches[3],
	}, nil
}

// Empty creates a new UserAgent with default values.
func Empty() *UserAgent {
	return &UserAgent{
		grafanaVersion: "0.0.0",
		os:             "unknown",
		arch:           "unknown",
	}
}

func (ua *UserAgent) GrafanaVersion() string {
	return ua.grafanaVersion
}

func (ua *UserAgent) String() string {
	return "Grafana/" + ua.grafanaVersion + " (" + ua.os + "; " + ua.arch + ")"
}
