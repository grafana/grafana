# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2023-01-30

[0.6.0]: https://github.com/go-logfmt/logfmt/compare/v0.5.1...v0.6.0

### Added

- NewDecoderSize by [@alexanderjophus]

## [0.5.1] - 2021-08-18

[0.5.1]: https://github.com/go-logfmt/logfmt/compare/v0.5.0...v0.5.1

### Changed

- Update the `go.mod` file for Go 1.17 as described in the [Go 1.17 release
  notes](https://golang.org/doc/go1.17#go-command)

## [0.5.0] - 2020-01-03

[0.5.0]: https://github.com/go-logfmt/logfmt/compare/v0.4.0...v0.5.0

### Changed

- Remove the dependency on github.com/kr/logfmt by [@ChrisHines]
- Move fuzz code to github.com/go-logfmt/fuzzlogfmt by [@ChrisHines]

## [0.4.0] - 2018-11-21

[0.4.0]: https://github.com/go-logfmt/logfmt/compare/v0.3.0...v0.4.0

### Added

- Go module support by [@ChrisHines]
- CHANGELOG by [@ChrisHines]

### Changed

- Drop invalid runes from keys instead of returning ErrInvalidKey by [@ChrisHines]
- On panic while printing, attempt to print panic value by [@bboreham]

## [0.3.0] - 2016-11-15

[0.3.0]: https://github.com/go-logfmt/logfmt/compare/v0.2.0...v0.3.0

### Added

- Pool buffers for quoted strings and byte slices by [@nussjustin]

### Fixed

- Fuzz fix, quote invalid UTF-8 values by [@judwhite]

## [0.2.0] - 2016-05-08

[0.2.0]: https://github.com/go-logfmt/logfmt/compare/v0.1.0...v0.2.0

### Added

- Encoder.EncodeKeyvals by [@ChrisHines]

## [0.1.0] - 2016-03-28

[0.1.0]: https://github.com/go-logfmt/logfmt/commits/v0.1.0

### Added

- Encoder by [@ChrisHines]
- Decoder by [@ChrisHines]
- MarshalKeyvals by [@ChrisHines]

[@ChrisHines]: https://github.com/ChrisHines
[@bboreham]: https://github.com/bboreham
[@judwhite]: https://github.com/judwhite
[@nussjustin]: https://github.com/nussjustin
[@alexanderjophus]: https://github.com/alexanderjophus
