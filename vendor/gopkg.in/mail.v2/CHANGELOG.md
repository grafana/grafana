# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## *Unreleased*

## [2.3.1] - 2018-11-12

### Fixed

- #39: Reverts addition of Go modules `go.mod` manifest.

## [2.3.0] - 2018-11-10

### Added

- #12: Adds `SendError` to provide additional info about the cause and index of
  a failed attempt to transmit a batch of messages.
- go-gomail#78: Adds new `Message` methods for attaching and embedding
  `io.Reader`s: `AttachReader` and `EmbedReader`.

### Fixed

- #26: Fixes RFC 1341 compliance by properly capitalizing the
  `MIME-Version` header.
- #30: Fixes IO errors being silently dropped in `Message.WriteTo`.

## [2.2.0] - 2018-03-01

### Added

- #20: Adds `Message.SetBoundary` to allow specifying a custom MIME boundary.
- #22: Adds `Message.SetBodyWriter` to make it easy to use text/template and
  html/template for message bodies. Contributed by Quantcast.
- #25: Adds `Dialer.StartTLSPolicy` so that `MandatoryStartTLS` can be required,
  or `NoStartTLS` can disable it. Contributed by Quantcast.

## [2.1.0] - 2017-12-14

### Added

- go-gomail#40: Adds `Dialer.LocalName` field to allow specifying the hostname
  sent with SMTP's HELO command.
- go-gomail#47: `Message.SetBody`, `Message.AddAlternative`, and
  `Message.AddAlternativeWriter` allow specifying the encoding of message parts.
- `Dialer.Dial`'s returned `SendCloser` automatically redials after a timeout.
- go-gomail#55, go-gomail#56: Adds `Rename` to allow specifying filename
  of an attachment.
- go-gomail#100: Exports `NetDialTimeout` to allow setting a custom dialer.
- go-gomail#70: Adds `Dialer.Timeout` field to allow specifying a timeout for
  dials, reads, and writes.

### Changed

- go-gomail#52: `Dialer.Dial` automatically uses CRAM-MD5 when available.
- `Dialer.Dial` specifies a default timeout of 10 seconds.
- Gomail is forked from <https://github.com/go-gomail/gomail/> to
  <https://github.com/go-mail/mail/>.

### Deprecated

- go-gomail#52: `NewPlainDialer` is deprecated in favor of `NewDialer`.

### Fixed

- go-gomail#41, go-gomail#42: Fixes a panic when a `Message` contains a
  nil header.
- go-gomail#44: Fixes `AddAlternativeWriter` replacing the message body instead
  of adding a body part.
- go-gomail#53: Folds long header lines for RFC 2047 compliance.
- go-gomail#54: Fixes `Message.FormatAddress` when name is blank.

## [2.0.0] - 2015-09-02

- Mailer has been removed. It has been replaced by Dialer and Sender.
- `File` type and the `CreateFile` and `OpenFile` functions have been removed.
- `Message.Attach` and `Message.Embed` have a new signature.
- `Message.GetBodyWriter` has been removed. Use `Message.AddAlternativeWriter`
instead.
- `Message.Export` has been removed. `Message.WriteTo` can be used instead.
- `Message.DelHeader` has been removed.
- The `Bcc` header field is no longer sent. It is far more simpler and
efficient: the same message is sent to all recipients instead of sending a
different email to each Bcc address.
- LoginAuth has been removed. `NewPlainDialer` now implements the LOGIN
authentication mechanism when needed.
- Go 1.2 is now required instead of Go 1.3. No external dependency are used when
using Go 1.5.
