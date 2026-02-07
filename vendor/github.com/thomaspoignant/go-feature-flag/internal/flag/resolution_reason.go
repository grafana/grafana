package flag

// ResolutionReason is an enum following the open-feature specs about resolution reasons.
type ResolutionReason = string

const (
	// ReasonTargetingMatch The resolved value was the result of a dynamic evaluation,
	// such as a rule or specific user-targeting.
	// ex: serve variation A if username is Thomas
	ReasonTargetingMatch ResolutionReason = "TARGETING_MATCH"

	// ReasonTargetingMatchSplit The resolved value was the result of a dynamic evaluation,
	// that is serving a percentage.
	// ex: serve variation A to 10% of users with the username Thomas
	ReasonTargetingMatchSplit ResolutionReason = "TARGETING_MATCH_SPLIT"

	// ReasonSplit The resolved value was the result of pseudorandom assignment.
	// ex: serve variation A to 10% of all the users.
	ReasonSplit ResolutionReason = "SPLIT"

	// ReasonDisabled Indicates that the feature flag is disabled
	ReasonDisabled ResolutionReason = "DISABLED"

	// ReasonDefault The resolved value was the result of the flag being disabled in the management system.
	ReasonDefault ResolutionReason = "DEFAULT"

	// ReasonStatic	Indicates that the feature flag evaluated to a
	// static value, for example, the default value for the flag
	//
	// Note: Typically means that no dynamic evaluation has been
	// executed for the feature flag
	ReasonStatic ResolutionReason = "STATIC"

	// ReasonUnknown Indicates an unknown issue occurred during evaluation
	ReasonUnknown ResolutionReason = "UNKNOWN"

	// ReasonError Indicates that an error occurred during evaluation
	// Note: The `errorCode`-field contains the details of this error
	ReasonError ResolutionReason = "ERROR"

	// ReasonOffline Indicates that GO Feature Flag is currently evaluating in offline mode.
	ReasonOffline ResolutionReason = "OFFLINE"
)
