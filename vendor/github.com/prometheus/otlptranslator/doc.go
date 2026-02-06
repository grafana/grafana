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

// Package otlptranslator provides utilities for converting OpenTelemetry Protocol (OTLP)
// metric and attribute names to Prometheus-compliant formats.
//
// This package is designed to help users translate OpenTelemetry metrics to Prometheus
// metrics while following the official OpenTelemetry to Prometheus compatibility specification.
//
// Main components:
//   - MetricNamer: Translates OTLP metric names to Prometheus metric names
//   - LabelNamer: Translates OTLP attribute names to Prometheus label names
//   - UnitNamer: Translates OTLP units to Prometheus unit conventions
package otlptranslator
