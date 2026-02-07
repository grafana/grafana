package flag

// variationSelection is an internal struct used when selecting the variation
// for a flag.
type variationSelection struct {
	// name of the selected variation
	name string

	// reason of the selection
	reason ResolutionReason

	// ruleIndex the index of the original rule which applied
	ruleIndex *int

	// ruleName (optional) is the name of the associated rule if we have one
	ruleName *string

	// cacheable is set to true if a provider/SDK can cache the value
	cacheable bool
}
