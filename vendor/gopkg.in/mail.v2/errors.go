package mail

import "fmt"

// A SendError represents the failure to transmit a Message, detailing the cause
// of the failure and index of the Message within a batch.
type SendError struct {
	// Index specifies the index of the Message within a batch.
	Index uint
	Cause error
}

func (err *SendError) Error() string {
	return fmt.Sprintf("gomail: could not send email %d: %v",
		err.Index+1, err.Cause)
}
