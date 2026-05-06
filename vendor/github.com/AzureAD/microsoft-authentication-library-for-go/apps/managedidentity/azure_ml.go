// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

package managedidentity

import (
	"context"
	"net/http"
	"os"
)

func createAzureMLAuthRequest(ctx context.Context, id ID, resource string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, os.Getenv(msiEndpointEnvVar), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("secret", os.Getenv(msiSecretEnvVar))
	q := req.URL.Query()
	q.Set(apiVersionQueryParameterName, azureMLAPIVersion)
	q.Set(resourceQueryParameterName, resource)
	q.Set("clientid", os.Getenv("DEFAULT_IDENTITY_CLIENT_ID"))
	if cid, ok := id.(UserAssignedClientID); ok {
		q.Set("clientid", string(cid))
	}
	req.URL.RawQuery = q.Encode()
	return req, nil
}
