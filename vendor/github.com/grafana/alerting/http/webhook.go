package http

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/receivers"
)

type ForkedSender struct {
	cli *Client
}

func NewForkedSender(cli *Client) *ForkedSender {
	return &ForkedSender{cli: cli}
}

func (f ForkedSender) SendWebhook(ctx context.Context, l log.Logger, cmd *receivers.SendWebhookSettings) error {
	if cmd.HTTPMethod != "GET" {
		return f.cli.SendWebhook(ctx, l, cmd)
	}

	request, err := http.NewRequestWithContext(ctx, cmd.HTTPMethod, cmd.URL, nil)
	if err != nil {
		return err
	}
	_, err = url.Parse(cmd.URL)
	if err != nil {
		// Should not be possible - NewRequestWithContext should also err if the URL is bad.
		return err
	}

	request.Header.Set("User-Agent", "Grafana")

	if cmd.User != "" && cmd.Password != "" {
		request.SetBasicAuth(cmd.User, cmd.Password)
	}

	for k, v := range cmd.HTTPHeader {
		request.Header.Set(k, v)
	}

	resp, err := NewTLSClient(cmd.TLSConfig, f.cli.cfg.dialer.DialContext).Do(request)
	if err != nil {
		return redactURL(err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if cmd.Validation != nil {
		err := cmd.Validation(body, resp.StatusCode)
		if err != nil {
			return fmt.Errorf("webhook failed validation: %w", err)
		}
	}

	if resp.StatusCode/100 == 2 {
		return nil
	}

	return fmt.Errorf("webhook response status %v", resp.Status)
}
