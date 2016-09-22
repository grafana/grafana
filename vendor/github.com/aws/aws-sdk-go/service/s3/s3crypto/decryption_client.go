package s3crypto

import (
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/kms"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3iface"
)

// WrapEntry is builder that return a proper key decrypter and error
type WrapEntry func(Envelope) (CipherDataDecrypter, error)

// CEKEntry is a builder thatn returns a proper content decrypter and error
type CEKEntry func(CipherData) (ContentCipher, error)

// DecryptionClient is an S3 crypto client. By default the SDK will use Authentication mode which
// will use KMS for key wrapping and AES GCM for content encryption.
// AES GCM will load all data into memory. However, the rest of the content algorithms
// do not load the entire contents into memory.
type DecryptionClient struct {
	S3Client s3iface.S3API
	// LoadStrategy is used to load the metadata either from the metadata of the object
	// or from a separate file in s3.
	//
	// Defaults to our default load strategy.
	LoadStrategy LoadStrategy

	WrapRegistry map[string]WrapEntry
	CEKRegistry  map[string]CEKEntry
}

// NewDecryptionClient instantiates a new S3 crypto client
//
// Example:
//	cmkID := "some key id to kms"
//	sess := session.New()
//	handler, err = s3crypto.NewKMSEncryptHandler(sess, cmkID, s3crypto.MaterialDescription{})
//	if err != nil {
//	  return err
//	}
//	svc := s3crypto.New(sess, s3crypto.AESGCMContentCipherBuilder(handler))
func NewDecryptionClient(prov client.ConfigProvider, options ...func(*DecryptionClient)) *DecryptionClient {
	s3client := s3.New(prov)
	client := &DecryptionClient{
		S3Client: s3client,
		LoadStrategy: defaultV2LoadStrategy{
			client: s3client,
		},
		WrapRegistry: map[string]WrapEntry{
			KMSWrap: (kmsKeyHandler{
				kms: kms.New(prov),
			}).decryptHandler,
		},
		CEKRegistry: map[string]CEKEntry{
			AESGCMNoPadding: newAESGCMContentCipher,
		},
	}
	for _, option := range options {
		option(client)
	}

	return client
}

// GetObjectRequest will make a request to s3 and retrieve the object. In this process
// decryption will be done. The SDK only supports V2 reads of KMS and GCM.
//
// Example:
//	svc := s3crypto.New(session.New(),s3crypto.AESGCMContentCipherBuilder(handler))
//	req, out := svc.GetObjectRequest(&s3.GetObjectInput {
//	  Key: aws.String("testKey"),
//	  Bucket: aws.String("testBucket"),
//	})
//	err := req.Send()
func (c *DecryptionClient) GetObjectRequest(input *s3.GetObjectInput) (*request.Request, *s3.GetObjectOutput) {
	req, out := c.S3Client.GetObjectRequest(input)
	req.Handlers.Unmarshal.PushBack(func(r *request.Request) {
		env, err := c.LoadStrategy.Load(r)
		if err != nil {
			r.Error = err
			out.Body.Close()
			return
		}

		// If KMS should return the correct CEK algorithm with the proper
		// KMS key provider
		cipher, err := c.contentCipherFromEnvelope(env)
		if err != nil {
			r.Error = err
			out.Body.Close()
			return
		}

		reader, err := cipher.DecryptContents(out.Body)
		if err != nil {
			r.Error = err
			out.Body.Close()
			return
		}
		out.Body = reader
	})
	return req, out
}

// GetObject is a wrapper for GetObjectRequest
func (c *DecryptionClient) GetObject(input *s3.GetObjectInput) (*s3.GetObjectOutput, error) {
	req, out := c.GetObjectRequest(input)
	return out, req.Send()
}
