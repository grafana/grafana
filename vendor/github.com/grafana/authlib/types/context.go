package types

import (
	"context"
)

// The key type is unexported to prevent collisions
type key int

const (
	// infoKey is the context key for the identity claims
	infoKey key = iota
)

func AuthInfoFrom(ctx context.Context) (AuthInfo, bool) {
	v, ok := ctx.Value(infoKey).(AuthInfo)
	return v, ok
}

func WithAuthInfo(ctx context.Context, auth AuthInfo) context.Context {
	return context.WithValue(ctx, infoKey, auth)
}
