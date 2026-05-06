package smtpmock

import "errors"

// RSET command handler
type handlerRset struct {
	*handler
}

// RSET command handler builder. Returns pointer to new handlerRset structure
func newHandlerRset(session sessionInterface, message *Message, configuration *configuration) *handlerRset {
	return &handlerRset{&handler{session: session, message: message, configuration: configuration}}
}

// RSET handler methods

// Main RSET handler runner
func (handler *handlerRset) run(request string) {
	handler.clearError()
	handler.clearMessage()

	if handler.isInvalidRequest(request) {
		return
	}

	handler.writeResult(true, request, handler.configuration.msgRsetReceived)
}

// Erases all message data except HELO/EHLO command context and changes cleared status to true
// for case when not multiple message receiving condition
func (handler *handlerRset) clearMessage() {
	messageWithData, configuration := handler.message, handler.configuration

	if !(configuration.multipleMessageReceiving && messageWithData.IsConsistent()) {
		clearedMessage := &Message{
			heloRequest:  messageWithData.heloRequest,
			heloResponse: messageWithData.heloResponse,
			helo:         messageWithData.helo,
		}
		*messageWithData = *clearedMessage
	}
}

// Writes handled RSET result to session, message. Always returns true
func (handler *handlerRset) writeResult(isSuccessful bool, request, response string) bool {
	session, message := handler.session, handler.message
	if !isSuccessful {
		session.addError(errors.New(response))
	}

	message.rsetRequest, message.rsetResponse, message.rset = request, response, isSuccessful
	session.writeResponse(response, handler.configuration.responseDelayRset)
	return true
}

// Invalid RSET command sequence predicate. Returns true and writes result for case when
// RSET command sequence is invalid (HELO command was failure), otherwise returns false
func (handler *handlerRset) isInvalidCmdSequence(request string) bool {
	if !handler.message.helo {
		return handler.writeResult(false, request, handler.configuration.msgInvalidCmdRsetSequence)
	}

	return false
}

// Invalid RSET command argument predicate. Returns true and writes result for case when
// RSET command argument is invalid, otherwise returns false
func (handler *handlerRset) isInvalidCmdArg(request string) bool {
	if !matchRegex(request, validRsetCmdRegexPattern) {
		return handler.writeResult(false, request, handler.configuration.msgInvalidCmdRsetArg)
	}

	return false
}

// Invalid RSET command request complex predicate. Returns true for case when one
// of the chain checks returns true, otherwise returns false
func (handler *handlerRset) isInvalidRequest(request string) bool {
	return handler.isInvalidCmdSequence(request) || handler.isInvalidCmdArg(request)
}
