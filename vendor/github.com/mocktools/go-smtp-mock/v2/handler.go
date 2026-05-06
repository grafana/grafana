package smtpmock

// Base handler
type handler struct {
	session       sessionInterface
	message       *Message
	configuration *configuration
}

// handler methods

// Erases session error
func (handler *handler) clearError() {
	handler.session.clearError()
}
