package data

import (
	"fmt"
	"math"
	"strconv"
	"time"
)

// FieldConfig represents the display properties for a Field.
type FieldConfig struct {

	// This struct needs to match the frontend component defined in:
	// https://github.com/grafana/grafana/blob/master/packages/grafana-data/src/types/dataFrame.ts#L23
	// All properties are optional should be omitted from JSON when empty or not set.

	// DisplayName overrides Grafana default naming, should not be used from a data source
	DisplayName string `json:"displayName,omitempty"`

	// DisplayNameFromDS overrides Grafana default naming strategy.
	DisplayNameFromDS string `json:"displayNameFromDS,omitempty"`

	// Path is an explicit path to the field in the datasource. When the frame meta includes a path,
	// this will default to `${frame.meta.path}/${field.name}
	//
	// When defined, this value can be used as an identifier within the datasource scope, and
	// may be used as an identifier to update values in a subsequent request
	Path string `json:"path,omitempty"`

	// Description is human readable field metadata
	Description string `json:"description,omitempty"`

	// Filterable indicates if the Field's data can be filtered by additional calls.
	Filterable *bool `json:"filterable,omitempty"`

	// Writeable indicates that the datasource knows how to update this value
	Writeable *bool `json:"writeable,omitempty"`

	// Numeric Options
	Unit     string       `json:"unit,omitempty"`     // is the string to display to represent the Field's unit, such as "Requests/sec"
	Decimals *uint16      `json:"decimals,omitempty"` // is the number of decimal places to display
	Min      *ConfFloat64 `json:"min,omitempty"`      // is the maximum value of fields in the column. When present the frontend can skip the calculation.
	Max      *ConfFloat64 `json:"max,omitempty"`      // see Min

	// Interval indicates the expected regular step between values in the series.
	// When an interval exists, consumers can identify "missing" values when the expected value is not present.
	// The grafana timeseries visualization will render disconnected values when missing values are found it the time field.
	// The interval uses the same units as the values.  For time.Time, this is defined in milliseconds.
	Interval float64 `json:"interval,omitempty"`

	// Convert input values into a display string
	Mappings ValueMappings `json:"mappings,omitempty"`

	// Map numeric values to states
	Thresholds *ThresholdsConfig `json:"thresholds,omitempty"`

	// Map values to a display color
	// NOTE: this interface is under development in the frontend... so simple map for now
	Color map[string]interface{} `json:"color,omitempty"`

	// The behavior when clicking on a result
	Links []DataLink `json:"links,omitempty"`

	// Alternative to empty string
	NoValue string `json:"noValue,omitempty"`

	// Type specific configs
	TypeConfig *FieldTypeConfig `json:"type,omitempty"`

	// Panel Specific Values
	Custom map[string]interface{} `json:"custom,omitempty"`
}

// FieldTypeConfig has type specific configs, only one should be active at a time
type FieldTypeConfig struct {
	Enum *EnumFieldConfig `json:"enum,omitempty"`
}

// Enum field config
// Vector values are used as lookup keys into the enum fields
type EnumFieldConfig struct {
	// Value is the string display value for a given index
	Text []string `json:"text"`

	// Color is the color value for a given index (empty is undefined)
	Color []string `json:"color,omitempty"`

	// Icon supports setting an icon for a given index value
	Icon []string `json:"icon,omitempty"`

	// Description of the enum state
	Description []string `json:"description,omitempty"`
}

// ExplicitNullValue is the string representation for null
const ExplicitNullValue = "null"

// ConfFloat64 is a float64. It Marshals float64 values of NaN of Inf
// to null.
type ConfFloat64 float64

// MarshalJSON fullfills the json.Marshaler interface.
func (sf *ConfFloat64) MarshalJSON() ([]byte, error) {
	if sf == nil || math.IsNaN(float64(*sf)) || math.IsInf(float64(*sf), -1) || math.IsInf(float64(*sf), 1) {
		return []byte(string(ExplicitNullValue)), nil
	}

	return []byte(fmt.Sprintf(`%v`, float64(*sf))), nil
}

// UnmarshalJSON fullfills the json.Unmarshaler interface.
func (sf *ConfFloat64) UnmarshalJSON(data []byte) error {
	s := string(data)
	if s == string(ExplicitNullValue) {
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
// be set to v and returns the FieldConfig. It is a convenience function
// since the Decimals property is a pointer.
func (fc *FieldConfig) SetDecimals(v uint16) *FieldConfig {
	fc.Decimals = &v
	return fc
}

// SetMin modifies the FieldConfig's Min property to
// be set to v and returns the FieldConfig. It is a convenience function
// since the Min property is a pointer.
func (fc *FieldConfig) SetMin(v float64) *FieldConfig {
	cf := ConfFloat64(v)
	fc.Min = &cf
	return fc
}

// SetMax modifies the FieldConfig's Max property to
// be set to v and returns the FieldConfig. It is a convenience function
// since the Min property is a pointer.
func (fc *FieldConfig) SetMax(v float64) *FieldConfig {
	cf := ConfFloat64(v)
	fc.Max = &cf
	return fc
}

// SetFilterable modifies the FieldConfig's Filterable property to
// be set to b and returns the FieldConfig. It is a convenience function
// since the Filterable property is a pointer.
func (fc *FieldConfig) SetFilterable(b bool) *FieldConfig {
	fc.Filterable = &b
	return fc
}

// DataLink define what
type DataLink struct { //revive:disable-line
	Title       string            `json:"title,omitempty"`
	TargetBlank bool              `json:"targetBlank,omitempty"`
	URL         string            `json:"url,omitempty"`
	Internal    *InternalDataLink `json:"internal,omitempty"`
}

// InternalDataLink definition to allow Explore links to be constructed in the backend
type InternalDataLink struct {
	Query              any                         `json:"query,omitempty"`
	DatasourceUID      string                      `json:"datasourceUid,omitempty"`
	DatasourceName     string                      `json:"datasourceName,omitempty"`
	ExplorePanelsState *ExplorePanelsState         `json:"panelsState,omitempty"`
	Transformations    *[]LinkTransformationConfig `json:"transformations,omitempty"`
	Range              *TimeRange                  `json:"timeRange,omitempty"`
}

// This is an object constructed with the keys as the values of the enum VisType and the value being a bag of properties
type ExplorePanelsState any

// Redefining this to avoid an import cycle
type TimeRange struct {
	From time.Time `json:"from,omitempty"`
	To   time.Time `json:"to,omitempty"`
}

type LinkTransformationConfig struct {
	Type       SupportedTransformationTypes `json:"type,omitempty"`
	Field      string                       `json:"field,omitempty"`
	Expression string                       `json:"expression,omitempty"`
	MapValue   string                       `json:"mapValue,omitempty"`
}

type SupportedTransformationTypes string

const (
	Regex  SupportedTransformationTypes = "regex"
	Logfmt SupportedTransformationTypes = "logfmt"
)

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
