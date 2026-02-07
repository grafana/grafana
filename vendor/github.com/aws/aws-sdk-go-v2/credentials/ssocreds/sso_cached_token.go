package ssocreds

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/aws-sdk-go-v2/internal/shareddefaults"
)

var osUserHomeDur = shareddefaults.UserHomeDir

// StandardCachedTokenFilepath returns the filepath for the cached SSO token file, or
// error if unable get derive the path. Key that will be used to compute a SHA1
// value that is hex encoded.
//
// Derives the filepath using the Key as:
//
//	~/.aws/sso/cache/<sha1-hex-encoded-key>.json
func StandardCachedTokenFilepath(key string) (string, error) {
	homeDir := osUserHomeDur()
	if len(homeDir) == 0 {
		return "", fmt.Errorf("unable to get USER's home directory for cached token")
	}
	hash := sha1.New()
	if _, err := hash.Write([]byte(key)); err != nil {
		return "", fmt.Errorf("unable to compute cached token filepath key SHA1 hash, %w", err)
	}

	cacheFilename := strings.ToLower(hex.EncodeToString(hash.Sum(nil))) + ".json"

	return filepath.Join(homeDir, ".aws", "sso", "cache", cacheFilename), nil
}

type tokenKnownFields struct {
	AccessToken string   `json:"accessToken,omitempty"`
	ExpiresAt   *rfc3339 `json:"expiresAt,omitempty"`

	RefreshToken string `json:"refreshToken,omitempty"`
	ClientID     string `json:"clientId,omitempty"`
	ClientSecret string `json:"clientSecret,omitempty"`
}

type token struct {
	tokenKnownFields
	UnknownFields map[string]interface{} `json:"-"`
}

func (t token) MarshalJSON() ([]byte, error) {
	fields := map[string]interface{}{}

	setTokenFieldString(fields, "accessToken", t.AccessToken)
	setTokenFieldRFC3339(fields, "expiresAt", t.ExpiresAt)

	setTokenFieldString(fields, "refreshToken", t.RefreshToken)
	setTokenFieldString(fields, "clientId", t.ClientID)
	setTokenFieldString(fields, "clientSecret", t.ClientSecret)

	for k, v := range t.UnknownFields {
		if _, ok := fields[k]; ok {
			return nil, fmt.Errorf("unknown token field %v, duplicates known field", k)
		}
		fields[k] = v
	}

	return json.Marshal(fields)
}

func setTokenFieldString(fields map[string]interface{}, key, value string) {
	if value == "" {
		return
	}
	fields[key] = value
}
func setTokenFieldRFC3339(fields map[string]interface{}, key string, value *rfc3339) {
	if value == nil {
		return
	}
	fields[key] = value
}

func (t *token) UnmarshalJSON(b []byte) error {
	var fields map[string]interface{}
	if err := json.Unmarshal(b, &fields); err != nil {
		return nil
	}

	t.UnknownFields = map[string]interface{}{}

	for k, v := range fields {
		var err error
		switch k {
		case "accessToken":
			err = getTokenFieldString(v, &t.AccessToken)
		case "expiresAt":
			err = getTokenFieldRFC3339(v, &t.ExpiresAt)
		case "refreshToken":
			err = getTokenFieldString(v, &t.RefreshToken)
		case "clientId":
			err = getTokenFieldString(v, &t.ClientID)
		case "clientSecret":
			err = getTokenFieldString(v, &t.ClientSecret)
		default:
			t.UnknownFields[k] = v
		}

		if err != nil {
			return fmt.Errorf("field %q, %w", k, err)
		}
	}

	return nil
}

func getTokenFieldString(v interface{}, value *string) error {
	var ok bool
	*value, ok = v.(string)
	if !ok {
		return fmt.Errorf("expect value to be string, got %T", v)
	}
	return nil
}

func getTokenFieldRFC3339(v interface{}, value **rfc3339) error {
	var stringValue string
	if err := getTokenFieldString(v, &stringValue); err != nil {
		return err
	}

	timeValue, err := parseRFC3339(stringValue)
	if err != nil {
		return err
	}

	*value = &timeValue
	return nil
}

func loadCachedToken(filename string) (token, error) {
	fileBytes, err := ioutil.ReadFile(filename)
	if err != nil {
		return token{}, fmt.Errorf("failed to read cached SSO token file, %w", err)
	}

	var t token
	if err := json.Unmarshal(fileBytes, &t); err != nil {
		return token{}, fmt.Errorf("failed to parse cached SSO token file, %w", err)
	}

	if len(t.AccessToken) == 0 || t.ExpiresAt == nil || time.Time(*t.ExpiresAt).IsZero() {
		return token{}, fmt.Errorf(
			"cached SSO token must contain accessToken and expiresAt fields")
	}

	return t, nil
}

func storeCachedToken(filename string, t token, fileMode os.FileMode) (err error) {
	tmpFilename := filename + ".tmp-" + strconv.FormatInt(sdk.NowTime().UnixNano(), 10)
	if err := writeCacheFile(tmpFilename, fileMode, t); err != nil {
		return err
	}

	if err := os.Rename(tmpFilename, filename); err != nil {
		return fmt.Errorf("failed to replace old cached SSO token file, %w", err)
	}

	return nil
}

func writeCacheFile(filename string, fileMode os.FileMode, t token) (err error) {
	var f *os.File
	f, err = os.OpenFile(filename, os.O_CREATE|os.O_TRUNC|os.O_RDWR, fileMode)
	if err != nil {
		return fmt.Errorf("failed to create cached SSO token file %w", err)
	}

	defer func() {
		closeErr := f.Close()
		if err == nil && closeErr != nil {
			err = fmt.Errorf("failed to close cached SSO token file, %w", closeErr)
		}
	}()

	encoder := json.NewEncoder(f)

	if err = encoder.Encode(t); err != nil {
		return fmt.Errorf("failed to serialize cached SSO token, %w", err)
	}

	return nil
}

type rfc3339 time.Time

func parseRFC3339(v string) (rfc3339, error) {
	parsed, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return rfc3339{}, fmt.Errorf("expected RFC3339 timestamp: %w", err)
	}

	return rfc3339(parsed), nil
}

func (r *rfc3339) UnmarshalJSON(bytes []byte) (err error) {
	var value string

	// Use JSON unmarshal to unescape the quoted value making use of JSON's
	// unquoting rules.
	if err = json.Unmarshal(bytes, &value); err != nil {
		return err
	}

	*r, err = parseRFC3339(value)

	return nil
}

func (r *rfc3339) MarshalJSON() ([]byte, error) {
	value := time.Time(*r).UTC().Format(time.RFC3339)

	// Use JSON unmarshal to unescape the quoted value making use of JSON's
	// quoting rules.
	return json.Marshal(value)
}
