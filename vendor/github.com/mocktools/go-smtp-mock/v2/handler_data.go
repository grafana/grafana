package smtpmock

import "errors"

// DATA command handler
type handlerData struct {
	*handler
	handlerMessage handlerMessageInterface
}

// DATA command handler builder. Returns pointer to new handlerData structure
func newHandlerData(session sessionInterface, message *Message, configuration *configuration) *handlerData {
	return &handlerData{
		&handler{session: session, message: message, configuration: configuration},
		newHandlerMessage(session, message, configuration),
	}
}

// DATA handler methods

// Main DATA handler runner
func (handler *handlerData) run(request string) {
	handler.clearError()
	handler.clearMessage()

	if handler.isInvalidRequest(request) {
		return
	}

	handler.writeResult(true, request, handler.configuration.msgDataReceived)
	handler.processIncomingMessage()
}

// Erases all message data from DATA command
func (handler *handlerData) clearMessage() {
	messageWithData := handler.message
	clearedMessage := &Message{
		heloRequest:           messageWithData.heloRequest,
		heloResponse:          messageWithData.heloResponse,
		helo:                  messageWithData.helo,
		mailfromRequest:       messageWithData.mailfromRequest,
		mailfromResponse:      messageWithData.mailfromResponse,
		mailfrom:              messageWithData.mailfrom,
		rcpttoRequestResponse: messageWithData.rcpttoRequestResponse,
		rcptto:                messageWithData.rcptto,
	}
	*messageWithData = *clearedMessage
}

// Reads and saves message body context using handlerMessage under the hood
func (handler *handlerData) processIncomingMessage() {
	handler.handlerMessage.run()
}

// Writes handled DATA result to session, message. Always returns true
func (handler *handlerData) writeResult(isSuccessful bool, request, response string) bool {
	session, message := handler.session, handler.message
	if !isSuccessful {
		session.addError(errors.New(response))
	}

	message.dataRequest, message.dataResponse, message.data = request, response, isSuccessful
	session.writeResponse(response, handler.configuration.responseDelayData)
	return true
}

// Invalid DATA command sequence predicate. Returns true and writes result for case
// when DATA command sequence is invalid, otherwise returns false
func (handler *handlerData) isInvalidCmdSequence(request string) bool {
	message := handler.message
	if !(message.helo && message.mailfrom && message.rcptto) {
		return handler.writeResult(false, request, handler.configuration.msgInvalidCmdDataSequence)
	}

	return false
}

// Invalid DATA command predicate. Returns true and writes result for case
// when DATA command is invalid, otherwise returns false
func (handler *handlerData) isInvalidCmd(request string) bool {
	if !matchRegex(request, validDataCmdRegexPattern) {
		return handler.writeResult(false, request, handler.configuration.msgInvalidCmd)
	}

	return false
}

// Invalid DATA command predicate. Returns true and writes result for case
// when request is invalid, otherwise returns false.
func (handler *handlerData) isInvalidRequest(request string) bool {
	return handler.isInvalidCmdSequence(request) || handler.isInvalidCmd(request)
}
