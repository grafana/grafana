// Package sourceinfo provides the ability to register and query source code info
// for file descriptors that are compiled into the binary. This data is registered
// by code generated from the protoc-gen-gosrcinfo plugin.
//
// The standard descriptors bundled into the compiled binary are stripped of source
// code info, to reduce binary size and reduce runtime memory footprint. However,
// the source code info can be very handy and worth the size cost when used with
// gRPC services and the server reflection service. Without source code info, the
// descriptors that a client downloads from the reflection service have no comments.
// But the presence of comments, and the ability to show them to humans, can greatly
// improve the utility of user agents that use the reflection service.
//
// When the protoc-gen-gosrcinfo plugin is used, the desc.Load* methods, which load
// descriptors for compiled-in elements, will automatically include source code
// info, using the data registered with this package.
//
// In order to make the reflection service use this functionality, you will need to
// be using v1.45 or higher of the Go runtime for gRPC (google.golang.org/grpc). The
// following snippet demonstrates how to do this in your server. Do this instead of
// using the reflection.Register function:
//
//	refSvr := reflection.NewServer(reflection.ServerOptions{
//	    Services:           grpcServer,
//	    DescriptorResolver: sourceinfo.GlobalFiles,
//	    ExtensionResolver:  sourceinfo.GlobalFiles,
//	})
//	grpc_reflection_v1alpha.RegisterServerReflectionServer(grpcServer, refSvr)
package sourceinfo

import (
	"bytes"
	"compress/gzip"
	"errors"
	"fmt"
	"io"
	"sync"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"
)

var (
	// GlobalFiles is a registry of descriptors that include source code info, if the
	// files they belong to were processed with protoc-gen-gosrcinfo.
	//
	// If is mean to serve as a drop-in alternative to protoregistry.GlobalFiles that
	// can include source code info in the returned descriptors.
	GlobalFiles Resolver = registry{}

	// GlobalTypes is a registry of descriptors that include source code info, if the
	// files they belong to were processed with protoc-gen-gosrcinfo.
	//
	// If is mean to serve as a drop-in alternative to protoregistry.GlobalTypes that
	// can include source code info in the returned descriptors.
	GlobalTypes TypeResolver = registry{}

	mu                 sync.RWMutex
	sourceInfoByFile   = map[string]*descriptorpb.SourceCodeInfo{}
	fileDescriptors    = map[protoreflect.FileDescriptor]protoreflect.FileDescriptor{}
	updatedDescriptors filesWithFallback
)

// Resolver can resolve file names into file descriptors and also provides methods for
// resolving extensions.
type Resolver interface {
	protodesc.Resolver
	protoregistry.ExtensionTypeResolver
	RangeExtensionsByMessage(message protoreflect.FullName, f func(protoreflect.ExtensionType) bool)
}

// NB: These interfaces are far from ideal. Ideally, Resolver would have
//    * EITHER been named FileResolver and not included the extension methods.
//    * OR also included message methods (i.e. embed protoregistry.MessageTypeResolver).
//   Now (since it's been released) we can't add the message methods to the interface as
//   that's not a backwards-compatible change. So we have to introduce the new interface
//   below, which is now a little confusing since it has some overlap with Resolver.

// TypeResolver can resolve message names and URLs into message descriptors and also
// provides methods for resolving extensions.
type TypeResolver interface {
	protoregistry.MessageTypeResolver
	protoregistry.ExtensionTypeResolver
	RangeExtensionsByMessage(message protoreflect.FullName, f func(protoreflect.ExtensionType) bool)
}

// RegisterSourceInfo registers the given source code info for the file descriptor
// with the given path/name.
//
// This is automatically used from older generated code if using a previous release of
// the protoc-gen-gosrcinfo plugin.
func RegisterSourceInfo(file string, srcInfo *descriptorpb.SourceCodeInfo) {
	mu.Lock()
	defer mu.Unlock()
	sourceInfoByFile[file] = srcInfo
}

