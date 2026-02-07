package logincreds

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/aws-sdk-go-v2/internal/shareddefaults"
	"github.com/aws/aws-sdk-go-v2/service/signin"
)

var userHomeDir = shareddefaults.UserHomeDir

// StandardCachedTokenFilepath returns the filepath for the cached login token
// file. Key that will be used to compute a SHA256 value that is hex encoded.
//
// An overriden root dir can be provided, if not set the path defaults to
// ~/.aws/sso/cache.
func StandardCachedTokenFilepath(session, dir string) (string, error) {
	session = strings.TrimSpace(session)

	if len(dir) == 0 {
		dir = userHomeDir()
		if len(dir) == 0 {
			return "", errors.New("user home dir is blank")
		}
		dir = filepath.Join(dir, ".aws", "login", "cache")
	}

	h := sha256.New()
	h.Write([]byte(session))

	filename := strings.ToLower(hex.EncodeToString(h.Sum(nil))) + ".json"
	return filepath.Join(dir, filename), nil
}

// contents of the token as they appear on disk
type loginToken struct {
	AccessToken   *loginTokenAccessToken `json:"accessToken"`
	TokenType     string                 `json:"tokenType"`
	RefreshToken  string                 `json:"refreshToken"`
	IdentityToken string                 `json:"identityToken"`
	ClientID      string                 `json:"clientId"`
	DPOPKey       string                 `json:"dpopKey"`
}

type loginTokenAccessToken struct {
	AccessKeyID     string    `json:"accessKeyId"`
	SecretAccessKey string    `json:"secretAccessKey"`
	SessionToken    string    `json:"sessionToken"`
	AccountID       string    `json:"accountId"`
	ExpiresAt       time.Time `json:"expiresAt"`
}

func (t *loginToken) Validate() error {
	if t.AccessToken == nil {
		return fmt.Errorf("missing accessToken")
	}
	if t.AccessToken.AccessKeyID == "" {
		return fmt.Errorf("missing accessToken.accessKeyId")
	}
	if t.AccessToken.SecretAccessKey == "" {
		return fmt.Errorf("missing accessToken.secretAccessKey")
	}
	if t.AccessToken.SessionToken == "" {
		return fmt.Errorf("missing accessToken.sessionToken")
	}
	if t.AccessToken.AccountID == "" {
		return fmt.Errorf("missing accessToken.accountId")
	}
	if t.AccessToken.ExpiresAt.IsZero() {
		return fmt.Errorf("missing accessToken.expiresAt")
	}
	if t.ClientID == "" {
		return fmt.Errorf("missing clientId")
	}
	if t.RefreshToken == "" {
		return fmt.Errorf("missing refreshToken")
	}
	if t.DPOPKey == "" {
		return fmt.Errorf("missing dpopKey")
	}
	return nil
}

func (t *loginToken) Credentials() aws.Credentials {
	return aws.Credentials{
		AccessKeyID:     t.AccessToken.AccessKeyID,
		SecretAccessKey: t.AccessToken.SecretAccessKey,
		SessionToken:    t.AccessToken.SessionToken,
		Source:          ProviderName,
		CanExpire:       true,
		Expires:         t.AccessToken.ExpiresAt,
		AccountID:       t.AccessToken.AccountID,
	}
}

func (t *loginToken) Update(out *signin.CreateOAuth2TokenOutput) {
	t.AccessToken.AccessKeyID = *out.TokenOutput.AccessToken.AccessKeyId
	t.AccessToken.SecretAccessKey = *out.TokenOutput.AccessToken.SecretAccessKey
	t.AccessToken.SessionToken = *out.TokenOutput.AccessToken.SessionToken
	t.AccessToken.ExpiresAt = sdk.NowTime().Add(time.Duration(*out.TokenOutput.ExpiresIn) * time.Second)
	t.RefreshToken = *out.TokenOutput.RefreshToken
}
