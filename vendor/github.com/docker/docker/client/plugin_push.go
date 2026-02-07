package client // import "github.com/docker/docker/client"

import (
	"context"
	"io"
	"net/http"

	"github.com/docker/docker/api/types/registry"
)

// PluginPush pushes a plugin to a registry
func (cli *Client) PluginPush(ctx context.Context, name string, registryAuth string) (io.ReadCloser, error) {
	name, err := trimID("plugin", name)
	if err != nil {
		return nil, err
	}
	resp, err := cli.post(ctx, "/plugins/"+name+"/push", nil, nil, http.Header{
		registry.AuthHeader: {registryAuth},
	})
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}
