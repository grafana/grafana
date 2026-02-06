package internal

type EndpointCtxKeyType struct{}

// This package has been added to expose the EndpointCtxKey to allow the datasource_metrics_middleware to read it
var EndpointCtxKey = EndpointCtxKeyType{}
