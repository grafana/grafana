/*
Package acceptencoding provides customizations associated with Accept Encoding Header.

# Accept encoding gzip

The Go HTTP client automatically supports accept-encoding and content-encoding
gzip by default. This default behavior is not desired by the SDK, and prevents
validating the response body's checksum. To prevent this the SDK must manually
control usage of content-encoding gzip.

To control content-encoding, the SDK must always set the `Accept-Encoding`
header to a value. This prevents the HTTP client from using gzip automatically.
When gzip is enabled on the API client, the SDK's customization will control
decompressing the gzip data in order to not break the checksum validation. When
gzip is disabled, the API client will disable gzip, preventing the HTTP
client's default behavior.

An `EnableAcceptEncodingGzip` option may or may not be present depending on the client using
the below middleware. The option if present can be used to enable auto decompressing
gzip by the SDK.
*/
package acceptencoding
