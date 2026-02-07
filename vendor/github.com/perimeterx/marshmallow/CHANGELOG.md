# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [[1.1.5](https://github.com/PerimeterX/marshmallow/compare/v1.1.4...v1.1.5)] - 2023-07-03

### Added

- Support for reporting errors from `HandleJSONData` - [info](https://github.com/PerimeterX/marshmallow/issues/27).

## [[1.1.4](https://github.com/PerimeterX/marshmallow/compare/v1.1.3...v1.1.4)] - 2022-11-10

### Fixed

- Fixed problem with nested object implementing JSONDataHandler with skipPopulateStruct - [info](https://github.com/PerimeterX/marshmallow/issues/18).
- Fixed problem with nested object implementing JSONDataHandler with skipPopulateStruct in ModeFailOverToOriginalValue - [info](https://github.com/PerimeterX/marshmallow/issues/19).

## [[1.1.3](https://github.com/PerimeterX/marshmallow/compare/v1.1.2...v1.1.3)] - 2022-08-31

### Added

- Support for excluding known fields from the result map - [info](https://github.com/PerimeterX/marshmallow/issues/16).

## [[1.1.2](https://github.com/PerimeterX/marshmallow/compare/v1.1.1...v1.1.2)] - 2022-08-23

### Added

- Support capturing nested unknown fields - [info](https://github.com/PerimeterX/marshmallow/issues/15).

## [[1.1.1](https://github.com/PerimeterX/marshmallow/compare/v1.1.0...v1.1.1)] - 2022-08-21

### Fixed

- Fix parsing bug for unknown nested fields - [info](https://github.com/PerimeterX/marshmallow/issues/12).

## [[1.1.0](https://github.com/PerimeterX/marshmallow/compare/v0.0.1...v1.1.0)] - 2022-07-10

### Fixed

- Fixed an issue with embedded fields - [info](https://github.com/PerimeterX/marshmallow/issues/9).

## [[0.0.1](https://github.com/PerimeterX/marshmallow/tree/v0.0.1)] - 2022-04-21

### Added

- All functionality from our internal repository, after it has been stabilized on production for several months - [info](https://www.perimeterx.com/tech-blog/2022/boosting-up-json-performance-of-unstructured-structs-in-go/).
