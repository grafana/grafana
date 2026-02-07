package system

// Runtime describes an OCI runtime
type Runtime struct {
	// "Legacy" runtime configuration for runc-compatible runtimes.

	Path string   `json:"path,omitempty"`
	Args []string `json:"runtimeArgs,omitempty"`

	// Shimv2 runtime configuration. Mutually exclusive with the legacy config above.

	Type    string                 `json:"runtimeType,omitempty"`
	Options map[string]interface{} `json:"options,omitempty"`
}

// RuntimeWithStatus extends [Runtime] to hold [RuntimeStatus].
type RuntimeWithStatus struct {
	Runtime
	Status map[string]string `json:"status,omitempty"`
}
