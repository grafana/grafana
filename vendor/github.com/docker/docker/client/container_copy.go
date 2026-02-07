package client // import "github.com/docker/docker/client"

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/docker/docker/api/types/container"
)

// ContainerStatPath returns stat information about a path inside the container filesystem.
func (cli *Client) ContainerStatPath(ctx context.Context, containerID, path string) (container.PathStat, error) {
	containerID, err := trimID("container", containerID)
	if err != nil {
		return container.PathStat{}, err
	}

	query := url.Values{}
	query.Set("path", filepath.ToSlash(path)) // Normalize the paths used in the API.

	resp, err := cli.head(ctx, "/containers/"+containerID+"/archive", query, nil)
	defer ensureReaderClosed(resp)
	if err != nil {
		return container.PathStat{}, err
	}
	return getContainerPathStatFromHeader(resp.Header)
}

// CopyToContainer copies content into the container filesystem.
// Note that `content` must be a Reader for a TAR archive
func (cli *Client) CopyToContainer(ctx context.Context, containerID, dstPath string, content io.Reader, options container.CopyToContainerOptions) error {
	containerID, err := trimID("container", containerID)
	if err != nil {
		return err
	}

	query := url.Values{}
	query.Set("path", filepath.ToSlash(dstPath)) // Normalize the paths used in the API.
	// Do not allow for an existing directory to be overwritten by a non-directory and vice versa.
	if !options.AllowOverwriteDirWithFile {
		query.Set("noOverwriteDirNonDir", "true")
	}

	if options.CopyUIDGID {
		query.Set("copyUIDGID", "true")
	}

	response, err := cli.putRaw(ctx, "/containers/"+containerID+"/archive", query, content, nil)
	defer ensureReaderClosed(response)
	if err != nil {
		return err
	}

	return nil
}

// CopyFromContainer gets the content from the container and returns it as a Reader
// for a TAR archive to manipulate it in the host. It's up to the caller to close the reader.
func (cli *Client) CopyFromContainer(ctx context.Context, containerID, srcPath string) (io.ReadCloser, container.PathStat, error) {
	containerID, err := trimID("container", containerID)
	if err != nil {
		return nil, container.PathStat{}, err
	}

	query := make(url.Values, 1)
	query.Set("path", filepath.ToSlash(srcPath)) // Normalize the paths used in the API.

	resp, err := cli.get(ctx, "/containers/"+containerID+"/archive", query, nil)
	if err != nil {
		return nil, container.PathStat{}, err
	}

	// In order to get the copy behavior right, we need to know information
	// about both the source and the destination. The response headers include
	// stat info about the source that we can use in deciding exactly how to
	// copy it locally. Along with the stat info about the local destination,
	// we have everything we need to handle the multiple possibilities there
	// can be when copying a file/dir from one location to another file/dir.
	stat, err := getContainerPathStatFromHeader(resp.Header)
	if err != nil {
		return nil, stat, fmt.Errorf("unable to get resource stat from response: %s", err)
	}
	return resp.Body, stat, err
}

func getContainerPathStatFromHeader(header http.Header) (container.PathStat, error) {
	var stat container.PathStat

	encodedStat := header.Get("X-Docker-Container-Path-Stat")
	statDecoder := base64.NewDecoder(base64.StdEncoding, strings.NewReader(encodedStat))

	err := json.NewDecoder(statDecoder).Decode(&stat)
	if err != nil {
		err = fmt.Errorf("unable to decode container path stat header: %s", err)
	}

	return stat, err
}
