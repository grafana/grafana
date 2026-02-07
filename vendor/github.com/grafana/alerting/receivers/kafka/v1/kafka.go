package v1

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/notify"

	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/go-kit/log"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
	"github.com/grafana/alerting/templates"
)

type kafkaBody struct {
	Records []kafkaRecordEnvelope `json:"records"`
}

type kafkaRecordEnvelope struct {
	Value kafkaRecord `json:"value"`
}

type kafkaRecord struct {
	Description string                   `json:"description"`
	Client      string                   `json:"client,omitempty"`
	Details     string                   `json:"details,omitempty"`
	AlertState  receivers.AlertStateType `json:"alert_state,omitempty"`
	ClientURL   string                   `json:"client_url,omitempty"`
	Contexts    []kafkaContext           `json:"contexts,omitempty"`
	IncidentKey string                   `json:"incident_key,omitempty"`
}

type kafkaV3Record struct {
	Type string      `json:"type"`
	Data kafkaRecord `json:"data"`
}

type kafkaContext struct {
	Type   string `json:"type"`
	Source string `json:"src"`
}

// Notifier is responsible for sending
// alert notifications to Kafka.
type Notifier struct {
	*receivers.Base
	images   images.Provider
	ns       receivers.WebhookSender
	tmpl     *templates.Template
	settings Config
}

func New(cfg Config, meta receivers.Metadata, template *templates.Template, sender receivers.WebhookSender, images images.Provider, logger log.Logger) *Notifier {
	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		ns:       sender,
		images:   images,
		tmpl:     template,
		settings: cfg,
	}
}

// Notify sends the alert notification.
func (kn *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	if kn.settings.APIVersion == apiVersionV3 {
		return kn.notifyWithAPIV3(ctx, as...)
	}
	return kn.notifyWithAPIV2(ctx, as...)
}

// Use the v2 API to send the alert notification.
func (kn *Notifier) notifyWithAPIV2(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := kn.GetLogger(ctx)
	var tmplErr error
	tmpl, _ := templates.TmplText(ctx, kn.tmpl, as, l, &tmplErr)

	topicURL := kn.settings.Endpoint + "/topics/" + tmpl(kn.settings.Topic)
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Kafka url", "err", tmplErr.Error())
	}

	body, err := kn.buildBody(ctx, l, tmpl, as...)
	if err != nil {
		return false, err
	}
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Kafka message", "err", tmplErr.Error())
	}

	cmd := &receivers.SendWebhookSettings{
		URL:        topicURL,
		Body:       body,
		HTTPMethod: "POST",
		HTTPHeader: map[string]string{
			"Content-Type": "application/vnd.kafka.json.v2+json",
			"Accept":       "application/vnd.kafka.v2+json",
		},
		User:     kn.settings.Username,
		Password: kn.settings.Password,
	}

	if err := kn.ns.SendWebhook(ctx, l, cmd); err != nil {
		level.Error(l).Log("msg", "Failed to send notification to Kafka", "err", err, "body", body)
		return false, err
	}
	return true, nil
}

// Use the v3 API to send the alert notification.
func (kn *Notifier) notifyWithAPIV3(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := kn.GetLogger(ctx)
	var tmplErr error
	tmpl, _ := templates.TmplText(ctx, kn.tmpl, as, l, &tmplErr)

	// For v3 the Produce URL is like this,
	// <Endpoint>/v3/clusters/<KafkaClusterID>/topics/<Topic>/records
	topicURL := kn.settings.Endpoint + "/v3/clusters/" + tmpl(kn.settings.KafkaClusterID) + "/topics/" + tmpl(kn.settings.Topic) + "/records"
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Kafka url", "err", tmplErr.Error())
	}

	body, err := kn.buildV3Body(ctx, l, tmpl, as...)
	if err != nil {
		return false, err
	}
	if tmplErr != nil {
		level.Warn(l).Log("msg", "failed to template Kafka message", "err", tmplErr.Error())
	}

	cmd := &receivers.SendWebhookSettings{
		URL:        topicURL,
		Body:       body,
		HTTPMethod: "POST",
		HTTPHeader: map[string]string{
			"Content-Type": "application/json",
			"Accept":       "application/json",
		},
		Validation: validateKafkaV3Response,
		User:       kn.settings.Username,
		Password:   kn.settings.Password,
	}

	// TODO: Convert to a stream - keep a single connection open and send records on it.
	// Can be implemented nicely using receivers. The v3 API can be used in streaming mode
	// by setting “Transfer-Encoding: chunked” header.
	// For as long as the connection is kept open, the server will keep accepting records.
	if err := kn.ns.SendWebhook(ctx, l, cmd); err != nil {
		level.Error(l).Log("msg", "Failed to send notification to Kafka", "err", err, "body", body)
		return false, err
	}
	return true, nil
}

