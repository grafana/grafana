// Copyright 2019 Prometheus Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package pushover

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	commoncfg "github.com/prometheus/common/config"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

const (
	// https://pushover.net/api#limits - 250 characters or runes.
	maxTitleLenRunes = 250
	// https://pushover.net/api#limits - 1024 characters or runes.
	maxMessageLenRunes = 1024
	// https://pushover.net/api#limits - 512 characters or runes.
	maxURLLenRunes = 512
)

// Notifier implements a Notifier for Pushover notifications.
type Notifier struct {
	conf    *config.PushoverConfig
	tmpl    *template.Template
	logger  log.Logger
	client  *http.Client
	retrier *notify.Retrier
	apiURL  string // for tests.
}

// New returns a new Pushover notifier.
func New(c *config.PushoverConfig, t *template.Template, l log.Logger, httpOpts ...commoncfg.HTTPClientOption) (*Notifier, error) {
	client, err := commoncfg.NewClientFromConfig(*c.HTTPConfig, "pushover", httpOpts...)
	if err != nil {
		return nil, err
	}
	return &Notifier{
		conf:    c,
		tmpl:    t,
		logger:  l,
		client:  client,
		retrier: &notify.Retrier{},
		apiURL:  "https://api.pushover.net/1/messages.json",
	}, nil
}

// Notify implements the Notifier interface.
func (n *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	key, ok := notify.GroupKey(ctx)
	if !ok {
		return false, fmt.Errorf("group key missing")
	}
	data := notify.GetTemplateData(ctx, n.tmpl, as, n.logger)

	level.Debug(n.logger).Log("incident", key)

	var (
		err     error
		message string
	)
	tmpl := notify.TmplText(n.tmpl, data, &err)
	tmplHTML := notify.TmplHTML(n.tmpl, data, &err)

	var (
		token   string
		userKey string
	)
	if n.conf.Token != "" {
		token = string(n.conf.Token)
	} else {
		content, err := os.ReadFile(n.conf.TokenFile)
		if err != nil {
			return false, fmt.Errorf("read token_file: %w", err)
		}
		token = string(content)
	}
	if n.conf.UserKey != "" {
		userKey = string(n.conf.UserKey)
	} else {
		content, err := os.ReadFile(n.conf.UserKeyFile)
		if err != nil {
			return false, fmt.Errorf("read user_key_file: %w", err)
		}
		userKey = string(content)
	}

	parameters := url.Values{}
	parameters.Add("token", tmpl(token))
	parameters.Add("user", tmpl(userKey))

	title, truncated := notify.TruncateInRunes(tmpl(n.conf.Title), maxTitleLenRunes)
	if truncated {
		level.Warn(n.logger).Log("msg", "Truncated title", "incident", key, "max_runes", maxTitleLenRunes)
	}
	parameters.Add("title", title)

	if n.conf.HTML {
		parameters.Add("html", "1")
		message = tmplHTML(n.conf.Message)
	} else {
		message = tmpl(n.conf.Message)
	}

	message, truncated = notify.TruncateInRunes(message, maxMessageLenRunes)
	if truncated {
		level.Warn(n.logger).Log("msg", "Truncated message", "incident", key, "max_runes", maxMessageLenRunes)
	}
	message = strings.TrimSpace(message)
	if message == "" {
		// Pushover rejects empty messages.
		message = "(no details)"
	}
	parameters.Add("message", message)

	supplementaryURL, truncated := notify.TruncateInRunes(tmpl(n.conf.URL), maxURLLenRunes)
	if truncated {
		level.Warn(n.logger).Log("msg", "Truncated URL", "incident", key, "max_runes", maxURLLenRunes)
	}
	parameters.Add("url", supplementaryURL)
	parameters.Add("url_title", tmpl(n.conf.URLTitle))

	parameters.Add("priority", tmpl(n.conf.Priority))
	parameters.Add("retry", fmt.Sprintf("%d", int64(time.Duration(n.conf.Retry).Seconds())))
	parameters.Add("expire", fmt.Sprintf("%d", int64(time.Duration(n.conf.Expire).Seconds())))
	parameters.Add("device", tmpl(n.conf.Device))
	parameters.Add("sound", tmpl(n.conf.Sound))

	newttl := int64(time.Duration(n.conf.TTL).Seconds())
	if newttl > 0 {
		parameters.Add("ttl", fmt.Sprintf("%d", newttl))
	}

	if err != nil {
		return false, err
	}

	u, err := url.Parse(n.apiURL)
	if err != nil {
		return false, err
	}
	u.RawQuery = parameters.Encode()
	// Don't log the URL as it contains secret data (see #1825).
	level.Debug(n.logger).Log("msg", "Sending message", "incident", key)
	resp, err := notify.PostText(ctx, n.client, u.String(), nil)
	if err != nil {
		return true, notify.RedactURL(err)
	}
	defer notify.Drain(resp)

	shouldRetry, err := n.retrier.Check(resp.StatusCode, resp.Body)
	if err != nil {
		return shouldRetry, notify.NewErrorWithReason(notify.GetFailureReasonFromStatusCode(resp.StatusCode), err)
	}
	return shouldRetry, err
}
