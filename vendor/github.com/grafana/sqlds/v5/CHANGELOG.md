# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.0.2]

### Changed
- Hash connectionArgs when used as cache key (#199)

## [5.0.1]

### Dependencies
- Bumped github.com/grafana/grafana-plugin-sdk-go (#192)

## [5.0.0]

### Added
- Added QueryErrorMutator (#190)

### Changed
- **Breaking change** IsPGXConnectionError has been removed. Removed PGX v5/PostgreSQL-specific error detection (#190)

## [4.2.7]

### Changed
- Fix error source in QueryData (#180)

## [4.2.6]

### Changed
- Pass down Context to Ping method (#179)

## [4.2.5]

### Changed
- Improved error handling (#177)

## [4.2.4]

### Changed
- Improved panic error recovery (#176)

### Dependencies
- Bumped github.com/grafana/grafana-plugin-sdk-go (#175)
- Bumped github.com/go-sql-driver/mysql in the all-go-dependencies group (#174)

## [4.2.3]

### Added
- Added panic recovery mechanism (#173)

### Dependencies
- Bumped github.com/grafana/grafana-plugin-sdk-go (#171)
- Bumped actions/setup-go in the all-github-action-dependencies group (#172)

### Infrastructure
- Updated workflows (#170)

## [4.2.2]

### Dependencies
- Bumped the all-go-dependencies group with 2 updates (#167)
- Bumped golang.org/x/net from 0.36.0 to 0.38.0 in the go_modules group (#168)
- Bumped github.com/go-sql-driver/mysql in the all-go-dependencies group (#166)
- Bumped the all-go-dependencies group across 1 directory with 2 updates (#164)

## [4.2.1]

### Added
- Made row limit configurable (#165)

## [4.2.0]

### Added
- Enabled dataproxy.row_limit configuration option from Grafana (#162)

### Dependencies
- Bumped the all-go-dependencies group with 2 updates (#160)
- Bumped golang.org/x/net from 0.35.0 to 0.36.0 in the go_modules group (#161)
- Bumped the all-go-dependencies group across 1 directory with 4 updates (#159)
- Bumped github.com/grafana/grafana-plugin-sdk-go (#157)
- Bumped github.com/grafana/grafana-plugin-sdk-go from 0.263.0 to 0.265.0 (#155)
- Bumped grafana-plugin-sdk-go and removed experimental error source (#153)

## [4.1.7]

### Fixed
- Fixed: return error if not nil when connecting (#151)

### Dependencies
- Bumped x/net to v0.33.0 (#150)
- Bumped github.com/grafana/grafana-plugin-sdk-go (#149)

## [4.1.6]

### Dependencies
- Bumped golang.org/x/crypto from 0.29.0 to 0.31.0 in the go_modules group (#148)
- Bumped github.com/grafana/grafana-plugin-sdk-go (#146)
- Bumped the all-go-dependencies group with 2 updates (#145)
- Bumped github.com/grafana/grafana-plugin-sdk-go (#144)

## [4.1.5]

### Added
- Added pre and post health check methods (#147)

### Dependencies
- Bumped golang.org/x/crypto from 0.29.0 to 0.31.0 in the go_modules group (#148)
- Bumped github.com/grafana/grafana-plugin-sdk-go (#146)
- Bumped the all-go-dependencies group with 2 updates (#145)
- Bumped github.com/grafana/grafana-plugin-sdk-go (#144)

## [4.1.4]

### Fixed
- Fixed error source coming from getFrames function (#142)
- Fixed mistyped macros being incorrectly reported as plugin error (#141)

### Infrastructure
- Migrated from Drone to GitHub Actions (#143)

## [4.1.3]

### Fixed
- Fixed: mark incorrect macros arguments error as downstream (#140)
- Fixed: implement InstanceDisposer to close db connections (#136)

### Dependencies
- Updated dependencies and added Dependabot configuration (#138)

### Infrastructure
- Bumped actions/checkout in the all-github-action-dependencies group (#139)

## [4.1.2]

### Security
- Updated dependencies for CVE fixes (#134)

## [4.1.1]

### Changed
- Updated Go version and SDK version (#130)

### Dependencies
- Bumped google.golang.org/grpc from 1.64.0 to 1.64.1 (#129)

## [4.1.0]

### Added
- Added support for context modification (#127)

## [4.0.0]

### Changed
- **BREAKING**: Major version release v4.0.0 (#126)
- Updated grafana-plugin-sdk-go to v0.233.0 (#125)

### Improved
- Enhanced test coverage with more no-error checks (#123)

## [3.4.2]

### Fixed
- Adjusted handling of zero-rows results (#121)

## [3.4.1]

### Added
- Added SLO support: capture query and health duration with error source labeling (#122)

## [3.4.0]

### Added
- Unit tests for zero-rows-returned situations (#119)
- Capture duration and label with error source (#116)
- Return executed query string when error occurs (#117)

### Fixed
- Fixed Next() method in tests (#120)

### Documentation
- Added release instructions (#115)

## [3.3.0]

### Dependencies
- Updated grafana-plugin-sdk-go to v0.231.0 (#114)

## [3.2.0]

### Added
- Added multi timeseries return format (#106)

### Changed
- Used functions migrated to sqlutil (#107)

### Infrastructure
- Added CODEOWNERS file (#104)

## [3.1.0]

### Added
- Added error source support (#103)

## [3.0.0]

### Changed
- **BREAKING**: Major version release v3.0.0 (#102)
- Updated Go plugin SDK to 0.184.0 (#100)
- Enhanced error source functionality (#99)

### Documentation
- Updated installation instructions (#101)

## [2.7.2]

### Fixed
- Fixed functions passed into macros with multiple arguments to parse correctly (#98)

### Added
- Added capability for implementing datasources to set query args (#95)

## [2.7.1]

### Added
- Added QueryFailTimes check to the test driver (#94)

## [2.7.0]

### Added
- Added test driver functionality (#93)

## [2.6.0]

### Added
- Added query errors handling (#92)

## [2.5.1]

### Added
- Added header forwarding capability (#90)

## [2.5.0]

### Added
- Added support for mutateResponse functionality (#89)

## [2.4.1]

### Fixed
- Fixed map write panic (#88)

## [2.4.0]

### Added
- Added QueryMutator interface for driver (#87)

### Infrastructure
- Used organization ISSUE_COMMANDS_TOKEN with reduced scope (#86)

## [2.3.21]

### Added
- Added format option for trace (#81)

### Fixed
- Fixed macro parsing issues:
  - Close macro match on space if no arguments (#83)
  - Fixed parsing macros in more complex queries (#78)
- Fixed connection leak on query retry reconnect (#79)

### Improved
- Added retry on message functionality (#80)

## [2.3.0]

### Added
- Updated Completable interface with custom options (#47)

## [2.2.0]

### Added
- Added default macros support (#45)

### Fixed
- Fixed panic issues (#40)
- Fixed integration test backoff/limit

## [2.1.0]

### Added
- Added support for logs format (#38)

## [2.0.3]

### Fixed
- Fixed error frame return during macro parsing errors (#37)

## [2.0.2]

### Added
- Added integration tests
- Added tests for query timeout
- Added backoff mechanism with ticker

## [2.0.1]

### Changed
- Updated import path to v2

## [2.0.0]

### Changed
- **BREAKING**: Major version release v2.0.0 (#33)
- Updated import path to v2 (#33)
- Used QueryContext for context cancellation handling
- Replaced github.com/pkg/errors with stdlib

### Added
- Added query args to modify current DB (#30)
- Added timeout functionality with no results fallback
- Added support for any route (#29)

## [1.3.0]

### Added
- Added ability to modify query FillMode (#27)

### Infrastructure
- Signed Drone's configuration YAML file for repository protection

## [1.2.0]

### Added
- Added schema evaluation when requesting tables (#24)
- Added macros with no arguments support (#23)
- Added possible macros to Query struct (#22)
- Added ability to return tables, schemas and columns as resources (#21)
- Used refId as frame name (#18)

## [1.0.0]

### Added
- Initial stable release of sqlds
- Core SQL datasource functionality
- Basic macro support
- Connection management

## About

This changelog documents changes for the `sqlds` package, which provides a common foundation for SQL-driven datasources in Grafana. The package centralizes common SQL datasource logic to reduce code duplication across datasources like Postgres, MySQL, and MSSQL.

### Categories

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Vulnerability fixes
- **Dependencies**: Dependency updates
- **Infrastructure**: CI/CD and tooling changes 
