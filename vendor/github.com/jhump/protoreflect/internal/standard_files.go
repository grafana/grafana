// Package internal contains some code that should not be exported but needs to
// be shared across more than one of the protoreflect sub-packages.
package internal

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io/ioutil"

	"github.com/golang/protobuf/proto"
	"google.golang.org/protobuf/types/descriptorpb"
)

// TODO: replace this alias configuration with desc.RegisterImportPath?

// StdFileAliases are the standard protos included with protoc, but older versions of
// their respective packages registered them using incorrect paths.
var StdFileAliases = map[string]string{
	// Files for the github.com/golang/protobuf/ptypes package at one point were
	// registered using the path where the proto files are mirrored in GOPATH,
	// inside the golang/protobuf repo.
	// (Fixed as of https://github.com/golang/protobuf/pull/412)
	"google/protobuf/any.proto":       "github.com/golang/protobuf/ptypes/any/any.proto",
	"google/protobuf/duration.proto":  "github.com/golang/protobuf/ptypes/duration/duration.proto",
	"google/protobuf/empty.proto":     "github.com/golang/protobuf/ptypes/empty/empty.proto",
	"google/protobuf/struct.proto":    "github.com/golang/protobuf/ptypes/struct/struct.proto",
	"google/protobuf/timestamp.proto": "github.com/golang/protobuf/ptypes/timestamp/timestamp.proto",
	"google/protobuf/wrappers.proto":  "github.com/golang/protobuf/ptypes/wrappers/wrappers.proto",
	// Files for the google.golang.org/genproto/protobuf package at one point
	// were registered with an anomalous "src/" prefix.
	// (Fixed as of https://github.com/google/go-genproto/pull/31)
	"google/protobuf/api.proto":            "src/google/protobuf/api.proto",
	"google/protobuf/field_mask.proto":     "src/google/protobuf/field_mask.proto",
	"google/protobuf/source_context.proto": "src/google/protobuf/source_context.proto",
	"google/protobuf/type.proto":           "src/google/protobuf/type.proto",

	// Other standard files (descriptor.proto and compiler/plugin.proto) are
	// registered correctly, so we don't need rules for them here.
}

func init() {
	// We provide aliasing in both directions, to support files with the
	// proper import path linked against older versions of the generated
	// files AND files that used the aliased import path but linked against
	// newer versions of the generated files (which register with the
	// correct path).

	// Get all files defined above
	keys := make([]string, 0, len(StdFileAliases))
	for k := range StdFileAliases {
		keys = append(keys, k)
	}
	// And add inverse mappings
	for _, k := range keys {
		alias := StdFileAliases[k]
		StdFileAliases[alias] = k
	}
}

type ErrNoSuchFile string

func (e ErrNoSuchFile) Error() string {
	return fmt.Sprintf("no such file: %q", string(e))
}

// LoadFileDescriptor loads a registered descriptor and decodes it. If the given
// name cannot be loaded but is a known standard name, an alias will be tried,
// so the standard files can be loaded even if linked against older "known bad"
// versions of packages.
func LoadFileDescriptor(file string) (*descriptorpb.FileDescriptorProto, error) {
	fdb := proto.FileDescriptor(file)
	aliased := false
	if fdb == nil {
		var ok bool
		alias, ok := StdFileAliases[file]
		if ok {
			aliased = true
			if fdb = proto.FileDescriptor(alias); fdb == nil {
				return nil, ErrNoSuchFile(file)
			}
		} else {
			return nil, ErrNoSuchFile(file)
		}
	}

	fd, err := DecodeFileDescriptor(file, fdb)
	if err != nil {
		return nil, err
	}

	if aliased {
		// the file descriptor will have the alias used to load it, but
		// we need it to have the specified name in order to link it
		fd.Name = proto.String(file)
	}

	return fd, nil
}

// DecodeFileDescriptor decodes the bytes of a registered file descriptor.
// Registered file descriptors are first "proto encoded" (e.g. binary format
// for the descriptor protos) and then gzipped. So this function gunzips and
// then unmarshals into a descriptor proto.
func DecodeFileDescriptor(element string, fdb []byte) (*descriptorpb.FileDescriptorProto, error) {
	raw, err := decompress(fdb)
	if err != nil {
		return nil, fmt.Errorf("failed to decompress %q descriptor: %v", element, err)
	}
	fd := descriptorpb.FileDescriptorProto{}
	if err := proto.Unmarshal(raw, &fd); err != nil {
		return nil, fmt.Errorf("bad descriptor for %q: %v", element, err)
	}
	return &fd, nil
}

func decompress(b []byte) ([]byte, error) {
	r, err := gzip.NewReader(bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("bad gzipped descriptor: %v", err)
	}
	out, err := ioutil.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("bad gzipped descriptor: %v", err)
	}
	return out, nil
}
