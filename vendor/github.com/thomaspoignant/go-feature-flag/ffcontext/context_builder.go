package ffcontext

// NewEvaluationContextBuilder constructs a new EvaluationContextBuilder, specifying the user key.
//
// For authenticated users, the key may be a username or e-mail address. For anonymous users,
// this could be an IP address or session ID.
func NewEvaluationContextBuilder(key string) EvaluationContextBuilder {
	return &evaluationContextBuilderImpl{
		key:    key,
		custom: map[string]interface{}{},
	}
}

// EvaluationContextBuilder is a builder to create an EvaluationContext.
type EvaluationContextBuilder interface {
	// Deprecated: Anonymous is to flag the context for an anonymous context or not.
	// This function is here for compatibility reason, please consider to use AddCustom("anonymous", true)
	// instead of using this function.
	Anonymous(bool) EvaluationContextBuilder

	AddCustom(string, interface{}) EvaluationContextBuilder
	Build() EvaluationContext
}

type evaluationContextBuilderImpl struct {
	// Key is the only mandatory attribute
	key    string
	custom value
}

// Deprecated: Anonymous is to flag the context for an anonymous context or not.
// This function is here for compatibility reason, please consider using AddCustom("anonymous", true)
// instead of using this function.
func (u *evaluationContextBuilderImpl) Anonymous(anonymous bool) EvaluationContextBuilder {
	u.custom["anonymous"] = anonymous
	return u
}

// AddCustom allows you to add a custom attribute to the EvaluationContext.
func (u *evaluationContextBuilderImpl) AddCustom(key string, value interface{}) EvaluationContextBuilder {
	u.custom[key] = value
	return u
}

// Build is creating the EvaluationContext.
func (u *evaluationContextBuilderImpl) Build() EvaluationContext {
	return EvaluationContext{
		key:    u.key,
		custom: u.custom,
	}
}