// RegisterEncodedSourceInfo registers the given source code info, which is a serialized
// and gzipped form of a google.protobuf.SourceCodeInfo message.
//
// This is automatically used from generated code if using the protoc-gen-gosrcinfo
// plugin.
func RegisterEncodedSourceInfo(file string, data []byte) error {
	zipReader, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer func() {
		_ = zipReader.Close()
	}()
	unzipped, err := io.ReadAll(zipReader)
	if err != nil {
		return err
	}
	var srcInfo descriptorpb.SourceCodeInfo
	if err := proto.Unmarshal(unzipped, &srcInfo); err != nil {
		return err
	}
	RegisterSourceInfo(file, &srcInfo)
	return nil
}

// SourceInfoForFile queries for any registered source code info for the file
// descriptor with the given path/name. It returns nil if no source code info
// was registered.
func SourceInfoForFile(file string) *descriptorpb.SourceCodeInfo {
	mu.RLock()
	defer mu.RUnlock()
	return sourceInfoByFile[file]
}

func canUpgrade(d protoreflect.Descriptor) bool {
	if d == nil {
		return false
	}
	fd := d.ParentFile()
	if fd.SourceLocations().Len() > 0 {
		// already has source info
		return false
	}
	if genFile, err := protoregistry.GlobalFiles.FindFileByPath(fd.Path()); err != nil || genFile != fd {
		// given descriptor is not from generated code
		return false
	}
	return true
}

func getFile(fd protoreflect.FileDescriptor) (protoreflect.FileDescriptor, error) {
	if !canUpgrade(fd) {
		return fd, nil
	}

	mu.RLock()
	result := fileDescriptors[fd]
	mu.RUnlock()

	if result != nil {
		return result, nil
	}

	mu.Lock()
	defer mu.Unlock()
	result, err := getFileLocked(fd)
	if err != nil {
		return nil, fmt.Errorf("updating file %q: %w", fd.Path(), err)
	}
	return result, nil
}

func getFileLocked(fd protoreflect.FileDescriptor) (protoreflect.FileDescriptor, error) {
	result := fileDescriptors[fd]
	if result != nil {
		return result, nil
	}

	// We have to build its dependencies, too, so that the descriptor's
	// references *all* have source code info.
	var deps []protoreflect.FileDescriptor
	imps := fd.Imports()
	for i, length := 0, imps.Len(); i < length; i++ {
		origDep := imps.Get(i).FileDescriptor
		updatedDep, err := getFileLocked(origDep)
		if err != nil {
			return nil, fmt.Errorf("updating import %q: %w", origDep.Path(), err)
		}
		if updatedDep != origDep && deps == nil {
			// lazily init slice of deps and copy over deps before this one
			deps = make([]protoreflect.FileDescriptor, i, length)
			for j := 0; j < i; j++ {
				deps[j] = imps.Get(i).FileDescriptor
			}
		}
		if deps != nil {
			deps = append(deps, updatedDep)
		}
	}

	srcInfo := sourceInfoByFile[fd.Path()]
	if len(srcInfo.GetLocation()) == 0 && len(deps) == 0 {
		// nothing to do; don't bother changing
		return fd, nil
	}

	// Add source code info and rebuild.
	fdProto := protodesc.ToFileDescriptorProto(fd)
	fdProto.SourceCodeInfo = srcInfo

	result, err := protodesc.NewFile(fdProto, &updatedDescriptors)
	if err != nil {
		return nil, err
	}
	if err := updatedDescriptors.RegisterFile(result); err != nil {
		return nil, fmt.Errorf("registering import %q: %w", result.Path(), err)
	}

	fileDescriptors[fd] = result
	return result, nil
}

type registry struct{}

var _ protodesc.Resolver = &registry{}

func (r registry) FindFileByPath(path string) (protoreflect.FileDescriptor, error) {
	fd, err := protoregistry.GlobalFiles.FindFileByPath(path)
	if err != nil {
		return nil, err
	}
	return getFile(fd)
}

