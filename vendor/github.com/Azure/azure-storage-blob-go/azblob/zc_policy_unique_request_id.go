package azblob

import (
	"context"
	"errors"

	"github.com/Azure/azure-pipeline-go/pipeline"
)

// NewUniqueRequestIDPolicyFactory creates a UniqueRequestIDPolicyFactory object
// that sets the request's x-ms-client-request-id header if it doesn't already exist.
func NewUniqueRequestIDPolicyFactory() pipeline.Factory {
	return pipeline.FactoryFunc(func(next pipeline.Policy, po *pipeline.PolicyOptions) pipeline.PolicyFunc {
		// This is Policy's Do method:
		return func(ctx context.Context, request pipeline.Request) (pipeline.Response, error) {
			id := request.Header.Get(xMsClientRequestID)
			if id == "" { // Add a unique request ID if the caller didn't specify one already
				id = newUUID().String()
				request.Header.Set(xMsClientRequestID, id)
			}

			resp, err := next.Do(ctx, request)

			if err == nil && resp != nil {
				crId := resp.Response().Header.Get(xMsClientRequestID)
				if crId != "" && crId != id {
					err = errors.New("client Request ID from request and response does not match")
				}
			}

			return resp, err
		}
	})
}

const xMsClientRequestID = "x-ms-client-request-id"
