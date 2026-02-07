# Microsoft's official Go MSSQL driver

[![Go Reference](https://pkg.go.dev/badge/github.com/microsoft/go-mssqldb.svg)](https://pkg.go.dev/github.com/microsoft/go-mssqldb)
[![Build status](https://ci.appveyor.com/api/projects/status/jrln8cs62wj9i0a2?svg=true)](https://ci.appveyor.com/project/microsoft/go-mssqldb)
[![codecov](https://codecov.io/gh/microsoft/go-mssqldb/branch/master/graph/badge.svg)](https://codecov.io/gh/microsoft/go-mssqldb)


## Install

Requires Go 1.17 or above.

Install with `go install github.com/microsoft/go-mssqldb@latest`.

## Connection Parameters and DSN

The recommended connection string uses a URL format:
`sqlserver://username:password@host/instance?param1=value&param2=value`
Other supported formats are listed below.

### Common parameters

* `user id` - enter the SQL Server Authentication user id or the Windows Authentication user id in the DOMAIN\User format. On Windows, if user id is empty or missing Single-Sign-On is used. The user domain sensitive to the case which is defined in the connection string.
* `password`
* `database`
* `connection timeout` - in seconds (default is 0 for no timeout), set to 0 for no timeout. Recommended to set to 0 and use context to manage query and connection timeouts.
* `dial timeout` - in seconds (default is 15 times the number of registered protocols), set to 0 for no timeout.
* `encrypt`
  * `strict` - Data sent between client and server is encrypted E2E using [TDS8](https://learn.microsoft.com/en-us/sql/relational-databases/security/networking/tds-8?view=sql-server-ver16).
  * `disable` - Data send between client and server is not encrypted.
  * `false`/`optional`/`no`/`0`/`f` - Data sent between client and server is not encrypted beyond the login packet. (Default)
  * `true`/`mandatory`/`yes`/`1`/`t` - Data sent between client and server is encrypted.
* `app name` - The application name (default is go-mssqldb)
* `authenticator` - Can be used to specify use of a registered authentication provider. (e.g. ntlm, winsspi (on windows) or krb5 (on linux))
* `timezone` - Sets the time zone used by the driver when parsing time types. For example: `timezone=Asia/Shanghai`. Supports [IANA](https://www.iana.org/time-zones) time zone names.

### Connection parameters for ODBC and ADO style connection strings

* `server` - host or host\instance (default localhost)
* `port` - specifies the host\instance port (default 1433). If instance name is provided but no port, the driver will use SQL Server Browser to discover the port.

### Less common parameters

* `keepAlive` - in seconds; 0 to disable (default is 30)
* `failoverpartner` - host or host\instance (default is no partner).
* `failoverport` - used only when there is no instance in failoverpartner (default 1433)
* `packet size` - in bytes; 512 to 32767 (default is 4096)
  * Encrypted connections have a maximum packet size of 16383 bytes
  * Further information on usage: <https://docs.microsoft.com/en-us/sql/database-engine/configure-windows/configure-the-network-packet-size-server-configuration-option>
* `log` - logging flags (default `0`/no logging, `255` for full logging)
  * `1` log errors
  * `2` log messages
  * `4` log rows affected
  * `8` trace sql statements
  * `16` log statement parameters
  * `32` log transaction begin/end
  * `64` additional debug logs
  * `128` log retries
* `TrustServerCertificate`
  * false - Server certificate is checked. Default is false if encrypt is specified.
  * true - Server certificate is not checked. Default is true if encrypt is not specified. If trust server certificate is true, driver accepts any certificate presented by the server and any host name in that certificate. In this mode, TLS is susceptible to man-in-the-middle attacks. This should be used only for testing.
* `certificate` - The file that contains the public key certificate of the CA that signed the SQL Server certificate. The specified certificate overrides the go platform specific CA certificates. Currently, certificates of PEM type are supported.
* `hostNameInCertificate` - Specifies the Common Name (CN) in the server certificate. Default value is the server host.
* `tlsmin` - Specifies the minimum TLS version for negotiating encryption with the server. Recognized values are `1.0`, `1.1`, `1.2`, `1.3`. If not set to a recognized value the default value for the `tls` package will be used. The default is currently `1.2`. 
* `ServerSPN` - The kerberos SPN (Service Principal Name) for the server. Default is MSSQLSvc/host:port.
* `Workstation ID` - The workstation name (default is the host name)
* `ApplicationIntent` - Can be given the value `ReadOnly` to initiate a read-only connection to an Availability Group listener. The `database` must be specified when connecting with `Application Intent` set to `ReadOnly`.
* `protocol` - forces use of a protocol. Make sure the corresponding package is imported.
* `columnencryption` or `column encryption setting` - a boolean value indicating whether Always Encrypted should be enabled on the connection.
* `multisubnetfailover`
  * `true` (Default) Client attempt to connect to all IPs simultaneously. 
  * `false` Client attempts to connect to IPs in serial.
* `guid conversion` - Enables the conversion of GUIDs, so that byte order is preserved. UniqueIdentifier isn't supported for nullable fields, NullUniqueIdentifier must be used instead.

### Connection parameters for namedpipe package
* `pipe`  - If set, no Browser query is made and named pipe used will be `\\<host>\pipe\<pipe>`
* `protocol` can be set to `np`
* For a non-URL DSN, the `server` parameter can be set to the full pipe name like `\\host\pipe\sql\query`

If no pipe name can be derived from the DSN, connection attempts will first query the SQL Browser service to find the pipe name for the instance.

### DNS Resolution through a Custom Dialer

Custom Dialers can be used to resolve DNS if the Connection's Dialer implements the `HostDialer` interface. This is helpful when the dialer is proxying requests to a different, private network and the DNS record is local to the private network.

### Protocol configuration

To force a specific protocol for the connection there two several options:
1. Prepend the server name in a DSN with the protocol and a colon, like `np:host` or `lpc:host` or `tcp:host`
2. Set the `protocol` parameter to the protocol name

`msdsn.ProtocolParsers` can be reordered to prioritize other protocols ahead of `tcp`

The `admin` protocol will not be used for dialing unless the connection string explicitly specifies it. Note SQL Server allows only 1 admin (or DAC) connection to be active at a time.

### Kerberos Active Directory authentication outside Windows

To connect with kerberos authentication from a Linux server you can use the optional krb5 package. 
Imported krb alongside the main driver 
```
package main

import (
    ...
    _ "github.com/microsoft/go-mssqldb"
    _ "github.com/microsoft/go-mssqldb/integratedauth/krb5"
)

func main() {
    ...
}
```

It will become available for use when the connection string parameter "authenticator=krb5" is used.

The package supports authentication via 3 methods.

* Keytabs - Specify the username, keytab file, the krb5.conf file, and realm.

      authenticator=krb5;server=DatabaseServerName;database=DBName;user id=MyUserName;krb5-realm=domain.com;krb5-configfile=/etc/krb5.conf;krb5-keytabfile=~/MyUserName.keytab

* Credential Cache - Specify the krb5.conf file path and credential cache file path.

      authenticator=krb5;server=DatabaseServerName;database=DBName;krb5-configfile=/etc/krb5.conf;krb5-credcachefile=~/MyUserNameCachedCreds 

* Raw credentials - Specity krb5.confg, Username, Password and Realm.

      authenticator=krb5;server=DatabaseServerName;database=DBName;user id=MyUserName;password=foo;krb5-realm=comani.com;krb5-configfile=/etc/krb5.conf;

### Kerberos Parameters

* `authenticator` - set this to `krb5` to enable kerberos authentication. If this is not present, the default provider would be `ntlm` for unix and `winsspi` for windows.
* `krb5-configfile` (optional) - path to kerberos configuration file. Defaults to `/etc/krb5.conf`. Can also be set using `KRB5_CONFIG` environment variable.
* `krb5-realm` (required with keytab and raw credentials) - Domain name for kerberos authentication. Omit this parameter if the realm is part of the user name like `username@REALM`.
* `krb5-keytabfile` - path to Keytab file. Can also be set using environment variable `KRB5_KTNAME`. If no parameter or environment variable is set, the `DefaultClientKeytabName` value from the krb5 config file is used.
* `krb5-credcachefile` - path to Credential cache. Can also be set using environment variable `KRBCCNAME`.
* `krb5-dnslookupkdc` - Optional parameter in all contexts. Set to lookup KDCs in DNS. Boolean. Default is true. 
* `krb5-udppreferencelimit` - Optional parameter in all contexts. 1 means to always use tcp. MIT krb5 has a default value of 1465, and it prevents user setting more than 32700. Integer. Default is 1.
  
For further information on usage: 
  * <https://web.mit.edu/kerberos/krb5-1.12/doc/admin/conf_files/krb5_conf.html>
  * <https://web.mit.edu/kerberos/krb5-1.12/doc/basic/index.html>

### The connection string can be specified in one of three formats

1. URL: with `sqlserver` scheme. username and password appears before the host. Any instance appears as
    the first segment in the path. All other options are query parameters. Examples:

    * `sqlserver://username:password@host/instance?param1=value&param2=value`
    * `sqlserver://username:password@host:port?param1=value&param2=value`
    * `sqlserver://sa@localhost/SQLExpress?database=master&connection+timeout=30` // `SQLExpress instance.
    * `sqlserver://sa:mypass@localhost?database=master&connection+timeout=30`     // username=sa, password=mypass.
    * `sqlserver://sa:mypass@localhost:1234?database=master&connection+timeout=30` // port 1234 on localhost.
    * `sqlserver://sa:my%7Bpass@somehost?connection+timeout=30` // password is "my{pass"
      A string of this format can be constructed using the `URL` type in the `net/url` package.

    ```go

    query := url.Values{}
    query.Add("app name", "MyAppName")
    
    u := &url.URL{
    	Scheme:   "sqlserver",
    	User:     url.UserPassword(username, password),
    	Host:     fmt.Sprintf("%s:%d", hostname, port),
    	// Path:  instance, // if connecting to an instance instead of a port
    	RawQuery: query.Encode(),
    }
    db, err := sql.Open("sqlserver", u.String())

    ```

* `sqlserver://username@host/instance?krb5-configfile=path/to/file&krb5-credcachefile=/path/to/cache`
    * `sqlserver://username@host/instance?krb5-configfile=path/to/file&krb5-realm=domain.com&krb5-keytabfile=/path/to/keytabfile`

2. ADO: `key=value` pairs separated by `;`. Values may not contain `;`, leading and trailing whitespace is ignored.
     Examples:

    * `server=localhost\\SQLExpress;user id=sa;database=master;app name=MyAppName`
    * `server=localhost;user id=sa;database=master;app name=MyAppName`
    * `server=localhost;user id=sa;database=master;app name=MyAppName;krb5-configfile=path/to/file;krb5-credcachefile=path/to/cache;authenticator=krb5`
    * `server=localhost;user id=sa;database=master;app name=MyAppName;krb5-configfile=path/to/file;krb5-realm=domain.com;krb5-keytabfile=path/to/keytabfile;authenticator=krb5`


    ADO strings support synonyms for database, app name, user id, and server
    * server <= addr, address, network address, data source
    * user id <= user, uid
    * database <= initial catalog
    * app name <= application name

3. ODBC: Prefix with `odbc`, `key=value` pairs separated by `;`. Allow `;` by wrapping
    values in `{}`. Examples:

    * `odbc:server=localhost\\SQLExpress;user id=sa;database=master;app name=MyAppName`
    * `odbc:server=localhost;user id=sa;database=master;app name=MyAppName`
    * `odbc:server=localhost;user id=sa;password={foo;bar}` // Value marked with `{}`, password is "foo;bar"
    * `odbc:server=localhost;user id=sa;password={foo{bar}` // Value marked with `{}`, password is "foo{bar"
    * `odbc:server=localhost;user id=sa;password={foobar }` // Value marked with `{}`, password is "foobar "
    * `odbc:server=localhost;user id=sa;password=foo{bar`   // Literal `{`, password is "foo{bar"
    * `odbc:server=localhost;user id=sa;password=foo}bar`   // Literal `}`, password is "foo}bar"
    * `odbc:server=localhost;user id=sa;password={foo{bar}` // Literal `{`, password is "foo{bar"
    * `odbc:server=localhost;user id=sa;password={foo}}bar}` // Escaped `} with`}}`, password is "foo}bar"
    * `odbc:server=localhost;user id=sa;database=master;app name=MyAppName;krb5-configfile=path/to/file;krb5-credcachefile=path/to/cache;authenticator=krb5`
    * `odbc:server=localhost;user id=sa;database=master;app name=MyAppName;krb5-configfile=path/to/file;krb5-realm=domain.com;krb5-keytabfile=path/to/keytabfile;authenticator=krb5`

### Azure Active Directory authentication

Azure Active Directory authentication uses temporary authentication tokens to authenticate.
The `mssql` package does not provide an implementation to obtain tokens: instead, import the `azuread` package and use driver name `azuresql`. This driver uses [azidentity](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#section-readme) to acquire tokens using a variety of credential types.

To reduce friction in local development, `ActiveDirectoryDefault` can authenticate as the user signed into the Azure CLI.

Run the following command to sign into the Azure CLI before running your application using the `ActiveDirectoryDefault` connection string parameter:

```azurecli
az login
```

Azure CLI authentication isn't recommended for applications running in Azure. More details are available via the [Azure authentication with the Azure Identity module for Go](https://learn.microsoft.com/en-us/azure/developer/go/azure-sdk-authentication) tutorial.

The credential type is determined by the new `fedauth` connection string parameter.

* `fedauth=ActiveDirectoryServicePrincipal` or `fedauth=ActiveDirectoryApplication` - authenticates using an Azure Active Directory application client ID and client secret or certificate. Implemented using [ClientSecretCredential or CertificateCredential](https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/azidentity#authenticating-service-principals)
  * `clientcertpath=<path to certificate file>;password=<certificate password>` or
  * `password=<client secret>`
  * `user id=<application id>[@tenantid]` Note the `@tenantid` component can be omitted if the server's tenant is the same as the application's tenant.
* `fedauth=ActiveDirectoryPassword` - authenticates using a user name and password.
  * `user id=username@domain`
  * `password=<password>`
  * `applicationclientid=<application id>` - This guid identifies an Azure Active Directory enterprise application that the AAD admin has approved for accessing Azure SQL database resources in the tenant. This driver does not have an associated application id of its own.
* `fedauth=ActiveDirectoryDefault` - authenticates using a chained set of credentials. The chain is built from EnvironmentCredential -> ManagedIdentityCredential->AzureCLICredential.  See [DefaultAzureCredential docs](https://github.com/Azure/azure-sdk-for-go/wiki/Set-up-Your-Environment-for-Authentication#configure-defaultazurecredential) for instructions on setting up your host environment to use it. Using this option allows you to have the same connection string in a service deployment as on your interactive development machine.
* `fedauth=ActiveDirectoryManagedIdentity` or `fedauth=ActiveDirectoryMSI` - authenticates using a system-assigned or user-assigned Azure Managed Identity.
  * `user id=<identity id>` - optional id of user-assigned managed identity. If empty, system-assigned managed identity is used.
  * `resource id=<resource id>` - optional resource id of user-assigned managed identity.  If empty, system-assigned managed identity or user id are used (if both user id and resource id are provided, resource id will be used)
* `fedauth=ActiveDirectoryInteractive` - authenticates using credentials acquired from an external web browser. Only suitable for use with human interaction.
  * `applicationclientid=<application id>` - This guid identifies an Azure Active Directory enterprise application that the AAD admin has approved for accessing Azure SQL database resources in the tenant. This driver does not have an associated application id of its own.
* `fedauth=ActiveDirectoryDeviceCode` - prints a message to stdout giving the user a URL and code to authenticate. Connection continues after user completes the login separately.
* `fedauth=ActiveDirectoryAzCli` - reuses local authentication the user already performed using Azure CLI.
* `fedauth=ActiveDirectoryAzureDeveloperCli` - reuses local authentication the user already performed using Azure Developer CLI.
* `fedauth=ActiveDirectoryEnvironment` - authenticates using environment variables. Uses the same environment variables as [EnvironmentCredential](https://pkg.go.dev/github.com/Azure/azure-sdk-for-go/sdk/azidentity#EnvironmentCredential).
* `fedauth=ActiveDirectoryWorkloadIdentity` - authenticates using workload identity credentials for Kubernetes and other OIDC environments.
* `fedauth=ActiveDirectoryAzurePipelines` - authenticates using Azure Pipelines service connection.
  * `user id=<service principal id>[@tenantid]` - The service principal client ID and tenant ID. If not provided, uses `AZURESUBSCRIPTION_CLIENT_ID` and `AZURESUBSCRIPTION_TENANT_ID` environment variables.
  * `serviceconnectionid=<connection id>` - The service connection ID from Azure DevOps. If not provided, uses `AZURESUBSCRIPTION_SERVICE_CONNECTION_ID` environment variable.
  * `systemtoken=<system token>` - The system access token for the pipeline. If not provided, uses `SYSTEM_ACCESSTOKEN` environment variable.
  * Note: Environment variables are automatically configured by Azure Pipelines in AzureCLI@2 and AzurePowerShell@5 tasks.
* `fedauth=ActiveDirectoryClientAssertion` - authenticates using a client assertion (JWT token).
  * `user id=<client id>[@tenantid]` - The client ID and tenant ID.
  * `clientassertion=<jwt token>` - The JWT assertion token.
* `fedauth=ActiveDirectoryOnBehalfOf` - authenticates using the on-behalf-of flow for delegated access.
  * `user id=<client id>[@tenantid]` - The client ID and tenant ID.
  * `userassertion=<user token>` - The user assertion token.
  * Use one of the following for client authentication:
    * `password=<client secret>` - Client secret
    * `clientcertpath=<path to certificate file>;password=<certificate password>` - Client certificate
    * `clientassertion=<jwt token>` - Client assertion JWT

#### Common Credential Options

The following connection string parameters can be used with most Azure credential types to provide additional configuration:

* `additionallyallowedtenants=<tenant1,tenant2>` - Comma or semicolon-separated list of additional tenant IDs that the credential may authenticate to. Use "*" to allow any tenant.
* `disableinstancediscovery=true` - Disables Microsoft Entra instance discovery. Set to `true` only for disconnected or private clouds like Azure Stack.
* `tokenfilepath=<path>` - For `ActiveDirectoryWorkloadIdentity`, specifies the path to the Kubernetes service account token file.
* `sendcertificatechain=true` - For certificate-based authentication, controls whether to send the full certificate chain in token requests. Required for Subject Name/Issuer (SNI) authentication.

```go

import (
  "database/sql"
  "net/url"

  // Import the Azure AD driver module (also imports the regular driver package)
  "github.com/microsoft/go-mssqldb/azuread"
)

func ConnectWithMSI() (*sql.DB, error) {
  return sql.Open(azuread.DriverName, "sqlserver://azuresql.database.windows.net?database=yourdb&fedauth=ActiveDirectoryMSI")
}

func ConnectWithEnvironmentCredential() (*sql.DB, error) {
  // Requires AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET environment variables
  return sql.Open(azuread.DriverName, "sqlserver://azuresql.database.windows.net?database=yourdb&fedauth=ActiveDirectoryEnvironment")
}

func ConnectWithWorkloadIdentity() (*sql.DB, error) {
  // For use in Kubernetes environments with workload identity
  return sql.Open(azuread.DriverName, "sqlserver://azuresql.database.windows.net?database=yourdb&fedauth=ActiveDirectoryWorkloadIdentity")
}

func ConnectWithAzurePipelines() (*sql.DB, error) {
  // For use in Azure DevOps Pipelines with explicit parameters
  connStr := "sqlserver://azuresql.database.windows.net?database=yourdb&fedauth=ActiveDirectoryAzurePipelines"
  connStr += "&user+id=" + url.QueryEscape("client-id@tenant-id")
  connStr += "&serviceconnectionid=connection-id"
  connStr += "&systemtoken=access-token"
  return sql.Open(azuread.DriverName, connStr)
}

func ConnectWithAzurePipelinesEnvVars() (*sql.DB, error) {
  // For use in Azure DevOps Pipelines with AzureCLI@2 or AzurePowerShell@5 tasks
  // Environment variables are automatically set by these tasks
  connStr := "sqlserver://azuresql.database.windows.net?database=yourdb&fedauth=ActiveDirectoryAzurePipelines"
  connStr += "&systemtoken=access-token"  // Only systemtoken needs to be provided
  return sql.Open(azuread.DriverName, connStr)
}

```

## Executing Stored Procedures

To run a stored procedure, set the query text to the procedure name:

```go

var account = "abc"
_, err := db.ExecContext(ctx, "sp_RunMe",
	sql.Named("ID", 123),
	sql.Named("Account", sql.Out{Dest: &account}),
)

```

## Reading Output Parameters from a Stored Procedure with Resultset

To read output parameters from a stored procedure with resultset, make sure you read all the rows before reading the output parameters:

```go

sqltextcreate := `
CREATE PROCEDURE spwithoutputandrows
	@bitparam BIT OUTPUT
AS BEGIN
	SET @bitparam = 1
	SELECT 'Row 1'
END
`
var bitout int64
rows, err := db.QueryContext(ctx, "spwithoutputandrows", sql.Named("bitparam", sql.Out{Dest: &bitout}))
var strrow string
for rows.Next() {
	err = rows.Scan(&strrow)
}
fmt.Printf("bitparam is %d", bitout)

```

## Caveat for local temporary tables

Due to protocol limitations, temporary tables will only be allocated on the connection
as a result of executing a query with zero parameters. The following query
will, due to the use of a parameter, execute in its own session,
and `#mytemp` will be de-allocated right away:

```go
conn, err := pool.Conn(ctx)
defer conn.Close()
_, err := conn.ExecContext(ctx, "select @p1 as x into #mytemp", 1)
// at this point #mytemp is already dropped again as the session of the ExecContext is over
```

To work around this, always explicitly create the local temporary
table in a query without any parameters. As a special case, the driver
will then be able to execute the query directly on the
connection-scoped session. The following example works:

```go
conn, err := pool.Conn(ctx)

// Set us up so that temp table is always cleaned up, since conn.Close()
// merely returns conn to pool, rather than actually closing the connection.
defer func() {
	_, _ = conn.ExecContext(ctx, "drop table #mytemp")  // always clean up
	conn.Close() // merely returns conn to pool
}()


// Since we not pass any parameters below, the query will execute on the scope of
// the connection and succeed in creating the table.
_, err := conn.ExecContext(ctx, "create table #mytemp ( x int )")

// #mytemp is now available even if you pass parameters
_, err := conn.ExecContext(ctx, "insert into #mytemp (x) values (@p1)", 1)

```

## Return Status

To get the procedure return status, pass into the parameters a
`*mssql.ReturnStatus`. For example:

```go

var rs mssql.ReturnStatus
_, err := db.ExecContext(ctx, "theproc", &rs)
log.Printf("status=%d", rs)

```

or

```go
var rs mssql.ReturnStatus
_, err := db.QueryContext(ctx, "theproc", &rs)
for rows.Next() {
	err = rows.Scan(&val)
}
log.Printf("status=%d", rs)

```

Limitation: ReturnStatus cannot be retrieved using `QueryRow`.

## Parameters

The `sqlserver` driver uses normal MS SQL Server syntax and expects parameters in
the sql query to be in the form of either `@Name` or `@p1` to `@pN` (ordinal position).

```go

db.QueryContext(ctx, `select * from t where ID = @ID and Name = @p2;`, sql.Named("ID", 6), "Bob")

```

### Parameter Types

To pass specific types to the query parameters, say `varchar` or `date` types,
you must convert the types to the type before passing in. The following types
are supported:

* string -> nvarchar
* mssql.VarChar -> varchar
* time.Time -> datetimeoffset or datetime (TDS version dependent)
* mssql.DateTime1 -> datetime
* mssql.DateTimeOffset -> datetimeoffset
* "github.com/golang-sql/civil".Date -> date
* "github.com/golang-sql/civil".DateTime -> datetime2
* "github.com/golang-sql/civil".Time -> time
* mssql.TVP -> Table Value Parameter (TDS version dependent)

Using an `int` parameter will send a 4 byte value (int) from a 32bit app and an 8 byte value (bigint) from a 64bit app. 
To make sure your integer parameter matches the size of the SQL parameter, use the appropriate sized type like `int32` or `int8`.

```go
// If this is passed directly as a parameter, 
// the SQL parameter generated would be nvarchar
name := "Bob"
// If the user_name is defined as varchar,
// it needs to be converted like this:
db.QueryContext(ctx, `select * from t2 where user_name = @p1;`, mssql.VarChar(name))
// Note: Mismatched data types on table and parameter may cause long running queries
```

## Using Always Encrypted

The protocol and cryptography details for AE are [detailed elsewhere](https://learn.microsoft.com/sql/relational-databases/security/encryption/always-encrypted-database-engine?view=sql-server-ver16).

### Enablement

To enable AE on a connection, set the `ColumnEncryption` value to true on a config or pass `columnencryption=true` in the connection string.

Decryption and encryption won't succeed, however, without also including a decryption key provider. To avoid code size impacts on non-AE applications, key providers are not included by default.

Include the local certificate providers:

```go
 import (
  "github.com/microsoft/go-mssqldb/aecmk/localcert"
 )
 ```

You can also instantiate a key provider directly in code and hand it to a `Connector` instance.

```go
c := mssql.NewConnectorConfig(myconfig)
c.RegisterCekProvider(providerName, MyProviderType{})
```

### Decryption

If the correct key provider is included in your application, decryption of encrypted cells happens automatically with no extra server round trips.

### Encryption

Encryption of parameters passed to `Exec` and `Query` variants requires an extra round trip per query to fetch the encryption metadata. If the error returned by a query attempt indicates a type mismatch between the parameter and the destination table, most likely your input type is not a strict match for the SQL Server data type of the destination. You may be using a Go `string` when you need to use one of the driver-specific aliases like `VarChar` or `NVarCharMax`.

*** NOTE *** - Currently `char` and `varchar` types do not include a collation parameter component so can't be used for inserting encrypted values. 
https://github.com/microsoft/go-mssqldb/issues/129


### Local certificate AE key provider

Key provider configuration is managed separately without any properties in the connection string.
The `pfx` provider exposes its instance as the variable `PfxKeyProvider`. You can give it passwords for certificates using `SetCertificatePassword(pathToCertificate, path)`. Use an empty string or `"*"` as the path to use the same password for all certificates.

The `MSSQL_CERTIFICATE_STORE` provider exposes its instance as the variable `WindowsCertificateStoreKeyProvider`.

Both providers can be constrained to an allowed list of encryption key paths by appending paths to `provider.AllowedLocations`.


### Azure Key Vault (AZURE_KEY_VAULT) key provider

Import this provider using `github.com/microsoft/go-mssqldb/aecmk/akv`

Constrain the provider to an allowed list of key vaults by appending vault host strings like "mykeyvault.vault.azure.net" to `akv.KeyProvider.AllowedLocations`.

## Important Notes


* [LastInsertId](https://golang.org/pkg/database/sql/#Result.LastInsertId) should
    not be used with this driver (or SQL Server) due to how the TDS protocol
 works. Please use the [OUTPUT Clause](https://docs.microsoft.com/en-us/sql/t-sql/queries/output-clause-transact-sql)
 or add a `select ID = convert(bigint, SCOPE_IDENTITY());` to the end of your
 query (ref [SCOPE_IDENTITY](https://docs.microsoft.com/en-us/sql/t-sql/functions/scope-identity-transact-sql)).
 This will ensure you are getting the correct ID and will prevent a network round trip.
* [NewConnector](https://godoc.org/github.com/microsoft/go-mssqldb#NewConnector)
    may be used with [OpenDB](https://golang.org/pkg/database/sql/#OpenDB).
* [Connector.SessionInitSQL](https://godoc.org/github.com/microsoft/go-mssqldb#Connector.SessionInitSQL)
 may be set to set any driver specific session settings after the session
 has been reset. If empty the session will still be reset but use the database
 defaults in Go1.10+.

## Features

* Can be used with SQL Server 2005 or newer
* Can be used with Microsoft Azure SQL Database
* Can be used on all go supported platforms (e.g. Linux, Mac OS X and Windows)
* Supports new date/time types: date, time, datetime2, datetimeoffset
* Supports string parameters longer than 8000 characters
* Supports encryption using SSL/TLS
* Supports SQL Server and Windows Authentication
* Supports Single-Sign-On on Windows
* Supports connections to AlwaysOn Availability Group listeners, including re-direction to read-only replicas.
* Supports query notifications
* Supports Kerberos Authentication
* Supports handling the `uniqueidentifier` data type with the `UniqueIdentifier` and `NullUniqueIdentifier` go types
* Pluggable Dialer implementations through `msdsn.ProtocolParsers` and `msdsn.ProtocolDialers`
* A `namedpipe` package to support connections using named pipes (np:) on Windows
* A `sharedmemory` package to support connections using shared memory (lpc:) on Windows
* Dedicated Administrator Connection (DAC) is supported using `admin` protocol
* Always Encrypted
  - `MSSQL_CERTIFICATE_STORE` provider on Windows
  - `pfx` provider on Linux and Windows

## Tests

`go test` is used for testing. A running instance of MSSQL server is required.
Environment variables are used to pass login information.

Example:

```bash
    env SQLSERVER_DSN=sqlserver://user:pass@hostname/instance?database=test1 go test
```

`AZURESERVER_DSN` environment variable provides the connection string for Azure Active Directory-based authentication. If it's not set the AAD test will be skipped.

## Deprecated

These features still exist in the driver, but they are are deprecated.

### Query Parameter Token Replace (driver "mssql")

If you use the driver name "mssql" (rather then "sqlserver") the SQL text
will be loosly parsed and an attempt to extract identifiers using one of

* ?
* ?nnn
* :nnn
* $nnn

will be used. This is not recommended with SQL Server.
There is at least one existing `won't fix` issue with the query parsing.

Use the native "@Name" parameters instead with the "sqlserver" driver name.

## Known Issues

* SQL Server 2008 and 2008 R2 engine cannot handle login records when SSL encryption is not disabled.
To fix SQL Server 2008 R2 issue, install SQL Server 2008 R2 Service Pack 2.
To fix SQL Server 2008 issue, install Microsoft SQL Server 2008 Service Pack 3 and Cumulative update package 3 for SQL Server 2008 SP3.
More information: <http://support.microsoft.com/kb/2653857>

* Bulk copy does not yet support encrypting column values using Always Encrypted. Tracked in [#127](https://github.com/microsoft/go-mssqldb/issues/127)

# Contributing
This project is a fork of [https://github.com/denisenkom/go-mssqldb](https://github.com/denisenkom/go-mssqldb) and welcomes new and previous contributors. For more informaton on contributing to this project, please see [Contributing](./CONTRIBUTING.md).

For more information on the roadmap for go-mssqldb, [project plans](https://github.com/microsoft/go-mssqldb/projects) are available for viewing and discussion.


# Microsoft Open Source Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).

Resources:

- [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/)
- [Microsoft Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/)
- Contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with questions or concerns
