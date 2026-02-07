package smtpmock

import "fmt"

// SMTP mock configuration structure. Provides to configure mock behavior
type configuration struct {
	hostAddress                   string
	portNumber                    int
	logToStdout                   bool
	logServerActivity             bool
	isCmdFailFast                 bool
	multipleRcptto                bool
	multipleMessageReceiving      bool
	msgGreeting                   string
	msgInvalidCmd                 string
	msgQuitCmd                    string
	msgInvalidCmdHeloSequence     string
	msgInvalidCmdHeloArg          string
	msgHeloBlacklistedDomain      string
	msgHeloReceived               string
	msgInvalidCmdMailfromSequence string
	msgInvalidCmdMailfromArg      string
	msgMailfromBlacklistedEmail   string
	msgMailfromReceived           string
	msgInvalidCmdRcpttoSequence   string
	msgInvalidCmdRcpttoArg        string
	msgRcpttoNotRegisteredEmail   string
	msgRcpttoBlacklistedEmail     string
	msgRcpttoReceived             string
	msgInvalidCmdDataSequence     string
	msgDataReceived               string
	msgMsgSizeIsTooBig            string
	msgMsgReceived                string
	msgInvalidCmdRsetSequence     string
	msgInvalidCmdRsetArg          string
	msgRsetReceived               string
	msgNoopReceived               string
	blacklistedHeloDomains        []string
	blacklistedMailfromEmails     []string
	blacklistedRcpttoEmails       []string
	notRegisteredEmails           []string
	responseDelayHelo             int
	responseDelayMailfrom         int
	responseDelayRcptto           int
	responseDelayData             int
	responseDelayMessage          int
	responseDelayRset             int
	responseDelayNoop             int
	responseDelayQuit             int
	msgSizeLimit                  int
	sessionTimeout                int
	shutdownTimeout               int

	// TODO: add ability to send 221 response before end of session for case when fail fast scenario enabled
}

// New configuration builder. Returns pointer to valid new configuration structure
func newConfiguration(config ConfigurationAttr) *configuration {
	config.assignDefaultValues()

	return &configuration{
		hostAddress:                   config.HostAddress,
		portNumber:                    config.PortNumber,
		logToStdout:                   config.LogToStdout,
		logServerActivity:             config.LogServerActivity,
		isCmdFailFast:                 config.IsCmdFailFast,
		multipleRcptto:                config.MultipleRcptto,
		multipleMessageReceiving:      config.MultipleMessageReceiving,
		msgGreeting:                   config.MsgGreeting,
		msgInvalidCmd:                 config.MsgInvalidCmd,
		msgInvalidCmdHeloSequence:     config.MsgInvalidCmdHeloSequence,
		msgInvalidCmdHeloArg:          config.MsgInvalidCmdHeloArg,
		msgHeloBlacklistedDomain:      config.MsgHeloBlacklistedDomain,
		msgHeloReceived:               config.MsgHeloReceived,
		msgInvalidCmdMailfromSequence: config.MsgInvalidCmdMailfromSequence,
		msgInvalidCmdMailfromArg:      config.MsgInvalidCmdMailfromArg,
		msgMailfromBlacklistedEmail:   config.MsgMailfromBlacklistedEmail,
		msgMailfromReceived:           config.MsgMailfromReceived,
		msgInvalidCmdRcpttoSequence:   config.MsgInvalidCmdRcpttoSequence,
		msgInvalidCmdRcpttoArg:        config.MsgInvalidCmdRcpttoArg,
		msgRcpttoNotRegisteredEmail:   config.MsgRcpttoNotRegisteredEmail,
		msgRcpttoBlacklistedEmail:     config.MsgRcpttoBlacklistedEmail,
		msgRcpttoReceived:             config.MsgRcpttoReceived,
		msgInvalidCmdDataSequence:     config.MsgInvalidCmdDataSequence,
		msgDataReceived:               config.MsgDataReceived,
		msgMsgSizeIsTooBig:            config.MsgMsgSizeIsTooBig,
		msgMsgReceived:                config.MsgMsgReceived,
		msgInvalidCmdRsetSequence:     config.MsgInvalidCmdRsetSequence,
		msgInvalidCmdRsetArg:          config.MsgInvalidCmdRsetArg,
		msgRsetReceived:               config.MsgRsetReceived,
		msgNoopReceived:               config.MsgNoopReceived,
		msgQuitCmd:                    config.MsgQuitCmd,
		blacklistedHeloDomains:        config.BlacklistedHeloDomains,
		blacklistedMailfromEmails:     config.BlacklistedMailfromEmails,
		blacklistedRcpttoEmails:       config.BlacklistedRcpttoEmails,
		notRegisteredEmails:           config.NotRegisteredEmails,
		responseDelayHelo:             config.ResponseDelayHelo,
		responseDelayMailfrom:         config.ResponseDelayMailfrom,
		responseDelayRcptto:           config.ResponseDelayRcptto,
		responseDelayData:             config.ResponseDelayData,
		responseDelayMessage:          config.ResponseDelayMessage,
		responseDelayRset:             config.ResponseDelayRset,
		responseDelayNoop:             config.ResponseDelayNoop,
		responseDelayQuit:             config.ResponseDelayQuit,
		msgSizeLimit:                  config.MsgSizeLimit,
		sessionTimeout:                config.SessionTimeout,
		shutdownTimeout:               config.ShutdownTimeout,
	}
}

