package client // import "github.com/docker/docker/client"

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/url"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/versions"
)

const containerWaitErrorMsgLimit = 2 * 1024 /* Max: 2KiB */

// ContainerWait waits until the specified container is in a certain state
// indicated by the given condition, either "not-running" (default),
// "next-exit", or "removed".
//
// If this client's API version is before 1.30, condition is ignored and
// ContainerWait will return immediately with the two channels, as the server
// will wait as if the condition were "not-running".
//
// If this client's API version is at least 1.30, ContainerWait blocks until
// the request has been acknowledged by the server (with a response header),
// then returns two channels on which the caller can wait for the exit status
// of the container or an error if there was a problem either beginning the
// wait request or in getting the response. This allows the caller to
// synchronize ContainerWait with other calls, such as specifying a
// "next-exit" condition before issuing a ContainerStart request.
func (cli *Client) ContainerWait(ctx context.Context, containerID string, condition container.WaitCondition) (<-chan container.WaitResponse, <-chan error) {
	resultC := make(chan container.WaitResponse)
	errC := make(chan error, 1)

	containerID, err := trimID("container", containerID)
	if err != nil {
		errC <- err
		return resultC, errC
	}

	// Make sure we negotiated (if the client is configured to do so),
	// as code below contains API-version specific handling of options.
	//
	// Normally, version-negotiation (if enabled) would not happen until
	// the API request is made.
	if err := cli.checkVersion(ctx); err != nil {
		errC <- err
		return resultC, errC
	}
	if versions.LessThan(cli.ClientVersion(), "1.30") {
		return cli.legacyContainerWait(ctx, containerID)
	}

	query := url.Values{}
	if condition != "" {
		query.Set("condition", string(condition))
	}

	resp, err := cli.post(ctx, "/containers/"+containerID+"/wait", query, nil, nil)
	if err != nil {
		defer ensureReaderClosed(resp)
		errC <- err
		return resultC, errC
	}

	go func() {
		defer ensureReaderClosed(resp)

		responseText := bytes.NewBuffer(nil)
		stream := io.TeeReader(resp.Body, responseText)

		var res container.WaitResponse
		if err := json.NewDecoder(stream).Decode(&res); err != nil {
			// NOTE(nicks): The /wait API does not work well with HTTP proxies.
			// At any time, the proxy could cut off the response stream.
			//
			// But because the HTTP status has already been written, the proxy's
			// only option is to write a plaintext error message.
			//
			// If there's a JSON parsing error, read the real error message
			// off the body and send it to the client.
			if errors.As(err, new(*json.SyntaxError)) {
				_, _ = io.ReadAll(io.LimitReader(stream, containerWaitErrorMsgLimit))
				errC <- errors.New(responseText.String())
			} else {
				errC <- err
			}
			return
		}

		resultC <- res
	}()

	return resultC, errC
}

// legacyContainerWait returns immediately and doesn't have an option to wait
// until the container is removed.
func (cli *Client) legacyContainerWait(ctx context.Context, containerID string) (<-chan container.WaitResponse, <-chan error) {
	resultC := make(chan container.WaitResponse)
	errC := make(chan error)

	go func() {
		resp, err := cli.post(ctx, "/containers/"+containerID+"/wait", nil, nil, nil)
		if err != nil {
			errC <- err
			return
		}
		defer ensureReaderClosed(resp)

		var res container.WaitResponse
		if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
			errC <- err
			return
		}

		resultC <- res
	}()

	return resultC, errC
}
