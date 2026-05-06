package protocol

import (
	"fmt"
	"hash/fnv"
	"sort"
	"time"
)

// Tag holds the keys and values for a bunch of Tag k/v pairs.
type Tag struct {
	Key   string
	Value string
}

// Field holds the keys and values for a bunch of Metric Field k/v pairs where Value can be a uint64, int64, int, float32, float64, string, or bool.
type Field struct {
	Key   string
	Value interface{}
}

// Metric is the interface for marshaling, if you implement this interface you can be marshalled into the line protocol.  Woot!
type Metric interface {
	Time() time.Time
	Name() string
	TagList() []*Tag
	FieldList() []*Field
}

// MutableMetric represents a metric that can be be modified.
type MutableMetric interface {
	Metric
	SetTime(time.Time)
	AddTag(key, value string)
	AddField(key string, value interface{})
}

// FieldSortOrder is a type for controlling if Fields are sorted
type FieldSortOrder int

const (
	// NoSortFields tells the Decoder to not sort the fields.
	NoSortFields FieldSortOrder = iota

	// SortFields tells the Decoder to sort the fields.
	SortFields
)

// FieldTypeSupport is a type for the parser to understand its type support.
type FieldTypeSupport int

const (
	// UintSupport means the parser understands uint64s and can store them without having to convert to int64.
	UintSupport FieldTypeSupport = 1 << iota
)

// MetricError is an error causing a metric to be unserializable.
type MetricError struct {
	s string
}

func (e MetricError) Error() string {
	return e.s
}

// FieldError is an error causing a field to be unserializable.
type FieldError struct {
	s string
}

func (e FieldError) Error() string {
	return e.s
}

var (
	// ErrNeedMoreSpace tells us that the Decoder's io.Reader is full.
	ErrNeedMoreSpace = &MetricError{"need more space"}

	// ErrInvalidName tells us that the chosen name is invalid.
	ErrInvalidName = &MetricError{"invalid name"}

	// ErrNoFields tells us that there were no serializable fields in the line/metric.
	ErrNoFields = &MetricError{"no serializable fields"}
)

type metric struct {
	name   string
	tags   []*Tag
	fields []*Field
	tm     time.Time
}

// New creates a new metric via maps.
func New(
	name string,
	tags map[string]string,
	fields map[string]interface{},
	tm time.Time,
) (MutableMetric, error) {
	m := &metric{
		name:   name,
		tags:   nil,
		fields: nil,
		tm:     tm,
	}

	if len(tags) > 0 {
		m.tags = make([]*Tag, 0, len(tags))
		for k, v := range tags {
			m.tags = append(m.tags,
				&Tag{Key: k, Value: v})
		}
		sort.Slice(m.tags, func(i, j int) bool { return m.tags[i].Key < m.tags[j].Key })
	}

	if len(fields) > 0 {
		m.fields = make([]*Field, 0, len(fields))
		for k, v := range fields {
			v := convertField(v)
			if v == nil {
				continue
			}
			m.AddField(k, v)
		}
	}

	return m, nil
}

// FromMetric returns a deep copy of the metric with any tracking information
// removed.
func FromMetric(other Metric) Metric {
	m := &metric{
		name:   other.Name(),
		tags:   make([]*Tag, len(other.TagList())),
		fields: make([]*Field, len(other.FieldList())),
		tm:     other.Time(),
	}

	for i, tag := range other.TagList() {
		m.tags[i] = &Tag{Key: tag.Key, Value: tag.Value}
	}

	for i, field := range other.FieldList() {
		m.fields[i] = &Field{Key: field.Key, Value: field.Value}
	}
	return m
}

func (m *metric) String() string {
	return fmt.Sprintf("%s %v %v %d", m.name, m.Tags(), m.Fields(), m.tm.UnixNano())
}

func (m *metric) Name() string {
	return m.name
}

func (m *metric) Tags() map[string]string {
	tags := make(map[string]string, len(m.tags))
	for _, tag := range m.tags {
		tags[tag.Key] = tag.Value
	}
	return tags
}

func (m *metric) TagList() []*Tag {
	return m.tags
}

func (m *metric) Fields() map[string]interface{} {
	fields := make(map[string]interface{}, len(m.fields))
	for _, field := range m.fields {
		fields[field.Key] = field.Value
	}

	return fields
}

func (m *metric) FieldList() []*Field {
	return m.fields
}

func (m *metric) Time() time.Time {
	return m.tm
}

func (m *metric) SetName(name string) {
	m.name = name
}

func (m *metric) AddPrefix(prefix string) {
	m.name = prefix + m.name
}

func (m *metric) AddSuffix(suffix string) {
	m.name = m.name + suffix
}

