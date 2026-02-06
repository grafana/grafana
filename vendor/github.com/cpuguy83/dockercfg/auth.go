package dockercfg

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os/exec"
	"runtime"
	"strings"
)

// This is used by the docker CLI in cases where an oauth identity token is used.
// In that case the username is stored literally as `<token>`
// When fetching the credentials we check for this value to determine if.
const tokenUsername = "<token>"

// GetRegistryCredentials gets registry credentials for the passed in registry host.
//
// This will use [LoadDefaultConfig] to read registry auth details from the config.
// If the config doesn't exist, it will attempt to load registry credentials using the default credential helper for the platform.
func GetRegistryCredentials(hostname string) (string, string, error) {
	cfg, err := LoadDefaultConfig()
	if err != nil {
		if !errors.Is(err, fs.ErrNotExist) {
			return "", "", fmt.Errorf("load default config: %w", err)
		}

		return GetCredentialsFromHelper("", hostname)
	}

	return cfg.GetRegistryCredentials(hostname)
}

// ResolveRegistryHost can be used to transform a docker registry host name into what is used for the docker config/cred helpers
//
// This is useful for using with containerd authorizers.
// Naturally this only transforms docker hub URLs.
func ResolveRegistryHost(host string) string {
	switch host {
	case "index.docker.io", "docker.io", "https://index.docker.io/v1/", "registry-1.docker.io":
		return "https://index.docker.io/v1/"
	}
	return host
}

// GetRegistryCredentials gets credentials, if any, for the provided hostname.
//
// Hostnames should already be resolved using [ResolveRegistryHost].
//
// If the returned username string is empty, the password is an identity token.
func (c *Config) GetRegistryCredentials(hostname string) (string, string, error) {
	h, ok := c.CredentialHelpers[hostname]
	if ok {
		return GetCredentialsFromHelper(h, hostname)
	}

	if c.CredentialsStore != "" {
		username, password, err := GetCredentialsFromHelper(c.CredentialsStore, hostname)
		if err != nil {
			return "", "", fmt.Errorf("get credentials from store: %w", err)
		}

		if username != "" || password != "" {
			return username, password, nil
		}
	}

	auth, ok := c.AuthConfigs[hostname]
	if !ok {
		return GetCredentialsFromHelper("", hostname)
	}

	if auth.IdentityToken != "" {
		return "", auth.IdentityToken, nil
	}

	if auth.Username != "" && auth.Password != "" {
		return auth.Username, auth.Password, nil
	}

	return DecodeBase64Auth(auth)
}

// DecodeBase64Auth decodes the legacy file-based auth storage from the docker CLI.
// It takes the "Auth" filed from AuthConfig and decodes that into a username and password.
//
// If "Auth" is empty, an empty user/pass will be returned, but not an error.
func DecodeBase64Auth(auth AuthConfig) (string, string, error) {
	if auth.Auth == "" {
		return "", "", nil
	}

	decLen := base64.StdEncoding.DecodedLen(len(auth.Auth))
	decoded := make([]byte, decLen)
	n, err := base64.StdEncoding.Decode(decoded, []byte(auth.Auth))
	if err != nil {
		return "", "", fmt.Errorf("decode auth: %w", err)
	}

	decoded = decoded[:n]

	const sep = ":"
	user, pass, found := strings.Cut(string(decoded), sep)
	if !found {
		return "", "", fmt.Errorf("invalid auth: missing %q separator", sep)
	}

	return user, pass, nil
}

// Errors from credential helpers.
var (
	ErrCredentialsNotFound         = errors.New("credentials not found in native keychain")
	ErrCredentialsMissingServerURL = errors.New("no credentials server URL")
)

//nolint:gochecknoglobals // These are used to mock exec in tests.
var (
	// execLookPath is a variable that can be used to mock exec.LookPath in tests.
	execLookPath = exec.LookPath
	// execCommand is a variable that can be used to mock exec.Command in tests.
	execCommand = exec.Command
)

// GetCredentialsFromHelper attempts to lookup credentials from the passed in docker credential helper.
//
// The credential helper should just be the suffix name (no "docker-credential-").
// If the passed in helper program is empty this will look up the default helper for the platform.
//
// If the credentials are not found, no error is returned, only empty credentials.
//
// Hostnames should already be resolved using [ResolveRegistryHost]
//
// If the username string is empty, the password string is an identity token.
func GetCredentialsFromHelper(helper, hostname string) (string, string, error) {
	if helper == "" {
		helper, helperErr := getCredentialHelper()
		if helperErr != nil {
			return "", "", fmt.Errorf("get credential helper: %w", helperErr)
		}

		if helper == "" {
			return "", "", nil
		}
	}

	helper = "docker-credential-" + helper
	p, err := execLookPath(helper)
	if err != nil {
		if !errors.Is(err, exec.ErrNotFound) {
			return "", "", fmt.Errorf("look up %q: %w", helper, err)
		}

		return "", "", nil
	}

	var outBuf, errBuf bytes.Buffer
	cmd := execCommand(p, "get")
	cmd.Stdin = strings.NewReader(hostname)
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	if err = cmd.Run(); err != nil {
		out := strings.TrimSpace(outBuf.String())
		switch out {
		case ErrCredentialsNotFound.Error():
			return "", "", nil
		case ErrCredentialsMissingServerURL.Error():
			return "", "", ErrCredentialsMissingServerURL
		default:
			return "", "", fmt.Errorf("execute %q stdout: %q stderr: %q: %w",
				helper, out, strings.TrimSpace(errBuf.String()), err,
			)
		}
	}

	var creds struct {
		Username string `json:"Username"`
		Secret   string `json:"Secret"`
	}

	if err = json.Unmarshal(outBuf.Bytes(), &creds); err != nil {
		return "", "", fmt.Errorf("unmarshal credentials from: %q: %w", helper, err)
	}

	// When tokenUsername is used, the output is an identity token and the username is garbage.
	if creds.Username == tokenUsername {
		creds.Username = ""
	}

	return creds.Username, creds.Secret, nil
}

// getCredentialHelper gets the default credential helper name for the current platform.
func getCredentialHelper() (string, error) {
	switch runtime.GOOS {
	case "linux":
		if _, err := exec.LookPath("pass"); err != nil {
			if errors.Is(err, exec.ErrNotFound) {
				return "secretservice", nil
			}
			return "", fmt.Errorf(`look up "pass": %w`, err)
		}
		return "pass", nil
	case "darwin":
		return "osxkeychain", nil
	case "windows":
		return "wincred", nil
	default:
		return "", nil
	}
}
