# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [1.1.0]
### Added
- [#49]: Add option to ignore current goroutines, which checks for any additional leaks and allows for incremental adoption of goleak in larger projects.

Thanks to @denis-tingajkin for their contributions to this release.

## [1.0.0]
### Changed
- Migrate to Go modules.

### Fixed
- Ignore trace related goroutines that cause false positives with -trace.

## 0.10.0
- Initial release.

[1.0.0]: https://github.com/uber-go/goleak/compare/v0.10.0...v1.0.0
[#49]: https://github.com/uber-go/goleak/pull/49
