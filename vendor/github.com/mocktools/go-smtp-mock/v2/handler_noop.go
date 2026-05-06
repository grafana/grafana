package smtpmock

// NOOP command handler
type handlerNoop struct {
	*handler
}

// NOOP command handler builder. Returns pointer to new handlerNoop structure
func newHandlerNoop(session sessionInterface, message *Message, configuration *configuration) *handlerNoop {
	return &handlerNoop{&handler{session: session, message: message, configuration: configuration}}
}

// NOOP handler methods

// Main NOOP handler runner
func (handler *handlerNoop) run(request string) {
	if handler.isInvalidRequest(request) {
		return
	}

	handler.message.noop = true
	configuration := handler.configuration
	handler.session.writeResponse(configuration.msgNoopReceived, configuration.responseDelayNoop)
}

// Invalid NOOP command predicate. Returns true when request is invalid, otherwise returns false
func (handler *handlerNoop) isInvalidRequest(request string) bool {
	return !matchRegex(request, validNoopCmdRegexPattern)
}
