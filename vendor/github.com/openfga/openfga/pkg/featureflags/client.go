package featureflags

type Client interface {
	Boolean(flagName string, storeID string) bool
}

type defaultClient struct {
	flags map[string]any
}

// NewDefaultClient creates a default feature flag client which takes in a static list of enabled feature flag names
// and stores them as keys in a map.
func NewDefaultClient(flags []string) Client {
	enabledFlags := make(map[string]any, len(flags))
	for _, flag := range flags {
		enabledFlags[flag] = struct{}{}
	}
	return &defaultClient{
		flags: enabledFlags,
	}
}

func (c *defaultClient) Boolean(flagName string, storeID string) bool {
	_, ok := c.flags[flagName]
	return ok
}

type hardcodedBooleanClient struct {
	result bool // this client will always return this result
}

// NewHardcodedBooleanClient creates a hardcodedBooleanClient which always returns the value of `result` it's given.
// The hardcodedBooleanClient is used in testing and in shadow code paths where we want to force enable/disable a feature.
func NewHardcodedBooleanClient(result bool) Client {
	return &hardcodedBooleanClient{result: result}
}

func (h *hardcodedBooleanClient) Boolean(flagName string, _ string) bool {
	return h.result
}

func NewNoopFeatureFlagClient() Client {
	return NewHardcodedBooleanClient(false)
}
