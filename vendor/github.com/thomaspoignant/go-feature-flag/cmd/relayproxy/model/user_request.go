package model

type AllFlagRequest struct {
	// Deprecated: User The representation of a user for your feature flag system.
	User *UserRequest `json:"user,omitempty" xml:"user,omitempty" form:"user" query:"user" deprecated:"true" swaggerignore:"true"` // nolint: lll
	// EvaluationContext The representation of a EvaluationContext for your feature flag system.
	EvaluationContext *EvaluationContextRequest `json:"evaluationContext,omitempty" xml:"evaluationContext,omitempty" form:"evaluationContext" query:"evaluationContext"` // nolint: lll
}

type EvalFlagRequest struct {
	AllFlagRequest `json:",inline" yaml:",inline" toml:",inline"`
	// The value will we use if we are not able to get the variation of the flag.
	DefaultValue interface{} `json:"defaultValue" xml:"defaultValue" form:"defaultValue" query:"defaultValue"`
}

// Deprecated: UserRequest The representation of a user for your feature flag system.
type UserRequest struct {
	// Key is the identifier of the UserRequest.
	Key string `json:"key" xml:"key" form:"key" query:"key" example:"08b5ffb7-7109-42f4-a6f2-b85560fbd20f"`

	// Anonymous set if this is a logged-in user or not.
	Anonymous bool `json:"anonymous" xml:"anonymous" form:"anonymous" query:"anonymous" example:"false"`

	// Custom is a map containing all extra information for this user.
	Custom map[string]interface{} `json:"custom" xml:"custom" form:"custom" query:"custom"  swaggertype:"object,string" example:"email:contact@gofeatureflag.org,firstname:John,lastname:Doe,company:GO Feature Flag"` // nolint: lll
}

// EvaluationContextRequest The representation of a EvaluationContext for your feature flag system.
type EvaluationContextRequest struct {
	// Key is the identifier of the UserRequest.
	Key string `json:"key" xml:"key" form:"key" query:"key" example:"08b5ffb7-7109-42f4-a6f2-b85560fbd20f"`

	// Custom is a map containing all extra information for this user.
	Custom map[string]interface{} `json:"custom" xml:"custom" form:"custom" query:"custom"  swaggertype:"object,string" example:"email:contact@gofeatureflag.org,firstname:John,lastname:Doe,company:GO Feature Flag"` // nolint: lll
}
