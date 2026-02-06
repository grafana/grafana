package errdefs

import (
	"net/http"
)

// FromStatusCode creates an errdef error, based on the provided HTTP status-code
func FromStatusCode(err error, statusCode int) error {
	if err == nil {
		return nil
	}
	switch statusCode {
	case http.StatusNotFound:
		return NotFound(err)
	case http.StatusBadRequest:
		return InvalidParameter(err)
	case http.StatusConflict:
		return Conflict(err)
	case http.StatusUnauthorized:
		return Unauthorized(err)
	case http.StatusServiceUnavailable:
		return Unavailable(err)
	case http.StatusForbidden:
		return Forbidden(err)
	case http.StatusNotModified:
		return NotModified(err)
	case http.StatusNotImplemented:
		return NotImplemented(err)
	case http.StatusInternalServerError:
		if IsCancelled(err) || IsSystem(err) || IsUnknown(err) || IsDataLoss(err) || IsDeadline(err) {
			return err
		}
		return System(err)
	default:
		switch {
		case statusCode >= 200 && statusCode < 400:
			// it's a client error
			return err
		case statusCode >= 400 && statusCode < 500:
			return InvalidParameter(err)
		case statusCode >= 500 && statusCode < 600:
			return System(err)
		default:
			return Unknown(err)
		}
	}
}
