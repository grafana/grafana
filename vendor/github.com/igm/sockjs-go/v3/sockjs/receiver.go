package sockjs

type ReceiverType int

const (
	ReceiverTypeNone ReceiverType = iota
	ReceiverTypeXHR
	ReceiverTypeEventSource
	ReceiverTypeHtmlFile
	ReceiverTypeJSONP
	ReceiverTypeXHRStreaming
	ReceiverTypeRawWebsocket
	ReceiverTypeWebsocket
)

type receiver interface {
	// sendBulk send multiple data messages in frame frame in format: a["msg 1", "msg 2", ....]
	sendBulk(...string) error
	// sendFrame sends given frame over the wire (with possible chunking depending on receiver)
	sendFrame(string) error
	// close closes the receiver in a "done" way (idempotent)
	close()
	canSend() bool
	// done notification channel gets closed whenever receiver ends
	doneNotify() <-chan struct{}
	// interrupted channel gets closed whenever receiver is interrupted (i.e. http connection drops,...)
	interruptedNotify() <-chan struct{}
	// returns the type of receiver
	receiverType() ReceiverType
}
