package receivers

import (
	"context"

	"github.com/go-kit/log"
)

type NotificationServiceMock struct {
	WebhookCalls []SendWebhookSettings
	Webhook      SendWebhookSettings
	EmailSync    SendEmailSettings
	ShouldError  error
	ResponseBody []byte
	StatusCode   int
}

func (ns *NotificationServiceMock) SendWebhook(_ context.Context, _ log.Logger, cmd *SendWebhookSettings) error {
	ns.WebhookCalls = append(ns.WebhookCalls, *cmd)
	ns.Webhook = *cmd

	if cmd.Validation != nil && ns.ResponseBody != nil && ns.StatusCode != 0 {
		ns.ShouldError = cmd.Validation(ns.ResponseBody, 200)
	}

	return ns.ShouldError
}

func (ns *NotificationServiceMock) SendEmail(_ context.Context, cmd *SendEmailSettings) error {
	ns.EmailSync = *cmd
	return ns.ShouldError
}

func MockNotificationService() *NotificationServiceMock { return &NotificationServiceMock{} }

type Call struct {
	Method string
	Args   []interface{}
}

type MockWebhookSender struct {
	Calls           []Call
	SendWebhookFunc func(ctx context.Context, cmd *SendWebhookSettings) error
}

func NewMockWebhookSender() *MockWebhookSender {
	return &MockWebhookSender{
		Calls: make([]Call, 0),
	}
}

func (m *MockWebhookSender) SendWebhook(ctx context.Context, l log.Logger, cmd *SendWebhookSettings) error {
	m.Calls = append(m.Calls, Call{
		Method: "SendWebhook",
		Args:   []interface{}{ctx, l, cmd},
	})

	if m.SendWebhookFunc != nil {
		return m.SendWebhookFunc(ctx, cmd)
	}
	return nil
}
