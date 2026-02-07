// Copyright 2014 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*
Package cloud is the root of the packages used to access Google Cloud
Services. See https://pkg.go.dev/cloud.google.com/go#section-directories for a
full list of sub-modules.

# Client Options

All clients in sub-packages are configurable via client options. These options
are described here: https://pkg.go.dev/google.golang.org/api/option.

# Endpoint Override

Endpoint configuration is used to specify the URL to which requests are
sent. It is used for services that support or require regional endpoints, as
well as for other use cases such as [testing against fake servers].

For example, the Vertex AI service recommends that you configure the endpoint to
the location with the features you want that is closest to your physical
location or the location of your users. There is no global endpoint for Vertex
AI. See [Vertex AI - Locations] for more details. The following example
demonstrates configuring a Vertex AI client with a regional endpoint:

	ctx := context.Background()
	endpoint := "us-central1-aiplatform.googleapis.com:443"
	client, err := aiplatform.NewDatasetClient(ctx, option.WithEndpoint(endpoint))

# Authentication and Authorization

All of the clients support authentication via [Google Application Default Credentials],
or by providing a JSON key file for a Service Account. See examples below.

Google Application Default Credentials (ADC) is the recommended way to authorize
and authenticate clients. For information on how to create and obtain
Application Default Credentials, see
https://cloud.google.com/docs/authentication/production. If you have your
environment configured correctly you will not need to pass any extra information
to the client libraries. Here is an example of a client using ADC to
authenticate:

	client, err := secretmanager.NewClient(context.Background())
	if err != nil {
		// TODO: handle error.
	}
	_ = client // Use the client.

You can use a file with credentials to authenticate and authorize, such as a
JSON key file associated with a Google service account. Service Account keys can
be created and downloaded from https://console.cloud.google.com/iam-admin/serviceaccounts.
This example uses the Secret Manger client, but the same steps apply to the
all other client libraries this package as well. Example:

	client, err := secretmanager.NewClient(context.Background(),
		option.WithCredentialsFile("/path/to/service-account-key.json"))
	if err != nil {
		// TODO: handle error.
	}
	_ = client // Use the client.

In some cases (for instance, you don't want to store secrets on disk), you can
create credentials from in-memory JSON and use the WithCredentials option.
This example uses the Secret Manager client, but the same steps apply to
all other client libraries as well. Note that scopes can be
found at https://developers.google.com/identity/protocols/oauth2/scopes, and
are also provided in all auto-generated libraries: for example,
cloud.google.com/go/secretmanager/apiv1 provides DefaultAuthScopes. Example:

	ctx := context.Background()
	// https://pkg.go.dev/cloud.google.com/go/auth/credentials
	creds, err := credentials.DetectDefault(&credentials.DetectOptions{
		Scopes:          secretmanager.DefaultAuthScopes(),
		CredentialsJSON: []byte("JSON creds")
	}), secretmanager.DefaultAuthScopes()...)
	if err != nil {
		// TODO: handle error.
	}
	client, err := secretmanager.NewClient(ctx, option.WithAuthCredentials(creds))
	if err != nil {
		// TODO: handle error.
	}
	_ = client // Use the client.

# Timeouts and Cancellation

By default, non-streaming methods, like Create or Get, will have a default
deadline applied to the context provided at call time, unless a context deadline
is already set. Streaming methods have no default deadline and will run
indefinitely. To set timeouts or arrange for cancellation, use
[context]. Transient errors will be retried when correctness allows.

Here is an example of setting a timeout for an RPC using
[context.WithTimeout]:

	ctx := context.Background()
	// Do not set a timeout on the context passed to NewClient: dialing happens
	// asynchronously, and the context is used to refresh credentials in the
	// background.
	client, err := secretmanager.NewClient(ctx)
	if err != nil {
		// TODO: handle error.
	}
	// Time out if it takes more than 10 seconds to create a dataset.
	tctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel() // Always call cancel.

	req := &secretmanagerpb.DeleteSecretRequest{Name: "projects/project-id/secrets/name"}
	if err := client.DeleteSecret(tctx, req); err != nil {
		// TODO: handle error.
	}

Here is an example of setting a timeout for an RPC using
[github.com/googleapis/gax-go/v2.WithTimeout]:

	ctx := context.Background()
	// Do not set a timeout on the context passed to NewClient: dialing happens
	// asynchronously, and the context is used to refresh credentials in the
	// background.
	client, err := secretmanager.NewClient(ctx)
	if err != nil {
		// TODO: handle error.
	}

	req := &secretmanagerpb.DeleteSecretRequest{Name: "projects/project-id/secrets/name"}
	// Time out if it takes more than 10 seconds to create a dataset.
	if err := client.DeleteSecret(tctx, req, gax.WithTimeout(10*time.Second)); err != nil {
		// TODO: handle error.
	}

Here is an example of how to arrange for an RPC to be canceled, use
[context.WithCancel]:

	ctx := context.Background()
	// Do not cancel the context passed to NewClient: dialing happens asynchronously,
	// and the context is used to refresh credentials in the background.
	client, err := secretmanager.NewClient(ctx)
	if err != nil {
		// TODO: handle error.
	}
	cctx, cancel := context.WithCancel(ctx)
	defer cancel() // Always call cancel.

	// TODO: Make the cancel function available to whatever might want to cancel the
	// call--perhaps a GUI button.
	req := &secretmanagerpb.DeleteSecretRequest{Name: "projects/proj/secrets/name"}
	if err := client.DeleteSecret(cctx, req); err != nil {
		// TODO: handle error.
	}

