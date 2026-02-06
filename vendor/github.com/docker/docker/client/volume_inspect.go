package client // import "github.com/docker/docker/client"

import (
	"bytes"
	"context"
	"encoding/json"
	"io"

	"github.com/docker/docker/api/types/volume"
)

// VolumeInspect returns the information about a specific volume in the docker host.
func (cli *Client) VolumeInspect(ctx context.Context, volumeID string) (volume.Volume, error) {
	vol, _, err := cli.VolumeInspectWithRaw(ctx, volumeID)
	return vol, err
}

// VolumeInspectWithRaw returns the information about a specific volume in the docker host and its raw representation
func (cli *Client) VolumeInspectWithRaw(ctx context.Context, volumeID string) (volume.Volume, []byte, error) {
	volumeID, err := trimID("volume", volumeID)
	if err != nil {
		return volume.Volume{}, nil, err
	}

	resp, err := cli.get(ctx, "/volumes/"+volumeID, nil, nil)
	defer ensureReaderClosed(resp)
	if err != nil {
		return volume.Volume{}, nil, err
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return volume.Volume{}, nil, err
	}

	var vol volume.Volume
	rdr := bytes.NewReader(body)
	err = json.NewDecoder(rdr).Decode(&vol)
	return vol, body, err
}
