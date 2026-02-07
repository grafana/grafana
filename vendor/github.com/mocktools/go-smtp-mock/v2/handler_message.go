package smtpmock

import (
	"bytes"
	"errors"
)

// Message handler interface
type handlerMessageInterface interface {
	run()
}

// Message handler
type handlerMessage struct {
	*handler
}

// Message handler builder. Returns pointer to new handlerMessage structure
func newHandlerMessage(session sessionInterface, message *Message, configuration *configuration) *handlerMessage {
	return &handlerMessage{&handler{session: session, message: message, configuration: configuration}}
}

// Message handler methods

// Main message handler runner
func (handler *handlerMessage) run() {
	var request string
	var msgData []byte
	session, configuration := handler.session, handler.configuration

	for {
		line, err := session.readBytes()
		if err != nil {
			return
		}

		// Handles end of data denoted by lone period (\r\n.\r\n)
		if bytes.Equal(line, []byte(".\r\n")) {
			break
		}

		// Removes leading period (RFC 5321 section 4.5.2)
		if line[0] == '.' {
			line = line[1:]
		}

		// Enforces the maximum message size limit
		if len(msgData)+len(line) > configuration.msgSizeLimit {
			session.discardBufin()
			handler.writeResult(false, request, configuration.msgMsgSizeIsTooBig)
			return
		}

		msgData = append(msgData, line...)
	}

	handler.writeResult(true, string(msgData), configuration.msgMsgReceived)
}

// Writes handled message result to session, message. Always returns true
func (handler *handlerMessage) writeResult(isSuccessful bool, request, response string) bool {
	session, message := handler.session, handler.message
	if !isSuccessful {
		session.addError(errors.New(response))
	}

	message.msgRequest, message.msgResponse, message.msg = request, response, isSuccessful
	session.writeResponse(response, handler.configuration.responseDelayMessage)
	return true
}
