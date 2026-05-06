package smtpmock

import "errors"

// MAILFROM command handler
type handlerMailfrom struct {
	*handler
}

// MAILFROM command handler builder. Returns pointer to new handlerHelo structure
func newHandlerMailfrom(session sessionInterface, message *Message, configuration *configuration) *handlerMailfrom {
	return &handlerMailfrom{&handler{session: session, message: message, configuration: configuration}}
}

// MAILFROM handler methods

// Main MAILFROM handler runner
func (handler *handlerMailfrom) run(request string) {
	handler.clearError()
	handler.clearMessage()

	if handler.isInvalidRequest(request) {
		return
	}

	handler.writeResult(true, request, handler.configuration.msgMailfromReceived)
}

// Erases all message data from MAILFROM command
func (handler *handlerMailfrom) clearMessage() {
	messageWithData := handler.message
	clearedMessage := &Message{
		heloRequest:  messageWithData.heloRequest,
		heloResponse: messageWithData.heloResponse,
		helo:         messageWithData.helo,
	}
	*messageWithData = *clearedMessage
}

// Writes handled HELO result to session, message. Always returns true
func (handler *handlerMailfrom) writeResult(isSuccessful bool, request, response string) bool {
	session, message := handler.session, handler.message
	if !isSuccessful {
		session.addError(errors.New(response))
	}

	message.mailfromRequest, message.mailfromResponse, message.mailfrom = request, response, isSuccessful
	session.writeResponse(response, handler.configuration.responseDelayMailfrom)
	return true
}

// Invalid MAILFROM command sequence predicate. Returns true and writes result for case when
// MAILFROM command sequence is invalid (HELO command was failure), otherwise returns false
func (handler *handlerMailfrom) isInvalidCmdSequence(request string) bool {
	if !handler.message.helo {
		return handler.writeResult(false, request, handler.configuration.msgInvalidCmdMailfromSequence)
	}

	return false
}

// Invalid MAILFROM command argument predicate. Returns true and writes result for case when
// MAILFROM command argument is invalid, otherwise returns false
func (handler *handlerMailfrom) isInvalidCmdArg(request string) bool {
	if !matchRegex(request, validMailromComplexCmdRegexPattern) {
		return handler.writeResult(false, request, handler.configuration.msgInvalidCmdMailfromArg)
	}

	return false
}

// Returns email from MAILFROM request
func (handler *handlerMailfrom) mailfromEmail(request string) string {
	return regexCaptureGroup(request, validMailromComplexCmdRegexPattern, 3)
}

// Custom behavior for MAILFROM email. Returns true and writes result for case when
// MAILFROM email is included in configuration.blacklistedMailfromEmails slice
func (handler *handlerMailfrom) isBlacklistedEmail(request string) bool {
	configuration := handler.configuration
	if isIncluded(configuration.blacklistedMailfromEmails, handler.mailfromEmail(request)) {
		return handler.writeResult(false, request, configuration.msgMailfromBlacklistedEmail)
	}

	return false
}

// Invalid MAILFROM command request complex predicate. Returns true for case when one
// of the chain checks returns true, otherwise returns false
func (handler *handlerMailfrom) isInvalidRequest(request string) bool {
	return handler.isInvalidCmdSequence(request) ||
		handler.isInvalidCmdArg(request) ||
		handler.isBlacklistedEmail(request)
}
