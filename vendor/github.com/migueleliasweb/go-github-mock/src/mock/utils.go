package mock

import (
	"encoding/json"
	"net/http"

	"github.com/google/go-github/v64/github"
)

// MustMarshal helper function that wraps json.Marshal
func MustMarshal(v interface{}) []byte {
	b, err := json.Marshal(v)

	if err == nil {
		return b
	}

	panic(err)
}

// WriteError helper function to write errors to HTTP handlers
func WriteError(
	w http.ResponseWriter,
	httpStatus int,
	msg string,
	errors ...github.Error,
) {
	w.WriteHeader(httpStatus)

	w.Write(MustMarshal(github.ErrorResponse{
		Message: msg,
		Errors:  errors,
	}))
}
