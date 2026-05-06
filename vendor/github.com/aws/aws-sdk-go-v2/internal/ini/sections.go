package ini

import (
	"sort"
)

// Sections is a map of Section structures that represent
// a configuration.
type Sections struct {
	container map[string]Section
}

// NewSections returns empty ini Sections
func NewSections() Sections {
	return Sections{
		container: make(map[string]Section, 0),
	}
}

// GetSection will return section p. If section p does not exist,
// false will be returned in the second parameter.
func (t Sections) GetSection(p string) (Section, bool) {
	v, ok := t.container[p]
	return v, ok
}

// HasSection denotes if Sections consist of a section with
// provided name.
func (t Sections) HasSection(p string) bool {
	_, ok := t.container[p]
	return ok
}

// SetSection sets a section value for provided section name.
func (t Sections) SetSection(p string, v Section) Sections {
	t.container[p] = v
	return t
}

// DeleteSection deletes a section entry/value for provided section name./
func (t Sections) DeleteSection(p string) {
	delete(t.container, p)
}

// values represents a map of union values.
type values map[string]Value

// List will return a list of all sections that were successfully
// parsed.
func (t Sections) List() []string {
	keys := make([]string, len(t.container))
	i := 0
	for k := range t.container {
		keys[i] = k
		i++
	}

	sort.Strings(keys)
	return keys
}

// Section contains a name and values. This represent
// a sectioned entry in a configuration file.
type Section struct {
	// Name is the Section profile name
	Name string

	// values are the values within parsed profile
	values values

	// Errors is the list of errors
	Errors []error

	// Logs is the list of logs
	Logs []string

	// SourceFile is the INI Source file from where this section
	// was retrieved. They key is the property, value is the
	// source file the property was retrieved from.
	SourceFile map[string]string
}

// NewSection returns an initialize section for the name
func NewSection(name string) Section {
	return Section{
		Name:       name,
		values:     values{},
		SourceFile: map[string]string{},
	}
}

// List will return a list of all
// services in values
func (t Section) List() []string {
	keys := make([]string, len(t.values))
	i := 0
	for k := range t.values {
		keys[i] = k
		i++
	}

	sort.Strings(keys)
	return keys
}

// UpdateSourceFile updates source file for a property to provided filepath.
func (t Section) UpdateSourceFile(property string, filepath string) {
	t.SourceFile[property] = filepath
}

// UpdateValue updates value for a provided key with provided value
func (t Section) UpdateValue(k string, v Value) error {
	t.values[k] = v
	return nil
}

// Has will return whether or not an entry exists in a given section
func (t Section) Has(k string) bool {
	_, ok := t.values[k]
	return ok
}

// ValueType will returned what type the union is set to. If
// k was not found, the NoneType will be returned.
func (t Section) ValueType(k string) (ValueType, bool) {
	v, ok := t.values[k]
	return v.Type, ok
}

// Bool returns a bool value at k
func (t Section) Bool(k string) (bool, bool) {
	return t.values[k].BoolValue()
}

// Int returns an integer value at k
func (t Section) Int(k string) (int64, bool) {
	return t.values[k].IntValue()
}

// Map returns a map value at k
func (t Section) Map(k string) map[string]string {
	return t.values[k].MapValue()
}

// Float64 returns a float value at k
func (t Section) Float64(k string) (float64, bool) {
	return t.values[k].FloatValue()
}

// String returns the string value at k
func (t Section) String(k string) string {
	_, ok := t.values[k]
	if !ok {
		return ""
	}
	return t.values[k].StringValue()
}
