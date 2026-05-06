package azblob

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"runtime"
	"strings"
	"time"

	"github.com/Azure/azure-pipeline-go/pipeline"
)

// RequestLogOptions configures the retry policy's behavior.
type RequestLogOptions struct {
	// LogWarningIfTryOverThreshold logs a warning if a tried operation takes longer than the specified
	// duration (-1=no logging; 0=default threshold).
	LogWarningIfTryOverThreshold time.Duration

	// SyslogDisabled is a flag to check if logging to Syslog/Windows-Event-Logger is enabled or not
	// We by default print to Syslog/Windows-Event-Logger.
	// If SyslogDisabled is not provided explicitly, the default value will be false.
	SyslogDisabled bool
}

func (o RequestLogOptions) defaults() RequestLogOptions {
	if o.LogWarningIfTryOverThreshold == 0 {
		// It would be good to relate this to https://azure.microsoft.com/en-us/support/legal/sla/storage/v1_2/
		// But this monitors the time to get the HTTP response; NOT the time to download the response body.
		o.LogWarningIfTryOverThreshold = 3 * time.Second // Default to 3 seconds
	}
	return o
}

// NewRequestLogPolicyFactory creates a RequestLogPolicyFactory object configured using the specified options.
func NewRequestLogPolicyFactory(o RequestLogOptions) pipeline.Factory {
	o = o.defaults() // Force defaults to be calculated
	return pipeline.FactoryFunc(func(next pipeline.Policy, po *pipeline.PolicyOptions) pipeline.PolicyFunc {
		// These variables are per-policy; shared by multiple calls to Do
		var try int32
		operationStart := time.Now() // If this is the 1st try, record the operation state time
		return func(ctx context.Context, request pipeline.Request) (response pipeline.Response, err error) {
			try++ // The first try is #1 (not #0)

			// Log the outgoing request as informational
			if po.ShouldLog(pipeline.LogInfo) {
				b := &bytes.Buffer{}
				fmt.Fprintf(b, "==> OUTGOING REQUEST (Try=%d)\n", try)
				pipeline.WriteRequestWithResponse(b, prepareRequestForLogging(request), nil, nil)
				po.Log(pipeline.LogInfo, b.String())
			}

			// Set the time for this particular retry operation and then Do the operation.
			tryStart := time.Now()
			response, err = next.Do(ctx, request) // Make the request
			tryEnd := time.Now()
			tryDuration := tryEnd.Sub(tryStart)
			opDuration := tryEnd.Sub(operationStart)

			logLevel, forceLog := pipeline.LogInfo, false // Default logging information

			// If the response took too long, we'll upgrade to warning.
			if o.LogWarningIfTryOverThreshold > 0 && tryDuration > o.LogWarningIfTryOverThreshold {
				// Log a warning if the try duration exceeded the specified threshold
				logLevel, forceLog = pipeline.LogWarning, !o.SyslogDisabled
			}

			var sc int
			if err == nil { // We got a valid response from the service
				sc = response.Response().StatusCode
			} else { // We got an error, so we should inspect if we got a response
				if se, ok := err.(StorageError); ok {
					if r := se.Response(); r != nil {
						sc = r.StatusCode
					}
				}
			}

			if sc == 0 || ((sc >= 400 && sc <= 499) && sc != http.StatusNotFound && sc != http.StatusConflict &&
				sc != http.StatusPreconditionFailed && sc != http.StatusRequestedRangeNotSatisfiable) || (sc >= 500 && sc <= 599) {
				logLevel, forceLog = pipeline.LogError, !o.SyslogDisabled // Promote to Error any 4xx (except those listed is an error) or any 5xx
			} else {
				// For other status codes, we leave the level as is.
			}

			if shouldLog := po.ShouldLog(logLevel); forceLog || shouldLog {
				// We're going to log this; build the string to log
				b := &bytes.Buffer{}
				slow := ""
				if o.LogWarningIfTryOverThreshold > 0 && tryDuration > o.LogWarningIfTryOverThreshold {
					slow = fmt.Sprintf("[SLOW >%v]", o.LogWarningIfTryOverThreshold)
				}
				fmt.Fprintf(b, "==> REQUEST/RESPONSE (Try=%d/%v%s, OpTime=%v) -- ", try, tryDuration, slow, opDuration)
				if err != nil { // This HTTP request did not get a response from the service
					fmt.Fprint(b, "REQUEST ERROR\n")
				} else {
					if logLevel == pipeline.LogError {
						fmt.Fprint(b, "RESPONSE STATUS CODE ERROR\n")
					} else {
						fmt.Fprint(b, "RESPONSE SUCCESSFULLY RECEIVED\n")
					}
				}

				pipeline.WriteRequestWithResponse(b, prepareRequestForLogging(request), response.Response(), err)
				if logLevel <= pipeline.LogError {
					b.Write(stack()) // For errors (or lower levels), we append the stack trace (an expensive operation)
				}
				msg := b.String()

				if forceLog {
					pipeline.ForceLog(logLevel, msg)
				}
				if shouldLog {
					po.Log(logLevel, msg)
				}
			}
			return response, err
		}
	})
}

// RedactSigQueryParam redacts the 'sig' query parameter in URL's raw query to protect secret.
func RedactSigQueryParam(rawQuery string) (bool, string) {
	rawQuery = strings.ToLower(rawQuery) // lowercase the string so we can look for ?sig= and &sig=
	sigFound := strings.Contains(rawQuery, "?sig=")
	if !sigFound {
		sigFound = strings.Contains(rawQuery, "&sig=")
		if !sigFound {
			return sigFound, rawQuery // [?|&]sig= not found; return same rawQuery passed in (no memory allocation)
		}
	}
	// [?|&]sig= found, redact its value
	values, _ := url.ParseQuery(rawQuery)
	for name := range values {
		if strings.EqualFold(name, "sig") {
			values[name] = []string{"REDACTED"}
		}
	}
	return sigFound, values.Encode()
}

func prepareRequestForLogging(request pipeline.Request) *http.Request {
	req := request
	if sigFound, rawQuery := RedactSigQueryParam(req.URL.RawQuery); sigFound {
		// Make copy so we don't destroy the query parameters we actually need to send in the request
		req = request.Copy()
		req.Request.URL.RawQuery = rawQuery
	}

	return prepareRequestForServiceLogging(req)
}

func stack() []byte {
	buf := make([]byte, 1024)
	for {
		n := runtime.Stack(buf, false)
		if n < len(buf) {
			return buf[:n]
		}
		buf = make([]byte, 2*len(buf))
	}
}

///////////////////////////////////////////////////////////////////////////////////////
// Redact phase useful for blob and file service only. For other services,
// this method can directly return request.Request.
///////////////////////////////////////////////////////////////////////////////////////
func prepareRequestForServiceLogging(request pipeline.Request) *http.Request {
	req := request
	if exist, key := doesHeaderExistCaseInsensitive(req.Header, xMsCopySourceHeader); exist {
		req = request.Copy()
		url, err := url.Parse(req.Header.Get(key))
		if err == nil {
			if sigFound, rawQuery := RedactSigQueryParam(url.RawQuery); sigFound {
				url.RawQuery = rawQuery
				req.Header.Set(xMsCopySourceHeader, url.String())
			}
		}
	}
	return req.Request
}

const xMsCopySourceHeader = "x-ms-copy-source"

func doesHeaderExistCaseInsensitive(header http.Header, key string) (bool, string) {
	for keyInHeader := range header {
		if strings.EqualFold(keyInHeader, key) {
			return true, keyInHeader
		}
	}
	return false, ""
}
