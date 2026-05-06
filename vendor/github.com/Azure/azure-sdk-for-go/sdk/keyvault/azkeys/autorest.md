## Go

```yaml
clear-output-folder: false
export-clients: true
go: true
input-file: https://github.com/Azure/azure-rest-api-specs/blob/551275acb80e1f8b39036b79dfc35a8f63b601a7/specification/keyvault/data-plane/Microsoft.KeyVault/stable/7.4/keys.json
license-header: MICROSOFT_MIT_NO_VERSION
module: github.com/Azure/azure-sdk-for-go/sdk/keyvault/azkeys
openapi-type: "data-plane"
output-folder: ../azkeys
override-client-name: Client
security: "AADToken"
security-scopes: "https://vault.azure.net/.default"
use: "@autorest/go@4.0.0-preview.46"
version: "^3.0.0"

directive:
  # delete unused models
  - remove-model: KeyExportParameters
  - remove-model: KeyProperties

  # make vault URL a parameter of the client constructor
  - from: swagger-document
    where: $["x-ms-parameterized-host"]
    transform: $.parameters[0]["x-ms-parameter-location"] = "client"

  # capitalize acronyms
  - from: swagger-document
    where: $.definitions.KeyImportParameters.properties.Hsm
    transform: $["x-ms-client-name"] = "HSM"
  - from: swagger-document
    where: $.definitions..properties..iv
    transform: $["x-ms-client-name"] = "IV"
  - from: swagger-document
    where: $.definitions..properties..kid
    transform: $["x-ms-client-name"] = "KID"

  # Maxresults -> MaxResults
  - from: swagger-document
    where: $.paths..parameters..[?(@.name=='maxresults')]
    transform: $["x-ms-client-name"] = "MaxResults"

  # keyName, keyVersion -> name, version
  - from: swagger-document
    where: $.paths..parameters..[?(@.name=='key-name')]
    transform: $["x-ms-client-name"] = "name"
  - from: swagger-document
    where: $.paths..parameters..[?(@.name=='key-version')]
    transform: $["x-ms-client-name"] = "version"

  # rename parameter models to match their methods
  - rename-model:
      from: KeyCreateParameters
      to: CreateKeyParameters
  - rename-model:
      from: KeyExportParameters
      to: ExportKeyParameters
  - rename-model:
      from: KeyImportParameters
      to: ImportKeyParameters
  - rename-model:
      from: KeyReleaseParameters
      to: ReleaseParameters
  - rename-model:
      from: KeyRestoreParameters
      to: RestoreKeyParameters
  - rename-model:
      from: KeySignParameters
      to: SignParameters
  - rename-model:
      from: KeyUpdateParameters
      to: UpdateKeyParameters
  - rename-model:
      from: KeyVerifyParameters
      to: VerifyParameters

  # rename paged operations from Get* to List*
  - rename-operation:
      from: GetDeletedKeys
      to: ListDeletedKeys
  - rename-operation:
      from: GetKeys
      to: ListKeys
  - rename-operation:
      from: GetKeyVersions
      to: ListKeyVersions

  # delete unused error models
  - from: models.go
    where: $
    transform: return $.replace(/(?:\/\/.*\s)+type (?:Error|KeyVaultError).+\{(?:\s.+\s)+\}\s/g, "");
  - from: models_serde.go
    where: $
    transform: return $.replace(/(?:\/\/.*\s)+func \(\w \*?(?:Error|KeyVaultError)\).*\{\s(?:.+\s)+\}\s/g, "");

  # delete the Attributes model defined in common.json (it's used only with allOf)
  - from: models.go
    where: $
    transform: return $.replace(/(?:\/\/.*\s)+type Attributes.+\{(?:\s.+\s)+\}\s/, "");
  - from: models_serde.go
    where: $
    transform: return $.replace(/(?:\/\/.*\s)+func \(a \*?Attributes\).*\{\s(?:.+\s)+\}\s/g, "");

  # delete the version path param check (version == "" is legal for Key Vault but indescribable by OpenAPI)
  - from: client.go
    where: $
    transform: return $.replace(/\sif version == "" \{\s+.+version cannot be empty"\)\s+\}\s/g, "");

  # delete client name prefix from method options and response types
  - from:
      - client.go
      - models.go
      - response_types.go
    where: $
    transform: return $.replace(/Client(\w+)((?:Options|Response))/g, "$1$2");

  # insert a handwritten type for "KID" fields so we can add parsing methods
  - from: models.go
    where: $
    transform: return $.replace(/(KID \*)string(\s+.*)/g, "$1ID$2")
```
