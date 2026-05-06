# kuberesolver

A Grpc name resolver by using kubernetes API.
It comes with a small ~250 LOC kubernetes client to find service endpoints. Therefore it won't bloat your binaries.


### USAGE

```go

// Import the module
import "github.com/sercand/kuberesolver/v6"
	
// Register kuberesolver to grpc before calling grpc.Dial
kuberesolver.RegisterInCluster()

// it is same as
resolver.Register(kuberesolver.NewBuilder(nil /*custom kubernetes client*/ , "kubernetes"))

// if schema is 'kubernetes' then grpc will use kuberesolver to resolve addresses
cc, err := grpc.Dial("kubernetes:///service.namespace:portname", opts...)
```

An url can be one of the following, [grpc naming docs](https://github.com/grpc/grpc/blob/master/doc/naming.md)

```
kubernetes:///service-name:8080
kubernetes:///service-name:portname
kubernetes:///service-name.namespace:8080
kubernetes:///service-name.namespace.svc.cluster_name
kubernetes:///service-name.namespace.svc.cluster_name:8080

kubernetes://namespace/service-name:8080
kubernetes://service-name:8080/
kubernetes://service-name.namespace:8080/
kubernetes://service-name.namespace.svc.cluster_name
kubernetes://service-name.namespace.svc.cluster_name:8080
```
_* Please note that the cluster_name is not used in resolving the endpoints of a Service. It is only there to support fully qualified service names, e.g._ `test.default.svc.cluster.local`.

### Using alternative Schema

Use `RegisterInClusterWithSchema(schema)` instead of `RegisterInCluster` on start.

### Client Side Load Balancing

You need to pass grpc.WithBalancerName option to grpc on dial: 

```go
grpc.DialContext(ctx,  "kubernetes:///service:grpc", grpc.WithBalancerName("round_robin"), grpc.WithInsecure())
```
This will create subconnections for each available service endpoints.

### How is this different from dialing to `service.namespace:8080`

Connecting to a service by dialing to `service.namespace:8080` uses DNS and it returns service stable IP. Therefore, gRPC doesn't know the endpoint IP addresses and it fails to reconnect to target services in case of failure.  

Kuberesolver uses kubernetes API to get and watch service endpoint IP addresses. 
Since it provides and updates all available service endpoints, together with a client-side balancer you can achive zero downtime deployments.

### RBAC

You need give `GET` and `WATCH` access to the `endpointslices` if you are using RBAC in your cluster.


### Using With TLS

You need to a certificate with name `service-name.namespace` in order to connect with TLS to your services.
