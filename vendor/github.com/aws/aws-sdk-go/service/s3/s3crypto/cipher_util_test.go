package s3crypto

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/awstesting/unit"
	"github.com/aws/aws-sdk-go/service/kms"
)

func TestWrapFactory(t *testing.T) {
	c := DecryptionClient{
		WrapRegistry: map[string]WrapEntry{
			KMSWrap: (kmsKeyHandler{
				kms: kms.New(unit.Session),
			}).decryptHandler,
		},
		CEKRegistry: map[string]CEKEntry{
			AESGCMNoPadding: newAESGCMContentCipher,
		},
	}
	env := Envelope{
		WrapAlg: KMSWrap,
		MatDesc: `{"kms_cmk_id":""}`,
	}
	wrap, err := c.wrapFromEnvelope(env)
	_, ok := wrap.(*kmsKeyHandler)
	assert.NoError(t, err)
	assert.NotNil(t, wrap)
	assert.True(t, ok)
}
func TestWrapFactoryErrorNoWrap(t *testing.T) {
	c := DecryptionClient{
		WrapRegistry: map[string]WrapEntry{
			KMSWrap: (kmsKeyHandler{
				kms: kms.New(unit.Session),
			}).decryptHandler,
		},
		CEKRegistry: map[string]CEKEntry{
			AESGCMNoPadding: newAESGCMContentCipher,
		},
	}
	env := Envelope{
		WrapAlg: "none",
		MatDesc: `{"kms_cmk_id":""}`,
	}
	wrap, err := c.wrapFromEnvelope(env)
	assert.Error(t, err)
	assert.Nil(t, wrap)
}

func TestWrapFactoryCustomEntry(t *testing.T) {
	c := DecryptionClient{
		WrapRegistry: map[string]WrapEntry{
			"custom": (kmsKeyHandler{
				kms: kms.New(unit.Session),
			}).decryptHandler,
		},
		CEKRegistry: map[string]CEKEntry{
			AESGCMNoPadding: newAESGCMContentCipher,
		},
	}
	env := Envelope{
		WrapAlg: "custom",
		MatDesc: `{"kms_cmk_id":""}`,
	}
	wrap, err := c.wrapFromEnvelope(env)
	assert.NoError(t, err)
	assert.NotNil(t, wrap)
}

func TestCEKFactory(t *testing.T) {
	key, _ := hex.DecodeString("31bdadd96698c204aa9ce1448ea94ae1fb4a9a0b3c9d773b51bb1822666b8f22")
	keyB64 := base64.URLEncoding.EncodeToString(key)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, fmt.Sprintf("%s%s%s", `{"KeyId":"test-key-id","Plaintext":"`, keyB64, `"}`))
	}))
	defer ts.Close()

	sess := unit.Session.Copy(&aws.Config{
		MaxRetries:       aws.Int(0),
		Endpoint:         aws.String(ts.URL[7:]),
		DisableSSL:       aws.Bool(true),
		S3ForcePathStyle: aws.Bool(true),
		Region:           aws.String("us-west-2"),
	})

	c := DecryptionClient{
		WrapRegistry: map[string]WrapEntry{
			KMSWrap: (kmsKeyHandler{
				kms: kms.New(sess),
			}).decryptHandler,
		},
		CEKRegistry: map[string]CEKEntry{
			AESGCMNoPadding: newAESGCMContentCipher,
		},
	}
	iv, err := hex.DecodeString("0d18e06c7c725ac9e362e1ce")
	assert.NoError(t, err)
	ivB64 := base64.URLEncoding.EncodeToString(iv)

	cipherKey, err := hex.DecodeString("31bdadd96698c204aa9ce1448ea94ae1fb4a9a0b3c9d773b51bb1822666b8f22")
	assert.NoError(t, err)
	cipherKeyB64 := base64.URLEncoding.EncodeToString(cipherKey)

	env := Envelope{
		WrapAlg:   KMSWrap,
		CEKAlg:    AESGCMNoPadding,
		CipherKey: cipherKeyB64,
		IV:        ivB64,
		MatDesc:   `{"kms_cmk_id":""}`,
	}
	wrap, err := c.wrapFromEnvelope(env)
	cek, err := c.cekFromEnvelope(env, wrap)
	assert.NoError(t, err)
	assert.NotNil(t, cek)
}

