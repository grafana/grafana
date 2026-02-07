package client // import "github.com/docker/docker/client"

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/url"

	"github.com/docker/docker/api/types/container"
)

// ContainerInspect returns the container information.
func (cli *Client) ContainerInspect(ctx context.Context, containerID string) (container.InspectResponse, error) {
	containerID, err := trimID("container", containerID)
	if err != nil {
		return container.InspectResponse{}, err
	}

	resp, err := cli.get(ctx, "/containers/"+containerID+"/json", nil, nil)
	defer ensureReaderClosed(resp)
	if err != nil {
		return container.InspectResponse{}, err
	}

	var response container.InspectResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	return response, err
}

// ContainerInspectWithRaw returns the container information and its raw representation.
func (cli *Client) ContainerInspectWithRaw(ctx context.Context, containerID string, getSize bool) (container.InspectResponse, []byte, error) {
	containerID, err := trimID("container", containerID)
	if err != nil {
		return container.InspectResponse{}, nil, err
	}

	query := url.Values{}
	if getSize {
		query.Set("size", "1")
	}
	resp, err := cli.get(ctx, "/containers/"+containerID+"/json", query, nil)
	defer ensureReaderClosed(resp)
	if err != nil {
		return container.InspectResponse{}, nil, err
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return container.InspectResponse{}, nil, err
	}

	var response container.InspectResponse
	rdr := bytes.NewReader(body)
	err = json.NewDecoder(rdr).Decode(&response)
	return response, body, err
}
