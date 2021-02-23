go-sqlite3
==========

[![GoDoc Reference](https://godoc.org/github.com/mattn/go-sqlite3?status.svg)](http://godoc.org/github.com/mattn/go-sqlite3)
[![GitHub Actions](https://github.com/mattn/go-sqlite3/workflows/Go/badge.svg)](https://github.com/mattn/go-sqlite3/actions?query=workflow%3AGo)
[![Financial Contributors on Open Collective](https://opencollective.com/mattn-go-sqlite3/all/badge.svg?label=financial+contributors)](https://opencollective.com/mattn-go-sqlite3) 
[![codecov](https://codecov.io/gh/mattn/go-sqlite3/branch/master/graph/badge.svg)](https://codecov.io/gh/mattn/go-sqlite3)
[![Go Report Card](https://goreportcard.com/badge/github.com/mattn/go-sqlite3)](https://goreportcard.com/report/github.com/mattn/go-sqlite3)

Latest stable version is v1.14 or later not v2.

~~**NOTE:** The increase to v2 was an accident. There were no major changes or features.~~

# Description

sqlite3 driver conforming to the built-in database/sql interface

Supported Golang version: See [.github/workflows/go.yaml](./.github/workflows/go.yaml)

[This package follows the official Golang Release Policy.](https://golang.org/doc/devel/release.html#policy)

### Overview

- [go-sqlite3](#go-sqlite3)
- [Description](#description)
    - [Overview](#overview)
- [Installation](#installation)
- [API Reference](#api-reference)
- [Connection String](#connection-string)
  - [DSN Examples](#dsn-examples)
- [Features](#features)
    - [Usage](#usage)
    - [Feature / Extension List](#feature--extension-list)
- [Compilation](#compilation)
  - [Android](#android)
- [ARM](#arm)
- [Cross Compile](#cross-compile)
- [Google Cloud Platform](#google-cloud-platform)
  - [Linux](#linux)
    - [Alpine](#alpine)
    - [Fedora](#fedora)
    - [Ubuntu](#ubuntu)
  - [Mac OSX](#mac-osx)
  - [Windows](#windows)
  - [Errors](#errors)
- [User Authentication](#user-authentication)
  - [Compile](#compile)
  - [Usage](#usage-1)
    - [Create protected database](#create-protected-database)
    - [Password Encoding](#password-encoding)
      - [Available Encoders](#available-encoders)
    - [Restrictions](#restrictions)
    - [Support](#support)
    - [User Management](#user-management)
      - [SQL](#sql)
        - [Examples](#examples)
      - [*SQLiteConn](#sqliteconn)
    - [Attached database](#attached-database)
- [Extensions](#extensions)
  - [Spatialite](#spatialite)
- [FAQ](#faq)
- [License](#license)
- [Author](#author)

# Installation

This package can be installed with the go get command:

    go get github.com/mattn/go-sqlite3

_go-sqlite3_ is *cgo* package.
If you want to build your app using go-sqlite3, you need gcc.
However, after you have built and installed _go-sqlite3_ with `go install github.com/mattn/go-sqlite3` (which requires gcc), you can build your app without relying on gcc in future.

***Important: because this is a `CGO` enabled package you are required to set the environment variable `CGO_ENABLED=1` and have a `gcc` compile present within your path.***

# API Reference

API documentation can be found here: http://godoc.org/github.com/mattn/go-sqlite3

Examples can be found under the [examples](./_example) directory

# Connection String

When creating a new SQLite database or connection to an existing one, with the file name additional options can be given.
This is also known as a DSN string. (Data Source Name).

Options are append after the filename of the SQLite database.
The database filename and options are seperated by an `?` (Question Mark).
Options should be URL-encoded (see [url.QueryEscape](https://golang.org/pkg/net/url/#QueryEscape)).

This also applies when using an in-memory database instead of a file.

Options can be given using the following format: `KEYWORD=VALUE` and multiple options can be combined with the `&` ampersand.

This library supports dsn options of SQLite itself and provides additional options.

Boolean values can be one of:
* `0` `no` `false` `off`
* `1` `yes` `true` `on`

| Name | Key | Value(s) | Description |
|------|-----|----------|-------------|
| UA - Create | `_auth` | - | Create User Authentication, for more information see [User Authentication](#user-authentication) |
| UA - Username | `_auth_user` | `string` | Username for User Authentication, for more information see [User Authentication](#user-authentication) |
| UA - Password | `_auth_pass` | `string` | Password for User Authentication, for more information see [User Authentication](#user-authentication) |
| UA - Crypt | `_auth_crypt` | <ul><li>SHA1</li><li>SSHA1</li><li>SHA256</li><li>SSHA256</li><li>SHA384</li><li>SSHA384</li><li>SHA512</li><li>SSHA512</li></ul> | Password encoder to use for User Authentication, for more information see [User Authentication](#user-authentication) |
| UA - Salt | `_auth_salt` | `string` | Salt to use if the configure password encoder requires a salt, for User Authentication, for more information see [User Authentication](#user-authentication) |
| Auto Vacuum | `_auto_vacuum` \| `_vacuum` | <ul><li>`0` \| `none`</li><li>`1` \| `full`</li><li>`2` \| `incremental`</li></ul> | For more information see [PRAGMA auto_vacuum](https://www.sqlite.org/pragma.html#pragma_auto_vacuum) |
| Busy Timeout | `_busy_timeout` \| `_timeout` | `int` | Specify value for sqlite3_busy_timeout. For more information see [PRAGMA busy_timeout](https://www.sqlite.org/pragma.html#pragma_busy_timeout) |
| Case Sensitive LIKE | `_case_sensitive_like` \| `_cslike` | `boolean` | For more information see [PRAGMA case_sensitive_like](https://www.sqlite.org/pragma.html#pragma_case_sensitive_like) |
| Defer Foreign Keys | `_defer_foreign_keys` \| `_defer_fk` | `boolean` | For more information see [PRAGMA defer_foreign_keys](https://www.sqlite.org/pragma.html#pragma_defer_foreign_keys) |
| Foreign Keys | `_foreign_keys` \| `_fk` | `boolean` | For more information see [PRAGMA foreign_keys](https://www.sqlite.org/pragma.html#pragma_foreign_keys) |
| Ignore CHECK Constraints | `_ignore_check_constraints` | `boolean` | For more information see [PRAGMA ignore_check_constraints](https://www.sqlite.org/pragma.html#pragma_ignore_check_constraints) |
| Immutable | `immutable` | `boolean` | For more information see [Immutable](https://www.sqlite.org/c3ref/open.html) |
| Journal Mode | `_journal_mode` \| `_journal` | <ul><li>DELETE</li><li>TRUNCATE</li><li>PERSIST</li><li>MEMORY</li><li>WAL</li><li>OFF</li></ul> | For more information see [PRAGMA journal_mode](https://www.sqlite.org/pragma.html#pragma_journal_mode) |
| Locking Mode | `_locking_mode` \| `_locking` | <ul><li>NORMAL</li><li>EXCLUSIVE</li></ul> | For more information see [PRAGMA locking_mode](https://www.sqlite.org/pragma.html#pragma_locking_mode) |
| Mode | `mode` | <ul><li>ro</li><li>rw</li><li>rwc</li><li>memory</li></ul> | Access Mode of the database. For more information see [SQLite Open](https://www.sqlite.org/c3ref/open.html) |
| Mutex Locking | `_mutex` | <ul><li>no</li><li>full</li></ul> | Specify mutex mode. |
| Query Only | `_query_only` | `boolean` | For more information see [PRAGMA query_only](https://www.sqlite.org/pragma.html#pragma_query_only) |
| Recursive Triggers | `_recursive_triggers` \| `_rt` | `boolean` | For more information see [PRAGMA recursive_triggers](https://www.sqlite.org/pragma.html#pragma_recursive_triggers) |
| Secure Delete | `_secure_delete` | `boolean` \| `FAST` | For more information see [PRAGMA secure_delete](https://www.sqlite.org/pragma.html#pragma_secure_delete) |
| Shared-Cache Mode | `cache` | <ul><li>shared</li><li>private</li></ul> | Set cache mode for more information see [sqlite.org](https://www.sqlite.org/sharedcache.html) |
| Synchronous | `_synchronous` \| `_sync` | <ul><li>0 \| OFF</li><li>1 \| NORMAL</li><li>2 \| FULL</li><li>3 \| EXTRA</li></ul> | For more information see [PRAGMA synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous) |
| Time Zone Location | `_loc` | auto | Specify location of time format. |
| Transaction Lock | `_txlock` | <ul><li>immediate</li><li>deferred</li><li>exclusive</li></ul> | Specify locking behavior for transactions. |
| Writable Schema | `_writable_schema` | `Boolean` | When this pragma is on, the SQLITE_MASTER tables in which database can be changed using ordinary UPDATE, INSERT, and DELETE statements. Warning: misuse of this pragma can easily result in a corrupt database file. |
| Cache Size | `_cache_size` | `int` | Maximum cache size; default is 2000K (2M). See [PRAGMA cache_size](https://sqlite.org/pragma.html#pragma_cache_size) |


## DSN Examples

```
file:test.db?cache=shared&mode=memory
```

# Features

This package allows additional configuration of features available within SQLite3 to be enabled or disabled by golang build constraints also known as build `tags`.

[Click here for more information about build tags / constraints.](https://golang.org/pkg/go/build/#hdr-Build_Constraints)

### Usage

If you wish to build this library with additional extensions / features.
Use the following command.

```bash
go build --tags "<FEATURE>"
```

For available features see the extension list.
When using multiple build tags, all the different tags should be space delimted.

Example:

```bash
go build --tags "icu json1 fts5 secure_delete"
```

### Feature / Extension List

| Extension | Build Tag | Description |
|-----------|-----------|-------------|
| Additional Statistics | sqlite_stat4 | This option adds additional logic to the ANALYZE command and to the query planner that can help SQLite to chose a better query plan under certain situations. The ANALYZE command is enhanced to collect histogram data from all columns of every index and store that data in the sqlite_stat4 table.<br><br>The query planner will then use the histogram data to help it make better index choices. The downside of this compile-time option is that it violates the query planner stability guarantee making it more difficult to ensure consistent performance in mass-produced applications.<br><br>SQLITE_ENABLE_STAT4 is an enhancement of SQLITE_ENABLE_STAT3. STAT3 only recorded histogram data for the left-most column of each index whereas the STAT4 enhancement records histogram data from all columns of each index.<br><br>The SQLITE_ENABLE_STAT3 compile-time option is a no-op and is ignored if the SQLITE_ENABLE_STAT4 compile-time option is used |
| Allow URI Authority | sqlite_allow_uri_authority | URI filenames normally throws an error if the authority section is not either empty or "localhost".<br><br>However, if SQLite is compiled with the SQLITE_ALLOW_URI_AUTHORITY compile-time option, then the URI is converted into a Uniform Naming Convention (UNC) filename and passed down to the underlying operating system that way |
| App Armor | sqlite_app_armor | When defined, this C-preprocessor macro activates extra code that attempts to detect misuse of the SQLite API, such as passing in NULL pointers to required parameters or using objects after they have been destroyed. <br><br>App Armor is not available under `Windows`. |
| Disable Load Extensions | sqlite_omit_load_extension | Loading of external extensions is enabled by default.<br><br>To disable extension loading add the build tag `sqlite_omit_load_extension`. |
| Foreign Keys | sqlite_foreign_keys | This macro determines whether enforcement of foreign key constraints is enabled or disabled by default for new database connections.<br><br>Each database connection can always turn enforcement of foreign key constraints on and off and run-time using the foreign_keys pragma.<br><br>Enforcement of foreign key constraints is normally off by default, but if this compile-time parameter is set to 1, enforcement of foreign key constraints will be on by default | 
| Full Auto Vacuum | sqlite_vacuum_full | Set the default auto vacuum to full |
| Incremental Auto Vacuum | sqlite_vacuum_incr | Set the default auto vacuum to incremental |
| Full Text Search Engine | sqlite_fts5 | When this option is defined in the amalgamation, versions 5 of the full-text search engine (fts5) is added to the build automatically |
|  International Components for Unicode | sqlite_icu | This option causes the International Components for Unicode or "ICU" extension to SQLite to be added to the build |
| Introspect PRAGMAS | sqlite_introspect | This option adds some extra PRAGMA statements. <ul><li>PRAGMA function_list</li><li>PRAGMA module_list</li><li>PRAGMA pragma_list</li></ul> |
| JSON SQL Functions | sqlite_json | When this option is defined in the amalgamation, the JSON SQL functions are added to the build automatically |
| Pre Update Hook | sqlite_preupdate_hook | Registers a callback function that is invoked prior to each INSERT, UPDATE, and DELETE operation on a database table. |
| Secure Delete | sqlite_secure_delete | This compile-time option changes the default setting of the secure_delete pragma.<br><br>When this option is not used, secure_delete defaults to off. When this option is present, secure_delete defaults to on.<br><br>The secure_delete setting causes deleted content to be overwritten with zeros. There is a small performance penalty since additional I/O must occur.<br><br>On the other hand, secure_delete can prevent fragments of sensitive information from lingering in unused parts of the database file after it has been deleted. See the documentation on the secure_delete pragma for additional information |
| Secure Delete (FAST) | sqlite_secure_delete_fast | For more information see [PRAGMA secure_delete](https://www.sqlite.org/pragma.html#pragma_secure_delete) |
| Tracing / Debug | sqlite_trace | Activate trace functions |
| User Authentication | sqlite_userauth | SQLite User Authentication see [User Authentication](#user-authentication) for more information. |

# Compilation

This package requires `CGO_ENABLED=1` ennvironment variable if not set by default, and the presence of the `gcc` compiler.

If you need to add additional CFLAGS or LDFLAGS to the build command, and do not want to modify this package. Then this can be achieved by  using the `CGO_CFLAGS` and `CGO_LDFLAGS` environment variables.

## Android

This package can be compiled for android.
Compile with:

```bash
go build --tags "android"
```

For more information see [#201](https://github.com/mattn/go-sqlite3/issues/201)

# ARM

To compile for `ARM` use the following environment.

```bash
env CC=arm-linux-gnueabihf-gcc CXX=arm-linux-gnueabihf-g++ \
    CGO_ENABLED=1 GOOS=linux GOARCH=arm GOARM=7 \
    go build -v 
```

Additional information:
- [#242](https://github.com/mattn/go-sqlite3/issues/242)
- [#504](https://github.com/mattn/go-sqlite3/issues/504)

# Cross Compile

This library can be cross-compiled.

In some cases you are required to the `CC` environment variable with the cross compiler.

## Cross Compiling from MAC OSX
The simplest way to cross compile from OSX is to use [xgo](https://github.com/karalabe/xgo).

Steps:
- Install [xgo](https://github.com/karalabe/xgo) (`go get github.com/karalabe/xgo`).
- Ensure that your project is within your `GOPATH`.
- Run `xgo local/path/to/project`.

Please refer to the project's [README](https://github.com/karalabe/xgo/blob/master/README.md) for further information.

# Google Cloud Platform

Building on GCP is not possible because Google Cloud Platform does not allow `gcc` to be executed.

Please work only with compiled final binaries.

## Linux

To compile this package on Linux you must install the development tools for your linux distribution.

To compile under linux use the build tag `linux`.

```bash
go build --tags "linux"
```

If you wish to link directly to libsqlite3 then you can use the `libsqlite3` build tag.

```
go build --tags "libsqlite3 linux"
```

### Alpine

When building in an `alpine` container run the following command before building.

```
apk add --update gcc musl-dev
```

### Fedora

```bash
sudo yum groupinstall "Development Tools" "Development Libraries"
```

### Ubuntu

```bash
sudo apt-get install build-essential
```

## Mac OSX

OSX should have all the tools present to compile this package, if not install XCode this will add all the developers tools.

Required dependency

```bash
brew install sqlite3
```

For OSX there is an additional package install which is required if you wish to build the `icu` extension.

This additional package can be installed with `homebrew`.

```bash
brew upgrade icu4c
```

To compile for Mac OSX.

```bash
go build --tags "darwin"
```

If you wish to link directly to libsqlite3 then you can use the `libsqlite3` build tag.

```
go build --tags "libsqlite3 darwin"
```

Additional information:
- [#206](https://github.com/mattn/go-sqlite3/issues/206)
- [#404](https://github.com/mattn/go-sqlite3/issues/404)

## Windows

To compile this package on Windows OS you must have the `gcc` compiler installed.

1) Install a Windows `gcc` toolchain.
2) Add the `bin` folders to the Windows path if the installer did not do this by default.
3) Open a terminal for the TDM-GCC toolchain, can be found in the Windows Start menu.
4) Navigate to your project folder and run the `go build ...` command for this package.

For example the TDM-GCC Toolchain can be found [here](https://sourceforge.net/projects/tdm-gcc/).

## Errors

- Compile error: `can not be used when making a shared object; recompile with -fPIC`

    When receiving a compile time error referencing recompile with `-FPIC` then you
    are probably using a hardend system.

    You can compile the library on a hardend system with the following command.

    ```bash
    go build -ldflags '-extldflags=-fno-PIC'
    ```

    More details see [#120](https://github.com/mattn/go-sqlite3/issues/120)

- Can't build go-sqlite3 on windows 64bit.

    > Probably, you are using go 1.0, go1.0 has a problem when it comes to compiling/linking on windows 64bit.
    > See: [#27](https://github.com/mattn/go-sqlite3/issues/27)

- `go get github.com/mattn/go-sqlite3` throws compilation error.

    `gcc` throws: `internal compiler error`

    Remove the download repository from your disk and try re-install with:

    ```bash
    go install github.com/mattn/go-sqlite3
    ```

# User Authentication

This package supports the SQLite User Authentication module.

## Compile

To use the User authentication module the package has to be compiled with the tag `sqlite_userauth`. See [Features](#features).

## Usage

### Create protected database

To create a database protected by user authentication provide the following argument to the connection string `_auth`.
This will enable user authentication within the database. This option however requires two additional arguments:

- `_auth_user`
- `_auth_pass`

When `_auth` is present on the connection string user authentication will be enabled and the provided user will be created
as an `admin` user. After initial creation, the parameter `_auth` has no effect anymore and can be omitted from the connection string.

Example connection string:

Create an user authentication database with user `admin` and password `admin`.

`file:test.s3db?_auth&_auth_user=admin&_auth_pass=admin`

Create an user authentication database with user `admin` and password `admin` and use `SHA1` for the password encoding.

`file:test.s3db?_auth&_auth_user=admin&_auth_pass=admin&_auth_crypt=sha1`

### Password Encoding

The passwords within the user authentication module of SQLite are encoded with the SQLite function `sqlite_cryp`.
This function uses a ceasar-cypher which is quite insecure.
This library provides several additional password encoders which can be configured through the connection string.

The password cypher can be configured with the key `_auth_crypt`. And if the configured password encoder also requires an
salt this can be configured with `_auth_salt`.

#### Available Encoders

- SHA1
- SSHA1 (Salted SHA1)
- SHA256
- SSHA256 (salted SHA256)
- SHA384
- SSHA384 (salted SHA384)
- SHA512
- SSHA512 (salted SHA512)

### Restrictions

Operations on the database regarding to user management can only be preformed by an administrator user.

### Support

The user authentication supports two kinds of users

- administrators
- regular users

### User Management

User management can be done by directly using the `*SQLiteConn` or by SQL.

#### SQL

The following sql functions are available for user management.

| Function | Arguments | Description |
|----------|-----------|-------------|
| `authenticate` | username `string`, password `string` | Will authenticate an user, this is done by the connection; and should not be used manually. |
| `auth_user_add` | username `string`, password `string`, admin `int` | This function will add an user to the database.<br>if the database is not protected by user authentication it will enable it. Argument `admin` is an integer identifying if the added user should be an administrator. Only Administrators can add administrators. |
| `auth_user_change` | username `string`, password `string`, admin `int` | Function to modify an user. Users can change their own password, but only an administrator can change the administrator flag. |
| `authUserDelete` | username `string` | Delete an user from the database. Can only be used by an administrator. The current logged in administrator cannot be deleted. This is to make sure their is always an administrator remaining. |

These functions will return an integer.

- 0 (SQLITE_OK)
- 23 (SQLITE_AUTH) Failed to perform due to authentication or insufficient privileges

##### Examples

```sql
// Autheticate user
// Create Admin User
SELECT auth_user_add('admin2', 'admin2', 1);

// Change password for user
SELECT auth_user_change('user', 'userpassword', 0);

// Delete user
SELECT user_delete('user');
```

#### *SQLiteConn

The following functions are available for User authentication from the `*SQLiteConn`.

| Function | Description |
|----------|-------------|
| `Authenticate(username, password string) error` | Authenticate user |
| `AuthUserAdd(username, password string, admin bool) error` | Add user |
| `AuthUserChange(username, password string, admin bool) error` | Modify user |
| `AuthUserDelete(username string) error` | Delete user |

### Attached database

When using attached databases. SQLite will use the authentication from the `main` database for the attached database(s).

# Extensions

If you want your own extension to be listed here or you want to add a reference to an extension; please submit an Issue for this.

## Spatialite

Spatialite is available as an extension to SQLite, and can be used in combination with this repository.
For an example see [shaxbee/go-spatialite](https://github.com/shaxbee/go-spatialite).

## extension-functions.c from SQLite3 Contrib

extension-functions.c is available as an extension to SQLite, and provides the following functions:

- Math: acos, asin, atan, atn2, atan2, acosh, asinh, atanh, difference, degrees, radians, cos, sin, tan, cot, cosh, sinh, tanh, coth, exp, log, log10, power, sign, sqrt, square, ceil, floor, pi.
- String: replicate, charindex, leftstr, rightstr, ltrim, rtrim, trim, replace, reverse, proper, padl, padr, padc, strfilter.
- Aggregate: stdev, variance, mode, median, lower_quartile, upper_quartile

For an example see [dinedal/go-sqlite3-extension-functions](https://github.com/dinedal/go-sqlite3-extension-functions).

# FAQ

- Getting insert error while query is opened.

    > You can pass some arguments into the connection string, for example, a URI.
    > See: [#39](https://github.com/mattn/go-sqlite3/issues/39)

- Do you want to cross compile? mingw on Linux or Mac?

    > See: [#106](https://github.com/mattn/go-sqlite3/issues/106)
    > See also: http://www.limitlessfx.com/cross-compile-golang-app-for-windows-from-linux.html

- Want to get time.Time with current locale

    Use `_loc=auto` in SQLite3 filename schema like `file:foo.db?_loc=auto`.

- Can I use this in multiple routines concurrently?

    Yes for readonly. But, No for writable. See [#50](https://github.com/mattn/go-sqlite3/issues/50), [#51](https://github.com/mattn/go-sqlite3/issues/51), [#209](https://github.com/mattn/go-sqlite3/issues/209), [#274](https://github.com/mattn/go-sqlite3/issues/274).

- Why I'm getting `no such table` error?

    Why is it racy if I use a `sql.Open("sqlite3", ":memory:")` database?

    Each connection to `":memory:"` opens a brand new in-memory sql database, so if
    the stdlib's sql engine happens to open another connection and you've only
    specified `":memory:"`, that connection will see a brand new database. A
    workaround is to use `"file::memory:?cache=shared"` (or `"file:foobar?mode=memory&cache=shared"`). Every
    connection to this string will point to the same in-memory database.
    
    Note that if the last database connection in the pool closes, the in-memory database is deleted. Make sure the [max idle connection limit](https://golang.org/pkg/database/sql/#DB.SetMaxIdleConns) is > 0, and the [connection lifetime](https://golang.org/pkg/database/sql/#DB.SetConnMaxLifetime) is infinite.
    
    For more information see
    * [#204](https://github.com/mattn/go-sqlite3/issues/204)
    * [#511](https://github.com/mattn/go-sqlite3/issues/511)
    * https://www.sqlite.org/sharedcache.html#shared_cache_and_in_memory_databases
    * https://www.sqlite.org/inmemorydb.html#sharedmemdb

- Reading from database with large amount of goroutines fails on OSX.

    OS X limits OS-wide to not have more than 1000 files open simultaneously by default.

    For more information see [#289](https://github.com/mattn/go-sqlite3/issues/289)

- Trying to execute a `.` (dot) command throws an error.

    Error: `Error: near ".": syntax error`
    Dot command are part of SQLite3 CLI not of this library.

    You need to implement the feature or call the sqlite3 cli.

    More information see [#305](https://github.com/mattn/go-sqlite3/issues/305)

- Error: `database is locked`

    When you get a database is locked. Please use the following options.

    Add to DSN: `cache=shared`

    Example:
    ```go
    db, err := sql.Open("sqlite3", "file:locked.sqlite?cache=shared")
    ```

    Second please set the database connections of the SQL package to 1.
    
    ```go
    db.SetMaxOpenConns(1)
    ```

    More information see [#209](https://github.com/mattn/go-sqlite3/issues/209)

## Contributors

### Code Contributors

This project exists thanks to all the people who contribute. [[Contribute](CONTRIBUTING.md)].
<a href="https://github.com/mattn/go-sqlite3/graphs/contributors"><img src="https://opencollective.com/mattn-go-sqlite3/contributors.svg?width=890&button=false" /></a>

### Financial Contributors

Become a financial contributor and help us sustain our community. [[Contribute](https://opencollective.com/mattn-go-sqlite3/contribute)]

#### Individuals

<a href="https://opencollective.com/mattn-go-sqlite3"><img src="https://opencollective.com/mattn-go-sqlite3/individuals.svg?width=890"></a>

#### Organizations

Support this project with your organization. Your logo will show up here with a link to your website. [[Contribute](https://opencollective.com/mattn-go-sqlite3/contribute)]

<a href="https://opencollective.com/mattn-go-sqlite3/organization/0/website"><img src="https://opencollective.com/mattn-go-sqlite3/organization/0/avatar.svg"></a>
<a href="https://opencollective.com/mattn-go-sqlite3/organization/1/website"><img src="https://opencollective.com/mattn-go-sqlite3/organization/1/avatar.svg"></a>
<a href="https://opencollective.com/mattn-go-sqlite3/organization/2/website"><img src="https://opencollective.com/mattn-go-sqlite3/organization/2/avatar.svg"></a>
<a href="https://opencollective.com/mattn-go-sqlite3/organization/3/website"><img src="https://opencollective.com/mattn-go-sqlite3/organization/3/avatar.svg"></a>
<a href="https://opencollective.com/mattn-go-sqlite3/organization/4/website"><img src="https://opencollective.com/mattn-go-sqlite3/organization/4/avatar.svg"></a>
<a href="https://opencollective.com/mattn-go-sqlite3/organization/5/website"><img src="https://opencollective.com/mattn-go-sqlite3/organization/5/avatar.svg"></a>
<a href="https://opencollective.com/mattn-go-sqlite3/organization/6/website"><img src="https://opencollective.com/mattn-go-sqlite3/organization/6/avatar.svg"></a>
<a href="https://opencollective.com/mattn-go-sqlite3/organization/7/website"><img src="https://opencollective.com/mattn-go-sqlite3/organization/7/avatar.svg"></a>
<a href="https://opencollective.com/mattn-go-sqlite3/organization/8/website"><img src="https://opencollective.com/mattn-go-sqlite3/organization/8/avatar.svg"></a>
<a href="https://opencollective.com/mattn-go-sqlite3/organization/9/website"><img src="https://opencollective.com/mattn-go-sqlite3/organization/9/avatar.svg"></a>

# License

MIT: http://mattn.mit-license.org/2018

sqlite3-binding.c, sqlite3-binding.h, sqlite3ext.h

The -binding suffix was added to avoid build failures under gccgo.

In this repository, those files are an amalgamation of code that was copied from SQLite3. The license of that code is the same as the license of SQLite3.

# Author

Yasuhiro Matsumoto (a.k.a mattn)

G.J.R. Timmer
