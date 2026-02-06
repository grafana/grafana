package core

import (
	"context"
	"path/filepath"

	"github.com/docker/docker/client"

	"github.com/testcontainers/testcontainers-go/internal"
	"github.com/testcontainers/testcontainers-go/internal/config"
)

// NewClient returns a new docker client extracting the docker host from the different alternatives
func NewClient(ctx context.Context, ops ...client.Opt) (*client.Client, error) {
	tcConfig := config.Read()

	dockerHost := MustExtractDockerHost(ctx)

	opts := []client.Opt{client.FromEnv, client.WithAPIVersionNegotiation()}
	if dockerHost != "" {
		opts = append(opts, client.WithHost(dockerHost))

		// for further information, read https://docs.docker.com/engine/security/protect-access/
		if tcConfig.TLSVerify == 1 {
			cacertPath := filepath.Join(tcConfig.CertPath, "ca.pem")
			certPath := filepath.Join(tcConfig.CertPath, "cert.pem")
			keyPath := filepath.Join(tcConfig.CertPath, "key.pem")

			opts = append(opts, client.WithTLSClientConfig(cacertPath, certPath, keyPath))
		}
	}

	opts = append(opts, client.WithHTTPHeaders(
		map[string]string{
			"x-tc-pp":    ProjectPath(),
			"x-tc-sid":   SessionID(),
			"User-Agent": "tc-go/" + internal.Version,
		}),
	)

	// passed options have priority over the default ones
	opts = append(opts, ops...)

	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, err
	}

	return cli, nil
}
