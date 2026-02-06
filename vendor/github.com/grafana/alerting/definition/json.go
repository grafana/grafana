package definition

import (
	"unsafe"

	jsoniter "github.com/json-iterator/go"
	"github.com/modern-go/reflect2"
	amcfg "github.com/prometheus/alertmanager/config"
	commoncfg "github.com/prometheus/common/config"
)

// secretEncoder encodes Secret to plain text JSON,
// avoiding the default masking behavior of the structure.
type secretEncoder struct{}

func (encoder *secretEncoder) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	stream.WriteString(getStr(ptr))
}

func (encoder *secretEncoder) IsEmpty(ptr unsafe.Pointer) bool {
	return len(getStr(ptr)) == 0
}

func getStr(ptr unsafe.Pointer) string {
	return *(*string)(ptr)
}

// secretEncoder encodes SecretURL to plain text JSON,
// avoiding the default masking behavior of the structure.
type secretURLEncoder struct{}

func (encoder *secretURLEncoder) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	url := getURL(ptr)
	if url.URL != nil {
		stream.WriteString(url.String())
	} else {
		stream.WriteNil()
	}
}

func (encoder *secretURLEncoder) IsEmpty(ptr unsafe.Pointer) bool {
	url := getURL(ptr)
	return url.URL == nil
}

func getURL(ptr unsafe.Pointer) *amcfg.URL {
	v := (*amcfg.SecretURL)(ptr)
	url := amcfg.URL(*v)
	return &url
}

func newPlainAPI() jsoniter.API {
	api := jsoniter.ConfigCompatibleWithStandardLibrary

	secretEnc := &secretEncoder{}
	secretURLEnc := &secretURLEncoder{}

	extension := jsoniter.EncoderExtension{
		// Value types
		reflect2.TypeOfPtr((*amcfg.Secret)(nil)).Elem():     secretEnc,
		reflect2.TypeOfPtr((*commoncfg.Secret)(nil)).Elem(): secretEnc,
		reflect2.TypeOfPtr((*amcfg.SecretURL)(nil)).Elem():  secretURLEnc,
		// Pointer types
		reflect2.TypeOfPtr((*amcfg.Secret)(nil)):     &jsoniter.OptionalEncoder{ValueEncoder: secretEnc},
		reflect2.TypeOfPtr((*commoncfg.Secret)(nil)): &jsoniter.OptionalEncoder{ValueEncoder: secretEnc},
		reflect2.TypeOfPtr((*amcfg.SecretURL)(nil)):  &jsoniter.OptionalEncoder{ValueEncoder: secretURLEnc},
	}

	api.RegisterExtension(extension)

	return api
}

var (
	plainJSON = newPlainAPI()
)

// MarshalJSONWithSecrets marshals the given value to JSON with secrets in plain text.
//
// alertmanager's and prometheus' Secret and SecretURL types mask their values
// when marshaled with the standard JSON or YAML marshallers. This function
// preserves the values of these types by using a custom JSON encoder.
func MarshalJSONWithSecrets(v any) ([]byte, error) {
	return plainJSON.Marshal(v)
}
