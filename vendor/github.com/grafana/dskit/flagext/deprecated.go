package flagext

import (
	"flag"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// DeprecatedFlagsUsed is the metric that counts deprecated flags set.
var DeprecatedFlagsUsed = promauto.NewCounter(
	prometheus.CounterOpts{
		Name: "deprecated_flags_inuse_total",
		Help: "The number of deprecated flags currently set.",
	})

type deprecatedFlag struct {
	name   string
	logger log.Logger
}

func (deprecatedFlag) String() string {
	return "deprecated"
}

func (d deprecatedFlag) Set(string) error {
	level.Warn(d.logger).Log("msg", "flag disabled", "flag", d.name)
	DeprecatedFlagsUsed.Inc()
	return nil
}

// DeprecatedFlag logs a warning when you try to use it.
func DeprecatedFlag(f *flag.FlagSet, name, message string, logger log.Logger) {
	f.Var(deprecatedFlag{name: name, logger: logger}, name, message)
}
