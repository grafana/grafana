package telemetry

import (
	"context"
)

type rpcContextName string

const (
	rpcInfoContextName rpcContextName = "rpcInfo"
)

type RPCInfo struct {
	Method  string
	Service string
}

// ContextWithRPCInfo will save the rpc method and service information in context.
func ContextWithRPCInfo(ctx context.Context, rpcInfo RPCInfo) context.Context {
	return context.WithValue(ctx, rpcInfoContextName, rpcInfo)
}

// RPCInfoFromContext returns method and service stored in context.
func RPCInfoFromContext(ctx context.Context) RPCInfo {
	rpcInfo, ok := ctx.Value(rpcInfoContextName).(RPCInfo)
	if ok {
		return rpcInfo
	}
	return RPCInfo{
		Method:  "unknown",
		Service: "unknown",
	}
}
