// Copyright 2025 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// Provenance-includes-location: https://github.com/prometheus/prometheus/blob/3602785a89162ccc99a940fb9d862219a2d02241/config/config.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Copyright The Prometheus Authors

package otlptranslator

// TranslationStrategyOption is a constant that defines how metric and label
// names should be handled during translation. The recommended approach is to
// use either UnderscoreEscapingWithSuffixes for full Prometheus-style
// compatibility, or NoTranslation for Otel-style names.
type TranslationStrategyOption string

var (
	// NoUTF8EscapingWithSuffixes will accept metric/label names as they are. Unit
	// and type suffixes may be added to metric names, according to certain rules.
	NoUTF8EscapingWithSuffixes TranslationStrategyOption = "NoUTF8EscapingWithSuffixes"
	// UnderscoreEscapingWithSuffixes is the default option for translating OTLP
	// to Prometheus. This option will translate metric name characters that are
	// not alphanumerics/underscores/colons to underscores, and label name
	// characters that are not alphanumerics/underscores to underscores. Unit and
	// type suffixes may be appended to metric names, according to certain rules.
	UnderscoreEscapingWithSuffixes TranslationStrategyOption = "UnderscoreEscapingWithSuffixes"
	// UnderscoreEscapingWithoutSuffixes translates metric name characters that
	// are not alphanumerics/underscores/colons to underscores, and label name
	// characters that are not alphanumerics/underscores to underscores, but
	// unlike UnderscoreEscapingWithSuffixes it does not append any suffixes to
	// the names.
	UnderscoreEscapingWithoutSuffixes TranslationStrategyOption = "UnderscoreEscapingWithoutSuffixes"
	// NoTranslation (EXPERIMENTAL): disables all translation of incoming metric
	// and label names. This offers a way for the OTLP users to use native metric
	// names, reducing confusion.
	//
	// WARNING: This setting has significant known risks and limitations (see
	// https://prometheus.io/docs/practices/naming/  for details): * Impaired UX
	// when using PromQL in plain YAML (e.g. alerts, rules, dashboard, autoscaling
	// configuration). * Series collisions which in the best case may result in
	// OOO errors, in the worst case a silently malformed time series. For
	// instance, you may end up in situation of ingesting `foo.bar` series with
	// unit `seconds` and a separate series `foo.bar` with unit `milliseconds`.
	//
	// As a result, this setting is experimental and currently, should not be used
	// in production systems.
	//
	// TODO(ArthurSens): Mention `type-and-unit-labels` feature
	// (https://github.com/prometheus/proposals/pull/39) once released, as
	// potential mitigation of the above risks.
	NoTranslation TranslationStrategyOption = "NoTranslation"
)

// ShouldEscape returns true if the translation strategy requires that metric
// names be escaped.
func (o TranslationStrategyOption) ShouldEscape() bool {
	switch o {
	case UnderscoreEscapingWithSuffixes, UnderscoreEscapingWithoutSuffixes:
		return true
	case NoTranslation, NoUTF8EscapingWithSuffixes:
		return false
	default:
		return false
	}
}

// ShouldAddSuffixes returns a bool deciding whether the given translation
// strategy should have suffixes added.
func (o TranslationStrategyOption) ShouldAddSuffixes() bool {
	switch o {
	case UnderscoreEscapingWithSuffixes, NoUTF8EscapingWithSuffixes:
		return true
	case UnderscoreEscapingWithoutSuffixes, NoTranslation:
		return false
	default:
		return false
	}
}
