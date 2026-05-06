# v1.8.3 (2025-02-18)

* **Bug Fix**: Bump go version to 1.22

# v1.8.2 (2025-01-24)

* **Bug Fix**: Refactor filepath.Walk to filepath.WalkDir

# v1.8.1 (2024-08-15)

* **Dependency Update**: Bump minimum Go version to 1.21.

# v1.8.0 (2024-02-13)

* **Feature**: Bump minimum Go version to 1.20 per our language support policy.

# v1.7.3 (2024-01-22)

* **Bug Fix**: Remove invalid escaping of shared config values. All values in the shared config file will now be interpreted literally, save for fully-quoted strings which are unwrapped for legacy reasons.

# v1.7.2 (2023-12-08)

* **Bug Fix**: Correct loading of [services *] sections into shared config.

# v1.7.1 (2023-11-16)

* **Bug Fix**: Fix recognition of trailing comments in shared config properties. # or ; separators that aren't preceded by whitespace at the end of a property value should be considered part of it.

# v1.7.0 (2023-11-13)

* **Feature**: Replace the legacy config parser with a modern, less-strict implementation. Parsing failures within a section will now simply ignore the invalid line rather than silently drop the entire section.

# v1.6.0 (2023-11-09.2)

* **Feature**: BREAKFIX: In order to support subproperty parsing, invalid property definitions must not be ignored

# v1.5.2 (2023-11-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.5.1 (2023-11-07)

* **Bug Fix**: Fix subproperty performance regression

# v1.5.0 (2023-11-01)

* **Feature**: Adds support for configured endpoints via environment variables and the AWS shared configuration file.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.4.0 (2023-10-31)

* **Feature**: **BREAKING CHANGE**: Bump minimum go version to 1.19 per the revised [go version support policy](https://aws.amazon.com/blogs/developer/aws-sdk-for-go-aligns-with-go-release-policy-on-supported-runtimes/).
* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.45 (2023-10-12)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.44 (2023-10-06)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.43 (2023-09-22)

* **Bug Fix**: Fixed a bug where merging `max_attempts` or `duration_seconds` fields across shared config files with invalid values would silently default them to 0.
* **Bug Fix**: Move type assertion of config values out of the parsing stage, which resolves an issue where the contents of a profile would silently be dropped with certain numeric formats.

# v1.3.42 (2023-08-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.41 (2023-08-18)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.40 (2023-08-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.39 (2023-08-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.38 (2023-07-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.37 (2023-07-28)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.36 (2023-07-13)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.35 (2023-06-13)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.34 (2023-04-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.33 (2023-04-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.32 (2023-03-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.31 (2023-03-10)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.30 (2023-02-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.29 (2023-02-03)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.28 (2022-12-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.27 (2022-12-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.26 (2022-10-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.25 (2022-10-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.24 (2022-09-20)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.23 (2022-09-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.22 (2022-09-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.21 (2022-08-31)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.20 (2022-08-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.19 (2022-08-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.18 (2022-08-09)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.17 (2022-08-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.16 (2022-08-01)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.15 (2022-07-05)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.14 (2022-06-29)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.13 (2022-06-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.12 (2022-05-17)

* **Bug Fix**: Removes the fuzz testing files from the module, as they are invalid and not used.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.11 (2022-04-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.10 (2022-03-30)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.9 (2022-03-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.8 (2022-03-23)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.7 (2022-03-08)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.6 (2022-02-24)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.5 (2022-01-28)

* **Bug Fix**: Fixes the SDK's handling of `duration_sections` in the shared credentials file or specified in multiple shared config and shared credentials files under the same profile. [#1568](https://github.com/aws/aws-sdk-go-v2/pull/1568). Thanks to [Amir Szekely](https://github.com/kichik) for help reproduce this bug.

# v1.3.4 (2022-01-14)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.3 (2022-01-07)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.2 (2021-12-02)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.1 (2021-11-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.3.0 (2021-11-06)

* **Feature**: The SDK now supports configuration of FIPS and DualStack endpoints using environment variables, shared configuration, or programmatically.
* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.5 (2021-10-21)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.4 (2021-10-11)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.3 (2021-09-17)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.2 (2021-08-27)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.1 (2021-08-19)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.2.0 (2021-08-04)

* **Feature**: adds error handling for defered close calls
* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.1 (2021-07-15)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.1.0 (2021-07-01)

* **Feature**: Support for `:`, `=`, `[`, `]` being present in expression values.

# v1.0.1 (2021-06-25)

* **Dependency Update**: Updated to the latest SDK module versions

# v1.0.0 (2021-05-20)

* **Release**: The `github.com/aws/aws-sdk-go-v2/internal/ini` package is now a Go Module.
* **Dependency Update**: Updated to the latest SDK module versions

