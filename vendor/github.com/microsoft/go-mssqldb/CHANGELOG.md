# Changelog
## 1.9.2

### Bug fixes

* Fix race condition in message queue query model (#277)

## 1.9.1

### Bug fixes

* Fix bulk insert failure with datetime values near midnight due to day overflow (#271)
* Fix: apply guidConversion option in TestBulkcopy (#255)

### Features

* support configuring custom time.Location for datetime encoding and decoding via DSN (#260)
* Implement support for the latest Azure credential types in the azuread package (#269)

## 1.8.2

### Bug fixes

* Added "Pwd" as a recognized alias for "Password" in connection strings (#262)
* Updated `isProc` to detect more keywords

## 1.7.0

### Changed

* Changed always encrypted key provider error handling not to panic on failure

### Features

* Support DER certificates for server authentication (#152)

### Bug fixes

* Improved speed of CharsetToUTF8 (#154)

## 1.7.0

### Changed

* krb5 authenticator supports standard Kerberos environment variables for configuration

## 1.6.0

### Changed

* Go.mod updated to Go 1.17
* Azure SDK for Go dependencies updated

### Features

* Added `ActiveDirectoryAzCli` and `ActiveDirectoryDeviceCode` authentication types to `azuread` package
* Always Encrypted encryption and decryption with 2 hour key cache (#116)
* 'pfx', 'MSSQL_CERTIFICATE_STORE', and 'AZURE_KEY_VAULT' encryption key providers
* TDS8 can now be used for connections by setting encrypt="strict"

## 1.5.0

### Features

### Bug fixes

* Handle extended character in SQL instance names for browser lookup (#122)

## 1.4.0

### Features

* Adds UnmarshalJSON interface for UniqueIdentifier (#126)

### Bug fixes

* Fixes MarshalText prototype for UniqueIdentifier

## 1.2.0

### Features

* A connector's dialer can now be used to resolve DNS if the dialer implements the `HostDialer` interface

## 1.0.0

### Features

* `admin` protocol for dedicated administrator connections

### Changed

* Added `Hidden()` method to `ProtocolParser` interface

## 0.21.0

### Features

* Updated azidentity to 1.2.1, which adds in memory cache for managed credentials ([#90](https://github.com/microsoft/go-mssqldb/pull/90))

### Bug fixes

* Fixed uninitialized server name in TLS config ([#93](https://github.com/microsoft/go-mssqldb/issues/93))([#94](https://github.com/microsoft/go-mssqldb/pull/94))
* Fixed several kerberos authentication usages on Linux with new krb5 authentication provider. ([#65](https://github.com/microsoft/go-mssqldb/pull/65))

### Changed

* New kerberos authenticator implementation uses more explicit connection string parameters.

| Old          | New                |
|--------------|--------------------|
| krb5conffile | krb5-configfile    |
| krbcache     | krb5-credcachefile |
| keytabfile   | krb5-keytabfile    |
| realm        | krb5-realm         |

## 0.20.0

### Features

* Add driver version and name to TDS login packets
* Add `pipe` connection string parameter for named pipe dialer
* Expose network errors that occur during connection establishment. Now they are
wrapped, and can be detected by using errors.As/Is practise. This connection
errors can, and could even before, happen anytime the sql.DB doesn't have free
connection for executed query.

### Bug fixes

* Added checks while reading prelogin for invalid data ([#64](https://github.com/microsoft/go-mssqldb/issues/64))([86ecefd8b](https://github.com/microsoft/go-mssqldb/commit/86ecefd8b57683aeb5ad9328066ee73fbccd62f5))

* Fixed multi-protocol dialer path to avoid unneeded SQL Browser queries

