package receivers

import (
	"context"
)

// SendEmailSettings is the command for sending emails
type SendEmailSettings struct {
	To               []string
	SingleEmail      bool
	Template         string
	Subject          string
	Data             map[string]interface{}
	ReplyTo          []string
	EmbeddedFiles    []string
	EmbeddedContents []EmbeddedContent
}

type EmbeddedContent struct {
	Name    string
	Content []byte
}

type EmailSender interface {
	SendEmail(ctx context.Context, cmd *SendEmailSettings) error
}
