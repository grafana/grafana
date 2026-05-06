package exporter

import (
	"encoding/json"
	"time"

	"github.com/thomaspoignant/go-feature-flag/ffcontext"
)

type FeatureEventMetadata = map[string]interface{}

func NewFeatureEvent(
	ctx ffcontext.Context,
	flagKey string,
	value interface{},
	variation string,
	failed bool,
	version string,
	source string,
	metadata FeatureEventMetadata,
) FeatureEvent {
	contextKind := "user"
	if ctx.IsAnonymous() {
		contextKind = "anonymousUser"
	}
	return FeatureEvent{
		Kind:         "feature",
		ContextKind:  contextKind,
		UserKey:      ctx.GetKey(),
		CreationDate: time.Now().Unix(),
		Key:          flagKey,
		Variation:    variation,
		Value:        value,
		Default:      failed,
		Version:      version,
		Source:       source,
		Metadata:     metadata,
	}
}

// FeatureEvent represent an Event that we store in the data storage
// nolint:lll
type FeatureEvent struct {
	// Kind for a feature event is feature.
	// A feature event will only be generated if the trackEvents attribute of the flag is set to true.
	Kind string `json:"kind" example:"feature" parquet:"name=kind, type=BYTE_ARRAY, convertedtype=UTF8"`

	// ContextKind is the kind of context which generated an event. This will only be "anonymousUser" for events generated
	// on behalf of an anonymous user or the reserved word "user" for events generated on behalf of a non-anonymous user
	ContextKind string `json:"contextKind,omitempty" example:"user" parquet:"name=contextKind, type=BYTE_ARRAY, convertedtype=UTF8"`

	// UserKey The key of the user object used in a feature flag evaluation. Details for the user object used in a feature
	// flag evaluation as reported by the "feature" event are transmitted periodically with a separate index event.
	UserKey string `json:"userKey" example:"94a25909-20d8-40cc-8500-fee99b569345" parquet:"name=userKey, type=BYTE_ARRAY, convertedtype=UTF8"`

	// CreationDate When the feature flag was requested at Unix epoch time in milliseconds.
	CreationDate int64 `json:"creationDate" example:"1680246000011" parquet:"name=creationDate, type=INT64"`

	// Key of the feature flag requested.
	Key string `json:"key" example:"my-feature-flag" parquet:"name=key, type=BYTE_ARRAY, convertedtype=UTF8"`

	// Variation  of the flag requested. Flag variation values can be "True", "False", "Default" or "SdkDefault"
	// depending on which value was taken during flag evaluation. "SdkDefault" is used when an error is detected and the
	// default value passed during the call to your variation is used.
	Variation string `json:"variation" example:"admin-variation" parquet:"name=variation, type=BYTE_ARRAY, convertedtype=UTF8"`

	// Value of the feature flag returned by feature flag evaluation.
	Value interface{} `json:"value" parquet:"name=value, type=BYTE_ARRAY, convertedtype=UTF8"`

	// Default value is set to true if feature flag evaluation failed, in which case the value returned was the default
	// value passed to variation. If the default field is omitted, it is assumed to be false.
	Default bool `json:"default" example:"false" parquet:"name=default, type=BOOLEAN"`

	// Version contains the version of the flag. If the field is omitted for the flag in the configuration file
	// the default version will be 0.
	Version string `json:"version" example:"v1.0.0" parquet:"name=version, type=BYTE_ARRAY, convertedtype=UTF8"`

	// Source indicates where the event was generated.
	// This is set to SERVER when the event was evaluated in the relay-proxy and PROVIDER_CACHE when it is evaluated from the cache.
	Source string `json:"source" example:"SERVER" parquet:"name=source, type=BYTE_ARRAY, convertedtype=UTF8"`

	// Metadata are static information added in the providers to give context about the events generated.
	Metadata FeatureEventMetadata `json:"metadata,omitempty" parquet:"name=metadata, type=MAP, keytype=BYTE_ARRAY, keyconvertedtype=UTF8, valuetype=BYTE_ARRAY, valueconvertedtype=UTF8"`
}

// MarshalInterface marshals all interface type fields in FeatureEvent into JSON-encoded string.
func (f *FeatureEvent) MarshalInterface() error {
	if f == nil {
		return nil
	}
	b, err := json.Marshal(f.Value)
	if err != nil {
		return err
	}
	f.Value = string(b)
	return nil
}
