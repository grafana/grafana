package data

import (
	"fmt"
	"math"
	"strconv"
)

// FieldConfig represents the display properties for a Field.
type FieldConfig struct {

	// This struct needs to match the frontend component defined in:
	// https://github.com/grafana/grafana/blob/master/packages/grafana-data/src/types/dataFrame.ts#L23
	// All properties are optional should be omitted from JSON when empty or not set.

	Title      string `json:"title,omitempty"`
	Filterable *bool  `json:"filterable,omitempty"` // indicates if the Field's data can be filtered by additional calls.

	// Numeric Options
	Unit     string       `json:"unit,omitempty"`     // is the string to display to represent the Field's unit, such as "Requests/sec"
	Decimals *uint16      `json:"decimals,omitempty"` // is the number of decimal places to display
	Min      *ConfFloat64 `json:"min,omitempty"`      // is the maximum value of fields in the column. When present the frontend can skip the calculation.
	Max      *ConfFloat64 `json:"max,omitempty"`      // see Min

	// Convert input values into a display string
	Mappings []ValueMapping `json:"mappings,omitempty"`

	// Map numeric values to states
	Thresholds *ThresholdsConfig `json:"thresholds,omitempty"`

	// Map values to a display color
	// NOTE: this interface is under development in the frontend... so simple map for now
	Color map[string]interface{} `json:"color,omitempty"`

	// Used when reducing field values
	NullValueMode NullValueMode `json:"nullValueMode,omitempty"`

	// The behavior when clicking on a result
	Links []DataLink `json:"links,omitempty"`

	// Alternative to empty string
	NoValue string `json:"noValue,omitempty"`

	// Panel Specific Values
	Custom map[string]interface{} `json:"custom,omitempty"`
}

// ConfFloat64 is a float64. It Marshals float64 values of NaN of Inf
// to null.
type ConfFloat64 float64

func (sf *ConfFloat64) MarshalJSON() ([]byte, error) {
	if sf == nil || math.IsNaN(float64(*sf)) || math.IsInf(float64(*sf), -1) || math.IsInf(float64(*sf), 1) {
		return []byte("null"), nil
	}

	return []byte(fmt.Sprintf(`%v`, float64(*sf))), nil
}

func (sf *ConfFloat64) UnmarshalJSON(data []byte) error {
	s := string(data)
	if s == "null" {
		return nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return err
	}
	cf := ConfFloat64(v)
	*sf = cf
	return nil
}

// SetDecimals modifies the FieldConfig's Decimals property to
// be set to v and returns the FieldConfig. It is a convenance function
// since the Decimals property is a pointer.
func (fc *FieldConfig) SetDecimals(v uint16) *FieldConfig {
	fc.Decimals = &v
	return fc
}

// SetMin modifies the FieldConfig's Min property to
// be set to v and returns the FieldConfig. It is a convenance function
// since the Min property is a pointer.
func (fc *FieldConfig) SetMin(v float64) *FieldConfig {
	cf := ConfFloat64(v)
	fc.Min = &cf
	return fc
}

// SetMax modifies the FieldConfig's Max property to
// be set to v and returns the FieldConfig. It is a convenance function
// since the Min property is a pointer.
func (fc *FieldConfig) SetMax(v float64) *FieldConfig {
	cf := ConfFloat64(v)
	fc.Max = &cf
	return fc
}

// SetFilterable modifies the FieldConfig's Filterable property to
// be set to b and returns the FieldConfig. It is a convenance function
// since the Filterable property is a pointer.
func (fc *FieldConfig) SetFilterable(b bool) *FieldConfig {
	fc.Filterable = &b
	return fc
}

// NullValueMode say how the UI should show null values
type NullValueMode string

const (
	// NullValueModeNull displays null values
	NullValueModeNull NullValueMode = "null"
	// NullValueModeIgnore sets the display to ignore null values
	NullValueModeIgnore NullValueMode = "connected"
	// NullValueModeAsZero set the display show null values as zero
	NullValueModeAsZero NullValueMode = "null as zero"
)

// MappingType value or range
type MappingType int8

const (
	// ValueToText map a value to text
	ValueToText MappingType = iota + 1

	// RangeToText map a range to text
	RangeToText
)

// ValueMapping convert input value to something else
type ValueMapping struct {
	ID       int16       `json:"id"`
	Operator string      `json:"operator"`
	Text     string      `json:"title"`
	Type     MappingType `json:"type"`

	// Only valid for MappingType == ValueMap
	Value string `json:"value,omitempty"`

	// Only valid for MappingType == RangeMap
	From string `json:"from,omitempty"`
	To   string `json:"to,omitempty"`
}

// DataLink define what
type DataLink struct {
	Title       string `json:"title,omitempty"`
	TargetBlank bool   `json:"targetBlank,omitempty"`
	URL         string `json:"url,omitempty"`
}

// ThresholdsConfig setup thresholds
type ThresholdsConfig struct {
	Mode ThresholdsMode `json:"mode"`

	// Must be sorted by 'value', first value is always -Infinity
	Steps []Threshold `json:"steps"`
}

// Threshold a single step on the threshold list
type Threshold struct {
	Value ConfFloat64 `json:"value,omitempty"` // First value is always -Infinity serialize to null
	Color string      `json:"color,omitempty"`
	State string      `json:"state,omitempty"`
}

// NewThreshold Creates a new Threshold object
func NewThreshold(value float64, color, state string) Threshold {
	cf := ConfFloat64(value)
	return Threshold{
		Value: cf,
		Color: color,
		State: state,
	}
}

// ThresholdsMode absolute or percentage
type ThresholdsMode string

const (
	// ThresholdsModeAbsolute pick thresholds based on absolute value
	ThresholdsModeAbsolute ThresholdsMode = "absolute"

	// ThresholdsModePercentage the threshold is relative to min/max
	ThresholdsModePercentage ThresholdsMode = "percentage"
)
