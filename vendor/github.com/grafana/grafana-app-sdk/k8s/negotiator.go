package k8s

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	jsonserializer "k8s.io/apimachinery/pkg/runtime/serializer/json"
	"k8s.io/apimachinery/pkg/watch"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
)

// GenericNegotiatedSerializer implements runtime.NegotiatedSerializer and allows for JSON serialization and
// deserialization of resource.Object. Since it is generic, and has no schema information,
// wrapped objects are returned which require a call to `Into` to marshal into an actual resource.Object.
type GenericNegotiatedSerializer struct {
}

// SupportedMediaTypes returns the JSON supported media type with a GenericJSONDecoder and kubernetes JSON Framer.
func (*GenericNegotiatedSerializer) SupportedMediaTypes() []runtime.SerializerInfo {
	return []runtime.SerializerInfo{{
		MediaType: "application/json",
		StreamSerializer: &runtime.StreamSerializerInfo{
			Serializer: &GenericJSONDecoder{},
			Framer:     jsonserializer.Framer,
		},
		Serializer: &GenericJSONDecoder{},
	}}
}

// EncoderForVersion returns the `serializer` input
func (*GenericNegotiatedSerializer) EncoderForVersion(serializer runtime.Encoder,
	_ runtime.GroupVersioner) runtime.Encoder {
	return serializer
}

// DecoderToVersion returns a GenericJSONDecoder
func (*GenericNegotiatedSerializer) DecoderToVersion(_ runtime.Decoder, _ runtime.GroupVersioner) runtime.Decoder {
	return &GenericJSONDecoder{}
}

// GenericJSONDecoder implements runtime.Serializer and works with Untyped* objects to implement runtime.Object
type GenericJSONDecoder struct {
}

type objCheck struct {
	metav1.TypeMeta `json:",inline"`
	Type            string          `json:"type,omitempty"`
	Items           json.RawMessage `json:"items,omitempty"`
}

// Decode decodes the provided data into UntypedWatchObject or UntypedObjectWrapper
//
//nolint:gocritic,revive
func (*GenericJSONDecoder) Decode(
	data []byte, defaults *schema.GroupVersionKind, into runtime.Object,
) (runtime.Object, *schema.GroupVersionKind, error) {
	// Determine what kind of object we have the raw bytes for
	// We do this by unmarshalling into a superset of a few possible types, then narrowing down
	// TODO: this seems very naive, check how apimachinery does it typically
	var chk objCheck
	if err := json.Unmarshal(data, &chk); err != nil {
		logging.DefaultLogger.Error("error unmarshalling into objCheck", "error", err)
		return into, defaults, fmt.Errorf("error unmarshalling into objCheck: %w", err)
	}

	switch {
	case chk.Type != "": // Watch
		obj, err := unmarshalWithDefault(data, into, &metav1.WatchEvent{})
		if err != nil {
			logging.DefaultLogger.Error("error unmarshalling into *metav1.WatchEvent", "error", err)
			return into, defaults, err
		}

		switch watch.EventType(obj.Type) {
		case watch.Error, watch.Added, watch.Modified, watch.Deleted, watch.Bookmark:
			// Other watch event types are already a resource.Object, so we can return them directly
			return obj, defaults, nil
		}

		// If we get here, we have an unknown watch event type
		logging.DefaultLogger.Error("unknown watch event type", "type", obj.Type)
		return into, defaults, fmt.Errorf("unknown watch event type: %s", obj.Type)
	case chk.APIVersion == StatusAPIVersion && chk.Kind == StatusKind: // Status
		obj, err := unmarshalWithDefault(data, into, &metav1.Status{})
		if err != nil {
			logging.DefaultLogger.Error("error unmarshalling into *metav1.Status", "error", err)
			return into, defaults, err
		}

		return obj, defaults, nil
	case into != nil: // Other known Kind
		if err := json.Unmarshal(data, into); err != nil {
			logging.DefaultLogger.Error(
				fmt.Sprintf("error unmarshalling into provided %T", into),
				"error", err,
			)
			return into, defaults, err
		}

		return into, defaults, nil
	case chk.Items != nil: // TODO: the codecs don't know how to handle lists yet.
		return nil, nil, fmt.Errorf("unsupported list object")
	case chk.Kind != "": // Fallback to UntypedObject
		o := &UntypedObjectWrapper{}
		if err := json.Unmarshal(data, o); err != nil {
			logging.DefaultLogger.Error("error unmarshalling into *k8s.UntypedObjectWrapper", "error", err)
			return into, defaults, fmt.Errorf("error unmarshalling into *k8s.UntypedObjectWrapper: %w", err)
		}

		o.object = data
		into = o
	}

	return into, defaults, nil
}

