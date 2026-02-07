package client // import "github.com/docker/docker/client"

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"reflect"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/versions"
	"github.com/docker/docker/errdefs"
	"github.com/pkg/errors"
)

// head sends an http request to the docker API using the method HEAD.
func (cli *Client) head(ctx context.Context, path string, query url.Values, headers http.Header) (*http.Response, error) {
	return cli.sendRequest(ctx, http.MethodHead, path, query, nil, headers)
}

// get sends an http request to the docker API using the method GET with a specific Go context.
func (cli *Client) get(ctx context.Context, path string, query url.Values, headers http.Header) (*http.Response, error) {
	return cli.sendRequest(ctx, http.MethodGet, path, query, nil, headers)
}

// post sends an http request to the docker API using the method POST with a specific Go context.
func (cli *Client) post(ctx context.Context, path string, query url.Values, obj interface{}, headers http.Header) (*http.Response, error) {
	body, headers, err := encodeBody(obj, headers)
	if err != nil {
		return nil, err
	}
	return cli.sendRequest(ctx, http.MethodPost, path, query, body, headers)
}

func (cli *Client) postRaw(ctx context.Context, path string, query url.Values, body io.Reader, headers http.Header) (*http.Response, error) {
	return cli.sendRequest(ctx, http.MethodPost, path, query, body, headers)
}

func (cli *Client) put(ctx context.Context, path string, query url.Values, obj interface{}, headers http.Header) (*http.Response, error) {
	body, headers, err := encodeBody(obj, headers)
	if err != nil {
		return nil, err
	}
	return cli.putRaw(ctx, path, query, body, headers)
}

// putRaw sends an http request to the docker API using the method PUT.
func (cli *Client) putRaw(ctx context.Context, path string, query url.Values, body io.Reader, headers http.Header) (*http.Response, error) {
	// PUT requests are expected to always have a body (apparently)
	// so explicitly pass an empty body to sendRequest to signal that
	// it should set the Content-Type header if not already present.
	if body == nil {
		body = http.NoBody
	}
	return cli.sendRequest(ctx, http.MethodPut, path, query, body, headers)
}

// delete sends an http request to the docker API using the method DELETE.
func (cli *Client) delete(ctx context.Context, path string, query url.Values, headers http.Header) (*http.Response, error) {
	return cli.sendRequest(ctx, http.MethodDelete, path, query, nil, headers)
}

func encodeBody(obj interface{}, headers http.Header) (io.Reader, http.Header, error) {
	if obj == nil {
		return nil, headers, nil
	}
	// encoding/json encodes a nil pointer as the JSON document `null`,
	// irrespective of whether the type implements json.Marshaler or encoding.TextMarshaler.
	// That is almost certainly not what the caller intended as the request body.
	if reflect.TypeOf(obj).Kind() == reflect.Ptr && reflect.ValueOf(obj).IsNil() {
		return nil, headers, nil
	}

	body, err := encodeData(obj)
	if err != nil {
		return nil, headers, err
	}
	if headers == nil {
		headers = make(map[string][]string)
	}
	headers["Content-Type"] = []string{"application/json"}
	return body, headers, nil
}

func (cli *Client) buildRequest(ctx context.Context, method, path string, body io.Reader, headers http.Header) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, path, body)
	if err != nil {
		return nil, err
	}
	req = cli.addHeaders(req, headers)
	req.URL.Scheme = cli.scheme
	req.URL.Host = cli.addr

	if cli.proto == "unix" || cli.proto == "npipe" {
		// Override host header for non-tcp connections.
		req.Host = DummyHost
	}

	if body != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "text/plain")
	}
	return req, nil
}

func (cli *Client) sendRequest(ctx context.Context, method, path string, query url.Values, body io.Reader, headers http.Header) (*http.Response, error) {
	req, err := cli.buildRequest(ctx, method, cli.getAPIPath(ctx, path, query), body, headers)
	if err != nil {
		return nil, err
	}

	resp, err := cli.doRequest(req)
	switch {
	case errors.Is(err, context.Canceled):
		return nil, errdefs.Cancelled(err)
	case errors.Is(err, context.DeadlineExceeded):
		return nil, errdefs.Deadline(err)
	case err == nil:
		return resp, cli.checkResponseErr(resp)
	default:
		return resp, err
	}
}

