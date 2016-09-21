package s3crypto

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestbytesReadWriteSeeker_Read(t *testing.T) {
	b := &bytesReadWriteSeeker{[]byte{1, 2, 3}, 0}
	expected := []byte{1, 2, 3}
	buf := []byte{}
	n, err := b.Read(buf)

	assert.NoError(t, err)
	assert.Equal(t, 3, n)
	assert.Equal(t, expected, buf)
}

func TestbytesReadWriteSeeker_Write(t *testing.T) {
	b := &bytesReadWriteSeeker{}
	expected := []byte{1, 2, 3}
	buf := []byte{}
	n, err := b.Write([]byte{1, 2, 3})

	assert.NoError(t, err)
	assert.Equal(t, 3, n)
	assert.Equal(t, expected, buf)
}

func TestbytesReadWriteSeeker_Seek(t *testing.T) {
	b := &bytesReadWriteSeeker{[]byte{1, 2, 3}, 0}
	expected := []byte{2, 3}
	m, err := b.Seek(1, 0)
	assert.NoError(t, err)
	assert.Equal(t, 1, m)
	buf := []byte{}
	n, err := b.Read(buf)

	assert.NoError(t, err)
	assert.Equal(t, 3, n)
	assert.Equal(t, expected, buf)
}