// Encode json-encodes the provided object
func (*GenericJSONDecoder) Encode(obj runtime.Object, w io.Writer) error {
	// TODO: check compliance with resource.Object and use marshalJSON in that case
	b, e := json.Marshal(obj)
	if e != nil {
		return e
	}
	_, e = w.Write(b)
	return e
}

// Identifier returns "generic-json-decoder"
func (*GenericJSONDecoder) Identifier() runtime.Identifier {
	return "generic-json-decoder"
}

type KindNegotiatedSerializer struct {
	Kind resource.Kind
}

// SupportedMediaTypes returns the JSON supported media type with a GenericJSONDecoder and kubernetes JSON Framer.
func (k *KindNegotiatedSerializer) SupportedMediaTypes() []runtime.SerializerInfo {
	supported := make([]runtime.SerializerInfo, 0)
	for encoding, codec := range k.Kind.Codecs {
		serializer := &CodecDecoder{
			SampleObject: k.Kind.ZeroValue(),
			SampleList:   k.Kind.ZeroListValue(),
			Codec:        codec,
		}
		info := runtime.SerializerInfo{
			MediaType:  string(encoding),
			Serializer: serializer,
		}

		// Framer is used for the stream serializer
		switch encoding {
		case resource.KindEncodingJSON:
			serializer.Decoder = json.Unmarshal
			info.Serializer = serializer
			info.StreamSerializer = &runtime.StreamSerializerInfo{
				Serializer: serializer,
				Framer:     jsonserializer.Framer,
			}
		default:
			// TODO: YAML framer
			// case resource.KindEncodingYAML:
			// framer = yamlserializer.Framer <- doesn't exist
		}
		supported = append(supported, info)
	}

	return supported
}

// EncoderForVersion returns the `serializer` input
func (*KindNegotiatedSerializer) EncoderForVersion(serializer runtime.Encoder,
	_ runtime.GroupVersioner) runtime.Encoder {
	return serializer
}

// DecoderToVersion returns a GenericJSONDecoder
func (*KindNegotiatedSerializer) DecoderToVersion(d runtime.Decoder, _ runtime.GroupVersioner) runtime.Decoder {
	return d
}

// CodecDecoder implements runtime.Serializer and works with Untyped* objects to implement runtime.Object
type CodecDecoder struct {
	SampleObject resource.Object
	SampleList   resource.ListObject
	Codec        resource.Codec
	Decoder      func([]byte, any) error
}

type indicator struct {
	metav1.TypeMeta `json:",inline"`
	Items           *noAlloc `json:"items,omitempty"`
}

// noAlloc is used to avoid allocating any memory when unmarshaling, it can be used as a signal field
type noAlloc struct {
}

func (*noAlloc) UnmarshalJSON([]byte) error {
	return nil
}

