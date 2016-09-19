package s3crypto_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/aws/aws-sdk-go/service/s3/s3crypto"
)

func TestAESGCMContentCipherBuilder(t *testing.T) {
	generator := mockGenerator{}
	builder := s3crypto.AESGCMContentCipherBuilder(generator)
	assert.NotNil(t, builder)
}

func TestAESGCMContentCipherNewEncryptor(t *testing.T) {
	generator := mockGenerator{}
	builder := s3crypto.AESGCMContentCipherBuilder(generator)
	cipher, err := builder.ContentCipher()
	assert.NoError(t, err)
	assert.NotNil(t, cipher)
}
