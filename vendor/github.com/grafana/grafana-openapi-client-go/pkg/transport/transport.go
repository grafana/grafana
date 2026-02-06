package transport

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"time"
)

const DefaultTimeout = time.Second * 5

type RetryableTransport struct {
	Transport        http.RoundTripper
	NumRetries       int
	RetryTimeout     time.Duration
	RetryStatusCodes []string
	HTTPHeaders      map[string]string
}

func (t *RetryableTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	for k, v := range t.HTTPHeaders {
		req.Header.Set(k, v)
	}

	var (
		resp             *http.Response
		err              error
		respBodyContents []byte
	)

	// Copy the request body if it's not nil
	var bodyData []byte
	if req.Body != nil {
		if bodyData, err = io.ReadAll(req.Body); err != nil {
			return nil, fmt.Errorf("failed to read request body: %w", err)
		}
	}

	for n := 0; n <= t.NumRetries; n++ {
		// Reset the request body if it's not nil
		if len(bodyData) > 0 {
			req.Body = io.NopCloser(bytes.NewBuffer(bodyData))
		}

		if n != 0 {
			retryTimeout := t.RetryTimeout
			if retryTimeout == 0 {
				retryTimeout = backoff(n)
			}
			time.Sleep(retryTimeout)
		}

		resp, err = t.Transport.RoundTrip(req)

		// If err is not nil, retry again
		// That's either caused by client policy, or failure to speak HTTP (such as network connectivity problem). A
		// non-2xx status code doesn't cause an error.
		if err != nil {
			continue
		}

		// read the body (even on non-successful HTTP status codes)
		respBodyContents, err = io.ReadAll(resp.Body)
		resp.Body.Close() //nolint:errcheck

		// if there was an error reading the body, try again
		if err != nil {
			continue
		}

		shouldRetry, err := matchRetryCode(resp.StatusCode, t.RetryStatusCodes)
		if err != nil {
			return resp, err
		}

		if !shouldRetry {
			break
		}
	}
	if err != nil {
		return resp, err
	}

	resp.Body = io.NopCloser(bytes.NewBuffer(respBodyContents))
	return resp, err
}

func backoff(retries int) time.Duration {
	return time.Duration(math.Pow(2, float64(retries))) * time.Second
}

// matchRetryCode checks if the status code matches any of the configured retry status codes.
func matchRetryCode(gottenCode int, retryCodes []string) (bool, error) {
	if len(retryCodes) == 0 {
		retryCodes = []string{"429", "5xx"}
	}

	gottenCodeStr := strconv.Itoa(gottenCode)
	for _, retryCode := range retryCodes {
		if len(retryCode) != 3 {
			return false, fmt.Errorf("invalid retry status code: %s", retryCode)
		}
		matched := true
		for i := range retryCode {
			c := retryCode[i]
			if c == 'x' {
				continue
			}
			if gottenCodeStr[i] != c {
				matched = false
				break
			}
		}
		if matched {
			return true, nil
		}
	}

	return false, nil
}
