package desc

import (
	"errors"
	"fmt"
	"strings"

	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/descriptorpb"

	"github.com/jhump/protoreflect/desc/internal"
	intn "github.com/jhump/protoreflect/internal"
)

// CreateFileDescriptor instantiates a new file descriptor for the given descriptor proto.
// The file's direct dependencies must be provided. If the given dependencies do not include
// all of the file's dependencies or if the contents of the descriptors are internally
// inconsistent (e.g. contain unresolvable symbols) then an error is returned.
func CreateFileDescriptor(fd *descriptorpb.FileDescriptorProto, deps ...*FileDescriptor) (*FileDescriptor, error) {
	return createFileDescriptor(fd, deps, nil)
}

type descResolver struct {
	files          []*FileDescriptor
	importResolver *ImportResolver
	fromPath       string
}

func (r *descResolver) FindFileByPath(path string) (protoreflect.FileDescriptor, error) {
	resolvedPath := r.importResolver.ResolveImport(r.fromPath, path)
	d := r.findFileByPath(resolvedPath)
	if d != nil {
		return d, nil
	}
	if resolvedPath != path {
		d := r.findFileByPath(path)
		if d != nil {
			return d, nil
		}
	}
	return nil, protoregistry.NotFound
}

func (r *descResolver) findFileByPath(path string) protoreflect.FileDescriptor {
	for _, fd := range r.files {
		if fd.GetName() == path {
			return fd.UnwrapFile()
		}
	}
	return nil
}

func (r *descResolver) FindDescriptorByName(n protoreflect.FullName) (protoreflect.Descriptor, error) {
	for _, fd := range r.files {
		d := fd.FindSymbol(string(n))
		if d != nil {
			return d.(DescriptorWrapper).Unwrap(), nil
		}
	}
	return nil, protoregistry.NotFound
}

func createFileDescriptor(fd *descriptorpb.FileDescriptorProto, deps []*FileDescriptor, r *ImportResolver) (*FileDescriptor, error) {
	dr := &descResolver{files: deps, importResolver: r, fromPath: fd.GetName()}
	d, err := protodesc.NewFile(fd, dr)
	if err != nil {
		return nil, err
	}

	// make sure cache has dependencies populated
	cache := mapCache{}
	for _, dep := range deps {
		fd, err := dr.FindFileByPath(dep.GetName())
		if err != nil {
			return nil, err
		}
		cache.put(fd, dep)
	}

	return convertFile(d, fd, cache)
}

func convertFile(d protoreflect.FileDescriptor, fd *descriptorpb.FileDescriptorProto, cache descriptorCache) (*FileDescriptor, error) {
	ret := &FileDescriptor{
		wrapped:    d,
		proto:      fd,
		symbols:    map[string]Descriptor{},
		fieldIndex: map[string]map[int32]*FieldDescriptor{},
	}
	cache.put(d, ret)

	// populate references to file descriptor dependencies
	ret.deps = make([]*FileDescriptor, len(fd.GetDependency()))
	for i := 0; i < d.Imports().Len(); i++ {
		f := d.Imports().Get(i).FileDescriptor
		if c, err := wrapFile(f, cache); err != nil {
			return nil, err
		} else {
			ret.deps[i] = c
		}
	}
	ret.publicDeps = make([]*FileDescriptor, len(fd.GetPublicDependency()))
	for i, pd := range fd.GetPublicDependency() {
		ret.publicDeps[i] = ret.deps[pd]
	}
	ret.weakDeps = make([]*FileDescriptor, len(fd.GetWeakDependency()))
	for i, wd := range fd.GetWeakDependency() {
		ret.weakDeps[i] = ret.deps[wd]
	}

	// populate all tables of child descriptors
	path := make([]int32, 1, 8)
	path[0] = internal.File_messagesTag
	for i := 0; i < d.Messages().Len(); i++ {
		src := d.Messages().Get(i)
		srcProto := fd.GetMessageType()[src.Index()]
		md := createMessageDescriptor(ret, ret, src, srcProto, ret.symbols, cache, append(path, int32(i)))
		ret.symbols[string(src.FullName())] = md
		ret.messages = append(ret.messages, md)
	}
	path[0] = internal.File_enumsTag
	for i := 0; i < d.Enums().Len(); i++ {
		src := d.Enums().Get(i)
		srcProto := fd.GetEnumType()[src.Index()]
		ed := createEnumDescriptor(ret, ret, src, srcProto, ret.symbols, cache, append(path, int32(i)))
		ret.symbols[string(src.FullName())] = ed
		ret.enums = append(ret.enums, ed)
	}
	path[0] = internal.File_extensionsTag
	for i := 0; i < d.Extensions().Len(); i++ {
		src := d.Extensions().Get(i)
		srcProto := fd.GetExtension()[src.Index()]
		exd := createFieldDescriptor(ret, ret, src, srcProto, cache, append(path, int32(i)))
		ret.symbols[string(src.FullName())] = exd
		ret.extensions = append(ret.extensions, exd)
	}
	path[0] = internal.File_servicesTag
	for i := 0; i < d.Services().Len(); i++ {
		src := d.Services().Get(i)
		srcProto := fd.GetService()[src.Index()]
		sd := createServiceDescriptor(ret, src, srcProto, ret.symbols, append(path, int32(i)))
		ret.symbols[string(src.FullName())] = sd
		ret.services = append(ret.services, sd)
	}

	ret.sourceInfo = internal.CreateSourceInfoMap(fd)
	ret.sourceInfoRecomputeFunc = ret.recomputeSourceInfo

	// now we can resolve all type references and source code info
	for _, md := range ret.messages {
		if err := md.resolve(cache); err != nil {
			return nil, err
		}
	}
	path[0] = internal.File_extensionsTag
	for _, exd := range ret.extensions {
		if err := exd.resolve(cache); err != nil {
			return nil, err
		}
	}
	path[0] = internal.File_servicesTag
	for _, sd := range ret.services {
		if err := sd.resolve(cache); err != nil {
			return nil, err
		}
	}

	return ret, nil
}

