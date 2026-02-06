package ffcontext

type Context interface {
	// GetKey return the unique key for the context.
	GetKey() string
	// IsAnonymous return if the context is about an anonymous user or not.
	IsAnonymous() bool
	// GetCustom return all the custom properties added to the context.
	GetCustom() map[string]interface{}
	// AddCustomAttribute allows to add a custom attribute into the context.
	AddCustomAttribute(name string, value interface{})
	// ExtractGOFFProtectedFields extract the goff specific attributes from the evaluation context.
	ExtractGOFFProtectedFields() GoffContextSpecifics
}

// value is a type to define custom attribute.
type value map[string]interface{}

// NewEvaluationContext creates a new evaluation context identified by the given key.
func NewEvaluationContext(key string) EvaluationContext {
	return EvaluationContext{key: key, custom: map[string]interface{}{}}
}

// Deprecated: NewAnonymousEvaluationContext is here for compatibility reason.
// Please use NewEvaluationContext instead and add a custom attribute to know that it is an anonymous user.
//
// ctx := NewEvaluationContext("my-key")
// ctx.AddCustomAttribute("anonymous", true)
func NewAnonymousEvaluationContext(key string) EvaluationContext {
	return EvaluationContext{key: key, custom: map[string]interface{}{
		"anonymous": true,
	}}
}

// EvaluationContext contains specific attributes for your evaluation.
// Most of the time it is identifying a user browsing your site.
// The only mandatory property is the Key, which must a unique identifier.
// For authenticated users, this may be a username or e-mail address.
// For anonymous users, this could be an IP address or session ID.
//
// EvaluationContext fields are immutable and can be accessed only via getter methods.
// To construct an EvaluationContext, use either a simple constructor (NewEvaluationContext) or the builder pattern
// with NewEvaluationContextBuilder.
type EvaluationContext struct {
	key    string // only mandatory attribute
	custom value
}

// GetKey return the unique key for the user.
func (u EvaluationContext) GetKey() string {
	return u.key
}

// IsAnonymous return if the user is anonymous or not.
func (u EvaluationContext) IsAnonymous() bool {
	anonymous := u.custom["anonymous"]
	switch v := anonymous.(type) {
	case bool:
		return v
	default:
		return false
	}
}

// GetCustom return all the custom properties of a user.
func (u EvaluationContext) GetCustom() map[string]interface{} {
	return u.custom
}

// AddCustomAttribute allows to add a custom attribute into the user.
func (u EvaluationContext) AddCustomAttribute(name string, value interface{}) {
	if name != "" {
		u.custom[name] = value
	}
}

// ExtractGOFFProtectedFields extract the goff specific attributes from the evaluation context.
func (u EvaluationContext) ExtractGOFFProtectedFields() GoffContextSpecifics {
	goff := GoffContextSpecifics{}
	switch v := u.custom["gofeatureflag"].(type) {
	case map[string]string:
		goff.addCurrentDateTime(v["currentDateTime"])
		goff.addListFlags(v["flagList"])
		goff.addExporterMetadata(v["exporterMetadata"])
	case map[string]interface{}:
		goff.addCurrentDateTime(v["currentDateTime"])
		goff.addListFlags(v["flagList"])
		goff.addExporterMetadata(v["exporterMetadata"])
	case GoffContextSpecifics:
		return v
	}
	return goff
}
