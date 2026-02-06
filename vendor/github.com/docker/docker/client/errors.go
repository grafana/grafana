package client // import "github.com/docker/docker/client"

import (
	"context"
	"errors"
	"fmt"

	"github.com/docker/docker/api/types/versions"
	"github.com/docker/docker/errdefs"
)

// errConnectionFailed implements an error returned when connection failed.
type errConnectionFailed struct {
	error
}

// Error returns a string representation of an errConnectionFailed
func (e errConnectionFailed) Error() string {
	return e.error.Error()
}

func (e errConnectionFailed) Unwrap() error {
	return e.error
}

// IsErrConnectionFailed returns true if the error is caused by connection failed.
func IsErrConnectionFailed(err error) bool {
	return errors.As(err, &errConnectionFailed{})
}

// ErrorConnectionFailed returns an error with host in the error message when connection to docker daemon failed.
//
// Deprecated: this function was only used internally, and will be removed in the next release.
func ErrorConnectionFailed(host string) error {
	return connectionFailed(host)
}

// connectionFailed returns an error with host in the error message when connection
// to docker daemon failed.
func connectionFailed(host string) error {
	var err error
	if host == "" {
		err = errors.New("Cannot connect to the Docker daemon. Is the docker daemon running on this host?")
	} else {
		err = fmt.Errorf("Cannot connect to the Docker daemon at %s. Is the docker daemon running?", host)
	}
	return errConnectionFailed{error: err}
}

// IsErrNotFound returns true if the error is a NotFound error, which is returned
// by the API when some object is not found. It is an alias for [errdefs.IsNotFound].
func IsErrNotFound(err error) bool {
	return errdefs.IsNotFound(err)
}

type objectNotFoundError struct {
	object string
	id     string
}

func (e objectNotFoundError) NotFound() {}

func (e objectNotFoundError) Error() string {
	return fmt.Sprintf("Error: No such %s: %s", e.object, e.id)
}

// NewVersionError returns an error if the APIVersion required is less than the
// current supported version.
//
// It performs API-version negotiation if the Client is configured with this
// option, otherwise it assumes the latest API version is used.
func (cli *Client) NewVersionError(ctx context.Context, APIrequired, feature string) error {
	// Make sure we negotiated (if the client is configured to do so),
	// as code below contains API-version specific handling of options.
	//
	// Normally, version-negotiation (if enabled) would not happen until
	// the API request is made.
	if err := cli.checkVersion(ctx); err != nil {
		return err
	}
	if cli.version != "" && versions.LessThan(cli.version, APIrequired) {
		return fmt.Errorf("%q requires API version %s, but the Docker daemon API version is %s", feature, APIrequired, cli.version)
	}
	return nil
}