func (m *metric) AddTag(key, value string) {
	for i, tag := range m.tags {
		if key > tag.Key {
			continue
		}

		if key == tag.Key {
			tag.Value = value
			return
		}

		m.tags = append(m.tags, nil)
		copy(m.tags[i+1:], m.tags[i:])
		m.tags[i] = &Tag{Key: key, Value: value}
		return
	}

	m.tags = append(m.tags, &Tag{Key: key, Value: value})
}

func (m *metric) HasTag(key string) bool {
	for _, tag := range m.tags {
		if tag.Key == key {
			return true
		}
	}
	return false
}

func (m *metric) GetTag(key string) (string, bool) {
	for _, tag := range m.tags {
		if tag.Key == key {
			return tag.Value, true
		}
	}
	return "", false
}

func (m *metric) RemoveTag(key string) {
	for i, tag := range m.tags {
		if tag.Key == key {
			copy(m.tags[i:], m.tags[i+1:])
			m.tags[len(m.tags)-1] = nil
			m.tags = m.tags[:len(m.tags)-1]
			return
		}
	}
}

func (m *metric) AddField(key string, value interface{}) {
	for i, field := range m.fields {
		if key == field.Key {
			m.fields[i] = &Field{Key: key, Value: convertField(value)}
			return
		}
	}
	m.fields = append(m.fields, &Field{Key: key, Value: convertField(value)})
}

func (m *metric) HasField(key string) bool {
	for _, field := range m.fields {
		if field.Key == key {
			return true
		}
	}
	return false
}

func (m *metric) GetField(key string) (interface{}, bool) {
	for _, field := range m.fields {
		if field.Key == key {
			return field.Value, true
		}
	}
	return nil, false
}

func (m *metric) RemoveField(key string) {
	for i, field := range m.fields {
		if field.Key == key {
			copy(m.fields[i:], m.fields[i+1:])
			m.fields[len(m.fields)-1] = nil
			m.fields = m.fields[:len(m.fields)-1]
			return
		}
	}
}

func (m *metric) SetTime(t time.Time) {
	m.tm = t
}

func (m *metric) Copy() Metric {
	m2 := &metric{
		name:   m.name,
		tags:   make([]*Tag, len(m.tags)),
		fields: make([]*Field, len(m.fields)),
		tm:     m.tm,
	}

	for i, tag := range m.tags {
		m2.tags[i] = &Tag{Key: tag.Key, Value: tag.Value}
	}

	for i, field := range m.fields {
		m2.fields[i] = &Field{Key: field.Key, Value: field.Value}
	}
	return m2
}

func (m *metric) HashID() uint64 {
	h := fnv.New64a()
	h.Write([]byte(m.name))
	h.Write([]byte("\n"))
	for _, tag := range m.tags {
		h.Write([]byte(tag.Key))
		h.Write([]byte("\n"))
		h.Write([]byte(tag.Value))
		h.Write([]byte("\n"))
	}
	return h.Sum64()
}

func (m *metric) Accept() {
}

func (m *metric) Reject() {
}

func (m *metric) Drop() {
}

// Convert field to a supported type or nil if unconvertible
func convertField(v interface{}) interface{} {
	switch v := v.(type) {
	case float64:
		return v
	case int64:
		return v
	case string:
		return v
	case bool:
		return v
	case int:
		return int64(v)
	case uint:
		return uint64(v)
	case uint64:
		return uint64(v)
	case []byte:
		return string(v)
	case int32:
		return int64(v)
	case int16:
		return int64(v)
	case int8:
		return int64(v)
	case uint32:
		return uint64(v)
	case uint16:
		return uint64(v)
	case uint8:
		return uint64(v)
	case float32:
		return float64(v)
	case *float64:
		if v != nil {
			return *v
		}
	case *int64:
		if v != nil {
			return *v
		}
	case *string:
		if v != nil {
			return *v
		}
	case *bool:
		if v != nil {
			return *v
		}
	case *int:
		if v != nil {
			return int64(*v)
		}
	case *uint:
		if v != nil {
			return uint64(*v)
		}
	case *uint64:
		if v != nil {
			return uint64(*v)
		}
	case *[]byte:
		if v != nil {
			return string(*v)
		}
	case *int32:
		if v != nil {
			return int64(*v)
		}
	case *int16:
		if v != nil {
			return int64(*v)
		}
	case *int8:
		if v != nil {
			return int64(*v)
		}
	case *uint32:
		if v != nil {
			return uint64(*v)
		}
	case *uint16:
		if v != nil {
			return uint64(*v)
		}
	case *uint8:
		if v != nil {
			return uint64(*v)
		}
	case *float32:
		if v != nil {
			return float64(*v)
		}
	default:
		return nil
	}
	return nil
}