Do not attempt to control the initial connection (dialing) of a service by
setting a timeout on the context passed to NewClient. Dialing is non-blocking,
so timeouts would be ineffective and would only interfere with credential
refreshing, which uses the same context.

# Headers

Regardless of which transport is used, request headers can be set in the same
way using [`callctx.SetHeaders`][setheaders].

Here is a generic example:

	// Set the header "key" to "value".
	ctx := callctx.SetHeaders(context.Background(), "key", "value")

	// Then use ctx in a subsequent request.
	response, err := client.GetSecret(ctx, request)

# Google-reserved headers

There are a some header keys that Google reserves for internal use that must
not be ovewritten. The following header keys are broadly considered reserved
and should not be conveyed by client library users unless instructed to do so:

* `x-goog-api-client`
* `x-goog-request-params`

Be sure to check the individual package documentation for other service-specific
reserved headers. For example, Storage supports a specific auditing header that
is mentioned in that [module's documentation][storagedocs].

# Google Cloud system parameters

Google Cloud services respect [system parameters][system parameters] that can be
used to augment request and/or response behavior. For the most part, they are
not needed when using one of the enclosed client libraries. However, those that
may be necessary are made available via the [`callctx`][callctx] package. If not
present there, consider opening an issue on that repo to request a new constant.

# Connection Pooling

Connection pooling differs in clients based on their transport. Cloud
clients either rely on HTTP or gRPC transports to communicate
with Google Cloud.

Cloud clients that use HTTP rely on the underlying HTTP transport to cache
connections for later re-use. These are cached to the http.MaxIdleConns
and http.MaxIdleConnsPerHost settings in http.DefaultTransport by default.

For gRPC clients, connection pooling is configurable. Users of Cloud Client
Libraries may specify [google.golang.org/api/option.WithGRPCConnectionPool]
as a client option to NewClient calls. This configures the underlying gRPC
connections to be pooled and accessed in a round robin fashion.

# Using the Libraries in Container environments(Docker)

Minimal container images like Alpine lack CA certificates. This causes RPCs to
appear to hang, because gRPC retries indefinitely. See
https://github.com/googleapis/google-cloud-go/issues/928 for more information.

# Debugging

For tips on how to write tests against code that calls into our libraries check
out our [Debugging Guide].

# Testing

For tips on how to write tests against code that calls into our libraries check
out our [Testing Guide].

# Inspecting errors

Most of the errors returned by the generated clients are wrapped in an
[github.com/googleapis/gax-go/v2/apierror.APIError] and can be further unwrapped
into a [google.golang.org/grpc/status.Status] or
[google.golang.org/api/googleapi.Error] depending on the transport used to make
the call (gRPC or REST). Converting your errors to these types can be a useful
way to get more information about what went wrong while debugging.

APIError gives access to specific details in the error. The transport-specific
errors can still be unwrapped using the APIError.

	if err != nil {
	   var ae *apierror.APIError
	   if errors.As(err, &ae) {
	      log.Println(ae.Reason())
	      log.Println(ae.Details().Help.GetLinks())
	   }
	   // If a gRPC transport was used you can extract the
	   // google.golang.org/grpc/status.Status from the error
	   s := ae.GRPCStatus()
	   log.Println(s.Code())
	   }

# Client Stability

Semver is used to communicate stability of the sub-modules of this package.
Note, some stable sub-modules do contain packages, and sometimes features, that
are considered unstable. If something is unstable it will be explicitly labeled
as such. Example of package does in an unstable package:

	NOTE: This package is in beta. It is not stable, and may be subject to changes.

Clients that contain alpha and beta in their import path may change or go away
without notice.

Clients marked stable will maintain compatibility with future versions for as
long as we can reasonably sustain. Incompatible changes might be made in some
situations, including:

  - Security bugs may prompt backwards-incompatible changes.
  - Situations in which components are no longer feasible to maintain without
    making breaking changes, including removal.
  - Parts of the client surface may be outright unstable and subject to change.
    These parts of the surface will be labeled with the note, "It is EXPERIMENTAL
    and subject to change or removal without notice."

[testing against fake servers]: https://github.com/googleapis/google-cloud-go/blob/main/testing.md#testing-grpc-services-using-fakes
[Vertex AI - Locations]: https://cloud.google.com/vertex-ai/docs/general/locations
[Google Application Default Credentials]: https://cloud.google.com/docs/authentication/external/set-up-adc
[Testing Guide]: https://github.com/googleapis/google-cloud-go/blob/main/testing.md
[Debugging Guide]: https://github.com/googleapis/google-cloud-go/blob/main/debug.md
[callctx]: https://pkg.go.dev/github.com/googleapis/gax-go/v2/callctx#pkg-constants
[setheaders]: https://pkg.go.dev/github.com/googleapis/gax-go/v2/callctx#SetHeaders
[storagedocs]: https://pkg.go.dev/cloud.google.com/go/storage#hdr-Sending_Custom_Headers
[system parameters]: https://cloud.google.com/apis/docs/system-parameters
*/
package cloud // import "cloud.google.com/go"
