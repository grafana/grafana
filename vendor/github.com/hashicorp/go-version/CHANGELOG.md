# 1.7.0 (May 24, 2024)

ENHANCEMENTS:

- Remove `reflect` dependency ([#91](https://github.com/hashicorp/go-version/pull/91))
- Implement the `database/sql.Scanner` and `database/sql/driver.Value` interfaces for `Version` ([#133](https://github.com/hashicorp/go-version/pull/133))

INTERNAL:

- [COMPLIANCE] Add Copyright and License Headers ([#115](https://github.com/hashicorp/go-version/pull/115))
- [COMPLIANCE] Update MPL-2.0 LICENSE ([#105](https://github.com/hashicorp/go-version/pull/105))
- Bump actions/cache from 3.0.11 to 3.2.5 ([#116](https://github.com/hashicorp/go-version/pull/116))
- Bump actions/checkout from 3.2.0 to 3.3.0 ([#111](https://github.com/hashicorp/go-version/pull/111))
- Bump actions/upload-artifact from 3.1.1 to 3.1.2 ([#112](https://github.com/hashicorp/go-version/pull/112))
- GHA Migration ([#103](https://github.com/hashicorp/go-version/pull/103))
- github: Pin external GitHub Actions to hashes ([#107](https://github.com/hashicorp/go-version/pull/107))
- SEC-090: Automated trusted workflow pinning (2023-04-05) ([#124](https://github.com/hashicorp/go-version/pull/124))
- update readme ([#104](https://github.com/hashicorp/go-version/pull/104))

# 1.6.0 (June 28, 2022)

FEATURES:

- Add `Prerelease` function to `Constraint` to return true if the version includes a prerelease field ([#100](https://github.com/hashicorp/go-version/pull/100))

# 1.5.0 (May 18, 2022)

FEATURES:

- Use `encoding` `TextMarshaler` & `TextUnmarshaler` instead of JSON equivalents ([#95](https://github.com/hashicorp/go-version/pull/95))
- Add JSON handlers to allow parsing from/to JSON ([#93](https://github.com/hashicorp/go-version/pull/93))

# 1.4.0 (January 5, 2022)

FEATURES:

 - Introduce `MustConstraints()` ([#87](https://github.com/hashicorp/go-version/pull/87))
 - `Constraints`: Introduce `Equals()` and `sort.Interface` methods ([#88](https://github.com/hashicorp/go-version/pull/88))

# 1.3.0 (March 31, 2021)

Please note that CHANGELOG.md does not exist in the source code prior to this release.

FEATURES:
 - Add `Core` function to return a version without prerelease or metadata ([#85](https://github.com/hashicorp/go-version/pull/85))

# 1.2.1 (June 17, 2020)

BUG FIXES:
 - Prevent `Version.Equal` method from panicking on `nil` encounter ([#73](https://github.com/hashicorp/go-version/pull/73))

# 1.2.0 (April 23, 2019)

FEATURES:
 - Add `GreaterThanOrEqual` and `LessThanOrEqual` helper methods ([#53](https://github.com/hashicorp/go-version/pull/53))

# 1.1.0 (Jan 07, 2019)

FEATURES:
 - Add `NewSemver` constructor ([#45](https://github.com/hashicorp/go-version/pull/45))

# 1.0.0 (August 24, 2018)

Initial release.
