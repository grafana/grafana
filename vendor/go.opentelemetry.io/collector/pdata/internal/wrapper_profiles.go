// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package internal // import "go.opentelemetry.io/collector/pdata/internal"

import (
	otlpcollectorprofile "go.opentelemetry.io/collector/pdata/internal/data/protogen/collector/profiles/v1development"
	otlpprofile "go.opentelemetry.io/collector/pdata/internal/data/protogen/profiles/v1development"
)

// ProfilesToProto internal helper to convert Profiles to protobuf representation.
func ProfilesToProto(l Profiles) otlpprofile.ProfilesData {
	return otlpprofile.ProfilesData{
		ResourceProfiles: l.orig.ResourceProfiles,
		Dictionary:       l.orig.Dictionary,
	}
}

// ProfilesFromProto internal helper to convert protobuf representation to Profiles.
// This function set exclusive state assuming that it's called only once per Profiles.
func ProfilesFromProto(orig otlpprofile.ProfilesData) Profiles {
	return NewProfiles(&otlpcollectorprofile.ExportProfilesServiceRequest{
		ResourceProfiles: orig.ResourceProfiles,
		Dictionary:       orig.Dictionary,
	}, NewState())
}
