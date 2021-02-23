package logging

import (
	"fmt"
	"os"

	"github.com/sirupsen/logrus"

	"github.com/weaveworks/promrus"
)

// Setup configures a global logrus logger to output to stderr.
// It populates the standard logrus logger as well as the global logging instance.
func Setup(logLevel string) error {
	level, err := logrus.ParseLevel(logLevel)
	if err != nil {
		return fmt.Errorf("error parsing log level: %v", err)
	}
	hook, err := promrus.NewPrometheusHook() // Expose number of log messages as Prometheus metrics.
	if err != nil {
		return err
	}
	logrus.SetOutput(os.Stderr)
	logrus.SetLevel(level)
	logrus.AddHook(hook)
	SetGlobal(Logrus(logrus.StandardLogger()))
	return nil
}
