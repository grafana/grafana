package k8s

// Converter describes a type which can convert a kubernetes kind from one API version to another.
// Typically there is one converter per-kind, but a single converter can also handle multiple kinds.
type Converter interface {
	// Convert converts a raw kubernetes kind into the target APIVersion.
	// The RawKind argument will contain kind information and the raw kubernetes object,
	// and the returned bytes are expected to be a raw kubernetes object of the same kind and targetAPIVersion
	// APIVersion. The returned kubernetes object MUST have an apiVersion that matches targetAPIVersion.
	Convert(obj RawKind, targetAPIVersion string) ([]byte, error)
}

// RawKind represents a raw kubernetes object with basic kind information parsed out of it
type RawKind struct {
	// Kind is the parsed kind string
	Kind string
	// APIVersion is the parsed API version string
	APIVersion string
	// Group is the group parsed from the API version string
	Group string
	// Version is the version parsed from the API version string
	Version string
	// Raw contains the entire kubernetes object in []byte form
	Raw []byte
}
