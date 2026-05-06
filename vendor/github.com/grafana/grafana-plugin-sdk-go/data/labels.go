package data

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"sort"
	"strings"
	"unsafe"

	jsoniter "github.com/json-iterator/go"
)

// Labels are used to add metadata to an object.  The JSON will always be sorted keys
//
//swagger:model FrameLabels
type Labels map[string]string

func init() { //nolint:gochecknoinits
	jsoniter.RegisterTypeEncoder("data.Labels", &dataLabelsCodec{})
}

// Equals returns true if the argument has the same k=v pairs as the receiver.
func (l Labels) Equals(arg Labels) bool {
	if len(l) != len(arg) {
		return false
	}
	for k, v := range l {
		if argVal, ok := arg[k]; !ok || argVal != v {
			return false
		}
	}
	return true
}

// Copy returns a copy of the labels.
func (l Labels) Copy() Labels {
	c := make(Labels, len(l))
	for k, v := range l {
		c[k] = v
	}
	return c
}

// Contains returns true if all k=v pairs of the argument are in the receiver.
func (l Labels) Contains(arg Labels) bool {
	if len(arg) > len(l) {
		return false
	}
	for k, v := range arg {
		if argVal, ok := l[k]; !ok || argVal != v {
			return false
		}
	}
	return true
}

// String() turns labels into string, and will sort the kv pairs by keys
// e.g. Labels{"b":"valueB", "a": "valueA"} -> {"a=valueA, b=valueB"}
func (l Labels) String() string {
	keys := make([]string, len(l))
	i := 0
	for k := range l {
		keys[i] = k
		i++
	}
	sort.Strings(keys)

	var sb strings.Builder

	i = 0
	for _, k := range keys {
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(l[k])
		if i != len(keys)-1 {
			sb.WriteString(", ")
		}
		i++
	}
	return sb.String()
}

type Fingerprint uint64

func (f Fingerprint) String() string {
	return fmt.Sprintf("%016x", uint64(f))
}

// Fingerprint calculates a 64-bit FNV-1 hash of the labels. Labels are sorted by key to make sure the hash is stable.
func (l Labels) Fingerprint() Fingerprint {
	h := fnv.New64()
	if len(l) == 0 {
		return Fingerprint(h.Sum64())
	}
	// maps do not guarantee predictable sequence of keys.
	// Therefore, to make hash stable, we need to sort keys
	keys := make([]string, 0, len(l))
	for labelName := range l {
		keys = append(keys, labelName)
	}
	sort.Strings(keys)
	for _, name := range keys {
		// avoid an extra allocation of a slice of bytes using unsafe conversions.
		// The internal structure of the string is almost like a slice (except capacity).
		_, _ = h.Write(unsafe.Slice(unsafe.StringData(name), len(name)))
		// ignore errors returned by Write method because fnv never returns them.
		_, _ = h.Write([]byte{255}) // use an invalid utf-8 sequence as separator
		value := l[name]
		_, _ = h.Write(unsafe.Slice(unsafe.StringData(value), len(value)))
		_, _ = h.Write([]byte{255})
	}
	return Fingerprint(h.Sum64())
}

// LabelsFromString() parses string into a Label object.
// Input string needs to follow the k=v convention,
// e.g. `{service="users-directory"}`, "method=GET", or real JSON
func LabelsFromString(s string) (Labels, error) {
	if s == "" {
		return nil, nil
	}
	labels := make(map[string]string)
	if strings.HasPrefix(s, `{"`) {
		err := json.Unmarshal([]byte(s), &labels)
		if err == nil {
			return labels, nil
		}
	}

	f := func(c rune) bool {
		return c == '=' || c == '}' || c == '"' || c == '{'
	}
	for _, rawKV := range strings.Split(s, ", ") {
		// split kv string by = and delete {} and ""
		// e.g {group="canary"} -> ["group" "canary"]
		kV := strings.FieldsFunc(rawKV, f)
		if len(kV) != 2 {
			return nil, fmt.Errorf(`invalid label key=value pair "%v"`, rawKV)
		}
		key := kV[0]
		value := kV[1]

		labels[key] = value
	}

	return labels, nil
}

// MarshalJSON marshals Labels to JSON.
func (l Labels) MarshalJSON() ([]byte, error) {
	cfg := jsoniter.ConfigCompatibleWithStandardLibrary
	stream := cfg.BorrowStream(nil)
	defer cfg.ReturnStream(stream)

	writeLabelsJSON(l, stream)
	if stream.Error != nil {
		return nil, stream.Error
	}

	return append([]byte(nil), stream.Buffer()...), nil
}

func writeLabelsJSON(l Labels, stream *jsoniter.Stream) {
	keys := make([]string, len(l))
	i := 0
	for k := range l {
		keys[i] = k
		i++
	}
	sort.Strings(keys)

	stream.WriteObjectStart()
	for i, k := range keys {
		if i > 0 {
			stream.WriteMore()
		}
		stream.WriteObjectField(k)
		stream.WriteString(l[k])
	}
	stream.WriteObjectEnd()
}

type dataLabelsCodec struct{}

func (codec *dataLabelsCodec) IsEmpty(ptr unsafe.Pointer) bool {
	f := (*Frame)(ptr)
	return f.Fields == nil && f.RefID == "" && f.Meta == nil
}

func (codec *dataLabelsCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	v := (*Labels)(ptr)
	if v == nil {
		stream.WriteNil()
		return
	}
	writeLabelsJSON(*v, stream)
}