func TestCEKFactoryNoCEK(t *testing.T) {
	key, _ := hex.DecodeString("31bdadd96698c204aa9ce1448ea94ae1fb4a9a0b3c9d773b51bb1822666b8f22")
	keyB64 := base64.URLEncoding.EncodeToString(key)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, fmt.Sprintf("%s%s%s", `{"KeyId":"test-key-id","Plaintext":"`, keyB64, `"}`))
	}))
	defer ts.Close()

	sess := unit.Session.Copy(&aws.Config{
		MaxRetries:       aws.Int(0),
		Endpoint:         aws.String(ts.URL[7:]),
		DisableSSL:       aws.Bool(true),
		S3ForcePathStyle: aws.Bool(true),
		Region:           aws.String("us-west-2"),
	})

	c := DecryptionClient{
		WrapRegistry: map[string]WrapEntry{
			KMSWrap: (kmsKeyHandler{
				kms: kms.New(sess),
			}).decryptHandler,
		},
		CEKRegistry: map[string]CEKEntry{
			AESGCMNoPadding: newAESGCMContentCipher,
		},
	}
	iv, err := hex.DecodeString("0d18e06c7c725ac9e362e1ce")
	assert.NoError(t, err)
	ivB64 := base64.URLEncoding.EncodeToString(iv)

	cipherKey, err := hex.DecodeString("31bdadd96698c204aa9ce1448ea94ae1fb4a9a0b3c9d773b51bb1822666b8f22")
	assert.NoError(t, err)
	cipherKeyB64 := base64.URLEncoding.EncodeToString(cipherKey)

	env := Envelope{
		WrapAlg:   KMSWrap,
		CEKAlg:    "none",
		CipherKey: cipherKeyB64,
		IV:        ivB64,
		MatDesc:   `{"kms_cmk_id":""}`,
	}
	wrap, err := c.wrapFromEnvelope(env)
	cek, err := c.cekFromEnvelope(env, wrap)
	assert.Error(t, err)
	assert.Nil(t, cek)
}

func TestCEKFactoryCustomEntry(t *testing.T) {
	key, _ := hex.DecodeString("31bdadd96698c204aa9ce1448ea94ae1fb4a9a0b3c9d773b51bb1822666b8f22")
	keyB64 := base64.URLEncoding.EncodeToString(key)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, fmt.Sprintf("%s%s%s", `{"KeyId":"test-key-id","Plaintext":"`, keyB64, `"}`))
	}))
	defer ts.Close()

	sess := unit.Session.Copy(&aws.Config{
		MaxRetries:       aws.Int(0),
		Endpoint:         aws.String(ts.URL[7:]),
		DisableSSL:       aws.Bool(true),
		S3ForcePathStyle: aws.Bool(true),
		Region:           aws.String("us-west-2"),
	})

	c := DecryptionClient{
		WrapRegistry: map[string]WrapEntry{
			KMSWrap: (kmsKeyHandler{
				kms: kms.New(sess),
			}).decryptHandler,
		},
		CEKRegistry: map[string]CEKEntry{
			"custom": newAESGCMContentCipher,
		},
	}
	iv, err := hex.DecodeString("0d18e06c7c725ac9e362e1ce")
	assert.NoError(t, err)
	ivB64 := base64.URLEncoding.EncodeToString(iv)

	cipherKey, err := hex.DecodeString("31bdadd96698c204aa9ce1448ea94ae1fb4a9a0b3c9d773b51bb1822666b8f22")
	assert.NoError(t, err)
	cipherKeyB64 := base64.URLEncoding.EncodeToString(cipherKey)

	env := Envelope{
		WrapAlg:   KMSWrap,
		CEKAlg:    "custom",
		CipherKey: cipherKeyB64,
		IV:        ivB64,
		MatDesc:   `{"kms_cmk_id":""}`,
	}
	wrap, err := c.wrapFromEnvelope(env)
	cek, err := c.cekFromEnvelope(env, wrap)
	assert.NoError(t, err)
	assert.NotNil(t, cek)
}
