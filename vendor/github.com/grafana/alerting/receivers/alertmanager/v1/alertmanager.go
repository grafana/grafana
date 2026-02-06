package v1

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"github.com/grafana/alerting/images"
	"github.com/grafana/alerting/receivers"
)

func New(cfg Config, meta receivers.Metadata, images images.Provider, logger log.Logger) *Notifier {
	return &Notifier{
		Base:     receivers.NewBase(meta, logger),
		images:   images,
		settings: cfg,
	}
}

// Notifier sends alert notifications to the alert manager
type Notifier struct {
	*receivers.Base
	images   images.Provider
	settings Config
}

// Notify sends alert notifications to Alertmanager.
func (n *Notifier) Notify(ctx context.Context, as ...*types.Alert) (bool, error) {
	l := n.GetLogger(ctx)
	level.Debug(l).Log("msg", "sending notification")
	if len(as) == 0 {
		return true, nil
	}

	// clone because it can be modified by the image provider
	clones := make([]*types.Alert, 0, len(as))
	for _, a := range as {
		clone := &types.Alert{
			Alert: model.Alert{
				Labels:       maps.Clone(a.Labels),
				Annotations:  maps.Clone(a.Annotations),
				StartsAt:     a.StartsAt,
				EndsAt:       a.EndsAt,
				GeneratorURL: a.GeneratorURL,
			},
			UpdatedAt: a.UpdatedAt,
			Timeout:   a.Timeout,
		}
		clones = append(clones, clone)
	}

	_ = images.WithStoredImages(ctx, l, n.images,
		func(index int, image images.Image) error {
			// If there is an image for this alert and the image has been uploaded
			// to a public URL then include it as an annotation
			if image.URL != "" {
				clones[index].Annotations["image"] = model.LabelValue(image.URL)
			}
			return nil
		}, clones...)

	body, err := json.Marshal(clones)
	if err != nil {
		return false, err
	}

	var (
		lastErr error
		numErrs int
	)
	for _, u := range n.settings.URLs {
		if _, err := receivers.SendHTTPRequest(ctx, u, receivers.HTTPCfg{
			User:     n.settings.User,
			Password: n.settings.Password,
			Body:     body,
		}, l); err != nil {
			level.Warn(l).Log("msg", "failed to send to Alertmanager", "err", err, "url", u.String())
			lastErr = err
			numErrs++
		}
	}

	if numErrs == len(n.settings.URLs) {
		// All attempts to send alerts have failed
		level.Warn(l).Log("msg", "all attempts to send to Alertmanager failed")
		return false, fmt.Errorf("failed to send alert to Alertmanager: %w", lastErr)
	}

	return true, nil
}

func (n *Notifier) SendResolved() bool {
	return !n.GetDisableResolveMessage()
}
