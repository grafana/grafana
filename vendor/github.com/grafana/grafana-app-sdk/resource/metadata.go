package resource

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"
)

const (
	// AnnotationPrefix is the prefix used for grafana app platform metadata keys in annotations
	AnnotationPrefix = "grafana.com/"
)

// ErrAnnotationMissing indicates that the provided annotation key is missing from the annotation map
var ErrAnnotationMissing = errors.New("annotation is not in annotations map")

// WriteGrafanaAnnotation sanitizes the value of `field` and prepends the grafana annotation prefix,
// then writes the value of the annotation to the provided annotations map, based on the underlying type.
// If `value` is nil, the key derived from `field` will be removed from the map.
func WriteGrafanaAnnotation(annotations map[string]string, field string, value any) error {
	if value == nil {
		delete(annotations, GetGrafanaAnnotationField(field))
		return nil
	}
	typ := reflect.TypeOf(value)
	for typ.Kind() == reflect.Ptr {
		typ = typ.Elem()
	}
	marshaled, err := json.Marshal(value)
	if err != nil {
		return err
	}
	annotations[GetGrafanaAnnotationField(field)] = strings.Trim(string(marshaled), "\"")
	return nil
}

// ReadGrafanaAnnotation derives a annotation key by sanitizing `field` and prepending the grafana annotation prefix,
// then reads the value of the key in the provided annotations map and attempts to unmarshal it into the
// provided type parameter type. If an error occurs during unmarshal, the unmarshal error is returned.
// If the derived key does not exist in the provided annotations map, ErrAnnotationMissing is returned.
func ReadGrafanaAnnotation[T any](annotations map[string]string, field string) (T, error) {
	into := new(T)
	val, ok := annotations[GetGrafanaAnnotationField(field)]
	if !ok {
		return *into, ErrAnnotationMissing
	}
	typ := reflect.TypeOf(into)
	for typ.Kind() == reflect.Pointer {
		typ = typ.Elem()
	}
	// TODO: special case for time.Time, should we determine a more generic way to handle things that marshal to strings?
	if typ.Kind() == reflect.String || (typ.Kind() == reflect.Struct && typ.AssignableTo(reflect.TypeOf(time.Time{}))) {
		// We have to put extra quotes around the string types before unmarshaling
		val = fmt.Sprintf(`"%s"`, val)
	}
	err := json.Unmarshal([]byte(val), into)
	return *into, err
}

var annotationForbiddenCharacters = regexp.MustCompile(`[^a-zA-z0-9\-_\.]`)

// SanitizeAnnotationFieldName removes all non-allowed characters for an annotation name segment
func SanitizeAnnotationFieldName(field string) string {
	return annotationForbiddenCharacters.ReplaceAllString(field, "")
}

// GetGrafanaAnnotationField sanitizes the field name and prepends it with the grafana prefix
func GetGrafanaAnnotationField(field string) string {
	return fmt.Sprintf("%s%s", AnnotationPrefix, SanitizeAnnotationFieldName(field))
}
