# Breaking Changes

## v1.8.0

### New errors from `NewManagedIdentityCredential` in some environments

`NewManagedIdentityCredential` now returns an error when `ManagedIdentityCredentialOptions.ID` is set in a hosting environment whose managed identity API doesn't support user-assigned identities. `ManagedIdentityCredential.GetToken()` formerly logged a warning in these cases. Returning an error instead prevents the credential authenticating an unexpected identity. The affected hosting environments are:
  * Azure Arc
  * Azure ML (when a resource or object ID is specified; client IDs are supported)
  * Cloud Shell
  * Service Fabric

## v1.6.0

### Behavioral change to `DefaultAzureCredential` in IMDS managed identity scenarios

As of `azidentity` v1.6.0, `DefaultAzureCredential` makes a minor behavioral change when it uses IMDS managed
identity. It sends its first request to IMDS without the "Metadata" header, to expedite validating whether the endpoint
is available. This precedes the credential's first token request and is guaranteed to fail with a 400 error. This error
response can appear in logs but doesn't indicate authentication failed.
