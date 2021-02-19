# Change Log

**ATTN**: This project uses [semantic versioning](http://semver.org/).

## [Unreleased]

## 1.20.0 - 2017-08-10

### Fixed

* `HandleExitCoder` is now correctly iterates over all errors in
  a `MultiError`. The exit code is the exit code of the last error or `1` if
  there are no `ExitCoder`s in the `MultiError`.
* Fixed YAML file loading on Windows (previously would fail validate the file path)
* Subcommand `Usage`, `Description`, `ArgsUsage`, `OnUsageError` correctly
  propogated
* `ErrWriter` is now passed downwards through command structure to avoid the
  need to redefine it
* Pass `Command` context into `OnUsageError` rather than parent context so that
  all fields are avaiable
* Errors occuring in `Before` funcs are no longer double printed
* Use `UsageText` in the help templates for commands and subcommands if
  defined; otherwise build the usage as before (was previously ignoring this
  field)
* `IsSet` and `GlobalIsSet` now correctly return whether a flag is set if
  a program calls `Set` or `GlobalSet` directly after flag parsing (would
  previously only return `true` if the flag was set during parsing)

### Changed

* No longer exit the program on command/subcommand error if the error raised is
  not an `OsExiter`. This exiting behavior was introduced in 1.19.0, but was
  determined to be a regression in functionality. See [the
  PR](https://github.com/urfave/cli/pull/595) for discussion.

### Added

* `CommandsByName` type was added to make it easy to sort `Command`s by name,
  alphabetically
* `altsrc` now handles loading of string and int arrays from TOML
* Support for definition of custom help templates for `App` via
  `CustomAppHelpTemplate`
* Support for arbitrary key/value fields on `App` to be used with
  `CustomAppHelpTemplate` via `ExtraInfo`
* `HelpFlag`, `VersionFlag`, and `BashCompletionFlag` changed to explictly be
  `cli.Flag`s allowing for the use of custom flags satisfying the `cli.Flag`
  interface to be used.


## [1.19.1] - 2016-11-21

### Fixed

- Fixes regression introduced in 1.19.0 where using an `ActionFunc` as
  the `Action` for a command would cause it to error rather than calling the
  function. Should not have a affected declarative cases using `func(c
  *cli.Context) err)`.
- Shell completion now handles the case where the user specifies
  `--generate-bash-completion` immediately after a flag that takes an argument.
  Previously it call the application with `--generate-bash-completion` as the
  flag value.

## [1.19.0] - 2016-11-19
### Added
- `FlagsByName` was added to make it easy to sort flags (e.g. `sort.Sort(cli.FlagsByName(app.Flags))`)
- A `Description` field was added to `App` for a more detailed description of
  the application (similar to the existing `Description` field on `Command`)
- Flag type code generation via `go generate`
- Write to stderr and exit 1 if action returns non-nil error
- Added support for TOML to the `altsrc` loader
- `SkipArgReorder` was added to allow users to skip the argument reordering.
  This is useful if you want to consider all "flags" after an argument as
  arguments rather than flags (the default behavior of the stdlib `flag`
  library). This is backported functionality from the [removal of the flag
  reordering](https://github.com/urfave/cli/pull/398) in the unreleased version
  2
- For formatted errors (those implementing `ErrorFormatter`), the errors will
  be formatted during output. Compatible with `pkg/errors`.

### Changed
- Raise minimum tested/supported Go version to 1.2+

### Fixed
- Consider empty environment variables as set (previously environment variables
  with the equivalent of `""` would be skipped rather than their value used).
- Return an error if the value in a given environment variable cannot be parsed
  as the flag type. Previously these errors were silently swallowed.
- Print full error when an invalid flag is specified (which includes the invalid flag)
- `App.Writer` defaults to `stdout` when `nil`
- If no action is specified on a command or app, the help is now printed instead of `panic`ing
- `App.Metadata` is initialized automatically now (previously was `nil` unless initialized)
- Correctly show help message if `-h` is provided to a subcommand
- `context.(Global)IsSet` now respects environment variables. Previously it
  would return `false` if a flag was specified in the environment rather than
  as an argument
- Removed deprecation warnings to STDERR to avoid them leaking to the end-user
- `altsrc`s import paths were updated to use `gopkg.in/urfave/cli.v1`. This
  fixes issues that occurred when `gopkg.in/urfave/cli.v1` was imported as well
  as `altsrc` where Go would complain that the types didn't match

## [1.18.1] - 2016-08-28
### Fixed
- Removed deprecation warnings to STDERR to avoid them leaking to the end-user (backported)

## [1.18.0] - 2016-06-27
### Added
- `./runtests` test runner with coverage tracking by default
- testing on OS X
- testing on Windows
- `UintFlag`, `Uint64Flag`, and `Int64Flag` types and supporting code

### Changed
- Use spaces for alignment in help/usage output instead of tabs, making the
  output alignment consistent regardless of tab width

### Fixed
- Printing of command aliases in help text
- Printing of visible flags for both struct and struct pointer flags
- Display the `help` subcommand when using `CommandCategories`
- No longer swallows `panic`s that occur within the `Action`s themselves when
  detecting the signature of the `Action` field

## [1.17.1] - 2016-08-28
### Fixed
- Removed deprecation warnings to STDERR to avoid them leaking to the end-user

## [1.17.0] - 2016-05-09
### Added
- Pluggable flag-level help text rendering via `cli.DefaultFlagStringFunc`
- `context.GlobalBoolT` was added as an analogue to `context.GlobalBool`
- Support for hiding commands by setting `Hidden: true` -- this will hide the
  commands in help output

### Changed
- `Float64Flag`, `IntFlag`, and `DurationFlag` default values are no longer
  quoted in help text output.
- All flag types now include `(default: {value})` strings following usage when a
  default value can be (reasonably) detected.
- `IntSliceFlag` and `StringSliceFlag` usage strings are now more consistent
  with non-slice flag types
- Apps now exit with a code of 3 if an unknown subcommand is specified
  (previously they printed "No help topic for...", but still exited 0. This
  makes it easier to script around apps built using `cli` since they can trust
  that a 0 exit code indicated a successful execution.
- cleanups based on [Go Report Card
  feedback](https://goreportcard.com/report/github.com/urfave/cli)

## [1.16.1] - 2016-08-28
### Fixed
- Removed deprecation warnings to STDERR to avoid them leaking to the end-user

## [1.16.0] - 2016-05-02
### Added
- `Hidden` field on all flag struct types to omit from generated help text

### Changed
- `BashCompletionFlag` (`--enable-bash-completion`) is now omitted from
generated help text via the `Hidden` field

### Fixed
- handling of error values in `HandleAction` and `HandleExitCoder`

## [1.15.0] - 2016-04-30
### Added
- This file!
- Support for placeholders in flag usage strings
- `App.Metadata` map for arbitrary data/state management
- `Set` and `GlobalSet` methods on `*cli.Context` for altering values after
parsing.
- Support for nested lookup of dot-delimited keys in structures loaded from
YAML.

### Changed
- The `App.Action` and `Command.Action` now prefer a return signature of
`func(*cli.Context) error`, as defined by `cli.ActionFunc`.  If a non-nil
`error` is returned, there may be two outcomes:
    - If the error fulfills `cli.ExitCoder`, then `os.Exit` will be called
    automatically
    - Else the error is bubbled up and returned from `App.Run`
- Specifying an `Action` with the legacy return signature of
`func(*cli.Context)` will produce a deprecation message to stderr
- Specifying an `Action` that is not a `func` type will produce a non-zero exit
from `App.Run`
- Specifying an `Action` func that has an invalid (input) signature will
produce a non-zero exit from `App.Run`

### Deprecated
- <a name="deprecated-cli-app-runandexitonerror"></a>
`cli.App.RunAndExitOnError`, which should now be done by returning an error
that fulfills `cli.ExitCoder` to `cli.App.Run`.
- <a name="deprecated-cli-app-action-signature"></a> the legacy signature for
`cli.App.Action` of `func(*cli.Context)`, which should now have a return
signature of `func(*cli.Context) error`, as defined by `cli.ActionFunc`.

### Fixed
- Added missing `*cli.Context.GlobalFloat64` method

## [1.14.0] - 2016-04-03 (backfilled 2016-04-25)
### Added
- Codebeat badge
- Support for categorization via `CategorizedHelp` and `Categories` on app.

### Changed
- Use `filepath.Base` instead of `path.Base` in `Name` and `HelpName`.

### Fixed
- Ensure version is not shown in help text when `HideVersion` set.

## [1.13.0] - 2016-03-06 (backfilled 2016-04-25)
### Added
- YAML file input support.
- `NArg` method on context.

## [1.12.0] - 2016-02-17 (backfilled 2016-04-25)
### Added
- Custom usage error handling.
- Custom text support in `USAGE` section of help output.
- Improved help messages for empty strings.
- AppVeyor CI configuration.

### Changed
- Removed `panic` from default help printer func.
- De-duping and optimizations.

### Fixed
- Correctly handle `Before`/`After` at command level when no subcommands.
- Case of literal `-` argument causing flag reordering.
- Environment variable hints on Windows.
- Docs updates.

## [1.11.1] - 2015-12-21 (backfilled 2016-04-25)
### Changed
- Use `path.Base` in `Name` and `HelpName`
- Export `GetName` on flag types.

### Fixed
- Flag parsing when skipping is enabled.
- Test output cleanup.
- Move completion check to account for empty input case.

## [1.11.0] - 2015-11-15 (backfilled 2016-04-25)
### Added
- Destination scan support for flags.
- Testing against `tip` in Travis CI config.

### Changed
- Go version in Travis CI config.

### Fixed
- Removed redundant tests.
- Use correct example naming in tests.

## [1.10.2] - 2015-10-29 (backfilled 2016-04-25)
### Fixed
- Remove unused var in bash completion.

## [1.10.1] - 2015-10-21 (backfilled 2016-04-25)
### Added
- Coverage and reference logos in README.

### Fixed
- Use specified values in help and version parsing.
- Only display app version and help message once.

## [1.10.0] - 2015-10-06 (backfilled 2016-04-25)
### Added
- More tests for existing functionality.
- `ArgsUsage` at app and command level for help text flexibility.

### Fixed
- Honor `HideHelp` and `HideVersion` in `App.Run`.
- Remove juvenile word from README.

## [1.9.0] - 2015-09-08 (backfilled 2016-04-25)
### Added
- `FullName` on command with accompanying help output update.
- Set default `$PROG` in bash completion.

### Changed
- Docs formatting.

### Fixed
- Removed self-referential imports in tests.

## [1.8.0] - 2015-06-30 (backfilled 2016-04-25)
### Added
- Support for `Copyright` at app level.
- `Parent` func at context level to walk up context lineage.

### Fixed
- Global flag processing at top level.

## [1.7.1] - 2015-06-11 (backfilled 2016-04-25)
### Added
- Aggregate errors from `Before`/`After` funcs.
- Doc comments on flag structs.
- Include non-global flags when checking version and help.
- Travis CI config updates.

### Fixed
- Ensure slice type flags have non-nil values.
- Collect global flags from the full command hierarchy.
- Docs prose.

## [1.7.0] - 2015-05-03 (backfilled 2016-04-25)
### Changed
- `HelpPrinter` signature includes output writer.

### Fixed
- Specify go 1.1+ in docs.
- Set `Writer` when running command as app.

## [1.6.0] - 2015-03-23 (backfilled 2016-04-25)
### Added
- Multiple author support.
- `NumFlags` at context level.
- `Aliases` at command level.

### Deprecated
- `ShortName` at command level.

### Fixed
- Subcommand help output.
- Backward compatible support for deprecated `Author` and `Email` fields.
- Docs regarding `Names`/`Aliases`.

## [1.5.0] - 2015-02-20 (backfilled 2016-04-25)
### Added
- `After` hook func support at app and command level.

### Fixed
- Use parsed context when running command as subcommand.
- Docs prose.

## [1.4.1] - 2015-01-09 (backfilled 2016-04-25)
### Added
- Support for hiding `-h / --help` flags, but not `help` subcommand.
- Stop flag parsing after `--`.

### Fixed
- Help text for generic flags to specify single value.
- Use double quotes in output for defaults.
- Use `ParseInt` instead of `ParseUint` for int environment var values.
- Use `0` as base when parsing int environment var values.

## [1.4.0] - 2014-12-12 (backfilled 2016-04-25)
### Added
- Support for environment variable lookup "cascade".
- Support for `Stdout` on app for output redirection.

### Fixed
- Print command help instead of app help in `ShowCommandHelp`.

## [1.3.1] - 2014-11-13 (backfilled 2016-04-25)
### Added
- Docs and example code updates.

### Changed
- Default `-v / --version` flag made optional.

## [1.3.0] - 2014-08-10 (backfilled 2016-04-25)
### Added
- `FlagNames` at context level.
- Exposed `VersionPrinter` var for more control over version output.
- Zsh completion hook.
- `AUTHOR` section in default app help template.
- Contribution guidelines.
- `DurationFlag` type.

## [1.2.0] - 2014-08-02
### Added
- Support for environment variable defaults on flags plus tests.

## [1.1.0] - 2014-07-15
### Added
- Bash completion.
- Optional hiding of built-in help command.
- Optional skipping of flag parsing at command level.
- `Author`, `Email`, and `Compiled` metadata on app.
- `Before` hook func support at app and command level.
- `CommandNotFound` func support at app level.
- Command reference available on context.
- `GenericFlag` type.
- `Float64Flag` type.
- `BoolTFlag` type.
- `IsSet` flag helper on context.
- More flag lookup funcs at context level.
- More tests &amp; docs.

### Changed
- Help template updates to account for presence/absence of flags.
- Separated subcommand help template.
- Exposed `HelpPrinter` var for more control over help output.

## [1.0.0] - 2013-11-01
### Added
- `help` flag in default app flag set and each command flag set.
- Custom handling of argument parsing errors.
- Command lookup by name at app level.
- `StringSliceFlag` type and supporting `StringSlice` type.
- `IntSliceFlag` type and supporting `IntSlice` type.
- Slice type flag lookups by name at context level.
- Export of app and command help functions.
- More tests &amp; docs.

## 0.1.0 - 2013-07-22
### Added
- Initial implementation.

[Unreleased]: https://github.com/urfave/cli/compare/v1.18.0...HEAD
[1.18.0]: https://github.com/urfave/cli/compare/v1.17.0...v1.18.0
[1.17.0]: https://github.com/urfave/cli/compare/v1.16.0...v1.17.0
[1.16.0]: https://github.com/urfave/cli/compare/v1.15.0...v1.16.0
[1.15.0]: https://github.com/urfave/cli/compare/v1.14.0...v1.15.0
[1.14.0]: https://github.com/urfave/cli/compare/v1.13.0...v1.14.0
[1.13.0]: https://github.com/urfave/cli/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/urfave/cli/compare/v1.11.1...v1.12.0
[1.11.1]: https://github.com/urfave/cli/compare/v1.11.0...v1.11.1
[1.11.0]: https://github.com/urfave/cli/compare/v1.10.2...v1.11.0
[1.10.2]: https://github.com/urfave/cli/compare/v1.10.1...v1.10.2
[1.10.1]: https://github.com/urfave/cli/compare/v1.10.0...v1.10.1
[1.10.0]: https://github.com/urfave/cli/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/urfave/cli/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/urfave/cli/compare/v1.7.1...v1.8.0
[1.7.1]: https://github.com/urfave/cli/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/urfave/cli/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/urfave/cli/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/urfave/cli/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/urfave/cli/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/urfave/cli/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/urfave/cli/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/urfave/cli/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/urfave/cli/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/urfave/cli/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/urfave/cli/compare/v0.1.0...v1.0.0
