# Google Auth Library for Go

[![Go Reference](https://pkg.go.dev/badge/cloud.google.com/go/auth.svg)](https://pkg.go.dev/cloud.google.com/go/auth)

## Install

``` bash
go get cloud.google.com/go/auth@latest
```

## Usage

The most common way this library is used is transitively, by default, from any
of our Go client libraries.

### Notable use-cases

- To create a credential directly please see examples in the
  [credentials](https://pkg.go.dev/cloud.google.com/go/auth/credentials)
  package.
- To create a authenticated HTTP client please see examples in the
  [httptransport](https://pkg.go.dev/cloud.google.com/go/auth/httptransport)
  package.
- To create a authenticated gRPC connection please see examples in the
  [grpctransport](https://pkg.go.dev/cloud.google.com/go/auth/grpctransport)
  package.
- To create an ID token please see examples in the
  [idtoken](https://pkg.go.dev/cloud.google.com/go/auth/credentials/idtoken)
  package.

## Contributing

Contributions are welcome. Please, see the
[CONTRIBUTING](https://github.com/GoogleCloudPlatform/google-cloud-go/blob/main/CONTRIBUTING.md)
document for details.

Please note that this project is released with a Contributor Code of Conduct.
By participating in this project you agree to abide by its terms.
See [Contributor Code of Conduct](https://github.com/GoogleCloudPlatform/google-cloud-go/blob/main/CONTRIBUTING.md#contributor-code-of-conduct)
for more information.
