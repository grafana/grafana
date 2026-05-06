package internal

import (
	"context"
	"fmt"
	"reflect"

	//lint:ignore SA1019 we use the old v1 package because
	//  we need to support older generated messages
	"github.com/golang/protobuf/proto"
	"github.com/jhump/protoreflect/dynamic"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// CopyMessage copies data from the given in value to the given out value. It returns an
// error if the two values do not have the same type or if the given out value is not
// settable.
func CopyMessage(out, in interface{}) error {
	pmIn, ok := in.(proto.Message)
	if !ok {
		return fmt.Errorf("value to copy is not a proto.Message: %T; use a custom cloner", in)
	}
	pmOut, ok := out.(proto.Message)
	if !ok {
		return fmt.Errorf("destination for copy is not a proto.Message: %T; use a custom cloner", in)
	}

	pmOut.Reset()
	// This will check that types are compatible and return an error if not.
	// Unlike proto.Merge, this allows one or the other to be a dynamic message.
	return dynamic.TryMerge(pmOut, pmIn)
}

// CloneMessage returns a copy of the given value.
func CloneMessage(m interface{}) (interface{}, error) {
	pm, ok := m.(proto.Message)
	if !ok {
		return nil, fmt.Errorf("value to clone is not a proto.Message: %T; use a custom cloner", m)
	}

	// this does a proper deep copy
	return proto.Clone(pm), nil
}

// ClearMessage resets the given value to its zero-value state. It returns an error
// if the given out value is not settable.
func ClearMessage(m interface{}) error {
	dest := reflect.Indirect(reflect.ValueOf(m))
	if !dest.CanSet() {
		return fmt.Errorf("unable to set destination: %v", reflect.ValueOf(m).Type())
	}
	dest.Set(reflect.Zero(dest.Type()))
	return nil
}

// TranslateContextError converts the given error to a gRPC status error if it
// is a context error. If it is context.DeadlineExceeded, it is converted to an
// error with a status code of DeadlineExceeded. If it is context.Canceled, it
// is converted to an error with a status code of Canceled. If it is not a
// context error, it is returned without any conversion.
func TranslateContextError(err error) error {
	switch err {
	case context.DeadlineExceeded:
		return status.Errorf(codes.DeadlineExceeded, err.Error())
	case context.Canceled:
		return status.Errorf(codes.Canceled, err.Error())
	}
	return err
}

// FindUnaryMethod returns the method descriptor for the named method. If the
// method is not found in the given slice of descriptors, nil is returned.
func FindUnaryMethod(methodName string, methods []grpc.MethodDesc) *grpc.MethodDesc {
	for i := range methods {
		if methods[i].MethodName == methodName {
			return &methods[i]
		}
	}
	return nil
}

// FindStreamingMethod returns the stream descriptor for the named method. If
// the method is not found in the given slice of descriptors, nil is returned.
func FindStreamingMethod(methodName string, methods []grpc.StreamDesc) *grpc.StreamDesc {
	for i := range methods {
		if methods[i].StreamName == methodName {
			return &methods[i]
		}
	}
	return nil
}
