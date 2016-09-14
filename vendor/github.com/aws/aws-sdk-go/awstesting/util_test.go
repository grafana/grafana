package awstesting_test

import (
	"io"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/aws/aws-sdk-go/awstesting"
)

func TestReadCloserClose(t *testing.T) {
	rc := awstesting.ReadCloser{Size: 1}
	err := rc.Close()

	assert.Nil(t, err)
	assert.True(t, rc.Closed)
	assert.Equal(t, rc.Size, 1)
}

func TestReadCloserRead(t *testing.T) {
	rc := awstesting.ReadCloser{Size: 5}
	b := make([]byte, 2)

	n, err := rc.Read(b)

	assert.Nil(t, err)
	assert.Equal(t, n, 2)
	assert.False(t, rc.Closed)
	assert.Equal(t, rc.Size, 3)

	err = rc.Close()
	assert.Nil(t, err)
	n, err = rc.Read(b)
	assert.Equal(t, err, io.EOF)
	assert.Equal(t, n, 0)
}

func TestReadCloserReadAll(t *testing.T) {
	rc := awstesting.ReadCloser{Size: 5}
	b := make([]byte, 5)

	n, err := rc.Read(b)

	assert.Equal(t, err, io.EOF)
	assert.Equal(t, n, 5)
	assert.False(t, rc.Closed)
	assert.Equal(t, rc.Size, 0)
}
