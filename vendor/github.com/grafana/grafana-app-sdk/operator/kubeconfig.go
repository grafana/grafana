package operator

import (
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/flowcontrol"
)

const (
	defaultQPS   = 50.0 // Sane default for controllers
	defaultBurst = 300  // Default for kubectl
)

type RestConfig = rest.Config

// RestConfigOptions are options which are applied when loading RestConfigs.
type RestConfigOptions struct {
	// QPS indicates the maximum QPS to the master from this client.
	// If it's zero, the created RESTClient will use DefaultQPS: 50
	QPS float64

	// Maximum burst for throttle.
	// If it's zero, the created RESTClient will use DefaultBurst: 300.
	Burst int

	// NoLimit removes client-side request throttling completely.
	NoLimit bool
}

// LoadOperatorRestConfig loads an operator rest config from given path.
func LoadOperatorRestConfig(path string, opts RestConfigOptions, dst *RestConfig) error {
	if path == "cluster" {
		cfg, err := rest.InClusterConfig()
		if err != nil {
			return err
		}
		*dst = *cfg
		return nil
	}

	cfg, err := clientcmd.BuildConfigFromFlags("", path)
	if err != nil {
		return err
	}

	cfg.APIPath = "/apis"

	if opts.NoLimit {
		cfg.RateLimiter = flowcontrol.NewFakeAlwaysRateLimiter()
	} else {
		if opts.Burst > 0 {
			cfg.Burst = opts.Burst
		} else {
			cfg.Burst = defaultBurst
		}

		if opts.QPS > 0 {
			cfg.QPS = float32(opts.QPS)
		} else {
			cfg.QPS = defaultQPS
		}
	}

	*dst = *cfg

	return nil
}
