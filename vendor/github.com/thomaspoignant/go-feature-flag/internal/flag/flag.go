package flag

import (
	"github.com/thomaspoignant/go-feature-flag/ffcontext"
)

type Flag interface {
	// Value is returning the Value associate to the flag
	Value(flagName string, evaluationContext ffcontext.Context, flagContext Context) (interface{}, ResolutionDetails)

	// GetVersion is the getter for the field Version
	// Default: 0.0
	GetVersion() string

	// IsTrackEvents is the getter of the field TrackEvents
	// Default: true
	IsTrackEvents() bool

	// IsDisable is the getter for the field Disable
	// Default: false
	IsDisable() bool

	// GetVariationValue return the value of variation from his name
	GetVariationValue(name string) interface{}

	// GetMetadata return the metadata associated to the flag
	GetMetadata() map[string]interface{}
}
