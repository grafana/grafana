package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/types"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

// Notifier is responsible for sending alert notifications to WeCom.
type Notifier struct {
	*receivers.Base
	tmpl        *templates.Template
	ns          receivers.WebhookSender
	settings    Config
	tok         *accessToken
	tokExpireAt time.Time
	group       singleflight.Group
}

func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.WebhookSender, logger log.Logger) *Notifier {
	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		tmpl:     template,
		ns:       sender,
		settings: cfg,
	}
}

// Notify send an alert notification to WeCom.
func (w *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := w.GetLogger(ctx)
	level.Debug(l).Log("msg", "sending notification")

	var tmplErr error
	tmpl, _ := templates.TmplText(ctx, w.tmpl, as, l, &tmplErr)

	bodyMsg := map[string]interface{}{
		"msgtype": w.settings.MsgType,
	}
	content := fmt.Sprintf("# %s\n%s\n",
		tmpl(w.settings.Title),
		tmpl(w.settings.Message),
	)
	if w.settings.MsgType != DefaultsgType {
		content = fmt.Sprintf("%s\n%s",
			tmpl(w.settings.Title),
			tmpl(w.settings.Message),
		)
	}

	msgType := string(w.settings.MsgType)
	bodyMsg[msgType] = map[string]interface{}{
		"content": content,
	}

	url := w.settings.URL
	if w.settings.Channel != DefaultChannelType {
		bodyMsg["agentid"] = w.settings.AgentID
		bodyMsg["touser"] = w.settings.ToUser
		token, err := w.GetAccessToken(ctx)
		if err != nil {
			return false, err
		}
		url = fmt.Sprintf(w.settings.EndpointURL+"/cgi-bin/message/send?access_token=%s", token)
	}

	body, err := json.Marshal(bodyMsg)
	if err != nil {
		return false, err
	}

	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template WeCom message", "err", tmplErr.Error())
	}

	cmd := &receivers.SendWebhookSettings{
		URL:  url,
		Body: string(body),
	}

	if err = w.ns.SendWebhook(ctx, l, cmd); err != nil {
		level.Error(l).Log("msg", "failed to send WeCom webhook", "err", err)
		return false, err
	}

	return true, nil
}

// GetAccessToken returns the access token for apiapp
func (w *Notifier) GetAccessToken(ctx context.Context) (string, error) {
	t := w.tok
	if w.tokExpireAt.Before(time.Now()) || w.tok == nil {
		// avoid multiple calls when there are multiple alarms
		tok, err, _ := w.group.Do("GetAccessToken", func() (interface{}, error) {
			return w.getAccessToken(ctx)
		})
		if err != nil {
			return "", err
		}
		t = tok.(*accessToken)
		// expire five minutes in advance to avoid using it when it is about to expire
		w.tokExpireAt = time.Now().Add(time.Second * time.Duration(t.ExpireIn-300))
		w.tok = t
	}
	return t.AccessToken, nil
}

type accessToken struct {
	AccessToken string `json:"access_token"`
	ErrMsg      string `json:"errmsg"`
	ErrCode     int    `json:"errcode"`
	ExpireIn    int    `json:"expire_in"`
}

func (w *Notifier) getAccessToken(ctx context.Context) (*accessToken, error) {
	geTokenURL := fmt.Sprintf(w.settings.EndpointURL+"/cgi-bin/gettoken?corpid=%s&corpsecret=%s", w.settings.CorpID, w.settings.Secret)

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, geTokenURL, nil)
	if err != nil {
		return nil, err
	}

	request.Header.Add("Content-Type", "application/json")
	request.Header.Add("User-Agent", "Grafana")

	resp, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("WeCom returned statuscode invalid status code: %v", resp.Status)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	var accessToken accessToken
	err = json.NewDecoder(resp.Body).Decode(&accessToken)
	if err != nil {
		return nil, err
	}

	if accessToken.ErrCode != 0 {
		return nil, fmt.Errorf("WeCom returned errmsg: %s", accessToken.ErrMsg)
	}
	return &accessToken, nil
}

func (w *Notifier) SendResolved() bool {
	return !w.GetDisableResolveMessage()
}