// ConfigurationAttr kwargs structure for configuration builder
type ConfigurationAttr struct {
	HostAddress                   string
	PortNumber                    int
	LogToStdout                   bool
	LogServerActivity             bool
	IsCmdFailFast                 bool
	MultipleRcptto                bool
	MultipleMessageReceiving      bool
	MsgGreeting                   string
	MsgInvalidCmd                 string
	MsgQuitCmd                    string
	MsgInvalidCmdHeloSequence     string
	MsgInvalidCmdHeloArg          string
	MsgHeloBlacklistedDomain      string
	MsgHeloReceived               string
	MsgInvalidCmdMailfromSequence string
	MsgInvalidCmdMailfromArg      string
	MsgMailfromBlacklistedEmail   string
	MsgMailfromReceived           string
	MsgInvalidCmdRcpttoSequence   string
	MsgInvalidCmdRcpttoArg        string
	MsgRcpttoNotRegisteredEmail   string
	MsgRcpttoBlacklistedEmail     string
	MsgRcpttoReceived             string
	MsgInvalidCmdDataSequence     string
	MsgDataReceived               string
	MsgMsgSizeIsTooBig            string
	MsgMsgReceived                string
	MsgInvalidCmdRsetSequence     string
	MsgInvalidCmdRsetArg          string
	MsgRsetReceived               string
	MsgNoopReceived               string
	BlacklistedHeloDomains        []string
	BlacklistedMailfromEmails     []string
	BlacklistedRcpttoEmails       []string
	NotRegisteredEmails           []string
	ResponseDelayHelo             int
	ResponseDelayMailfrom         int
	ResponseDelayRcptto           int
	ResponseDelayData             int
	ResponseDelayMessage          int
	ResponseDelayRset             int
	ResponseDelayNoop             int
	ResponseDelayQuit             int
	MsgSizeLimit                  int
	SessionTimeout                int
	ShutdownTimeout               int
}

// ConfigurationAttr methods

// Assigns server defaults
func (config *ConfigurationAttr) assignServerDefaultValues() {
	if config.HostAddress == emptyString {
		config.HostAddress = defaultHostAddress
	}
	if config.MsgGreeting == emptyString {
		config.MsgGreeting = defaultGreetingMsg
	}
	if config.MsgInvalidCmd == emptyString {
		config.MsgInvalidCmd = defaultInvalidCmdMsg
	}
	if config.MsgQuitCmd == emptyString {
		config.MsgQuitCmd = defaultQuitMsg
	}
	if config.SessionTimeout == 0 {
		config.SessionTimeout = defaultSessionTimeout
	}
	if config.ShutdownTimeout == 0 {
		config.ShutdownTimeout = defaultShutdownTimeout
	}
}

// Assigns handlerHelo defaults
func (config *ConfigurationAttr) assignHandlerHeloDefaultValues() {
	if config.MsgInvalidCmdHeloSequence == emptyString {
		config.MsgInvalidCmdHeloSequence = defaultInvalidCmdHeloSequenceMsg
	}
	if config.MsgInvalidCmdHeloArg == emptyString {
		config.MsgInvalidCmdHeloArg = defaultInvalidCmdHeloArgMsg
	}
	if config.MsgHeloBlacklistedDomain == emptyString {
		config.MsgHeloBlacklistedDomain = defaultTransientNegativeMsg
	}
	if config.MsgHeloReceived == emptyString {
		config.MsgHeloReceived = defaultReceivedMsg
	}
}