func (r registry) FindDescriptorByName(name protoreflect.FullName) (protoreflect.Descriptor, error) {
	d, err := protoregistry.GlobalFiles.FindDescriptorByName(name)
	if err != nil {
		return nil, err
	}
	if !canUpgrade(d) {
		return d, nil
	}
	switch d := d.(type) {
	case protoreflect.FileDescriptor:
		return getFile(d)
	case protoreflect.MessageDescriptor:
		return updateDescriptor(d)
	case protoreflect.FieldDescriptor:
		return updateField(d)
	case protoreflect.OneofDescriptor:
		return updateDescriptor(d)
	case protoreflect.EnumDescriptor:
		return updateDescriptor(d)
	case protoreflect.EnumValueDescriptor:
		return updateDescriptor(d)
	case protoreflect.ServiceDescriptor:
		return updateDescriptor(d)
	case protoreflect.MethodDescriptor:
		return updateDescriptor(d)
	default:
		return nil, fmt.Errorf("unrecognized descriptor type: %T", d)
	}
}

func (r registry) FindMessageByName(message protoreflect.FullName) (protoreflect.MessageType, error) {
	mt, err := protoregistry.GlobalTypes.FindMessageByName(message)
	if err != nil {
		return nil, err
	}
	msg, err := updateDescriptor(mt.Descriptor())
	if err != nil {
		return mt, nil
	}
	return messageType{MessageType: mt, msgDesc: msg}, nil
}

func (r registry) FindMessageByURL(url string) (protoreflect.MessageType, error) {
	mt, err := protoregistry.GlobalTypes.FindMessageByURL(url)
	if err != nil {
		return nil, err
	}
	msg, err := updateDescriptor(mt.Descriptor())
	if err != nil {
		return mt, nil
	}
	return messageType{MessageType: mt, msgDesc: msg}, nil
}

func (r registry) FindExtensionByName(field protoreflect.FullName) (protoreflect.ExtensionType, error) {
	xt, err := protoregistry.GlobalTypes.FindExtensionByName(field)
	if err != nil {
		return nil, err
	}
	ext, err := updateDescriptor(xt.TypeDescriptor().Descriptor())
	if err != nil {
		return xt, nil
	}
	return extensionType{ExtensionType: xt, extDesc: ext}, nil
}

func (r registry) FindExtensionByNumber(message protoreflect.FullName, field protoreflect.FieldNumber) (protoreflect.ExtensionType, error) {
	xt, err := protoregistry.GlobalTypes.FindExtensionByNumber(message, field)
	if err != nil {
		return nil, err
	}
	ext, err := updateDescriptor(xt.TypeDescriptor().Descriptor())
	if err != nil {
		return xt, nil
	}
	return extensionType{ExtensionType: xt, extDesc: ext}, nil
}

func (r registry) RangeExtensionsByMessage(message protoreflect.FullName, fn func(protoreflect.ExtensionType) bool) {
	protoregistry.GlobalTypes.RangeExtensionsByMessage(message, func(xt protoreflect.ExtensionType) bool {
		ext, err := updateDescriptor(xt.TypeDescriptor().Descriptor())
		if err != nil {
			return fn(xt)
		}
		return fn(extensionType{ExtensionType: xt, extDesc: ext})
	})
}

type filesWithFallback struct {
	protoregistry.Files
}

func (f *filesWithFallback) FindFileByPath(path string) (protoreflect.FileDescriptor, error) {
	fd, err := f.Files.FindFileByPath(path)
	if errors.Is(err, protoregistry.NotFound) {
		fd, err = protoregistry.GlobalFiles.FindFileByPath(path)
	}
	return fd, err
}

func (f *filesWithFallback) FindDescriptorByName(name protoreflect.FullName) (protoreflect.Descriptor, error) {
	fd, err := f.Files.FindDescriptorByName(name)
	if errors.Is(err, protoregistry.NotFound) {
		fd, err = protoregistry.GlobalFiles.FindDescriptorByName(name)
	}
	return fd, err
}
