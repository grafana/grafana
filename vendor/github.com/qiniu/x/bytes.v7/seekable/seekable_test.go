package seekable

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSeekable_EOFIfReqAlreadyParsed(t *testing.T) {
	body := "a=1"
	req, err := http.NewRequest("POST", "/a", bytes.NewBufferString(body))
	assert.NoError(t, err)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Content-Length", "3")
	req.ParseForm()
	_, err = New(req)
	assert.Equal(t, err.Error(), "EOF")
}

func TestSeekable_WorkaroundForEOF(t *testing.T) {
	body := "a=1"
	req, err := http.NewRequest("POST", "/a", bytes.NewBufferString(body))
	assert.NoError(t, err)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Content-Length", "3")
	_, _ = New(req)
	req.ParseForm()
	assert.Equal(t, req.FormValue("a"), "1")
	_, err = New(req)
	assert.NoError(t, err)
}

func TestSeekable(t *testing.T) {
	body := "a=1"
	req, err := http.NewRequest("POST", "/a", bytes.NewBufferString(body))
	assert.NoError(t, err)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Content-Length", "3")
	_, err = New(req)
	assert.NoError(t, err)
}