// Assigns handlerMailfrom defaults
func (config *ConfigurationAttr) assignHandlerMailfromDefaultValues() {
	if config.MsgInvalidCmdMailfromSequence == emptyString {
		config.MsgInvalidCmdMailfromSequence = defaultInvalidCmdMailfromSequenceMsg
	}
	if config.MsgInvalidCmdMailfromArg == emptyString {
		config.MsgInvalidCmdMailfromArg = defaultInvalidCmdMailfromArgMsg
	}
	if config.MsgMailfromBlacklistedEmail == emptyString {
		config.MsgMailfromBlacklistedEmail = defaultTransientNegativeMsg
	}
	if config.MsgMailfromReceived == emptyString {
		config.MsgMailfromReceived = defaultReceivedMsg
	}
}

// Assigns handlerRcptto defaults
func (config *ConfigurationAttr) assignHandlerRcpttoDefaultValues() {
	if config.MsgInvalidCmdRcpttoSequence == emptyString {
		config.MsgInvalidCmdRcpttoSequence = defaultInvalidCmdRcpttoSequenceMsg
	}
	if config.MsgInvalidCmdRcpttoArg == emptyString {
		config.MsgInvalidCmdRcpttoArg = defaultInvalidCmdRcpttoArgMsg
	}
	if config.MsgRcpttoBlacklistedEmail == emptyString {
		config.MsgRcpttoBlacklistedEmail = defaultTransientNegativeMsg
	}
	if config.MsgRcpttoNotRegisteredEmail == emptyString {
		config.MsgRcpttoNotRegisteredEmail = defaultNotRegistredRcpttoEmailMsg
	}
	if config.MsgRcpttoReceived == emptyString {
		config.MsgRcpttoReceived = defaultReceivedMsg
	}
}

// Assigns handlerData defaults
func (config *ConfigurationAttr) assignHandlerDataDefaultValues() {
	if config.MsgInvalidCmdDataSequence == emptyString {
		config.MsgInvalidCmdDataSequence = defaultInvalidCmdDataSequenceMsg
	}
	if config.MsgDataReceived == emptyString {
		config.MsgDataReceived = defaultReadyForReceiveMsg
	}
}

// Assigns handlerMessage defaults
func (config *ConfigurationAttr) assignHandlerMessageDefaultValues() {
	if config.MsgSizeLimit == 0 {
		config.MsgSizeLimit = defaultMessageSizeLimit
	}
	if config.MsgMsgSizeIsTooBig == emptyString {
		config.MsgMsgSizeIsTooBig = fmt.Sprintf(defaultMsgSizeIsTooBigMsg+" %d bytes", config.MsgSizeLimit)
	}
	if config.MsgMsgReceived == emptyString {
		config.MsgMsgReceived = defaultReceivedMsg
	}
}

// Assigns handlerRset defaults
func (config *ConfigurationAttr) assignHandlerRsetDefaultValues() {
	if config.MsgInvalidCmdRsetSequence == emptyString {
		config.MsgInvalidCmdRsetSequence = defaultInvalidCmdHeloSequenceMsg
	}
	if config.MsgInvalidCmdRsetArg == emptyString {
		config.MsgInvalidCmdRsetArg = defaultInvalidCmdMsg
	}
	if config.MsgRsetReceived == emptyString {
		config.MsgRsetReceived = defaultOkMsg
	}
}

// Assigns handlerRset defaults
func (config *ConfigurationAttr) assignHandlerNoopDefaultValues() {
	if config.MsgNoopReceived == emptyString {
		config.MsgNoopReceived = defaultOkMsg
	}
}

// Assigns default values to ConfigurationAttr fields
func (config *ConfigurationAttr) assignDefaultValues() {
	config.assignServerDefaultValues()
	config.assignHandlerHeloDefaultValues()
	config.assignHandlerMailfromDefaultValues()
	config.assignHandlerRcpttoDefaultValues()
	config.assignHandlerDataDefaultValues()
	config.assignHandlerMessageDefaultValues()
	config.assignHandlerRsetDefaultValues()
	config.assignHandlerNoopDefaultValues()
}
