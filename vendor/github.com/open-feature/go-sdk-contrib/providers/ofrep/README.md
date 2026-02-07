# OpenFeature Remote Evaluation Protocol Provider

This is the Go implementation of the OFREP provider.
The provider works by evaluating flags against OFREP single flag evaluation endpoint.

## Installation

Use OFREP provider with the latest OpenFeature Go SDK

```sh
go get github.com/open-feature/go-sdk-contrib/providers/ofrep
go get github.com/open-feature/go-sdk
```

## Usage

Initialize the provider with the URL of the OFREP implementing service,

```go
ofrepProvider := ofrep.NewProvider("http://localhost:8016")
```

Then, register the provider with the OpenFeature Go SDK and use derived clients for flag evaluations,

```go
openfeature.SetProvider(ofrepProvider)
```

## Configuration

You can configure the provider using following configuration options,

| Configuration option | Details                                                                                                                 |
|----------------------|-------------------------------------------------------------------------------------------------------------------------|
| WithApiKeyAuth       | Set the token to be used with "X-API-Key" header                                                                        |
| WithBearerToken      | Set the token to be used with "Bearer" HTTP Authorization schema                                                        |
| WithClient           | Provider a custom, pre-configured http.Client for OFREP service communication                                           |
| WithHeaderProvider   | Register a custom header provider for OFREP calls. You may utilize this for custom authentication/authorization headers |


For example, consider below example which set bearer token and provider a customized http client,

```go
provider := ofrep.NewProvider(
    "http://localhost:8016",
    ofrep.WithBearerToken("TOKEN"),
    ofrep.WithClient(&http.Client{
        Timeout: 1 * time.Second,
    }))
```