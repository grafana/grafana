package smtpmock

import "log"

const (
	// SMTP mock default messages
	defaultGreetingMsg                   = "220 Welcome"
	defaultQuitMsg                       = "221 Closing connection"
	defaultOkMsg                         = "250 Ok"
	defaultReceivedMsg                   = "250 Received"
	defaultReadyForReceiveMsg            = "354 Ready for receive message. End data with <CR><LF>.<CR><LF>"
	defaultTransientNegativeMsg          = "421 Service not available"
	defaultInvalidCmdHeloArgMsg          = "501 HELO requires domain address or valid address literal"
	defaultInvalidCmdMailfromArgMsg      = "501 MAIL FROM requires valid email address"
	defaultInvalidCmdRcpttoArgMsg        = "501 RCPT TO requires valid email address"
	defaultInvalidCmdMsg                 = "502 Command unrecognized. Available commands: HELO, EHLO, MAIL FROM:, RCPT TO:, DATA, RSET, NOOP, QUIT"
	defaultInvalidCmdHeloSequenceMsg     = "503 Bad sequence of commands. HELO should be the first"
	defaultInvalidCmdMailfromSequenceMsg = "503 Bad sequence of commands. MAIL FROM should be used after HELO"
	defaultInvalidCmdRcpttoSequenceMsg   = "503 Bad sequence of commands. RCPT TO should be used after MAIL FROM"
	defaultInvalidCmdDataSequenceMsg     = "503 Bad sequence of commands. DATA should be used after RCPT TO"
	defaultNotRegistredRcpttoEmailMsg    = "550 User not found"
	defaultMsgSizeIsTooBigMsg            = "552 Message exceeded max size of"

	// Logger
	infoLogLevel    = "INFO"
	warningLogLevel = "WARNING"
	errorLogLevel   = "ERROR"
	logFlag         = log.Ldate | log.Lmicroseconds

	// Session
	sessionStartMsg         = "SMTP session started"
	sessionRequestMsg       = "SMTP request: "
	sessionResponseMsg      = "SMTP response: "
	sessionResponseDelayMsg = "SMTP response delay"
	sessionEndMsg           = "SMTP session finished"
	sessionBinaryDataMsg    = "message binary data portion"

	// Server
	networkProtocol                  = "tcp"
	defaultHostAddress               = "0.0.0.0"
	defaultMessageSizeLimit          = 10485760 // in bytes (10MB)
	defaultSessionTimeout            = 30       // in seconds
	defaultShutdownTimeout           = 1        // in seconds
	defaultSessionResponseDelay      = 0        // in seconds
	serverStartMsg                   = "SMTP mock server started on port"
	serverStartErrorMsg              = "Unable to start SMTP mock server. Server must be inactive"
	serverErrorMsg                   = "Failed to start SMTP mock server on port"
	serverStopErrorMsg               = "Unable to stop SMTP mock server. Server must be active"
	serverNotAcceptNewConnectionsMsg = "SMTP mock server is in the shutdown mode and won't accept new connections"
	serverStopMsg                    = "SMTP mock server was stopped successfully"
	serverForceStopMsg               = "SMTP mock server was force stopped by timeout"

	// Regex patterns
	availableCmdsRegexPattern  = `(?i)helo|ehlo|mail from:|rcpt to:|data|rset|noop|quit`
	domainRegexPattern         = `(?i)([\p{L}0-9]+([\-.]{1}[\p{L}0-9]+)*\.\p{L}{2,63}|localhost)`
	emailRegexPattern          = `(?i)<?((.+)@` + domainRegexPattern + `)>?`
	ipAddressRegexPattern      = `(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}`
	addressLiteralRegexPattern = `|\[` + ipAddressRegexPattern + `\]`

	validHeloCmdsRegexPattern          = `(?i)helo|ehlo`
	validMailfromCmdRegexPattern       = `(?i)mail from:`
	validRcpttoCmdRegexPattern         = `(?i)rcpt to:`
	validDataCmdRegexPattern           = `\A(?i)data\z`
	validRsetCmdRegexPattern           = `\A(?i)rset\z`
	validNoopCmdRegexPattern           = `\A(?i)noop\z`
	validQuitCmdRegexPattern           = `\A(?i)quit\z`
	validHeloComplexCmdRegexPattern    = `\A(` + validHeloCmdsRegexPattern + `) (` + domainRegexPattern + `|` + ipAddressRegexPattern + addressLiteralRegexPattern + `)\z`
	validMailromComplexCmdRegexPattern = `\A(` + validMailfromCmdRegexPattern + `) ?(` + emailRegexPattern + `)\z`
	validRcpttoComplexCmdRegexPattern  = `\A(` + validRcpttoCmdRegexPattern + `) ?(` + emailRegexPattern + `)\z`

	// Helpers
	emptyString = ""
)
