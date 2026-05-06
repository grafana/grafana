# Azure Identity Client Module for Go

The Azure Identity module provides Microsoft Entra ID ([formerly Azure Active Directory](https://learn.microsoft.com/entra/fundamentals/new-name)) token authentication support across the Azure SDK. It includes a set of `TokenCredential` implementations, which can be used with Azure SDK clients supporting token authentication.

[![PkgGoDev](https://pkg.go.dev/badge/github.com/Azure/azure-sdk-for-go/sdk/azidentity)](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity)
| [Microsoft Entra ID documentation](https://learn.microsoft.com/entra/identity/)
| [Source code](https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/azidentity)

# Getting started

## Install the module

This project uses [Go modules](https://github.com/golang/go/wiki/Modules) for versioning and dependency management.

Install the Azure Identity module:

```sh
go get -u github.com/Azure/azure-sdk-for-go/sdk/azidentity
```

## Prerequisites

- an [Azure subscription](https://azure.microsoft.com/free/)
- [Supported](https://aka.ms/azsdk/go/supported-versions) version of Go

### Authenticating during local development

When debugging and executing code locally, developers typically use their own accounts to authenticate calls to Azure services. The `azidentity` module supports authenticating through developer tools to simplify local development.

#### Authenticating via the Azure CLI

`DefaultAzureCredential` and `AzureCLICredential` can authenticate as the user
signed in to the [Azure CLI](https://learn.microsoft.com/cli/azure). To sign in to the Azure CLI, run `az login`. On a system with a default web browser, the Azure CLI will launch the browser to authenticate a user.

When no default browser is available, `az login` will use the device code
authentication flow. This can also be selected manually by running `az login --use-device-code`.

#### Authenticate via the Azure Developer CLI

Developers coding outside of an IDE can also use the [Azure Developer CLI](https://aka.ms/azure-dev) to authenticate. Applications using the `DefaultAzureCredential` or the `AzureDeveloperCLICredential` can use the account logged in to the Azure Developer CLI to authenticate calls in their application when running locally.

To authenticate with the Azure Developer CLI, run `azd auth login`. On a system with a default web browser, `azd` will launch the browser to authenticate. On systems without a default web browser, run `azd auth login --use-device-code` to use the device code authentication flow.

## Key concepts

### Credentials

A credential is a type which contains or can obtain the data needed for a
service client to authenticate requests. Service clients across the Azure SDK
accept a credential instance when they are constructed, and use that credential
to authenticate requests.

The `azidentity` module focuses on OAuth authentication with Microsoft Entra ID. It offers a variety of credential types capable of acquiring a Microsoft Entra access token. See [Credential Types](#credential-types "Credential Types") for a list of this module's credential types.

### DefaultAzureCredential

`DefaultAzureCredential` simplifies authentication while developing apps that deploy to Azure by combining credentials used in Azure hosting environments with credentials used in local development. For more information, see [DefaultAzureCredential overview][dac_overview].

## Managed Identity

`DefaultAzureCredential` and `ManagedIdentityCredential` support
[managed identity authentication](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview)
in any hosting environment which supports managed identities, such as (this list is not exhaustive):
* [Azure App Service](https://learn.microsoft.com/azure/app-service/overview-managed-identity)
* [Azure Arc](https://learn.microsoft.com/azure/azure-arc/servers/managed-identity-authentication)
* [Azure Cloud Shell](https://learn.microsoft.com/azure/cloud-shell/msi-authorization)
* [Azure Kubernetes Service](https://learn.microsoft.com/azure/aks/use-managed-identity)
* [Azure Service Fabric](https://learn.microsoft.com/azure/service-fabric/concepts-managed-identity)
* [Azure Virtual Machines](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/how-to-use-vm-token)

## Examples

- [Authenticate with DefaultAzureCredential](#authenticate-with-defaultazurecredential "Authenticate with DefaultAzureCredential")
- [Define a custom authentication flow with ChainedTokenCredential](#define-a-custom-authentication-flow-with-chainedtokencredential "Define a custom authentication flow with ChainedTokenCredential")
- [Specify a user-assigned managed identity for DefaultAzureCredential](#specify-a-user-assigned-managed-identity-for-defaultazurecredential)

### Authenticate with DefaultAzureCredential

This example demonstrates authenticating a client from the `armresources` module with `DefaultAzureCredential`.

```go
cred, err := azidentity.NewDefaultAzureCredential(nil)
if err != nil {
  // handle error
}

client := armresources.NewResourceGroupsClient("subscription ID", cred, nil)
```

### Specify a user-assigned managed identity for DefaultAzureCredential

To configure `DefaultAzureCredential` to authenticate a user-assigned managed identity, set the environment variable `AZURE_CLIENT_ID` to the identity's client ID.

### Define a custom authentication flow with `ChainedTokenCredential`

`DefaultAzureCredential` is generally the quickest way to get started developing apps for Azure. For more advanced scenarios, `ChainedTokenCredential` links multiple credential instances to be tried sequentially when authenticating. It will try each chained credential in turn until one provides a token or fails to authenticate due to an error.

The following example demonstrates creating a credential, which will attempt to authenticate using managed identity. It will fall back to authenticating via the Azure CLI when a managed identity is unavailable.

```go
managed, err := azidentity.NewManagedIdentityCredential(nil)
if err != nil {
  // handle error
}
azCLI, err := azidentity.NewAzureCLICredential(nil)
if err != nil {
  // handle error
}
chain, err := azidentity.NewChainedTokenCredential([]azcore.TokenCredential{managed, azCLI}, nil)
if err != nil {
  // handle error
}

client := armresources.NewResourceGroupsClient("subscription ID", chain, nil)
```

## Credential Types

### Credential chains

|Credential|Usage|Reference
|-|-|-
|[DefaultAzureCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#DefaultAzureCredential)|Simplified authentication experience for getting started developing Azure apps|[DefaultAzureCredential overview][dac_overview]|
|[ChainedTokenCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#ChainedTokenCredential)|Define custom authentication flows, composing multiple credentials|[ChainedTokenCredential overview][ctc_overview]|

### Authenticating Azure-Hosted Applications

|Credential|Usage
|-|-
|[EnvironmentCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#EnvironmentCredential)|Authenticate a service principal or user configured by environment variables
|[ManagedIdentityCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#ManagedIdentityCredential)|Authenticate the managed identity of an Azure resource
|[WorkloadIdentityCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#WorkloadIdentityCredential)|Authenticate a workload identity on Kubernetes

### Authenticating Service Principals

|Credential|Usage
|-|-
|[AzurePipelinesCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#AzurePipelinesCredential)|Authenticate an Azure Pipelines [service connection](https://learn.microsoft.com/azure/devops/pipelines/library/service-endpoints?view=azure-devops&tabs=yaml)
|[ClientAssertionCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#ClientAssertionCredential)|Authenticate a service principal with a signed client assertion
|[ClientCertificateCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#ClientCertificateCredential)|Authenticate a service principal with a certificate
|[ClientSecretCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#ClientSecretCredential)|Authenticate a service principal with a secret

### Authenticating Users

|Credential|Usage
|-|-
|[InteractiveBrowserCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#InteractiveBrowserCredential)|Interactively authenticate a user with the default web browser
|[DeviceCodeCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#DeviceCodeCredential)|Interactively authenticate a user on a device with limited UI

### Authenticating via Development Tools

|Credential|Usage
|-|-
|[AzureCLICredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#AzureCLICredential)|Authenticate as the user signed in to the Azure CLI
|[AzureDeveloperCLICredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#AzureDeveloperCLICredential)|Authenticates as the user signed in to the Azure Developer CLI

## Environment Variables

`DefaultAzureCredential` and `EnvironmentCredential` can be configured with environment variables. Each type of authentication requires values for specific variables:

### Service principal with secret

|variable name|value
|-|-
|`AZURE_CLIENT_ID`|ID of a Microsoft Entra application
|`AZURE_TENANT_ID`|ID of the application's Microsoft Entra tenant
|`AZURE_CLIENT_SECRET`|one of the application's client secrets

### Service principal with certificate

|variable name|value
|-|-
|`AZURE_CLIENT_ID`|ID of a Microsoft Entra application
|`AZURE_TENANT_ID`|ID of the application's Microsoft Entra tenant
|`AZURE_CLIENT_CERTIFICATE_PATH`|path to a certificate file including private key
|`AZURE_CLIENT_CERTIFICATE_PASSWORD`|password of the certificate file, if any

Configuration is attempted in the above order. For example, if values for a client secret and certificate are both present, the client secret will be used.

## Token caching

Token caching is an `azidentity` feature that allows apps to:

* Cache tokens in memory (default) or on disk (opt-in).
* Improve resilience and performance.
* Reduce the number of requests made to Microsoft Entra ID to obtain access tokens.

For more details, see the [token caching documentation](https://aka.ms/azsdk/go/identity/caching).

## Troubleshooting

### Error Handling

Credentials return an `error` when they fail to authenticate or lack data they require to authenticate. For guidance on resolving errors from specific credential types, see the [troubleshooting guide](https://aka.ms/azsdk/go/identity/troubleshoot).

For more details on handling specific Microsoft Entra errors, see the Microsoft Entra [error code documentation](https://learn.microsoft.com/entra/identity-platform/reference-error-codes).

### Logging

This module uses the classification-based logging implementation in `azcore`. To enable console logging for all SDK modules, set `AZURE_SDK_GO_LOGGING` to `all`. Use the `azcore/log` package to control log event output or to enable logs for `azidentity` only. For example:
```go
import azlog "github.com/Azure/azure-sdk-for-go/sdk/azcore/log"

// print log output to stdout
azlog.SetListener(func(event azlog.Event, s string) {
    fmt.Println(s)
})

// include only azidentity credential logs
azlog.SetEvents(azidentity.EventAuthentication)
```

Credentials log basic information only, such as `GetToken` success or failure and errors. These log entries don't contain authentication secrets but may contain sensitive information.

## Next steps

Client and management modules listed on the [Azure SDK releases page](https://azure.github.io/azure-sdk/releases/latest/go.html) support authenticating with `azidentity` credential types. You can learn more about using these libraries in their documentation, which is linked from the release page.

## Provide Feedback

If you encounter bugs or have suggestions, please
[open an issue](https://github.com/Azure/azure-sdk-for-go/issues).

## Contributing

This project welcomes contributions and suggestions. Most contributions require
you to agree to a Contributor License Agreement (CLA) declaring that you have
the right to, and actually do, grant us the rights to use your contribution.
For details, visit [https://cla.microsoft.com](https://cla.microsoft.com).

When you submit a pull request, a CLA-bot will automatically determine whether
you need to provide a CLA and decorate the PR appropriately (e.g., label,
comment). Simply follow the instructions provided by the bot. You will only
need to do this once across all repos using our CLA.

This project has adopted the
[Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information, see the
[Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/)
or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any
additional questions or comments.

<!-- LINKS -->
[ctc_overview]: https://aka.ms/azsdk/go/identity/credential-chains#chainedtokencredential-overview
[dac_overview]: https://aka.ms/azsdk/go/identity/credential-chains#defaultazurecredential-overview


