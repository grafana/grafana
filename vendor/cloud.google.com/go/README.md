# Google Cloud Client Libraries for Go

[![Go Reference](https://pkg.go.dev/badge/cloud.google.com/go.svg)](https://pkg.go.dev/cloud.google.com/go)

Go packages for [Google Cloud Platform](https://cloud.google.com) services.

## Installation

```bash
go get cloud.google.com/go/firestore@latest # Replace firestore with the package you want to use.
```

**NOTE:** Some of these packages are under development, and may occasionally
make backwards-incompatible changes.

## Supported APIs

For an updated list of all of our released APIs please see our
[reference docs](https://cloud.google.com/go/docs/reference).

## [Go Versions Supported](#supported-versions)

Our libraries are compatible with the two most recent major Go
releases, the same [policy](https://go.dev/doc/devel/release#policy) the Go
programming language follows. This means the currently supported versions are:

- Go 1.23
- Go 1.24

## Authentication

By default, each client library will use [Application Default Credentials](https://developers.google.com/identity/protocols/application-default-credentials)
(ADC) to automatically configure the credentials used in calling the API endpoint.
When using the libraries in a Google Cloud Platform environment such as Compute
Engine, Kubernetes Engine, or App Engine, no additional authentication steps are
necessary. See [Authentication methods at Google](https://cloud.google.com/docs/authentication)
and [Authenticate for using client libraries](https://cloud.google.com/docs/authentication/client-libraries)
for more information.

```go
client, err := storage.NewClient(ctx)
```

For applications running elsewhere, such as your local development environment,
you can use the `gcloud auth application-default login` command from the
[Google Cloud CLI](https://cloud.google.com/cli) to set user credentials in
your local filesystem. Application Default Credentials will automatically detect
these credentials. See [Set up ADC for a local development
environment](https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment)
for more information.

Alternately, you may need to provide an explicit path to your credentials. To authenticate
using a [service account](https://cloud.google.com/docs/authentication#service-accounts)
key file, either set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the path
to your key file, or programmatically pass
[`option.WithCredentialsFile`](https://pkg.go.dev/google.golang.org/api/option#WithCredentialsFile)
to the `NewClient` function of the desired package. For example:

```go
client, err := storage.NewClient(ctx, option.WithCredentialsFile("path/to/keyfile.json"))
```

You can exert even more control over authentication by using the
[credentials](https://pkg.go.dev/cloud.google.com/go/auth/credentials) package to
create an [auth.Credentials](https://pkg.go.dev/cloud.google.com/go/auth#Credentials).
Then pass [`option.WithAuthCredentials`](https://pkg.go.dev/google.golang.org/api/option#WithAuthCredentials)
to the `NewClient` function:

```go
creds, err := credentials.DetectDefault(&credentials.DetectOptions{...})
...
client, err := storage.NewClient(ctx, option.WithAuthCredentials(creds))
```

## Contributing

Contributions are welcome. Please, see the
[CONTRIBUTING](https://github.com/GoogleCloudPlatform/google-cloud-go/blob/main/CONTRIBUTING.md)
document for details.

Please note that this project is released with a Contributor Code of Conduct.
By participating in this project you agree to abide by its terms.
See [Contributor Code of Conduct](https://github.com/GoogleCloudPlatform/google-cloud-go/blob/main/CONTRIBUTING.md#contributor-code-of-conduct)
for more information.

## Links

- [Go on Google Cloud](https://cloud.google.com/go/home)
- [Getting started with Go on Google Cloud](https://cloud.google.com/go/getting-started)
- [App Engine Quickstart](https://cloud.google.com/appengine/docs/standard/go/quickstart)
- [Cloud Functions Quickstart](https://cloud.google.com/functions/docs/quickstart-go)
- [Cloud Run Quickstart](https://cloud.google.com/run/docs/quickstarts/build-and-deploy#go)
