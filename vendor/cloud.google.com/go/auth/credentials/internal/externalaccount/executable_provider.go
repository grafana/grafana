// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package externalaccount

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"cloud.google.com/go/auth/internal"
)

const (
	executableSupportedMaxVersion = 1
	executableDefaultTimeout      = 30 * time.Second
	executableSource              = "response"
	executableProviderType        = "executable"
	outputFileSource              = "output file"

	allowExecutablesEnvVar = "GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES"

	jwtTokenType   = "urn:ietf:params:oauth:token-type:jwt"
	idTokenType    = "urn:ietf:params:oauth:token-type:id_token"
	saml2TokenType = "urn:ietf:params:oauth:token-type:saml2"
)

var (
	serviceAccountImpersonationRE = regexp.MustCompile(`https://iamcredentials..+/v1/projects/-/serviceAccounts/(.*@.*):generateAccessToken`)
)

type nonCacheableError struct {
	message string
}

func (nce nonCacheableError) Error() string {
	return nce.message
}

// environment is a contract for testing
type environment interface {
	existingEnv() []string
	getenv(string) string
	run(ctx context.Context, command string, env []string) ([]byte, error)
	now() time.Time
}

type runtimeEnvironment struct{}

func (r runtimeEnvironment) existingEnv() []string {
	return os.Environ()
}
func (r runtimeEnvironment) getenv(key string) string {
	return os.Getenv(key)
}
func (r runtimeEnvironment) now() time.Time {
	return time.Now().UTC()
}

func (r runtimeEnvironment) run(ctx context.Context, command string, env []string) ([]byte, error) {
	splitCommand := strings.Fields(command)
	cmd := exec.CommandContext(ctx, splitCommand[0], splitCommand[1:]...)
	cmd.Env = env

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, context.DeadlineExceeded
		}
		if exitError, ok := err.(*exec.ExitError); ok {
			return nil, exitCodeError(exitError)
		}
		return nil, executableError(err)
	}

	bytesStdout := bytes.TrimSpace(stdout.Bytes())
	if len(bytesStdout) > 0 {
		return bytesStdout, nil
	}
	return bytes.TrimSpace(stderr.Bytes()), nil
}

type executableSubjectProvider struct {
	Command    string
	Timeout    time.Duration
	OutputFile string
	client     *http.Client
	opts       *Options
	env        environment
}

type executableResponse struct {
	Version        int    `json:"version,omitempty"`
	Success        *bool  `json:"success,omitempty"`
	TokenType      string `json:"token_type,omitempty"`
	ExpirationTime int64  `json:"expiration_time,omitempty"`
	IDToken        string `json:"id_token,omitempty"`
	SamlResponse   string `json:"saml_response,omitempty"`
	Code           string `json:"code,omitempty"`
	Message        string `json:"message,omitempty"`
}

func (sp *executableSubjectProvider) parseSubjectTokenFromSource(response []byte, source string, now int64) (string, error) {
	var result executableResponse
	if err := json.Unmarshal(response, &result); err != nil {
		return "", jsonParsingError(source, string(response))
	}
	// Validate
	if result.Version == 0 {
		return "", missingFieldError(source, "version")
	}
	if result.Success == nil {
		return "", missingFieldError(source, "success")
	}
	if !*result.Success {
		if result.Code == "" || result.Message == "" {
			return "", malformedFailureError()
		}
		return "", userDefinedError(result.Code, result.Message)
	}
	if result.Version > executableSupportedMaxVersion || result.Version < 0 {
		return "", unsupportedVersionError(source, result.Version)
	}
	if result.ExpirationTime == 0 && sp.OutputFile != "" {
		return "", missingFieldError(source, "expiration_time")
	}
	if result.TokenType == "" {
		return "", missingFieldError(source, "token_type")
	}
	if result.ExpirationTime != 0 && result.ExpirationTime < now {
		return "", tokenExpiredError()
	}

	switch result.TokenType {
	case jwtTokenType, idTokenType:
		if result.IDToken == "" {
			return "", missingFieldError(source, "id_token")
		}
		return result.IDToken, nil
	case saml2TokenType:
		if result.SamlResponse == "" {
			return "", missingFieldError(source, "saml_response")
		}
		return result.SamlResponse, nil
	default:
		return "", tokenTypeError(source)
	}
}