// Decode decodes the provided data into UntypedWatchObject or UntypedObjectWrapper
//
//nolint:gocritic,revive
func (c *CodecDecoder) Decode(data []byte, defaults *schema.GroupVersionKind, into runtime.Object) (
	runtime.Object, *schema.GroupVersionKind, error) {
	if into != nil {
		switch cast := into.(type) {
		case resource.Object:
			logging.DefaultLogger.Debug("decoding object into provided resource.Object", "gvk", into.GetObjectKind().GroupVersionKind().String())
			err := c.Codec.Read(bytes.NewReader(data), cast)
			return cast, defaults, err
		case resource.ListObject:
			logging.DefaultLogger.Debug("decoding object into provided resource.ListObject", "gvk", into.GetObjectKind().GroupVersionKind().String())
			// TODO: use codec for each element in the list?
			err := c.Decoder(data, cast)
			return cast, defaults, err
		case *metav1.WatchEvent:
			logging.DefaultLogger.Debug("decoding object into provided *v1.WatchEvent", "gvk", into.GetObjectKind().GroupVersionKind().String())
			err := c.Decoder(data, cast)
			return cast, defaults, err
		case *metav1.List:
			logging.DefaultLogger.Debug("decoding object into provided *v1.List", "gvk", into.GetObjectKind().GroupVersionKind().String())
			err := c.Decoder(data, cast)
			return cast, defaults, err
		case *metav1.Status:
			logging.DefaultLogger.Debug("decoding object into provided *v1.Status", "gvk", into.GetObjectKind().GroupVersionKind().String())
			err := c.Decoder(data, cast)
			return cast, defaults, err
		}

		// TODO: This is the same process (just without casting) as WatchEvent, List, and Status (they all use the default Decoder). Should we still keep them separate?
		logging.DefaultLogger.Debug("decoding object into provided unregistered resource using default Decoder", "gvk", into.GetObjectKind().GroupVersionKind().String())
		err := c.Decoder(data, into)
		return into, defaults, err
	}

	if defaults != nil {
		if defaults.Kind == "Status" && defaults.Version == "v1" {
			logging.DefaultLogger.Debug("decoding object into *v1.Status resource based on defaults", "gvk", defaults.String())
			obj := &metav1.Status{}
			err := c.Decoder(data, obj)
			return obj, defaults, err
		}
		logging.DefaultLogger.Debug("defaults present", "gvk", defaults.String())
	}

	tm := indicator{}
	err := c.Decoder(data, &tm)
	if err != nil {
		return nil, nil, fmt.Errorf("error decoding object TypeMeta: %w", err)
	}
	if tm.GroupVersionKind().Version == "v1" && tm.GroupVersionKind().Kind == "Status" {
		logging.DefaultLogger.Debug("decoding object into *v1.Status resource based on decoded TypeMeta", "gvk", tm.GroupVersionKind().String())
		obj := &metav1.Status{}
		err := c.Decoder(data, obj)
		return obj, defaults, err
	}
	// Check if this is a List
	if tm.Items != nil {
		logging.DefaultLogger.Debug("decoding into a new empty list instance from kind", "gvk", tm.GroupVersionKind().String())
		var obj resource.ListObject
		if c.SampleList != nil {
			obj = c.SampleList.Copy()
		} else {
			logging.DefaultLogger.Warn("no SampleObject set in CodecDecoder, using *resource.TypedList[*resource.UntypedObject]")
			obj = &resource.TypedList[*resource.UntypedObject]{}
		}
		// TODO: use codec for each element in the list?
		err = c.Decoder(data, &obj)
		return obj, defaults, err
	}

	// Default to the data being the kind this CodecDecoder is for
	logging.DefaultLogger.Debug("decoding into a new empty object instance from kind", "gvk", tm.GroupVersionKind().String())
	var obj resource.Object
	if c.SampleObject != nil {
		obj = c.SampleObject.Copy()
	} else {
		logging.DefaultLogger.Warn("no SampleObject set in CodecDecoder, using *resource.UntypedObject")
		obj = &resource.UntypedObject{}
	}
	err = c.Codec.Read(bytes.NewReader(data), obj)
	return obj, defaults, err
}

// Encode json-encodes the provided object
func (c *CodecDecoder) Encode(obj runtime.Object, w io.Writer) error {
	if cast, ok := obj.(resource.Object); ok {
		return c.Codec.Write(w, cast)
	}
	return errors.New("provided object is not a resource.Object")
}

// Identifier returns "generic-json-decoder"
func (*CodecDecoder) Identifier() runtime.Identifier {
	return "codec-decoder"
}

func unmarshalWithDefault[T any](data []byte, obj runtime.Object, defVal T) (T, error) {
	res := defVal
	if obj != nil {
		cast, ok := obj.(T)
		if !ok {
			return res, fmt.Errorf("unable to cast %T into %T", obj, res)
		}
		res = cast
	}

	if err := json.Unmarshal(data, res); err != nil {
		return defVal, err
	}

	return res, nil
}
