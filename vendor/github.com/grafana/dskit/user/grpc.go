// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/user/grpc.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package user

import (
	"context"

	"google.golang.org/grpc/metadata"
)

// ExtractFromGRPCRequest extracts the user ID from the request metadata and returns
// the user ID and a context with the user ID injected.
func ExtractFromGRPCRequest(ctx context.Context) (string, context.Context, error) {
	orgIDs := metadata.ValueFromIncomingContext(ctx, lowerOrgIDHeaderName)
	if len(orgIDs) != 1 {
		return "", ctx, ErrNoOrgID
	}

	return orgIDs[0], InjectOrgID(ctx, orgIDs[0]), nil
}

// InjectIntoGRPCRequest injects the orgID from the context into the request metadata.
func InjectIntoGRPCRequest(ctx context.Context) (context.Context, error) {
	orgID, err := ExtractOrgID(ctx)
	if err != nil {
		return ctx, err
	}

	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		md = metadata.New(map[string]string{})
	}
	newCtx := ctx
	if orgIDs, ok := md[lowerOrgIDHeaderName]; ok {
		if len(orgIDs) == 1 {
			if orgIDs[0] != orgID {
				return ctx, ErrDifferentOrgIDPresent
			}
		} else {
			return ctx, ErrTooManyOrgIDs
		}
	} else {
		md = md.Copy()
		md[lowerOrgIDHeaderName] = []string{orgID}
		newCtx = metadata.NewOutgoingContext(ctx, md)
	}

	return newCtx, nil
}
