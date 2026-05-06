package smtpmock

import "sync"

// Structure for storing the result of SMTP client-server interaction. Context-included
// commands should be represented as request/response structure fields
type Message struct {
	heloRequest, heloResponse                               string
	mailfromRequest, mailfromResponse                       string
	rcpttoRequestResponse                                   [][]string
	dataRequest, dataResponse                               string
	msgRequest, msgResponse                                 string
	rsetRequest, rsetResponse                               string
	helo, mailfrom, rcptto, data, msg, rset, noop, quitSent bool
}

// message methods

// message getters

// Getter for heloRequest field
func (message Message) HeloRequest() string {
	return message.heloRequest
}

// Getter for heloResponse field
func (message Message) HeloResponse() string {
	return message.heloResponse
}

// Getter for helo field
func (message Message) Helo() bool {
	return message.helo
}

// Getter for mailfromRequest field
func (message Message) MailfromRequest() string {
	return message.mailfromRequest
}

// Getter for mailfromResponse field
func (message Message) MailfromResponse() string {
	return message.mailfromResponse
}

// Getter for mailfrom field
func (message Message) Mailfrom() bool {
	return message.mailfrom
}

// Getter for rcpttoRequestResponse field
func (message Message) RcpttoRequestResponse() [][]string {
	return message.rcpttoRequestResponse
}

// Getter for rcptto field
func (message Message) Rcptto() bool {
	return message.rcptto
}

// Getter for dataRequest field
func (message Message) DataRequest() string {
	return message.dataRequest
}

// Getter for dataResponse field
func (message Message) DataResponse() string {
	return message.dataResponse
}

// Getter for data field
func (message Message) Data() bool {
	return message.data
}

// Getter for msgRequest field
func (message Message) MsgRequest() string {
	return message.msgRequest
}

// Getter for msgResponse field
func (message Message) MsgResponse() string {
	return message.msgResponse
}

// Getter for msg field
func (message Message) Msg() bool {
	return message.msg
}

// Getter for rsetRequest field
func (message Message) RsetRequest() string {
	return message.rsetRequest
}

// Getter for rsetResponse field
func (message Message) RsetResponse() string {
	return message.rsetResponse
}

// Getter for rset field
func (message Message) Rset() bool {
	return message.rset
}

// Getter for noop field
func (message Message) Noop() bool {
	return message.noop
}

// Getter for quitSent field
func (message Message) QuitSent() bool {
	return message.quitSent
}

// Getter for message consistency status predicate. Returns true
// for case when message struct is consistent. It means that
// MAILFROM, RCPTTO, DATA commands and message context
// were successful. Otherwise returns false
func (message Message) IsConsistent() bool {
	return message.mailfrom && message.rcptto && message.data && message.msg
}

// Message RCPTTO successful response predicate. Returns true when at least one
// successful RCPTTO response exists. Otherwise returns false
func (message *Message) isIncludesSuccessfulRcpttoResponse(targetSuccessfulResponse string) bool {
	for _, slice := range message.rcpttoRequestResponse {
		if slice[1] == targetSuccessfulResponse {
			return true
		}
	}

	return false
}

// Pointer to empty message
var zeroMessage = &Message{}

// Concurrent type that can be safely shared between goroutines
type messages struct {
	sync.RWMutex
	items []*Message
}

// messages methods

// Adds new message pointer into concurrent messages slice
func (messages *messages) append(item *Message) {
	messages.Lock()
	defer messages.Unlock()
	messages.items = append(messages.items, item)
}

// Returns a copy of all messages
func (messages *messages) copy() []Message {
	messages.RLock()
	defer messages.RUnlock()
	return messages.copyInternal()
}

// Copy messages without a lock
func (messages *messages) copyInternal() []Message {
	copiedMessages := []Message{}
	for index := range messages.items {
		copiedMessages = append(copiedMessages, *messages.items[index])
	}

	return copiedMessages
}

// Returns all messages and removes them at the same time
func (messages *messages) purge() []Message {
	messages.Lock()
	defer messages.Unlock()

	copiedMessages := messages.copyInternal()
	messages.items = nil

	return copiedMessages
}
