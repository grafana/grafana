// Package commands contains the code that handles each endpoint.
package commands

import "go.opentelemetry.io/otel"

var tracer = otel.Tracer("openfga/pkg/server/commands")