// CreateFileDescriptors constructs a set of descriptors, one for each of the
// given descriptor protos. The given set of descriptor protos must include all
// transitive dependencies for every file.
func CreateFileDescriptors(fds []*descriptorpb.FileDescriptorProto) (map[string]*FileDescriptor, error) {
	return createFileDescriptors(fds, nil)
}

func createFileDescriptors(fds []*descriptorpb.FileDescriptorProto, r *ImportResolver) (map[string]*FileDescriptor, error) {
	if len(fds) == 0 {
		return nil, nil
	}
	files := map[string]*descriptorpb.FileDescriptorProto{}
	resolved := map[string]*FileDescriptor{}
	var name string
	for _, fd := range fds {
		name = fd.GetName()
		files[name] = fd
	}
	for _, fd := range fds {
		_, err := createFromSet(fd.GetName(), r, nil, files, resolved)
		if err != nil {
			return nil, err
		}
	}
	return resolved, nil
}

// ToFileDescriptorSet creates a FileDescriptorSet proto that contains all of the given
// file descriptors and their transitive dependencies. The files are topologically sorted
// so that a file will always appear after its dependencies.
func ToFileDescriptorSet(fds ...*FileDescriptor) *descriptorpb.FileDescriptorSet {
	var fdps []*descriptorpb.FileDescriptorProto
	addAllFiles(fds, &fdps, map[string]struct{}{})
	return &descriptorpb.FileDescriptorSet{File: fdps}
}

func addAllFiles(src []*FileDescriptor, results *[]*descriptorpb.FileDescriptorProto, seen map[string]struct{}) {
	for _, fd := range src {
		if _, ok := seen[fd.GetName()]; ok {
			continue
		}
		seen[fd.GetName()] = struct{}{}
		addAllFiles(fd.GetDependencies(), results, seen)
		*results = append(*results, fd.AsFileDescriptorProto())
	}
}

// CreateFileDescriptorFromSet creates a descriptor from the given file descriptor set. The
// set's *last* file will be the returned descriptor. The set's remaining files must comprise
// the full set of transitive dependencies of that last file. This is the same format and
// order used by protoc when emitting a FileDescriptorSet file with an invocation like so:
//
//	protoc --descriptor_set_out=./test.protoset --include_imports -I. test.proto
func CreateFileDescriptorFromSet(fds *descriptorpb.FileDescriptorSet) (*FileDescriptor, error) {
	return createFileDescriptorFromSet(fds, nil)
}

func createFileDescriptorFromSet(fds *descriptorpb.FileDescriptorSet, r *ImportResolver) (*FileDescriptor, error) {
	result, err := createFileDescriptorsFromSet(fds, r)
	if err != nil {
		return nil, err
	}
	files := fds.GetFile()
	lastFilename := files[len(files)-1].GetName()
	return result[lastFilename], nil
}

// CreateFileDescriptorsFromSet creates file descriptors from the given file descriptor set.
// The returned map includes all files in the set, keyed b name. The set must include the
// full set of transitive dependencies for all files therein or else a link error will occur
// and be returned instead of the slice of descriptors. This is the same format used by
// protoc when a FileDescriptorSet file with an invocation like so:
//
//	protoc --descriptor_set_out=./test.protoset --include_imports -I. test.proto
func CreateFileDescriptorsFromSet(fds *descriptorpb.FileDescriptorSet) (map[string]*FileDescriptor, error) {
	return createFileDescriptorsFromSet(fds, nil)
}

func createFileDescriptorsFromSet(fds *descriptorpb.FileDescriptorSet, r *ImportResolver) (map[string]*FileDescriptor, error) {
	files := fds.GetFile()
	if len(files) == 0 {
		return nil, errors.New("file descriptor set is empty")
	}
	return createFileDescriptors(files, r)
}

// createFromSet creates a descriptor for the given filename. It recursively
// creates descriptors for the given file's dependencies.
func createFromSet(filename string, r *ImportResolver, seen []string, files map[string]*descriptorpb.FileDescriptorProto, resolved map[string]*FileDescriptor) (*FileDescriptor, error) {
	for _, s := range seen {
		if filename == s {
			return nil, fmt.Errorf("cycle in imports: %s", strings.Join(append(seen, filename), " -> "))
		}
	}
	seen = append(seen, filename)

	if d, ok := resolved[filename]; ok {
		return d, nil
	}
	fdp := files[filename]
	if fdp == nil {
		return nil, intn.ErrNoSuchFile(filename)
	}
	deps := make([]*FileDescriptor, len(fdp.GetDependency()))
	for i, depName := range fdp.GetDependency() {
		resolvedDep := r.ResolveImport(filename, depName)
		dep, err := createFromSet(resolvedDep, r, seen, files, resolved)
		if _, ok := err.(intn.ErrNoSuchFile); ok && resolvedDep != depName {
			dep, err = createFromSet(depName, r, seen, files, resolved)
		}
		if err != nil {
			return nil, err
		}
		deps[i] = dep
	}
	d, err := createFileDescriptor(fdp, deps, r)
	if err != nil {
		return nil, err
	}
	resolved[filename] = d
	return d, nil
}