/*
A sample of V3 response looks like this,

	{
		"error_code": 200,
		"cluster_id": "lkc-abcd",
		"topic_name": "myTopic",
		"partition_id": 5,
		"offset": 0,
		"timestamp": "2023-01-08T11:21:48.031Z",
		"value": { "type" : "JSON", "size" : 14 }
	}
*/
type kafkaV3Response struct {
	ErrorCode int `json:"error_code"`
}

func validateKafkaV3Response(rawResponse []byte, statusCode int) error {
	if statusCode/100 != 2 {
		return fmt.Errorf("unexpected status code %d", statusCode)
	}
	// 200 status means the API was processed successfully.
	// The message publishing could still fail. This is verified by checking the error_code field in the response.
	var response kafkaV3Response
	if err := json.Unmarshal(rawResponse, &response); err != nil {
		return err
	}
	if response.ErrorCode/100 != 2 {
		return fmt.Errorf("failed to publish message to Kafka. response: %s", string(rawResponse))
	}
	return nil
}

func (kn *Notifier) SendResolved() bool {
	return !kn.GetDisableResolveMessage()
}

func (kn *Notifier) buildBody(ctx context.Context, l log.Logger, tmpl func(string) string, as ...*types.Alert) (string, error) {
	if kn.settings.APIVersion == apiVersionV3 {
		return kn.buildV3Body(ctx, l, tmpl, as...)
	}
	return kn.buildV2Body(ctx, l, tmpl, as...)
}

func (kn *Notifier) buildV2Body(ctx context.Context, l log.Logger, tmpl func(string) string, as ...*types.Alert) (string, error) {
	var record kafkaRecord
	if err := kn.buildKafkaRecord(ctx, l, &record, tmpl, as...); err != nil {
		return "", err
	}
	records := kafkaBody{
		Records: []kafkaRecordEnvelope{
			{Value: record},
		},
	}
	body, err := json.Marshal(records)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func (kn *Notifier) buildV3Body(ctx context.Context, l log.Logger, tmpl func(string) string, as ...*types.Alert) (string, error) {
	var record kafkaRecord
	if err := kn.buildKafkaRecord(ctx, l, &record, tmpl, as...); err != nil {
		return "", err
	}
	records := map[string]kafkaV3Record{
		"value": {
			Type: "JSON",
			Data: record,
		},
	}
	body, err := json.Marshal(records)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func (kn *Notifier) buildKafkaRecord(ctx context.Context, l log.Logger, record *kafkaRecord, tmpl func(string) string, as ...*types.Alert) error {
	record.Client = "Grafana"
	record.Description = tmpl(kn.settings.Description)
	record.Details = tmpl(kn.settings.Details)

	state := buildState(as...)
	level.Debug(l).Log("msg", "notifying Kafka", "alert_state", state)
	record.AlertState = state

	ruleURL := receivers.JoinURLPath(kn.tmpl.ExternalURL.String(), "/alerting/list", l)
	record.ClientURL = ruleURL

	contexts := buildContextImages(ctx, l, kn.images, as...)
	if len(contexts) > 0 {
		record.Contexts = contexts
	}

	groupKey, err := notify.ExtractGroupKey(ctx)
	if err != nil {
		return err
	}
	record.IncidentKey = groupKey.Hash()
	return nil
}

func buildState(as ...*types.Alert) receivers.AlertStateType {
	// We are using the state from 7.x to not break kafka.
	// TODO: should we switch to the new ones?
	if types.Alerts(as...).Status() == model.AlertResolved {
		return receivers.AlertStateOK
	}
	return receivers.AlertStateAlerting
}

func buildContextImages(ctx context.Context, l log.Logger, imageProvider images.Provider, as ...*types.Alert) []kafkaContext {
	var contexts []kafkaContext
	_ = images.WithStoredImages(ctx, l, imageProvider,
		func(_ int, image images.Image) error {
			if image.URL != "" {
				contexts = append(contexts, kafkaContext{
					Type:   "image",
					Source: image.URL,
				})
			}
			return nil
		}, as...)
	return contexts
}
