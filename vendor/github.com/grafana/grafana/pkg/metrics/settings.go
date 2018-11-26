package metrics

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/social"

	"github.com/grafana/grafana/pkg/metrics/graphitebridge"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

func (im *InternalMetricsService) readSettings() error {
	var section, err = im.Cfg.Raw.GetSection("metrics")
	if err != nil {
		return fmt.Errorf("Unable to find metrics config section %v", err)
	}

	im.intervalSeconds = section.Key("interval_seconds").MustInt64(10)

	if err := im.parseGraphiteSettings(); err != nil {
		return fmt.Errorf("Unable to parse metrics graphite section, %v", err)
	}

	im.oauthProviders = social.GetOAuthProviders(im.Cfg)

	return nil
}

func (im *InternalMetricsService) parseGraphiteSettings() error {
	graphiteSection, err := im.Cfg.Raw.GetSection("metrics.graphite")

	if err != nil {
		return nil
	}

	address := graphiteSection.Key("address").String()
	if address == "" {
		return nil
	}

	bridgeCfg := &graphitebridge.Config{
		URL:             address,
		Prefix:          graphiteSection.Key("prefix").MustString("prod.grafana.%(instance_name)s"),
		CountersAsDelta: true,
		Gatherer:        prometheus.DefaultGatherer,
		Interval:        time.Duration(im.intervalSeconds) * time.Second,
		Timeout:         10 * time.Second,
		Logger:          &logWrapper{logger: metricsLogger},
		ErrorHandling:   graphitebridge.ContinueOnError,
	}

	safeInstanceName := strings.Replace(setting.InstanceName, ".", "_", -1)
	prefix := graphiteSection.Key("prefix").Value()

	if prefix == "" {
		prefix = "prod.grafana.%(instance_name)s."
	}

	bridgeCfg.Prefix = strings.Replace(prefix, "%(instance_name)s", safeInstanceName, -1)

	im.graphiteCfg = bridgeCfg
	return nil
}
