package v1

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/go-kit/log/level"

	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

type client interface {
	Connect(ctx context.Context, brokerURL, clientID, username, password string, tlsCfg *tls.Config) error
	Disconnect(ctx context.Context) error
	Publish(ctx context.Context, message message) error
}

type message struct {
	topic   string
	payload []byte
	retain  bool
	qos     int
}

type Notifier struct {
	*receivers.Base
	tmpl     *templates.Template
	settings Config
	client   client
}

func New(cfg Config, meta receivers.Metadata, template *templates.Template, logger log.Logger, cli client) *Notifier {
	if cli == nil {
		cli = &mqttClient{}
	}

	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		tmpl:     template,
		settings: cfg,
		client:   cli,
	}
}

// mqttMessage defines the JSON object send to an MQTT broker.
type mqttMessage struct {
	*templates.ExtendedData

	// The protocol version.
	Version  string `json:"version"`
	GroupKey string `json:"groupKey"`
	Message  string `json:"message"`
}

func (n *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := n.GetLogger(ctx)
	level.Debug(l).Log("msg", "Sending an MQTT message", "topic", n.settings.Topic, "qos", n.settings.QoS, "retain", n.settings.Retain)

	msg, err := n.buildMessage(ctx, l, as...)
	if err != nil {
		level.Error(l).Log("msg", "Failed to build MQTT message", "err", err.Error())
		return false, err
	}

	var tlsCfg *tls.Config
	if n.settings.TLSConfig != nil {
		tlsCfg, err = n.settings.TLSConfig.ToCryptoTLSConfig()
	}
	if err != nil {
		level.Error(l).Log("msg", "Failed to build TLS config", "err", err.Error())
		return false, fmt.Errorf("failed to build TLS config: %s", err.Error())
	}

	err = n.client.Connect(ctx, n.settings.BrokerURL, n.settings.ClientID, n.settings.Username, n.settings.Password, tlsCfg)
	if err != nil {
		level.Error(l).Log("msg", "Failed to connect to MQTT broker", "err", err.Error())
		return false, fmt.Errorf("failed to connect to MQTT broker: %s", err.Error())
	}
	defer func() {
		err := n.client.Disconnect(ctx)
		if err != nil {
			level.Error(l).Log("msg", "Failed to disconnect from MQTT broker", "err", err.Error())
		}
	}()

	qos, err := n.settings.QoS.Int64()
	if err != nil {
		level.Error(l).Log("msg", "Failed to parse QoS", "err", err.Error())
		return false, fmt.Errorf("failed to parse QoS: %s", err.Error())
	}

	err = n.client.Publish(
		ctx,
		message{
			topic:   n.settings.Topic,
			payload: []byte(msg),
			retain:  n.settings.Retain,
			qos:     int(qos),
		},
	)

	if err != nil {
		level.Error(l).Log("msg", "Failed to publish MQTT message", "err", err.Error())
		return false, fmt.Errorf("failed to publish MQTT message: %s", err.Error())
	}

	return true, nil
}

func (n *Notifier) buildMessage(ctx context.Context, l log.Logger, as ...*types.Alert) (string, error) {
	groupKey, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return "", err
	}

	var tmplErr error
	tmpl, data := templates.TmplText(ctx, n.tmpl, as, l, &tmplErr)
	messageText := tmpl(n.settings.Message)
	if tmplErr != nil {
		level.Warn(l).Log("msg", "Failed to template MQTT message", "err", tmplErr.Error())
	}

	switch n.settings.MessageFormat {
	case MessageFormatText:
		return messageText, nil
	case MessageFormatJSON:
		msg := &mqttMessage{
			Version:      "1",
			ExtendedData: data,
			GroupKey:     groupKey.String(),
			Message:      messageText,
		}

		jsonMsg, err := json.Marshal(msg)
		if err != nil {
			return "", err
		}

		return string(jsonMsg), nil
	default:
		return "", errors.New("invalid message format")
	}
}

func (n *Notifier) SendResolved() bool {
	return !n.GetDisableResolveMessage()
}
