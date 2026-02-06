package smtpmock

// QUIT command handler
type handlerQuit struct {
	*handler
}

// QUIT command handler builder. Returns pointer to new handlerQuit structure
func newHandlerQuit(session sessionInterface, message *Message, configuration *configuration) *handlerQuit {
	return &handlerQuit{&handler{session: session, message: message, configuration: configuration}}
}

// QUIT handler methods

// Main QUIT handler runner
func (handler *handlerQuit) run(request string) {
	if handler.isInvalidRequest(request) {
		return
	}

	handler.message.quitSent = true
	configuration := handler.configuration
	handler.session.writeResponse(configuration.msgQuitCmd, configuration.responseDelayQuit)
}

// Invalid QUIT command predicate. Returns true when request is invalid, otherwise returns false
func (handler *handlerQuit) isInvalidRequest(request string) bool {
	return !matchRegex(request, validQuitCmdRegexPattern)
}
