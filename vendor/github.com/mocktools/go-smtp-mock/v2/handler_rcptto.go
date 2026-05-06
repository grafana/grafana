package smtpmock

import "errors"

// RCPTTO command handler
type handlerRcptto struct {
	*handler
}

// RCPTTO command handler builder. Returns pointer to new handlerRcptto structure
func newHandlerRcptto(session sessionInterface, message *Message, configuration *configuration) *handlerRcptto {
	return &handlerRcptto{&handler{session: session, message: message, configuration: configuration}}
}

// RCPTTO handler methods

// Main RCPTTO handler runner
func (handler *handlerRcptto) run(request string) {
	handler.clearError()
	handler.clearMessage()

	if handler.isInvalidRequest(request) {
		return
	}

	handler.writeResult(true, request, handler.configuration.msgRcpttoReceived)
}

// Erases all message data from RCPTTO command when multiple RCPTTO scenario is disabled
func (handler *handlerRcptto) clearMessage() {
	if !handler.configuration.multipleRcptto {
		messageWithData := handler.message
		clearedMessage := &Message{
			heloRequest:      messageWithData.heloRequest,
			heloResponse:     messageWithData.heloResponse,
			helo:             messageWithData.helo,
			mailfromRequest:  messageWithData.mailfromRequest,
			mailfromResponse: messageWithData.mailfromResponse,
			mailfrom:         messageWithData.mailfrom,
		}
		*messageWithData = *clearedMessage
	}
}

// RCPTTO message status resolver. Returns true when current RCPTTO status is true or
// when multiple RCPTTO scenario is enabled and message includes at least one successful
// RCPTTO response. Otherwise returns false
func (handler *handlerRcptto) resolveMessageStatus(currentRcpttoStatus bool) bool {
	configuration, message := handler.configuration, handler.message
	multipleRcptto, msgRcpttoReceived := configuration.multipleRcptto, configuration.msgRcpttoReceived

	return currentRcpttoStatus || (multipleRcptto && message.isIncludesSuccessfulRcpttoResponse(msgRcpttoReceived))
}

// Writes handled RCPTTO result to session, message. Always returns true
func (handler *handlerRcptto) writeResult(isSuccessful bool, request, response string) bool {
	session, message := handler.session, handler.message
	if !isSuccessful {
		session.addError(errors.New(response))
	}

	message.rcpttoRequestResponse = append(message.rcpttoRequestResponse, []string{request, response})
	message.rcptto = handler.resolveMessageStatus(isSuccessful)
	session.writeResponse(response, handler.configuration.responseDelayRcptto)
	return true
}

// Invalid RCPTTO command sequence predicate. Returns true and writes result for case when RCPTTO
// command sequence is invalid, otherwise returns false
func (handler *handlerRcptto) isInvalidCmdSequence(request string) bool {
	message := handler.message
	if !(message.helo && message.mailfrom) {
		return handler.writeResult(false, request, handler.configuration.msgInvalidCmdRcpttoSequence)
	}

	return false
}

// Invalid RCPTTO command argument predicate. Returns true and writes result for case when RCPTTO
// command argument is invalid, otherwise returns false
func (handler *handlerRcptto) isInvalidCmdArg(request string) bool {
	if !matchRegex(request, validRcpttoComplexCmdRegexPattern) {
		return handler.writeResult(false, request, handler.configuration.msgInvalidCmdRcpttoArg)
	}

	return false
}

// Returns email from RCPTTO request
func (handler *handlerRcptto) rcpttoEmail(request string) string {
	return regexCaptureGroup(request, validRcpttoComplexCmdRegexPattern, 3)
}

// Custom behavior for RCPTTO email. Returns true and writes result for case when
// RCPTTO email is included in configuration.blacklistedRcpttoEmails slice
func (handler *handlerRcptto) isBlacklistedEmail(request string) bool {
	configuration := handler.configuration
	if isIncluded(configuration.blacklistedRcpttoEmails, handler.rcpttoEmail(request)) {
		return handler.writeResult(false, request, configuration.msgRcpttoBlacklistedEmail)

	}

	return false
}

// Custom behavior for RCPTTO email. Returns true and writes result for case when
// RCPTTO email is included in configuration.notRegisteredEmails slice
func (handler *handlerRcptto) isNotRegisteredEmail(request string) bool {
	configuration := handler.configuration
	if isIncluded(configuration.notRegisteredEmails, handler.rcpttoEmail(request)) {
		return handler.writeResult(false, request, configuration.msgRcpttoNotRegisteredEmail)
	}

	return false
}

// Invalid RCPTTO command request complex predicate. Returns true for case when one
// of the chain checks returns true, otherwise returns false
func (handler *handlerRcptto) isInvalidRequest(request string) bool {
	return handler.isInvalidCmdSequence(request) ||
		handler.isInvalidCmdArg(request) ||
		handler.isBlacklistedEmail(request) ||
		handler.isNotRegisteredEmail(request)
}
