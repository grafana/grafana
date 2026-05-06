package s3shared

import (
	"context"
	"fmt"
	"strings"

	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"

	awsmiddle "github.com/aws/aws-sdk-go-v2/aws/middleware"
)

// EnableDualstack represents middleware struct for enabling dualstack support
//
// Deprecated:  See EndpointResolverOptions' UseDualStackEndpoint support
type EnableDualstack struct {
	// UseDualstack indicates if dualstack endpoint resolving is to be enabled
	UseDualstack bool

	// DefaultServiceID is the service id prefix used in endpoint resolving
	// by default service-id is 's3' and 's3-control' for service s3, s3control.
	DefaultServiceID string
}

// ID returns the middleware ID.
func (*EnableDualstack) ID() string {
	return "EnableDualstack"
}

// HandleSerialize handles serializer middleware behavior when middleware is executed
func (u *EnableDualstack) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {

	// check for host name immutable property
	if smithyhttp.GetHostnameImmutable(ctx) {
		return next.HandleSerialize(ctx, in)
	}

	serviceID := awsmiddle.GetServiceID(ctx)

	// s3-control may be represented as `S3 Control` as in model
	if serviceID == "S3 Control" {
		serviceID = "s3-control"
	}

	if len(serviceID) == 0 {
		// default service id
		serviceID = u.DefaultServiceID
	}

	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown request type %T", req)
	}

	if u.UseDualstack {
		parts := strings.Split(req.URL.Host, ".")
		if len(parts) < 3 {
			return out, metadata, fmt.Errorf("unable to update endpoint host for dualstack, hostname invalid, %s", req.URL.Host)
		}

		for i := 0; i+1 < len(parts); i++ {
			if strings.EqualFold(parts[i], serviceID) {
				parts[i] = parts[i] + ".dualstack"
				break
			}
		}

		// construct the url host
		req.URL.Host = strings.Join(parts, ".")
	}

	return next.HandleSerialize(ctx, in)
}
