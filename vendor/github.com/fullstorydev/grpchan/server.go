package grpchan

import (
	"fmt"
	"reflect"

	"google.golang.org/grpc"
)

// ServiceRegistry accumulates service definitions. Servers typically have this
// interface for accumulating the services they expose.
//
// Deprecated: Use grpc.ServiceRegistrar instead.
type ServiceRegistry = grpc.ServiceRegistrar

// HandlerMap is used to accumulate service handlers into a map. The handlers
// can be registered once in the map, and then re-used to configure multiple
// servers that should expose the same handlers. HandlerMap can also be used
// as the internal store of registered handlers for a server implementation.
type HandlerMap map[string]service

var _ grpc.ServiceRegistrar = HandlerMap(nil)

type service struct {
	desc    *grpc.ServiceDesc
	handler interface{}
}

// RegisterService registers the given handler to be used for the given service.
// Only a single handler can be registered for a given service. And services are
// identified by their fully-qualified name (e.g. "package.name.Service").
func (m HandlerMap) RegisterService(desc *grpc.ServiceDesc, h interface{}) {
	ht := reflect.TypeOf(desc.HandlerType).Elem()
	st := reflect.TypeOf(h)
	if !st.Implements(ht) {
		panic(fmt.Sprintf("service %s: handler of type %v does not satisfy %v", desc.ServiceName, st, ht))
	}
	if _, ok := m[desc.ServiceName]; ok {
		panic(fmt.Sprintf("service %s: handler already registered", desc.ServiceName))
	}
	m[desc.ServiceName] = service{desc: desc, handler: h}
}

// QueryService returns the service descriptor and handler for the named
// service. If no handler has been registered for the named service, then
// nil, nil is returned.
func (m HandlerMap) QueryService(name string) (*grpc.ServiceDesc, interface{}) {
	svc := m[name]
	return svc.desc, svc.handler
}

// GetServiceInfo returns a snapshot of information about the currently
// registered services in the map.
//
// This mirrors the method of the same name on *grpc.Server.
func (m HandlerMap) GetServiceInfo() map[string]grpc.ServiceInfo {
	ret := make(map[string]grpc.ServiceInfo, len(m))
	for _, svc := range m {
		methods := make([]grpc.MethodInfo, 0, len(svc.desc.Methods)+len(svc.desc.Streams))
		for _, mtd := range svc.desc.Methods {
			methods = append(methods, grpc.MethodInfo{Name: mtd.MethodName})
		}
		for _, mtd := range svc.desc.Streams {
			methods = append(methods, grpc.MethodInfo{
				Name:           mtd.StreamName,
				IsClientStream: mtd.ClientStreams,
				IsServerStream: mtd.ServerStreams,
			})
		}
		ret[svc.desc.ServiceName] = grpc.ServiceInfo{
			Methods:  methods,
			Metadata: svc.desc.Metadata,
		}
	}
	return ret
}

// ForEach calls the given function for each registered handler. The function is
// provided the service description, and the handler. This can be used to
// contribute all registered handlers to a server and means that applications
// can easily expose the same services and handlers via multiple channels after
// registering the handlers once, with the map:
//
//    // Register all handlers once with the map:
//    reg := channel.HandlerMap{}
//    // (these registration functions are generated)
//    foo.RegisterHandlerFooBar(newFooBarImpl())
//    fu.RegisterHandlerFuBaz(newFuBazImpl())
//
//    // Now we can re-use these handlers for multiple channels:
//    //   Normal gRPC
//    svr := grpc.NewServer()
//    reg.ForEach(svr.RegisterService)
//    //   In-process
//    ipch := &inprocgrpc.Channel{}
//    reg.ForEach(ipch.RegisterService)
//    //   And HTTP 1.1
//    httpgrpc.HandleServices(http.HandleFunc, "/rpc/", reg, nil, nil)
//
func (m HandlerMap) ForEach(fn func(desc *grpc.ServiceDesc, svr interface{})) {
	for _, svc := range m {
		fn(svc.desc, svc.handler)
	}
}
