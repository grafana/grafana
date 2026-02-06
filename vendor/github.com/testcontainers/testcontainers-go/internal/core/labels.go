package core

import (
	"errors"
	"fmt"
	"strings"

	"github.com/testcontainers/testcontainers-go/internal"
	"github.com/testcontainers/testcontainers-go/internal/config"
)

const (
	// LabelBase is the base label for all testcontainers labels.
	LabelBase = "org.testcontainers"

	// LabelLang specifies the language which created the test container.
	LabelLang = LabelBase + ".lang"

	// LabelReaper identifies the container as a reaper.
	LabelReaper = LabelBase + ".reaper"

	// LabelRyuk identifies the container as a ryuk.
	LabelRyuk = LabelBase + ".ryuk"

	// LabelSessionID specifies the session ID of the container.
	LabelSessionID = LabelBase + ".sessionId"

	// LabelVersion specifies the version of testcontainers which created the container.
	LabelVersion = LabelBase + ".version"

	// LabelReap specifies the container should be reaped by the reaper.
	LabelReap = LabelBase + ".reap"
)

// DefaultLabels returns the standard set of labels which
// includes LabelSessionID if the reaper is enabled.
func DefaultLabels(sessionID string) map[string]string {
	labels := map[string]string{
		LabelBase:      "true",
		LabelLang:      "go",
		LabelVersion:   internal.Version,
		LabelSessionID: sessionID,
	}

	if !config.Read().RyukDisabled {
		labels[LabelReap] = "true"
	}

	return labels
}

// AddDefaultLabels adds the default labels for sessionID to target.
func AddDefaultLabels(sessionID string, target map[string]string) {
	for k, v := range DefaultLabels(sessionID) {
		target[k] = v
	}
}

// MergeCustomLabels sets labels from src to dst.
// If a key in src has [LabelBase] prefix returns an error.
// If dst is nil returns an error.
func MergeCustomLabels(dst, src map[string]string) error {
	if dst == nil {
		return errors.New("destination map is nil")
	}
	for key, value := range src {
		if strings.HasPrefix(key, LabelBase) {
			return fmt.Errorf("key %q has %q prefix", key, LabelBase)
		}
		dst[key] = value
	}
	return nil
}
