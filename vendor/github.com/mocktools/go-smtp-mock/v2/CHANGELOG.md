# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.1] - 2025-06-24

### Added

- Added [ability to use special characters in email regex pattern](https://github.com/mocktools/go-smtp-mock/pull/207)

## [2.5.0] - 2025-05-31

### Added

- Added [ability to use a custom logger](https://github.com/mocktools/go-smtp-mock/issues/171), `WithLogger()` method. Thanks [@Hsn723](https://github.com/Hsn723) for PR

## [2.4.0] - 2024-11-21

### Added

- Added [ability to wait for the specified number of messages to arrive or until timeout is reached](https://github.com/mocktools/go-smtp-mock/issues/181), `WaitForMessages()` and `WaitForMessagesAndPurge()` methods

### Updated

- Updated project documentation

## [2.3.3] - 2024-11-17

### Fixed

- Fixed issue with [invalid name with email address parsing](https://github.com/mocktools/go-smtp-mock/issues/153) for `MAIL FROM` and `RCPT TO` commands
- Fixed flaky tests

### Updated

- Updated `cmd` namespace
- Updated `goreleaser` config

## [2.3.2] - 2024-11-14

### Fixed

- Fixed issue with [invalid email address parsing](https://github.com/mocktools/go-smtp-mock/issues/135) for `MAIL FROM` and `RCPT TO` commands

## [2.3.1] - 2024-08-04

### Updated

- Updated development dependencies
- Updated `circleci` config

## [2.3.0] - 2024-03-03

### Added

- Added ability to message purge when retrieving messages, `server.MessagesAndPurge()`. Thanks [@mitar](https://github.com/mitar) for PR
- Added `commitspell` linter

### Fixed

- Fixed issue with data race condition between newMessage() and Messages(). Thanks [@mitar](https://github.com/mitar) for PR

### Updated

- Updated `lefthook` config
- Updated project documentation

## [2.2.1] - 2024-01-25

### Added

- Added release build for ARM x64 architecture family

## [2.2.0] - 2023-12-27

### Added

- Added ability to use `localhost` as valid domain name for `MAIL FROM` and `RCPT TO` commands. Thanks [@Deracination](https://github.com/Deracination) for request

## [2.1.0] - 2023-06-14

### Added

- Added ability to use `NOOP` command, following [RFC 2821](https://datatracker.ietf.org/doc/html/rfc2821#section-4.1.1.9) (section 4.1.1.9). Thanks [@rehleinBo](https://github.com/rehleinBo) for PR

## [2.0.5] - 2023-01-11

### Updated

- Updated `CI` scripts (tag/release)
- Updated download script

## [2.0.4] - 2023-01-03

### Updated

- Updated `CircleCI` config (fixed issue with deploy config location)

## [2.0.3] - 2023-01-03

### Added

- Added `CI` tagging script

### Updated

- Updated `CI` releasing script
- Updated `CircleCI` config
- Updated package deployment flow

## [2.0.2] - 2022-12-10

### Added

- Added [`cspell`](https://cspell.org) linter
- Added [`markdownlint`](https://github.com/DavidAnson/markdownlint) linter
- Added [`shellcheck`](https://www.shellcheck.net) linter
- Added [`yamllint`](https://yamllint.readthedocs.io) linter
- Added [`lefthook`](https://github.com/evilmartians/lefthook) linters aggregator

### Fixed

- Fixed typos in project's codebase
- Fixed new project's linter issues

### Updated

- Updated `CircleCI` config

## [2.0.1] - 2022-11-18

### Fixed

- Fixed wrong link for `ldflags` in `goreleaser` config

## [2.0.0] - 2022-11-16

### Added

- Added ability to use multiple `RCPT TO` commands during one SMTP session, following [RFC 2821](https://datatracker.ietf.org/doc/html/rfc2821#section-4.1.1.3) (section 4.1.1.3). Thanks [@dandare100](https://github.com/dandare100) for request and provided examples
- Added `ConfigurationAttr#MultipleRcptto`, `configuration#multipleRcptto`, tests
- Added `Message#rcpttoRequestResponse`, `Message#isIncludesSuccessfulRcpttoResponse()`, tests
- Added `handlerRcptto#resolveMessageStatus()`, tests
- Added `Message` public methods, tests
- Added `Server` thread-safe getters/setters, tests

### Fixed

- Fixed race conditions with R/W lock in `Server`. Thanks [@benjamin-rood](https://github.com/benjamin-rood) for [report](https://github.com/mocktools/go-smtp-mock/issues/124) and [pull request](https://github.com/mocktools/go-smtp-mock/pull/125)
- Fixed race conditions with R/W lock in `Message`

### Removed

- Removed `Message#rcpttoRequest`, `Message#rcpttoResponse`
- Removed `&Message` public methods

### Updated

- Updated `handlerRcptto#clearMessage()`, `handlerRcptto#writeResult()`, `handlerData#clearMessage()`, tests
- Updated Go reference trigger script
- Updated `Server#Messages()`, returns slice of `Message` instead `&Message`
- Updated CircleCI config, added checking for race conditions step
- Updated project documentation

## [1.10.0] - 2022-09-09

### Added

- Ability to use address literal as `HELO` command args, following [RFC 5321](https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.1) (section 4.1.1.1). Thanks [@dandare100](https://github.com/dandare100) for investigation, report and brilliant PR.

### Updated

- Updated consts
- Updated `handlerHelo` tests
- Updated project documentation

## [1.9.3] - 2022-09-08

### Updated

- Updated Go reference trigger script

## [1.9.2] - 2022-09-08

### Added

- Ability to trigger Go reference

### Updated

- Updated CircleCI config

### Removed

- Removed `yaml.v3` indirect development dependency

## [1.9.1] - 2022-09-05

### Added

- Added `Server#isAbleToEndSession`, tests

### Updated

- Updated `message` to exported struct `Message`
- Updated `Server#handleSession`
- Updated test helpers
- Updated `golangci`/`circleci` configs

### Fixed

- Fixed project's code smells issues

## [1.9.0] - 2022-07-12

### Added

- Ability to use `RSET` SMTP command, following [RFC 821](https://www.rfc-editor.org/rfc/rfc821)
- Ability to configure multiple message receiving flow during one session. Thanks [@Pointer666](https://github.com/Pointer666) for report.

### Updated

- Updated `server`, tests
- Updated `message`, tests
- Updated `configuration`, `configurationAttr`, tests
- Updated command handlers, tests
- Updated cmd, consts
- Updated package documentation, changelog

### Removed

- Removed `message#cleared`, `message#isCleared?()`

## [1.8.1] - 2022-05-26

### Fixed

- Updated `yaml.v3` indirect dependency. An issue in the `Unmarshal` function in Go-Yaml v3 causes the program to crash when attempting to deserialize invalid input, [CVE-2022-28948](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2022-28948)

## [1.8.0] - 2022-04-25

### Added

- Ability to access to server messages

### Updated

- Updated package documentation

## [1.7.0] - 2022-02-22

### Added

- Ability to specify session response delay for each SMTP command

### Updated

- Updated `configuration`, `ConfigurationAttr` tests
- Updated consts
- Updated `session` structure methods, tests
- Updated `server#handleSession`, tests
- Updated `handlerHelo#writeResult`, tests
- Updated `handlerMailfrom#writeResult`, tests
- Updated `handlerRcptto#writeResult`, tests
- Updated `handlerData#writeResult`, tests
- Updated `handlerMessage#writeResult`, tests
- Updated `handlerQuit#writeResult`, tests
- Updated `main.attrFromCommandLine()`, tests
- Updated package documentation

## [1.6.0] - 2022-02-21

### Added

- Ability to shutdown `smtpmock` server with `SIGQUIT`

### Updated

- Updated package documentation

## [1.5.2] - 2022-01-29

### Updated

- Updated package documentation

## [1.5.1] - 2022-01-29

### Fixed

- Fixed version data sequence in `printVersionData()`

### Updated

- Updated package documentation

## [1.5.0] - 2022-01-28

### Added

- Added build data (version, commit, built at time) for compiled `smtpmock` binary
- Added `-v` flag

### Updated

- Updated `goreleaser` config
- Updated package documentation

## [1.4.2] - 2022-01-03

### Updated

- Updated bash script for downloading latest release

## [1.4.1] - 2022-01-02

### Added

- Added bash script for downloading latest release

### Updated

- Updated release binary package signature
- Updated package documentation

## [1.4.0] - 2021-12-20

### Added

- Implemented ability to do force stop by timeout

### Updated

- Updated `configuration`, tests
- Updated `server`, tests
- Updated `main`, tests
- Updated consts, package documentation

## [1.3.5] - 2021-12-16

### Updated

- Updated CircleCI config
- Updated `goreleaser` config

## [1.3.4] - 2021-12-16

### Updated

- Updated CircleCI config

## [1.3.3] - 2021-12-16

### Updated

- Updated CircleCI config

## [1.3.2] - 2021-12-16

### Updated

- Updated CircleCI config

## [1.3.1] - 2021-12-16

### Added

- Added `goreleaser` config

## [1.3.0] - 2021-12-16

### Added

- Added ability to run `smtpmock` as service
- Implemented package main, tests

### Fixed

- Fixed documentation issues. Thanks [@vpakhuchyi](https://github.com/vpakhuchyi) for report and PR.
- Fixed `MsgSizeLimit`, `msgSizeLimit` typo in fields naming. Thanks [@vanyavasylyshyn](https://github.com/vanyavasylyshyn) for report.
- Fixed project github templates

### Updated

- Updated CircleCI config
- Updated package documentation

## [1.2.0] - 2021-12-13

### Added

- Added ability to use localhost as valid `HELO` domain. Thanks [@lesichkovm](https://github.com/lesichkovm) for report.

### Changed

- Updated `handlerHelo#heloDomain`, tests
- Updated consts
- Updated package docs

## [1.1.0] - 2021-12-11

### Changed

- Updated default negative SMTP command responses follows to RFC
- Updated `ConfigurationAttr` methods, tests

## [1.0.1] - 2021-12-10

### Fixed

- Fixed `ConfigurationAttr` unexported fields issue

### Changed

- Updated package documentation

## [1.0.0] - 2021-12-07

### Added

- Added ability to assign random SMTP port number by OS as default settings
- Added `Server.PortNumber` field

### Changed

- Updated`Server#Start` method, tests
- Refactored `ConfigurationAttr#assignDefaultValues` method
- Updated `ConfigurationAttr#assignServerDefaultValues` method, tests
- Updated package docs
- Updated linters config

### Removed

- Removed `defaultPortNuber`

## [0.1.2] - 2021-12-03

### Changed

- Updated functions/structures/consts scopes
- Updated linters config
- Updated CircleCI config

### Fixed

- Linters issues

## [0.1.1] - 2021-11-30

### Fixed

- Fixed typos, linter warnings

## [0.1.0] - 2021-11-30

### Added

- First release of `smtpmock`. Thanks [@le0pard](https://github.com/le0pard) for support 🚀
