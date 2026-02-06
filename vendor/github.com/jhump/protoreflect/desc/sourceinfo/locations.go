package sourceinfo

import (
	"math"
	"sync"

	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"

	"github.com/jhump/protoreflect/desc/internal"
)

// NB: forked from google.golang.org/protobuf/internal/filedesc
type sourceLocations struct {
	protoreflect.SourceLocations

	orig []*descriptorpb.SourceCodeInfo_Location
	// locs is a list of sourceLocations.
	// The SourceLocation.Next field does not need to be populated
	// as it will be lazily populated upon first need.
	locs []protoreflect.SourceLocation

	// fd is the parent file descriptor that these locations are relative to.
	// If non-nil, ByDescriptor verifies that the provided descriptor
	// is a child of this file descriptor.
	fd protoreflect.FileDescriptor

	once   sync.Once
	byPath map[pathKey]int
}

func (p *sourceLocations) Len() int { return len(p.orig) }
func (p *sourceLocations) Get(i int) protoreflect.SourceLocation {
	return p.lazyInit().locs[i]
}
func (p *sourceLocations) byKey(k pathKey) protoreflect.SourceLocation {
	if i, ok := p.lazyInit().byPath[k]; ok {
		return p.locs[i]
	}
	return protoreflect.SourceLocation{}
}
func (p *sourceLocations) ByPath(path protoreflect.SourcePath) protoreflect.SourceLocation {
	return p.byKey(newPathKey(path))
}
func (p *sourceLocations) ByDescriptor(desc protoreflect.Descriptor) protoreflect.SourceLocation {
	if p.fd != nil && desc != nil && p.fd != desc.ParentFile() {
		return protoreflect.SourceLocation{} // mismatching parent imports
	}
	var pathArr [16]int32
	path := pathArr[:0]
	for {
		switch desc.(type) {
		case protoreflect.FileDescriptor:
			// Reverse the path since it was constructed in reverse.
			for i, j := 0, len(path)-1; i < j; i, j = i+1, j-1 {
				path[i], path[j] = path[j], path[i]
			}
			return p.byKey(newPathKey(path))
		case protoreflect.MessageDescriptor:
			path = append(path, int32(desc.Index()))
			desc = desc.Parent()
			switch desc.(type) {
			case protoreflect.FileDescriptor:
				path = append(path, int32(internal.File_messagesTag))
			case protoreflect.MessageDescriptor:
				path = append(path, int32(internal.Message_nestedMessagesTag))
			default:
				return protoreflect.SourceLocation{}
			}
		case protoreflect.FieldDescriptor:
			isExtension := desc.(protoreflect.FieldDescriptor).IsExtension()
			path = append(path, int32(desc.Index()))
			desc = desc.Parent()
			if isExtension {
				switch desc.(type) {
				case protoreflect.FileDescriptor:
					path = append(path, int32(internal.File_extensionsTag))
				case protoreflect.MessageDescriptor:
					path = append(path, int32(internal.Message_extensionsTag))
				default:
					return protoreflect.SourceLocation{}
				}
			} else {
				switch desc.(type) {
				case protoreflect.MessageDescriptor:
					path = append(path, int32(internal.Message_fieldsTag))
				default:
					return protoreflect.SourceLocation{}
				}
			}
		case protoreflect.OneofDescriptor:
			path = append(path, int32(desc.Index()))
			desc = desc.Parent()
			switch desc.(type) {
			case protoreflect.MessageDescriptor:
				path = append(path, int32(internal.Message_oneOfsTag))
			default:
				return protoreflect.SourceLocation{}
			}
		case protoreflect.EnumDescriptor:
			path = append(path, int32(desc.Index()))
			desc = desc.Parent()
			switch desc.(type) {
			case protoreflect.FileDescriptor:
				path = append(path, int32(internal.File_enumsTag))
			case protoreflect.MessageDescriptor:
				path = append(path, int32(internal.Message_enumsTag))
			default:
				return protoreflect.SourceLocation{}
			}
		case protoreflect.EnumValueDescriptor:
			path = append(path, int32(desc.Index()))
			desc = desc.Parent()
			switch desc.(type) {
			case protoreflect.EnumDescriptor:
				path = append(path, int32(internal.Enum_valuesTag))
			default:
				return protoreflect.SourceLocation{}
			}
		case protoreflect.ServiceDescriptor:
			path = append(path, int32(desc.Index()))
			desc = desc.Parent()
			switch desc.(type) {
			case protoreflect.FileDescriptor:
				path = append(path, int32(internal.File_servicesTag))
			default:
				return protoreflect.SourceLocation{}
			}
		case protoreflect.MethodDescriptor:
			path = append(path, int32(desc.Index()))
			desc = desc.Parent()
			switch desc.(type) {
			case protoreflect.ServiceDescriptor:
				path = append(path, int32(internal.Service_methodsTag))
			default:
				return protoreflect.SourceLocation{}
			}
		default:
			return protoreflect.SourceLocation{}
		}
	}
}
func (p *sourceLocations) lazyInit() *sourceLocations {
	p.once.Do(func() {
		if len(p.orig) > 0 {
			p.locs = make([]protoreflect.SourceLocation, len(p.orig))
			// Collect all the indexes for a given path.
			pathIdxs := make(map[pathKey][]int, len(p.locs))
			for i := range p.orig {
				l := asSourceLocation(p.orig[i])
				p.locs[i] = l
				k := newPathKey(l.Path)
				pathIdxs[k] = append(pathIdxs[k], i)
			}

			// Update the next index for all locations.
			p.byPath = make(map[pathKey]int, len(p.locs))
			for k, idxs := range pathIdxs {
				for i := 0; i < len(idxs)-1; i++ {
					p.locs[idxs[i]].Next = idxs[i+1]
				}
				p.locs[idxs[len(idxs)-1]].Next = 0
				p.byPath[k] = idxs[0] // record the first location for this path
			}
		}
	})
	return p
}

func asSourceLocation(l *descriptorpb.SourceCodeInfo_Location) protoreflect.SourceLocation {
	endLine := l.Span[0]
	endCol := l.Span[2]
	if len(l.Span) > 3 {
		endLine = l.Span[2]
		endCol = l.Span[3]
	}
	return protoreflect.SourceLocation{
		Path:                    l.Path,
		StartLine:               int(l.Span[0]),
		StartColumn:             int(l.Span[1]),
		EndLine:                 int(endLine),
		EndColumn:               int(endCol),
		LeadingDetachedComments: l.LeadingDetachedComments,
		LeadingComments:         l.GetLeadingComments(),
		TrailingComments:        l.GetTrailingComments(),
	}
}

// pathKey is a comparable representation of protoreflect.SourcePath.
type pathKey struct {
	arr [16]uint8 // first n-1 path segments; last element is the length
	str string    // used if the path does not fit in arr
}

func newPathKey(p protoreflect.SourcePath) (k pathKey) {
	if len(p) < len(k.arr) {
		for i, ps := range p {
			if ps < 0 || math.MaxUint8 <= ps {
				return pathKey{str: p.String()}
			}
			k.arr[i] = uint8(ps)
		}
		k.arr[len(k.arr)-1] = uint8(len(p))
		return k
	}
	return pathKey{str: p.String()}
}