func (cli *Client) doRequest(req *http.Request) (*http.Response, error) {
	resp, err := cli.client.Do(req)
	if err != nil {
		if cli.scheme != "https" && strings.Contains(err.Error(), "malformed HTTP response") {
			return nil, errConnectionFailed{fmt.Errorf("%v.\n* Are you trying to connect to a TLS-enabled daemon without TLS?", err)}
		}

		if cli.scheme == "https" && strings.Contains(err.Error(), "bad certificate") {
			return nil, errConnectionFailed{errors.Wrap(err, "the server probably has client authentication (--tlsverify) enabled; check your TLS client certification settings")}
		}

		// Don't decorate context sentinel errors; users may be comparing to
		// them directly.
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return nil, err
		}

		var uErr *url.Error
		if errors.As(err, &uErr) {
			var nErr *net.OpError
			if errors.As(uErr.Err, &nErr) {
				if os.IsPermission(nErr.Err) {
					return nil, errConnectionFailed{errors.Wrapf(err, "permission denied while trying to connect to the Docker daemon socket at %v", cli.host)}
				}
			}
		}

		var nErr net.Error
		if errors.As(err, &nErr) {
			// FIXME(thaJeztah): any net.Error should be considered a connection error (but we should include the original error)?
			if nErr.Timeout() {
				return nil, connectionFailed(cli.host)
			}
			if strings.Contains(nErr.Error(), "connection refused") || strings.Contains(nErr.Error(), "dial unix") {
				return nil, connectionFailed(cli.host)
			}
		}

		// Although there's not a strongly typed error for this in go-winio,
		// lots of people are using the default configuration for the docker
		// daemon on Windows where the daemon is listening on a named pipe
		// `//./pipe/docker_engine, and the client must be running elevated.
		// Give users a clue rather than the not-overly useful message
		// such as `error during connect: Get http://%2F%2F.%2Fpipe%2Fdocker_engine/v1.26/info:
		// open //./pipe/docker_engine: The system cannot find the file specified.`.
		// Note we can't string compare "The system cannot find the file specified" as
		// this is localised - for example in French the error would be
		// `open //./pipe/docker_engine: Le fichier spécifié est introuvable.`
		if strings.Contains(err.Error(), `open //./pipe/docker_engine`) {
			// Checks if client is running with elevated privileges
			if f, elevatedErr := os.Open(`\\.\PHYSICALDRIVE0`); elevatedErr != nil {
				err = errors.Wrap(err, "in the default daemon configuration on Windows, the docker client must be run with elevated privileges to connect")
			} else {
				_ = f.Close()
				err = errors.Wrap(err, "this error may indicate that the docker daemon is not running")
			}
		}

		return nil, errConnectionFailed{errors.Wrap(err, "error during connect")}
	}

	return resp, nil
}