func (sp *executableSubjectProvider) subjectToken(ctx context.Context) (string, error) {
	if token, err := sp.getTokenFromOutputFile(); token != "" || err != nil {
		return token, err
	}
	return sp.getTokenFromExecutableCommand(ctx)
}

func (sp *executableSubjectProvider) providerType() string {
	return executableProviderType
}

func (sp *executableSubjectProvider) getTokenFromOutputFile() (token string, err error) {
	if sp.OutputFile == "" {
		// This ExecutableCredentialSource doesn't use an OutputFile.
		return "", nil
	}

	file, err := os.Open(sp.OutputFile)
	if err != nil {
		// No OutputFile found. Hasn't been created yet, so skip it.
		return "", nil
	}
	defer file.Close()

	data, err := internal.ReadAll(file)
	if err != nil || len(data) == 0 {
		// Cachefile exists, but no data found. Get new credential.
		return "", nil
	}

	token, err = sp.parseSubjectTokenFromSource(data, outputFileSource, sp.env.now().Unix())
	if err != nil {
		if _, ok := err.(nonCacheableError); ok {
			// If the cached token is expired we need a new token,
			// and if the cache contains a failure, we need to try again.
			return "", nil
		}

		// There was an error in the cached token, and the developer should be aware of it.
		return "", err
	}
	// Token parsing succeeded.  Use found token.
	return token, nil
}

func (sp *executableSubjectProvider) executableEnvironment() []string {
	result := sp.env.existingEnv()
	result = append(result, fmt.Sprintf("GOOGLE_EXTERNAL_ACCOUNT_AUDIENCE=%v", sp.opts.Audience))
	result = append(result, fmt.Sprintf("GOOGLE_EXTERNAL_ACCOUNT_TOKEN_TYPE=%v", sp.opts.SubjectTokenType))
	result = append(result, "GOOGLE_EXTERNAL_ACCOUNT_INTERACTIVE=0")
	if sp.opts.ServiceAccountImpersonationURL != "" {
		matches := serviceAccountImpersonationRE.FindStringSubmatch(sp.opts.ServiceAccountImpersonationURL)
		if matches != nil {
			result = append(result, fmt.Sprintf("GOOGLE_EXTERNAL_ACCOUNT_IMPERSONATED_EMAIL=%v", matches[1]))
		}
	}
	if sp.OutputFile != "" {
		result = append(result, fmt.Sprintf("GOOGLE_EXTERNAL_ACCOUNT_OUTPUT_FILE=%v", sp.OutputFile))
	}
	return result
}

func (sp *executableSubjectProvider) getTokenFromExecutableCommand(ctx context.Context) (string, error) {
	// For security reasons, we need our consumers to set this environment variable to allow executables to be run.
	if sp.env.getenv(allowExecutablesEnvVar) != "1" {
		return "", errors.New("credentials: executables need to be explicitly allowed (set GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES to '1') to run")
	}

	ctx, cancel := context.WithDeadline(ctx, sp.env.now().Add(sp.Timeout))
	defer cancel()

	output, err := sp.env.run(ctx, sp.Command, sp.executableEnvironment())
	if err != nil {
		return "", err
	}
	return sp.parseSubjectTokenFromSource(output, executableSource, sp.env.now().Unix())
}

func missingFieldError(source, field string) error {
	return fmt.Errorf("credentials: %q missing %q field", source, field)
}

func jsonParsingError(source, data string) error {
	return fmt.Errorf("credentials: unable to parse %q: %v", source, data)
}

func malformedFailureError() error {
	return nonCacheableError{"credentials: response must include `error` and `message` fields when unsuccessful"}
}

func userDefinedError(code, message string) error {
	return nonCacheableError{fmt.Sprintf("credentials: response contains unsuccessful response: (%v) %v", code, message)}
}

func unsupportedVersionError(source string, version int) error {
	return fmt.Errorf("credentials: %v contains unsupported version: %v", source, version)
}

func tokenExpiredError() error {
	return nonCacheableError{"credentials: the token returned by the executable is expired"}
}

func tokenTypeError(source string) error {
	return fmt.Errorf("credentials: %v contains unsupported token type", source)
}

func exitCodeError(err *exec.ExitError) error {
	return fmt.Errorf("credentials: executable command failed with exit code %v: %w", err.ExitCode(), err)
}

func executableError(err error) error {
	return fmt.Errorf("credentials: executable command failed: %w", err)
}
