// +build go1.8

package redis

import "crypto/tls"

func cloneTLSConfig(cfg *tls.Config) *tls.Config {
	return cfg.Clone()
}