func (cli *Client) checkResponseErr(serverResp *http.Response) (retErr error) {
	if serverResp == nil {
		return nil
	}
	if serverResp.StatusCode >= 200 && serverResp.StatusCode < 400 {
		return nil
	}
	defer func() {
		retErr = errdefs.FromStatusCode(retErr, serverResp.StatusCode)
	}()

	var body []byte
	var err error
	var reqURL string
	if serverResp.Request != nil {
		reqURL = serverResp.Request.URL.String()
	}
	statusMsg := serverResp.Status
	if statusMsg == "" {
		statusMsg = http.StatusText(serverResp.StatusCode)
	}
	if serverResp.Body != nil {
		bodyMax := 1 * 1024 * 1024 // 1 MiB
		bodyR := &io.LimitedReader{
			R: serverResp.Body,
			N: int64(bodyMax),
		}
		body, err = io.ReadAll(bodyR)
		if err != nil {
			return err
		}
		if bodyR.N == 0 {
			if reqURL != "" {
				return fmt.Errorf("request returned %s with a message (> %d bytes) for API route and version %s, check if the server supports the requested API version", statusMsg, bodyMax, reqURL)
			}
			return fmt.Errorf("request returned %s with a message (> %d bytes); check if the server supports the requested API version", statusMsg, bodyMax)
		}
	}
	if len(body) == 0 {
		if reqURL != "" {
			return fmt.Errorf("request returned %s for API route and version %s, check if the server supports the requested API version", statusMsg, reqURL)
		}
		return fmt.Errorf("request returned %s; check if the server supports the requested API version", statusMsg)
	}

	var daemonErr error
	if serverResp.Header.Get("Content-Type") == "application/json" && (cli.version == "" || versions.GreaterThan(cli.version, "1.23")) {
		var errorResponse types.ErrorResponse
		if err := json.Unmarshal(body, &errorResponse); err != nil {
			return errors.Wrap(err, "Error reading JSON")
		}
		if errorResponse.Message == "" {
			// Error-message is empty, which means that we successfully parsed the
			// JSON-response (no error produced), but it didn't contain an error
			// message. This could either be because the response was empty, or
			// the response was valid JSON, but not with the expected schema
			// ([types.ErrorResponse]).
			//
			// We cannot use "strict" JSON handling (json.NewDecoder with DisallowUnknownFields)
			// due to the API using an open schema (we must anticipate fields
			// being added to [types.ErrorResponse] in the future, and not
			// reject those responses.
			//
			// For these cases, we construct an error with the status-code
			// returned, but we could consider returning (a truncated version
			// of) the actual response as-is.
			//
			// TODO(thaJeztah): consider adding a log.Debug to allow clients to debug the actual response when enabling debug logging.
			daemonErr = fmt.Errorf(`API returned a %d (%s) but provided no error-message`,
				serverResp.StatusCode,
				http.StatusText(serverResp.StatusCode),
			)
		} else {
			daemonErr = errors.New(strings.TrimSpace(errorResponse.Message))
		}
	} else {
		// Fall back to returning the response as-is for API versions < 1.24
		// that didn't support JSON error responses, and for situations
		// where a plain text error is returned. This branch may also catch
		// situations where a proxy is involved, returning a HTML response.
		daemonErr = errors.New(strings.TrimSpace(string(body)))
	}
	return errors.Wrap(daemonErr, "Error response from daemon")
}

func (cli *Client) addHeaders(req *http.Request, headers http.Header) *http.Request {
	// Add CLI Config's HTTP Headers BEFORE we set the Docker headers
	// then the user can't change OUR headers
	for k, v := range cli.customHTTPHeaders {
		if versions.LessThan(cli.version, "1.25") && http.CanonicalHeaderKey(k) == "User-Agent" {
			continue
		}
		req.Header.Set(k, v)
	}

	for k, v := range headers {
		req.Header[http.CanonicalHeaderKey(k)] = v
	}

	if cli.userAgent != nil {
		if *cli.userAgent == "" {
			req.Header.Del("User-Agent")
		} else {
			req.Header.Set("User-Agent", *cli.userAgent)
		}
	}
	return req
}

func encodeData(data interface{}) (*bytes.Buffer, error) {
	params := bytes.NewBuffer(nil)
	if data != nil {
		if err := json.NewEncoder(params).Encode(data); err != nil {
			return nil, err
		}
	}
	return params, nil
}

func ensureReaderClosed(response *http.Response) {
	if response != nil && response.Body != nil {
		// Drain up to 512 bytes and close the body to let the Transport reuse the connection
		// see https://github.com/google/go-github/pull/317/files#r57536827
		//
		// TODO(thaJeztah): see if this optimization is still needed, or already implemented in stdlib,
		//   and check if context-cancellation should handle this as well. If still needed, consider
		//   wrapping response.Body, or returning a "closer()" from [Client.sendRequest] and related
		//   methods.
		_, _ = io.CopyN(io.Discard, response.Body, 512)
		_ = response.Body.Close()
	}
}
