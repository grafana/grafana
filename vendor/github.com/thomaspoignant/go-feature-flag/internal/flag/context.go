package flag

type Context struct {
	// EvaluationContextEnrichment will be merged with the evaluation context sent during the evaluation.
	// It is useful to add common attributes to all the evaluation, such as a server version, environment, ...
	//
	// All those fields will be included in the custom attributes of the evaluation context,
	// if in the evaluation context you have a field with the same name, it will override the common one.
	// Default: nil
	EvaluationContextEnrichment map[string]interface{}

	// DefaultSdkValue is the default value of the SDK when calling the variation.
	DefaultSdkValue interface{}
}

func (s *Context) AddIntoEvaluationContextEnrichment(key string, value interface{}) {
	if s.EvaluationContextEnrichment == nil {
		s.EvaluationContextEnrichment = make(map[string]interface{})
	}
	s.EvaluationContextEnrichment[key] = value
}
