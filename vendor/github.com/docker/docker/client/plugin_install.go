package client // import "github.com/docker/docker/client"

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"

	"github.com/distribution/reference"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/registry"
	"github.com/docker/docker/errdefs"
	"github.com/pkg/errors"
)

// PluginInstall installs a plugin
func (cli *Client) PluginInstall(ctx context.Context, name string, options types.PluginInstallOptions) (rc io.ReadCloser, err error) {
	query := url.Values{}
	if _, err := reference.ParseNormalizedNamed(options.RemoteRef); err != nil {
		return nil, errors.Wrap(err, "invalid remote reference")
	}
	query.Set("remote", options.RemoteRef)

	privileges, err := cli.checkPluginPermissions(ctx, query, options)
	if err != nil {
		return nil, err
	}

	// set name for plugin pull, if empty should default to remote reference
	query.Set("name", name)

	resp, err := cli.tryPluginPull(ctx, query, privileges, options.RegistryAuth)
	if err != nil {
		return nil, err
	}

	name = resp.Header.Get("Docker-Plugin-Name")

	pr, pw := io.Pipe()
	go func() { // todo: the client should probably be designed more around the actual api
		_, err := io.Copy(pw, resp.Body)
		if err != nil {
			_ = pw.CloseWithError(err)
			return
		}
		defer func() {
			if err != nil {
				delResp, _ := cli.delete(ctx, "/plugins/"+name, nil, nil)
				ensureReaderClosed(delResp)
			}
		}()
		if len(options.Args) > 0 {
			if err := cli.PluginSet(ctx, name, options.Args); err != nil {
				_ = pw.CloseWithError(err)
				return
			}
		}

		if options.Disabled {
			_ = pw.Close()
			return
		}

		enableErr := cli.PluginEnable(ctx, name, types.PluginEnableOptions{Timeout: 0})
		_ = pw.CloseWithError(enableErr)
	}()
	return pr, nil
}

func (cli *Client) tryPluginPrivileges(ctx context.Context, query url.Values, registryAuth string) (*http.Response, error) {
	return cli.get(ctx, "/plugins/privileges", query, http.Header{
		registry.AuthHeader: {registryAuth},
	})
}

func (cli *Client) tryPluginPull(ctx context.Context, query url.Values, privileges types.PluginPrivileges, registryAuth string) (*http.Response, error) {
	return cli.post(ctx, "/plugins/pull", query, privileges, http.Header{
		registry.AuthHeader: {registryAuth},
	})
}

func (cli *Client) checkPluginPermissions(ctx context.Context, query url.Values, options types.PluginInstallOptions) (types.PluginPrivileges, error) {
	resp, err := cli.tryPluginPrivileges(ctx, query, options.RegistryAuth)
	if errdefs.IsUnauthorized(err) && options.PrivilegeFunc != nil {
		// todo: do inspect before to check existing name before checking privileges
		newAuthHeader, privilegeErr := options.PrivilegeFunc(ctx)
		if privilegeErr != nil {
			ensureReaderClosed(resp)
			return nil, privilegeErr
		}
		options.RegistryAuth = newAuthHeader
		resp, err = cli.tryPluginPrivileges(ctx, query, options.RegistryAuth)
	}
	if err != nil {
		ensureReaderClosed(resp)
		return nil, err
	}

	var privileges types.PluginPrivileges
	if err := json.NewDecoder(resp.Body).Decode(&privileges); err != nil {
		ensureReaderClosed(resp)
		return nil, err
	}
	ensureReaderClosed(resp)

	if !options.AcceptAllPermissions && options.AcceptPermissionsFunc != nil && len(privileges) > 0 {
		accept, err := options.AcceptPermissionsFunc(ctx, privileges)
		if err != nil {
			return nil, err
		}
		if !accept {
			return nil, errors.Errorf("permission denied while installing plugin %s", options.RemoteRef)
		}
	}
	return privileges, nil
}
