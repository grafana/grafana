package resource

import (
	"errors"
	"reflect"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// WireFormat enumerates values for possible message wire formats.
// Constants with these values are in this package with a `WireFormat` prefix.
type WireFormat int

const (
	// WireFormatUnknown is an unknown message wire format.
	WireFormatUnknown WireFormat = iota
	// WireFormatJSON is a JSON message wire format, which should be handle-able by the `json` package.
	// (messages which _contain_ JSON, but are not parsable by the go json package should not be
	// considered to be of the JSON wire format).
	WireFormatJSON
)

// Object implements kubernetes' runtime.Object and meta/v1.Object, as well as some additional methods useful for the app-sdk
type Object interface {
	runtime.Object
	schema.ObjectKind
	metav1.Object

	// GetSpec returns the Spec of the Object
	GetSpec() any
	// SetSpec sets the Spec of the Object. It will error if the underlying type is incompatible with the spec type
	SetSpec(any) error
	// GetSubresources returns all known and populated subresouces of the Object, in a map of subresource name -> subresource
	// TODO: should this exist? Originally it was added for arbitrary typed kind unmarshal, which didn't work right anyway
	GetSubresources() map[string]any
	// GetSubresource returns a specific subresource object, or nil if one does not exist. The boolean value is true if the subresource is valid.
	GetSubresource(string) (any, bool)
	// SetSubresource sets a specific subresource by name. If will error if the subresource does not exist, or if the
	// `val` type is incompatible with the subresource type.
	// TODO: should this exist? Originally it was added for arbitrary typed kind unmarshal, which didn't work right anyway
	SetSubresource(key string, val any) error
	// GetStaticMetadata returns the StaticMetadata of the Object
	GetStaticMetadata() StaticMetadata
	// SetStaticMetadata sets the StaticMetadata of the Object. This is equivalent to calling all the SetX methods
	// for each piece of metadata contained in StaticMetadata
	SetStaticMetadata(metadata StaticMetadata)
	// GetCommonMetadata returns the app-sdk CommonMetadata, which is a combination of kubernetes metadata
	// and additional app-sdk-specific metadata
	GetCommonMetadata() CommonMetadata
	// SetCommonMetadata sets the Object metadata fields contained in the provided CommonMetadata
	SetCommonMetadata(CommonMetadata)

	// Copy returns a Deep Copy of the object. This is the equivalent of the runtime.Object DeepCopyObject() method,
	// but one which returns Object instead of runtime.Object.
	Copy() Object
}

// ListObject represents a list of Object-implementing objects with list metadata.
// This interface extends the metav1.List
type ListObject interface {
	runtime.Object
	schema.ObjectKind
	metav1.ListInterface
	GetItems() []Object
	SetItems([]Object)
	Copy() ListObject
}

// StaticMetadata consists of all non-mutable metadata for an object.
// It is set in the initial Create call for an Object, then will always remain the same.
type StaticMetadata struct {
	Group     string `json:"group"`
	Version   string `json:"version"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
}

// Identifier creates an Identifier struct from the StaticMetadata
func (s StaticMetadata) Identifier() Identifier {
	return Identifier{
		Namespace: s.Namespace,
		Name:      s.Name,
	}
}

// FullIdentifier returns a FullIdentifier struct from the StaticMetadata.
// Plural cannot be inferred so is left empty.
func (s StaticMetadata) FullIdentifier() FullIdentifier {
	return FullIdentifier{
		Group:     s.Group,
		Version:   s.Version,
		Kind:      s.Kind,
		Namespace: s.Namespace,
		Name:      s.Name,
	}
}

// CommonMetadata is the generic common metadata for a resource.Object
// TODO: should this be in kindsys, based on the CUE type (once kindsys changes are in effect)?
type CommonMetadata struct {
	// UID is the unique ID of the object. This can be used to uniquely identify objects,
	// but is not guaranteed to be able to be used for lookups.
	UID string `json:"uid"`
	// ResourceVersion is a version string used to identify any and all changes to the object.
	// Any time the object changes in storage, the ResourceVersion will be changed.
	// This can be used to block updates if a change has been made to the object between when the object was
	// retrieved, and when the update was applied.
	ResourceVersion string `json:"resourceVersion"`
	// Generation is a number which is incremented every time the spec of the object changes.
	// It is distinct from ResourceVersion, as it tracks only updates to the spec, and not subresources or metadata.
	Generation int64 `json:"generation"`
	// Labels are string key/value pairs attached to the object. They can be used for filtering,
	// or as additional metadata
	Labels map[string]string `json:"labels"`
	// CreationTimestamp indicates when the resource has been created.
	CreationTimestamp time.Time `json:"creationTimestamp"`
	// DeletionTimestamp indicates that the resource is pending deletion as of the provided time if non-nil.
	// Depending on implementation, this field may always be nil, or it may be a "tombstone" indicator.
	// It may also indicate that the system is waiting on some task to finish before the object is fully removed.
	DeletionTimestamp *time.Time `json:"deletionTimestamp"`
	// Finalizers are a list of identifiers of interested parties for delete events for this resource.
	// Once a resource with finalizers has been deleted, the object should remain in the store,
	// DeletionTimestamp is set to the time of the "delete," and the resource will continue to exist
	// until the finalizers list is cleared.
	Finalizers []string `json:"finalizers"`
	// UpdateTimestamp is the timestamp of the last update to the resource
	UpdateTimestamp time.Time `json:"updateTimestamp"`
	// CreatedBy is a string which indicates the user or process which created the resource.
	// Implementations may choose what this indicator should be.
	CreatedBy string `json:"createdBy"`
	// UpdatedBy is a string which indicates the user or process which last updated the resource.
	// Implementations may choose what this indicator should be.
	UpdatedBy string `json:"updatedBy"`
	// TODO: additional fields?

	// ExtraFields stores implementation-specific metadata.
	// Not all Object implementations will respect or use all possible ExtraFields.
	ExtraFields map[string]any `json:"extraFields"`
}

// CopyObject is an implementation of the receiver method `Copy()` required for implementing Object.
// It should be used in your own runtime.Object implementations if you do not wish to implement custom behavior.
// Example:
//
//	func (c *CustomObject) Copy() resource.Object {
//	    return resource.CopyObject(c)
//	}
func CopyObject(in any) Object {
	if in == nil {
		return nil
	}

	val := reflect.ValueOf(in).Elem()

	cpy := reflect.New(val.Type()).Interface()

	err := CopyObjectInto(cpy, in)
	if err != nil {
		return nil
	}

	// Using the <obj>, <ok> for the type conversion ensures that it doesn't panic if it can't be converted
	if obj, ok := cpy.(Object); ok {
		return obj
	}

	// TODO: better return than nil?
	return nil
}

// CopyObjectInto performs a deep copy of in to out using reflection. in and out must both be pointers to a struct.
// If a copy cannot be performed, an error is returned.
func CopyObjectInto[T any](out T, in T) error {
	srcVal := reflect.ValueOf(in)
	dstVal := reflect.ValueOf(out)
	srcType := reflect.TypeOf(in)
	dstType := reflect.TypeOf(out)
	// T must be a pointer to a struct
	if dstType.Kind() != reflect.Ptr {
		return errors.New("out must be a pointer to a struct")
	}
	// srcType.NumField() panics on a nil type
	if srcType.Kind() == reflect.Ptr && srcVal.IsNil() {
		return errors.New("in must not be nil")
	}
	// Trying to set values on a nil panics
	if dstVal.IsNil() {
		return errors.New("out must not be nil")
	}
	// Before we can work with in and out, we actually need the values the T pointers are referencing
	for dstType.Kind() == reflect.Ptr {
		dstType = dstType.Elem()
		dstVal = dstVal.Elem()
	}
	for srcType.Kind() == reflect.Ptr {
		srcType = srcType.Elem()
		srcVal = srcVal.Elem()
	}

	// For each field, deep copy the value into dstVal
	for i := 0; i < srcType.NumField(); i++ {
		srcFieldValue := srcVal.Field(i)
		dstFieldValue := dstVal.Field(i)
		if err := copyReflectValueInto(dstFieldValue, srcFieldValue); err != nil {
			if errors.Is(err, errCannotSetValue) {
				// Can't set the field, ignore
				continue
			}
			return err
		}
	}

	return nil
}

var errCannotSetValue = errors.New("cannot set value")
var reflectTypeTime = reflect.TypeOf(time.Time{})

// nolint:gocognit,gocritic,funlen
func copyReflectValueInto(dst reflect.Value, src reflect.Value) error {
	// Check if we can set the value (Set panics if this is false)
	if !dst.CanSet() {
		return errCannotSetValue
	}

	switch src.Type().Kind() {
	case reflect.Ptr:
		// If the pointer is nil, just make a new one for the copy
		if src.IsNil() {
			if !dst.IsNil() {
				dst.Set(reflect.Zero(src.Type()))
			}
			return nil
		}
		// find the type of the pointer, then copy that
		typ := src.Type().Elem()
		switch src.Type().Elem().Kind() { //nolint:revive
		case reflect.Struct:
			if src.Elem().Type() == reflectTypeTime {
				dst.Set(src)
				return nil
			}
			dstPtr := reflect.New(typ).Interface()
			err := CopyObjectInto(dstPtr, src.Interface())
			if err != nil {
				return err
			}
			dst.Set(reflect.ValueOf(dstPtr))
		case reflect.Slice:
			if dst.IsNil() {
				dst.Set(reflect.New(typ))
			}
			return copyReflectValueInto(dst.Elem(), src.Elem())
		case reflect.Map:
			if dst.IsNil() {
				dst.Set(reflect.New(typ))
			}
			return copyReflectValueInto(dst.Elem(), src.Elem())
		default:
			ptrCopy := reflect.New(src.Type().Elem()) // new pointer of the same _value type_ as src
			ptrCopy.Elem().Set(src.Elem())            // copy the value src is pointing to
			dst.Set(ptrCopy)
		}
	case reflect.Struct:
		// Special case for time.Time:
		if src.Type() == reflectTypeTime {
			dst.Set(src)
			return nil
		}
		// Recursively copy the struct
		dstStruct := reflect.New(dst.Type()).Interface()
		err := CopyObjectInto(dstStruct, src.Interface())
		if err != nil {
			return err
		}
		dst.Set(reflect.ValueOf(dstStruct).Elem())
	case reflect.Map:
		if src.IsNil() {
			if !dst.IsNil() {
				dst.Set(reflect.New(src.Type()).Elem())
			}
			return nil
		}
		dstMap := reflect.MakeMap(src.Type())
		for _, key := range src.MapKeys() {
			srcKeyVal := src.MapIndex(key)
			dstKeyVal := reflect.New(srcKeyVal.Type()).Elem()
			if srcKeyVal.Kind() == reflect.Ptr && srcKeyVal.Elem().Kind() == reflect.Struct {
				// Copy using CopyObjectInto
				if srcKeyVal.IsNil() {
					dstKeyVal = reflect.New(srcKeyVal.Elem().Type())
				} else {
					// find the type of the pointer, then copy that
					typ := srcKeyVal.Type().Elem()
					dstPtr := reflect.New(typ).Interface()
					err := CopyObjectInto(dstPtr, srcKeyVal.Interface())
					if err != nil {
						return err
					}
					dstKeyVal = reflect.ValueOf(dstPtr)
				}
			} else if srcKeyVal.Kind() == reflect.Struct {
				// Copy using CopyObjectInto
				dst := reflect.New(srcKeyVal.Type()).Interface()
				if err := CopyObjectInto(dst, srcKeyVal.Interface()); err != nil {
					return err
				}
				dstKeyVal = reflect.ValueOf(dst).Elem()
			} else {
				dstKeyVal.Set(srcKeyVal)
			}
			dstMap.SetMapIndex(key, dstKeyVal)
		}
		dst.Set(dstMap)
	case reflect.Slice:
		if src.IsNil() {
			if !dst.IsNil() {
				dst.Set(reflect.New(src.Type()).Elem())
			}
			return nil
		}
		// Copy slice elements
		dstSlice := reflect.MakeSlice(src.Type(), src.Len(), src.Cap())
		reflect.Copy(dstSlice, src)
		dst.Set(dstSlice)
	default:
		// Just copy the value over
		dst.Set(src)
	}
	return nil
}
