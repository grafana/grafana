# ![SMTP mock server written on Golang. Mimic any SMTP server behavior for your test environment with fake SMTP server](https://repository-images.githubusercontent.com/401721985/848bc1dd-fc35-4d78-8bd9-0ac3430270d8)

[![Go Report Card](https://goreportcard.com/badge/github.com/mocktools/go-smtp-mock/v2)](https://goreportcard.com/report/github.com/mocktools/go-smtp-mock/v2)
[![Codecov](https://codecov.io/gh/mocktools/go-smtp-mock/branch/master/graph/badge.svg)](https://codecov.io/gh/mocktools/go-smtp-mock)
[![CircleCI](https://circleci.com/gh/mocktools/go-smtp-mock/tree/master.svg?style=svg)](https://circleci.com/gh/mocktools/go-smtp-mock/tree/master)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/mocktools/go-smtp-mock)](https://github.com/mocktools/go-smtp-mock/releases)
[![PkgGoDev](https://pkg.go.dev/badge/github.com/mocktools/go-smtp-mock/v2)](https://pkg.go.dev/github.com/mocktools/go-smtp-mock/v2)
[![Mentioned in Awesome Go](https://awesome.re/mentioned-badge.svg)](https://github.com/avelino/awesome-go)
[![GitHub](https://img.shields.io/github/license/mocktools/go-smtp-mock)](LICENSE.txt)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v1.4%20adopted-ff69b4.svg)](CODE_OF_CONDUCT.md)

`smtpmock` is lightweight configurable multithreaded fake SMTP server written in Go. It meets the minimum requirements specified by [RFC 2821](https://datatracker.ietf.org/doc/html/rfc2821) & [RFC 5321](https://datatracker.ietf.org/doc/html/rfc5321). Allows to mimic any SMTP server behavior for your test environment and even more 🚀

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
  - [Inside of Golang ecosystem](#inside-of-golang-ecosystem)
    - [Configuring](#configuring)
    - [Manipulation with server](#manipulation-with-server)
    - [Using a custom logger](#using-a-custom-logger)
  - [Inside of Ruby ecosystem](#inside-of-ruby-ecosystem)
    - [Example of usage](#example-of-usage)
  - [Inside of any ecosystem](#inside-of-any-ecosystem)
    - [Configuring with command line arguments](#configuring-with-command-line-arguments)
    - [Other options](#other-options)
    - [Stopping server](#stopping-server)
  - [Implemented SMTP commands](#implemented-smtp-commands)
- [Contributing](#contributing)
- [License](#license)
- [Code of Conduct](#code-of-conduct)
- [Credits](#credits)
- [Versioning](#versioning)
- [Changelog](CHANGELOG.md)

## Features

- Configurable multithreaded RFC compatible SMTP server
- Implements the minimum command set, responds to commands and adds a valid received header to messages as specified in [RFC 2821](https://datatracker.ietf.org/doc/html/rfc2821) & [RFC 5321](https://datatracker.ietf.org/doc/html/rfc5321)
- Ability to configure behavior for each SMTP command
- Comes with default settings out of the box, configure only what you need
- Ability to override previous SMTP commands
- Fail fast scenario (ability to close client session for case when command was inconsistent or failed)
- Multiple receivers (ability to configure multiple `RCPT TO` commands receiving during one session)
- Multiple message receiving (ability to configure multiple message receiving during one session)
- Mock-server activity logger
- Ability to do graceful/force shutdown of SMTP mock server
- No authentication support
- Zero runtime dependencies
- Ability to access to server messages
- Simple and intuitive DSL
- Ability to run server as binary with command line arguments

## Requirements

Golang 1.15+

## Installation

Install `smtpmock`:

```bash
go get github.com/mocktools/go-smtp-mock/v2
go install github.com/mocktools/go-smtp-mock/v2
```

Import `smtpmock` dependency into your code:

```go
package main

import smtpmock "github.com/mocktools/go-smtp-mock/v2"
```

## Usage

- [Inside of Golang ecosystem](#inside-of-golang-ecosystem)
  - [Configuring](#configuring)
  - [Manipulation with server](#manipulation-with-server)
  - [Using a custom logger](#using-a-custom-logger)
- [Inside of Ruby ecosystem](#inside-of-ruby-ecosystem)
  - [Example of usage](#example-of-usage)
- [Inside of any ecosystem](#inside-of-any-ecosystem)
  - [Configuring with command line arguments](#configuring-with-command-line-arguments)
  - [Other options](#other-options)
  - [Stopping server](#stopping-server)
- [Implemented SMTP commands](#implemented-smtp-commands)

### Inside of Golang ecosystem

You have to create your SMTP mock server using `smtpmock.New()` and `smtpmock.ConfigurationAttr{}` to start interaction with it.

#### Configuring

`smtpmock` is SMTP server for test environment with configurable behavior. It comes with default settings out of the box. But you can override any default behavior if you need.

```go
smtpmock.ConfigurationAttr{

  // Customizing server behavior
  // ---------------------------------------------------------------------
  // Host address where smtpmock will run, it's equal to "127.0.0.1" by default
  HostAddress:                   "[::]",

  // Port number on which the server will bind. If it not specified, it will be
  // assigned dynamically after server.Start() by default
  PortNumber:                    2525,

  // Enables/disables log to stdout. It's equal to false by default
  LogToStdout:                   true,

  // Enables/disables log server activity. It's equal to false by default
  LogServerActivity:             true,

  // Ability to specify session timeout. It's equal to 30 seconds by default
  SessionTimeout:                42,

  // Ability to specify graceful shutdown timeout. It's equal to 1 second by default
  ShutdownTimeout:               5,


  // Customizing SMTP command handlers behavior
  // ---------------------------------------------------------------------
  // Ability to configure fail fast scenario. It means that server will
  // close client session for case when command was inconsistent or failed.
  // It's equal to false by default
  IsCmdFailFast:                 true,

  // Ability to configure multiple RCPT TO command receiving during one session.
  // It means that server will handle and save all RCPT TO command request-response
  // pairs until receive successful response and next SMTP command has been passed.
  // Please note, by default will be saved only one, the last RCPT TO command
  // request-response pair. It's equal to false by default
  MultipleRcptto:                true,

  // Ability to configure multiple message receiving during one session. It means that server
  // will create another message during current SMTP session in case when RSET
  // command has been used after successful commands chain: MAIL FROM, RCPT TO, DATA.
  // Please note, by default RSET command flushes current message in any case.
  // It's equal to false by default
  MultipleMessageReceiving:      true,

  // Ability to specify blacklisted HELO domains. It's equal to empty []string
  BlacklistedHeloDomains:        []string{"example1.com", "example2.com", "localhost"},

  // Ability to specify blacklisted MAIL FROM emails. It's equal to empty []string
  BlacklistedMailfromEmails:     []string{"bot@olo.com", "robot@molo.com"},

  // Ability to specify blacklisted RCPT TO emails. It's equal to empty []string
  BlacklistedRcpttoEmails:       []string{"blacklisted@olo.com", "blacklisted@molo.com"},

  // Ability to specify not registered (non-existent) RCPT TO emails.
  // It's equal to empty []string
  NotRegisteredEmails:           []string{"nobody@olo.com", "non-existent@email.com"},

  // Ability to specify HELO response delay in seconds. It runs immediately,
  // equals to 0 seconds by default
  ResponseDelayHelo:             2,

  // Ability to specify MAIL FROM response delay in seconds. It runs immediately,
  // equals to 0 seconds by default
  ResponseDelayMailfrom:         2,

  // Ability to specify RCPT TO response delay in seconds. It runs immediately,
  // equals to 0 seconds by default
  ResponseDelayRcptto:           2,

  // Ability to specify DATA response delay in seconds. It runs immediately,
  // equals to 0 seconds by default
  ResponseDelayData:             2,

  // Ability to specify message response delay in seconds. It runs immediately,
  // equals to 0 seconds by default
  ResponseDelayMessage:          2,

  // Ability to specify RSET response delay in seconds. It runs immediately,
  // equals to 0 seconds by default
  ResponseDelayRset:             2,

  // Ability to specify NOOP response delay in seconds. It runs immediately,
  // equals to 0 seconds by default
  ResponseDelayNoop:             2,

  // Ability to specify QUIT response delay in seconds. It runs immediately,
  // equals to 0 seconds by default
  ResponseDelayQuit:             2,

  // Ability to specify message body size limit. It's equal to 10485760 bytes (10MB) by default
  MsgSizeLimit:                  5,


  // Customizing SMTP command handler messages context
  // ---------------------------------------------------------------------
  // Custom server greeting message. Base on defaultGreetingMsg by default
  MsgGreeting:                   "msgGreeting",

  // Custom invalid command message. Based on defaultInvalidCmdMsg by default
  MsgInvalidCmd:                 "msgInvalidCmd",

  // Custom invalid command HELO sequence message.
  // Based on defaultInvalidCmdHeloSequenceMsg by default
  MsgInvalidCmdHeloSequence:     "msgInvalidCmdHeloSequence",

  // Custom invalid command HELO argument message.
  // Based on defaultInvalidCmdHeloArgMsg by default
  MsgInvalidCmdHeloArg:          "msgInvalidCmdHeloArg",

  // Custom HELO blacklisted domain message. Based on defaultQuitMsg by default
  MsgHeloBlacklistedDomain:      "msgHeloBlacklistedDomain",

  // Custom HELO received message. Based on defaultReceivedMsg by default
  MsgHeloReceived:               "msgHeloReceived",

  // Custom invalid command MAIL FROM sequence message.
  // Based on defaultInvalidCmdMailfromSequenceMsg by default
  MsgInvalidCmdMailfromSequence: "msgInvalidCmdMailfromSequence",

  // Custom invalid command MAIL FROM argument message.
  // Based on defaultInvalidCmdMailfromArgMsg by default
  MsgInvalidCmdMailfromArg:      "msgInvalidCmdMailfromArg",

  // Custom MAIL FROM blacklisted email message. Based on defaultQuitMsg by default
  MsgMailfromBlacklistedEmail:   "msgMailfromBlacklistedEmail",

  // Custom MAIL FROM received message. Based on defaultReceivedMsg by default
  MsgMailfromReceived:           "msgMailfromReceived",

  // Custom invalid command RCPT TO sequence message.
  // Based on defaultInvalidCmdRcpttoSequenceMsg by default
  MsgInvalidCmdRcpttoSequence:   "msgInvalidCmdRcpttoSequence",

  // Custom invalid command RCPT TO argument message.
  // Based on defaultInvalidCmdRcpttoArgMsg by default
  MsgInvalidCmdRcpttoArg:        "msgInvalidCmdRcpttoArg",

  // Custom RCPT TO not registered email message.
  // Based on defaultNotRegisteredRcpttoEmailMsg by default
  MsgRcpttoNotRegisteredEmail:   "msgRcpttoNotRegisteredEmail",

  // Custom RCPT TO blacklisted email message. Based on defaultQuitMsg by default
  MsgRcpttoBlacklistedEmail:     "msgRcpttoBlacklistedEmail",

  // Custom RCPT TO received message. Based on defaultReceivedMsg by default
  MsgRcpttoReceived:             "msgRcpttoReceived",

  // Custom invalid command DATA sequence message.
  // Based on defaultInvalidCmdDataSequenceMsg by default
  MsgInvalidCmdDataSequence:     "msgInvalidCmdDataSequence",

  // Custom DATA received message. Based on defaultReadyForReceiveMsg by default
  MsgDataReceived:               "msgDataReceived",

  // Custom size is too big message. Based on defaultMsgSizeIsTooBigMsg by default
  MsgMsgSizeIsTooBig:            "msgMsgSizeIsTooBig",

  // Custom received message body message. Based on defaultReceivedMsg by default
  MsgMsgReceived:                "msgMsgReceived",

  // Custom invalid command RSET sequence message.
  // Based on defaultInvalidCmdHeloSequenceMsg by default
  MsgInvalidCmdRsetSequence:     "msgInvalidCmdRsetSequence",

  // Custom invalid command RSET message. Based on defaultInvalidCmdMsg by default
  MsgInvalidCmdRsetArg:           "msgInvalidCmdRsetArg",

  // Custom RSET received message. Based on defaultOkMsg by default
  MsgRsetReceived:               "msgRsetReceived",

  // Custom NOOP received message. Based on defaultOkMsg by default
  MsgNoopReceived:               "msgNoopReceived",

  // Custom quit command message. Based on defaultQuitMsg by default
  MsgQuitCmd:                    "msgQuitCmd",
}
```

#### Manipulation with server

```go
package main

import (
  "fmt"
  "net"
  "net/smtp"

  smtpmock "github.com/mocktools/go-smtp-mock/v2"
)

func main() {
  // You can pass empty smtpmock.ConfigurationAttr{}. It means that smtpmock will use default settings
  server := smtpmock.New(smtpmock.ConfigurationAttr{
    LogToStdout:       true,
    LogServerActivity: true,
  })

  // To start server use Start() method
  if err := server.Start(); err != nil {
    fmt.Println(err)
  }

  // Server's port will be assigned dynamically after server.Start()
  // for case when portNumber wasn't specified
  hostAddress, portNumber := "127.0.0.1", server.PortNumber()

  // Possible SMTP-client stuff for iteration with mock server
  address := fmt.Sprintf("%s:%d", hostAddress, portNumber)
  timeout := time.Duration(2) * time.Second

  connection, _ := net.DialTimeout("tcp", address, timeout)
  client, _ := smtp.NewClient(connection, hostAddress)
  client.Hello("example.com")
  client.Quit()
  client.Close()

  // Each result of SMTP session will be saved as message.
  // To get access for server messages copies use Messages() method
  server.Messages()

  // To get access for server messages copies and purge it on server after
  // use MessagesAndPurge() method
  server.MessagesAndPurge()

  // In case with flaky test environment you can wait for the specified number
  // of messages to arrive or until timeout is reached use WaitForMessages() method
  server.WaitForMessages(42, 1 * time.Millisecond)

  // In case with flaky test environment you can wait for the specified number
  // of messages to arrive or until timeout is reached and purge it on server
  // after use WaitForMessagesAndPurge() method
  server.WaitForMessagesAndPurge(42, 1 * time.Millisecond)

  // To stop the server use Stop() method. Please note, smtpmock uses graceful shutdown.
  // It means that smtpmock will end all sessions after client responses or by session
  // timeouts immediately.
  if err := server.Stop(); err != nil {
    fmt.Println(err)
  }
}
```

Code from example above will produce the following output to the configured logger:

```code
INFO: 2021/11/30 22:07:30.554827 SMTP mock server started on port: 2525
INFO: 2021/11/30 22:07:30.554961 SMTP session started
INFO: 2021/11/30 22:07:30.554998 SMTP response: 220 Welcome
INFO: 2021/11/30 22:07:30.555059 SMTP request: EHLO example.com
INFO: 2021/11/30 22:07:30.555648 SMTP response: 250 Received
INFO: 2021/11/30 22:07:30.555686 SMTP request: QUIT
INFO: 2021/11/30 22:07:30.555722 SMTP response: 221 Closing connection
INFO: 2021/11/30 22:07:30.555732 SMTP session finished
WARNING: 2021/11/30 22:07:30.555801 SMTP mock server is in the shutdown mode and won't accept new connections
INFO: 2021/11/30 22:07:30.555808 SMTP mock server was stopped successfully
```

#### Using a custom logger

```go
package main

import (
  "bytes"
  "fmt"
  "net"
  "net/smtp"

  smtpmock "github.com/mocktools/go-smtp-mock/v2"
)

// User-defined loggers can be defined by implementing the Logger interface.
// For example, this custom logger writes to byte buffers instead of os.Stdout/Stderr.
type customLogger struct {
  out *bytes.Buffer
  err *bytes.Buffer
}

func (logger *customLogger) InfoActivity(message string) {
  logger.out.WriteString(message)
}

func (logger *customLogger) Info(message string) {
  logger.out.WriteString(message)
}

func (logger *customLogger) Warning(message string) {
  logger.out.WriteString(message)
}

func (logger *customLogger) Error(message string) {
  logger.err.WriteString(message)
}

func main() {
  // You can pass empty smtpmock.ConfigurationAttr{}. It means that smtpmock will use default settings
  server := smtpmock.New(smtpmock.ConfigurationAttr{
    LogToStdout:       true,
    LogServerActivity: true,
  })

  // The default logger for the server can be substituted with a custom logging implementation.
  // This can be useful in tests where the server logs need to be programatically examined.
  outBuf := &bytes.Buffer{}
  errBuf := &bytes.Buffer{}
  server.WithLogger(&customLogger{
    out: outBuf,
    err: errBuf,
  })

  // To start server use Start() method
  if err := server.Start(); err != nil {
    fmt.Println(err)
  }

  // To stop the server use Stop() method. Please note, smtpmock uses graceful shutdown.
  // It means that smtpmock will end all sessions after client responses or by session
  // timeouts immediately.
  if err := server.Stop(); err != nil {
    fmt.Println(err)
  }
}
```

### Inside of Ruby ecosystem

In Ruby ecosystem `smtpmock` is available as [`smtp_mock`](https://github.com/mocktools/ruby-smtp-mock) gem. It's flexible Ruby wrapper over `smtpmock` binary.

#### Example of usage

First, you should install `smtp_mock` gem and `smtpmock` as system dependency:

```bash
gem install smtp_mock
bundle exec smtp_mock -i ~
```

Now, you can create and interact with your `smtpmock` instance natively from Ruby ecosystem. It comes with default settings out of the box. Configure only what you need, for example:

```ruby
require 'smtp_mock'

# List of all available server options:
# https://github.com/mocktools/ruby-smtp-mock#available-server-options
smtp_mock_server = SmtpMock.start_server(not_registered_emails: %w[user@olo.com user@molo.com])

# returns current smtp mock server port
smtp_mock_server.port # => 55640

# interface for force shutdown current smtp mock server
smtp_mock_server.stop! # => true
```

### Inside of any ecosystem

You can use `smtpmock` as binary. Just download the pre-compiled binary from the [releases page](https://github.com/mocktools/go-smtp-mock/releases) and copy them to the desired location. For start server run command with needed arguments. You can use our bash script for automation this process like in the example below:

```bash
curl -sL https://raw.githubusercontent.com/mocktools/go-smtp-mock/master/script/download.sh | bash
./smtpmock -port=2525 -log
```

#### Configuring with command line arguments

`smtpmock` configuration is available as command line arguments specified in the list below:

| Flag description | Example of usage |
| --- | --- |
| `-host` - host address where smtpmock will run. It's equal to `127.0.0.1` by default | `-host=localhost` |
| `-port` - server port number. If not specified it will be assigned dynamically | `-port=2525` |
| `-log` - enables log server activity. Disabled by default | `-log` |
| `-sessionTimeout` - session timeout in seconds. It's equal to 30 seconds by default | `-sessionTimeout=60` |
| `-shutdownTimeout` - graceful shutdown timeout in seconds. It's equal to 1 second by default | `-shutdownTimeout=5` |
| `-failFast` - enables fail fast scenario. Disabled by default | `-failFast` |
| `-multipleRcptto` - enables multiple `RCPT TO` receiving scenario. Disabled by default | `-multipleRcptto` |
| `-multipleMessageReceiving` - enables multiple message receiving scenario. Disabled by default | `-multipleMessageReceiving` |
| `-blacklistedHeloDomains` - blacklisted `HELO` domains, separated by commas | `-blacklistedHeloDomains="example1.com,example2.com"` |
| `-blacklistedMailfromEmails` - blacklisted `MAIL FROM` emails, separated by commas | `-blacklistedMailfromEmails="a@example1.com,b@example2.com"` |
| `-blacklistedRcpttoEmails` - blacklisted `RCPT TO` emails, separated by commas | `-blacklistedRcpttoEmails="a@example1.com,b@example2.com"` |
| `-notRegisteredEmails` - not registered (non-existent) `RCPT TO` emails, separated by commas | `-notRegisteredEmails="a@example1.com,b@example2.com"` |
| `-responseDelayHelo` - `HELO` response delay in seconds. It's equal to 0 seconds by default | `-responseDelayHelo=2` |
| `-responseDelayMailfrom` - `MAIL FROM` response delay in seconds. It's equal to 0 seconds by default | `-responseDelayMailfrom=2` |
| `-responseDelayRcptto` - `RCPT TO` response delay in seconds. It's equal to 0 seconds by default | `-responseDelayRcptto=2` |
| `-responseDelayData` - `DATA` response delay in seconds. It's equal to 0 seconds by default | `-responseDelayData=2` |
| `-responseDelayMessage` - Message response delay in seconds. It's equal to 0 seconds by default | `-responseDelayMessage=2` |
| `-responseDelayRset` - `RSET` response delay in seconds. It's equal to 0 seconds by default | `-responseDelayRset=2` |
| `-responseDelayNoop` - `NOOP` response delay in seconds. It's equal to 0 seconds by default | `-responseDelayNoop=2` |
| `-responseDelayQuit` - `QUIT` response delay in seconds. It's equal to 0 seconds by default | `-responseDelayQuit=2` |
| `-msgSizeLimit` - message body size limit in bytes. It's equal to `10485760` bytes | `-msgSizeLimit=42` |
| `-msgGreeting` - custom server greeting message | `-msgGreeting="Greeting message"` |
| `-msgInvalidCmd` - custom invalid command message | `-msgInvalidCmd="Invalid command message"` |
| `-msgInvalidCmdHeloSequence` - custom invalid command `HELO` sequence message | `-msgInvalidCmdHeloSequence="Invalid command HELO sequence message"` |
| `-msgInvalidCmdHeloArg` - custom invalid command `HELO` argument message | `-msgInvalidCmdHeloArg="Invalid command HELO argument message"` |
| `-msgHeloBlacklistedDomain` - custom `HELO` blacklisted domain message | `-msgHeloBlacklistedDomain="Blacklisted domain message"` |
| `-msgHeloReceived` - custom `HELO` received message | `-msgHeloReceived="HELO received message"` |
| `-msgInvalidCmdMailfromSequence` - custom invalid command `MAIL FROM` sequence message | `-msgInvalidCmdMailfromSequence="Invalid command MAIL FROM sequence message"` |
| `-msgInvalidCmdMailfromArg` - custom invalid command `MAIL FROM` argument message | `-msgInvalidCmdMailfromArg="Invalid command MAIL FROM argument message"` |
| `-msgMailfromBlacklistedEmail` - custom `MAIL FROM` blacklisted email message | `-msgMailfromBlacklistedEmail="Blacklisted email message"` |
| `-msgMailfromReceived`- custom `MAIL FROM` received message | `-msgMailfromReceived="MAIL FROM received message"` |
| `-msgInvalidCmdRcpttoSequence` - custom invalid command `RCPT TO` sequence message | `-msgInvalidCmdRcpttoSequence="Invalid command RCPT TO sequence message"` |
| `-msgInvalidCmdRcpttoArg` - custom invalid command `RCPT TO` argument message | `-msgInvalidCmdRcpttoArg="Invalid command RCPT TO argument message"` |
| `-msgRcpttoNotRegisteredEmail` - custom `RCPT TO` not registered email message | `-msgRcpttoNotRegisteredEmail="Not registered email message"` |
| `-msgRcpttoBlacklistedEmail` - custom `RCPT TO` blacklisted email message | `-msgRcpttoBlacklistedEmail="Blacklisted email message"` |
| `-msgRcpttoReceived` - custom `RCPT TO` received message | `-msgRcpttoReceived="RCPT TO received message"` |
| `-msgInvalidCmdDataSequence` - custom invalid command `DATA` sequence message | `-msgInvalidCmdDataSequence="Invalid command DATA sequence message"` |
| `-msgDataReceived` - custom `DATA` received message | `-msgDataReceived="DATA received message"` |
| `-msgMsgSizeIsTooBig` - custom size is too big message | `-msgMsgSizeIsTooBig="Message size is too big"` |
| `-msgMsgReceived` - custom received message body message | `-msgMsgReceived="Message has been received"` |
| `-msgInvalidCmdRsetSequence` - custom invalid command `RSET` sequence message | `-msgInvalidCmdRsetSequence="Invalid command RSET sequence message"` |
| `-msgInvalidCmdRsetArg` - custom invalid command `RSET` message | `-msgInvalidCmdRsetArg="Invalid command RSET message"` |
| `-msgRsetReceived` - custom `RSET` received message | `-msgRsetReceived="RSET received message"` |
| `-msgNoopReceived` - custom `NOOP` received message | `-msgNoopReceived="NOOP received message"` |
| `-msgQuitCmd` - custom `QUIT` command message | `-msgQuitCmd="Quit command message"` |

#### Other options

Available not configuration `smtpmock` options:

| Flag description | Example of usage |
| --- | --- |
| `-v` - Just prints current `smtpmock` binary build data (version, commit, datetime). Doesn't run the server. | `-v` |

#### Stopping server

`smtpmock` accepts 3 shutdown signals: `SIGINT`, `SIGQUIT`, `SIGTERM`.

### Implemented SMTP commands

| id | Command | Sequenceable |  Available args | Example of usage |
| --- | --- | --- | --- | --- |
| `1` | `HELO` | no | `domain name`, `localhost`, `ip address`, `[ip address]` | `HELO example.com` |
| `1` | `EHLO` | no | `domain name`, `localhost`, `ip address`, `[ip address]` | `EHLO example.com` |
| `2` | `MAIL FROM` | can be used after command with id `1` and greater | `email address`, `<email address>`, `localhost email address`, `<localhost email address>` | `MAIL FROM: user@domain.com` |
| `3` | `RCPT TO` | can be used after command with id `2` and greater | `email address`, `<email address>`, `localhost email address`, `<localhost email address>` | `RCPT TO: user@domain.com` |
| `4` | `DATA` | can be used after command with id `3` | - | `DATA` |
| `5` | `RSET` | can be used after command with id `1` and greater | - | `RSET` |
| `6` | `NOOP` | no | - | `NOOP` |
| `7` | `QUIT` | no | - | `QUIT` |

Please note in case when same command used more the one time during same session all saved data upper this command will be erased.

## Contributing

Bug reports and pull requests are welcome on GitHub at <https://github.com/mocktools/go-smtp-mock>. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [Contributor Covenant](http://contributor-covenant.org) code of conduct. Please check the [open tickets](https://github.com/mocktools/go-smtp-mock/issues). Be sure to follow Contributor Code of Conduct below and our [Contributing Guidelines](CONTRIBUTING.md).

## License

This golang package is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).

## Code of Conduct

Everyone interacting in the `smtpmock` project’s codebases, issue trackers, chat rooms and mailing lists is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).

## Credits

- [The Contributors](https://github.com/mocktools/go-smtp-mock/graphs/contributors) for code and awesome suggestions
- [The Stargazers](https://github.com/mocktools/go-smtp-mock/stargazers) for showing their support

## Versioning

`smtpmock` uses [Semantic Versioning 2.0.0](https://semver.org)
