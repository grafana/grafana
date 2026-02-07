// Copyright 2022 Prometheus Team
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

package telegram

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	commoncfg "github.com/prometheus/common/config"
	"gopkg.in/telebot.v3"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

// Telegram supports 4096 chars max - from https://limits.tginfo.me/en.
const maxMessageLenRunes = 4096

// Notifier implements a Notifier for telegram notifications.
type Notifier struct {
	conf    *config.TelegramConfig
	tmpl    *template.Template
	logger  log.Logger
	client  *telebot.Bot
	retrier *notify.Retrier
}

// New returns a new Telegram notification handler.
func New(conf *config.TelegramConfig, t *template.Template, l log.Logger, httpOpts ...commoncfg.HTTPClientOption) (*Notifier, error) {
	httpclient, err := commoncfg.NewClientFromConfig(*conf.HTTPConfig, "telegram", httpOpts...)
	if err != nil {
		return nil, err
	}

	client, err := createTelegramClient(conf.APIUrl.String(), conf.ParseMode, httpclient)
	if err != nil {
		return nil, err
	}

	return &Notifier{
		conf:    conf,
		tmpl:    t,
		logger:  l,
		client:  client,
		retrier: &notify.Retrier{},
	}, nil
}

func (n *Notifier) Notify(ctx context.Context, alert ...*types.Alert) (bool, error) {
	var (
		err  error
		data = notify.GetTemplateData(ctx, n.tmpl, alert, n.logger)
		tmpl = notify.TmplText(n.tmpl, data, &err)
	)

	if n.conf.ParseMode == "HTML" {
		tmpl = notify.TmplHTML(n.tmpl, data, &err)
	}

	key, ok := notify.GroupKey(ctx)
	if !ok {
		return false, fmt.Errorf("group key missing")
	}

	messageText, truncated := notify.TruncateInRunes(tmpl(n.conf.Message), maxMessageLenRunes)
	if truncated {
		level.Warn(n.logger).Log("msg", "Truncated message", "alert", key, "max_runes", maxMessageLenRunes)
	}

	n.client.Token, err = n.getBotToken()
	if err != nil {
		return true, err
	}

	message, err := n.client.Send(telebot.ChatID(n.conf.ChatID), messageText, &telebot.SendOptions{
		DisableNotification:   n.conf.DisableNotifications,
		DisableWebPagePreview: true,
	})
	if err != nil {
		return true, err
	}
	level.Debug(n.logger).Log("msg", "Telegram message successfully published", "message_id", message.ID, "chat_id", message.Chat.ID)

	return false, nil
}

func createTelegramClient(apiURL, parseMode string, httpClient *http.Client) (*telebot.Bot, error) {
	bot, err := telebot.NewBot(telebot.Settings{
		URL:       apiURL,
		ParseMode: parseMode,
		Client:    httpClient,
		Offline:   true,
	})
	if err != nil {
		return nil, err
	}

	return bot, nil
}

func (n *Notifier) getBotToken() (string, error) {
	if len(n.conf.BotTokenFile) > 0 {
		content, err := os.ReadFile(n.conf.BotTokenFile)
		if err != nil {
			return "", fmt.Errorf("could not read %s: %w", n.conf.BotTokenFile, err)
		}
		return strings.TrimSpace(string(content)), nil
	}
	return string(n.conf.BotToken), nil
}
