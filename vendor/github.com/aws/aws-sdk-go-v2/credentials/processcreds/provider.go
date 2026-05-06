package processcreds

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/internal/sdkio"
)

const (
	// ProviderName is the name this credentials provider will label any
	// returned credentials Value with.
	ProviderName = `ProcessProvider`

	// DefaultTimeout default limit on time a process can run.
	DefaultTimeout = time.Duration(1) * time.Minute
)

// ProviderError is an error indicating failure initializing or executing the
// process credentials provider
type ProviderError struct {
	Err error
}

// Error returns the error message.
func (e *ProviderError) Error() string {
	return fmt.Sprintf("process provider error: %v", e.Err)
}

// Unwrap returns the underlying error the provider error wraps.
func (e *ProviderError) Unwrap() error {
	return e.Err
}

// Provider satisfies the credentials.Provider interface, and is a
// client to retrieve credentials from a process.
type Provider struct {
	// Provides a constructor for exec.Cmd that are invoked by the provider for
	// retrieving credentials. Use this to provide custom creation of exec.Cmd
	// with things like environment variables, or other configuration.
	//
	// The provider defaults to the DefaultNewCommand function.
	commandBuilder NewCommandBuilder

	options Options
}

// Options is the configuration options for configuring the Provider.
type Options struct {
	// Timeout limits the time a process can run.
	Timeout time.Duration
	// The chain of providers that was used to create this provider
	// These values are for reporting purposes and are not meant to be set up directly
	CredentialSources []aws.CredentialSource
}

// NewCommandBuilder provides the interface for specifying how command will be
// created that the Provider will use to retrieve credentials with.
type NewCommandBuilder interface {
	NewCommand(context.Context) (*exec.Cmd, error)
}

// NewCommandBuilderFunc provides a wrapper type around a function pointer to
// satisfy the NewCommandBuilder interface.
type NewCommandBuilderFunc func(context.Context) (*exec.Cmd, error)

// NewCommand calls the underlying function pointer the builder was initialized with.
func (fn NewCommandBuilderFunc) NewCommand(ctx context.Context) (*exec.Cmd, error) {
	return fn(ctx)
}

// DefaultNewCommandBuilder provides the default NewCommandBuilder
// implementation used by the provider. It takes a command and arguments to
// invoke. The command will also be initialized with the current process
// environment variables, stderr, and stdin pipes.
type DefaultNewCommandBuilder struct {
	Args []string
}

// NewCommand returns an initialized exec.Cmd with the builder's initialized
// Args. The command is also initialized current process environment variables,
// stderr, and stdin pipes.
func (b DefaultNewCommandBuilder) NewCommand(ctx context.Context) (*exec.Cmd, error) {
	var cmdArgs []string
	if runtime.GOOS == "windows" {
		cmdArgs = []string{"cmd.exe", "/C"}
	} else {
		cmdArgs = []string{"sh", "-c"}
	}

	if len(b.Args) == 0 {
		return nil, &ProviderError{
			Err: fmt.Errorf("failed to prepare command: command must not be empty"),
		}
	}

	cmdArgs = append(cmdArgs, b.Args...)
	cmd := exec.CommandContext(ctx, cmdArgs[0], cmdArgs[1:]...)
	cmd.Env = os.Environ()

	cmd.Stderr = os.Stderr // display stderr on console for MFA
	cmd.Stdin = os.Stdin   // enable stdin for MFA

	return cmd, nil
}

// NewProvider returns a pointer to a new Credentials object wrapping the
// Provider.
//
// The provider defaults to the DefaultNewCommandBuilder for creating command
// the Provider will use to retrieve credentials with.
func NewProvider(command string, options ...func(*Options)) *Provider {
	var args []string

	// Ensure that the command arguments are not set if the provided command is
	// empty. This will error out when the command is executed since no
	// arguments are specified.
	if len(command) > 0 {
		args = []string{command}
	}

	commanBuilder := DefaultNewCommandBuilder{
		Args: args,
	}
	return NewProviderCommand(commanBuilder, options...)
}

// NewProviderCommand returns a pointer to a new Credentials object with the
// specified command, and default timeout duration. Use this to provide custom
// creation of exec.Cmd for options like environment variables, or other
// configuration.
func NewProviderCommand(builder NewCommandBuilder, options ...func(*Options)) *Provider {
	p := &Provider{
		commandBuilder: builder,
		options: Options{
			Timeout: DefaultTimeout,
		},
	}

	for _, option := range options {
		option(&p.options)
	}

	return p
}

// A CredentialProcessResponse is the AWS credentials format that must be
// returned when executing an external credential_process.
type CredentialProcessResponse struct {
	// As of this writing, the Version key must be set to 1. This might
	// increment over time as the structure evolves.
	Version int

	// The access key ID that identifies the temporary security credentials.
	AccessKeyID string `json:"AccessKeyId"`

	// The secret access key that can be used to sign requests.
	SecretAccessKey string

	// The token that users must pass to the service API to use the temporary credentials.
	SessionToken string

	// The date on which the current credentials expire.
	Expiration *time.Time

	// The ID of the account for credentials
	AccountID string `json:"AccountId"`
}

// Retrieve executes the credential process command and returns the
// credentials, or error if the command fails.
func (p *Provider) Retrieve(ctx context.Context) (aws.Credentials, error) {
	out, err := p.executeCredentialProcess(ctx)
	if err != nil {
		return aws.Credentials{Source: ProviderName}, err
	}

	// Serialize and validate response
	resp := &CredentialProcessResponse{}
	if err = json.Unmarshal(out, resp); err != nil {
		return aws.Credentials{Source: ProviderName}, &ProviderError{
			Err: fmt.Errorf("parse failed of process output: %s, error: %w", out, err),
		}
	}

	if resp.Version != 1 {
		return aws.Credentials{Source: ProviderName}, &ProviderError{
			Err: fmt.Errorf("wrong version in process output (not 1)"),
		}
	}

	if len(resp.AccessKeyID) == 0 {
		return aws.Credentials{Source: ProviderName}, &ProviderError{
			Err: fmt.Errorf("missing AccessKeyId in process output"),
		}
	}

	if len(resp.SecretAccessKey) == 0 {
		return aws.Credentials{Source: ProviderName}, &ProviderError{
			Err: fmt.Errorf("missing SecretAccessKey in process output"),
		}
	}

	creds := aws.Credentials{
		Source:          ProviderName,
		AccessKeyID:     resp.AccessKeyID,
		SecretAccessKey: resp.SecretAccessKey,
		SessionToken:    resp.SessionToken,
		AccountID:       resp.AccountID,
	}

	// Handle expiration
	if resp.Expiration != nil {
		creds.CanExpire = true
		creds.Expires = *resp.Expiration
	}

	return creds, nil
}

// executeCredentialProcess starts the credential process on the OS and
// returns the results or an error.
func (p *Provider) executeCredentialProcess(ctx context.Context) ([]byte, error) {
	if p.options.Timeout >= 0 {
		var cancelFunc func()
		ctx, cancelFunc = context.WithTimeout(ctx, p.options.Timeout)
		defer cancelFunc()
	}

	cmd, err := p.commandBuilder.NewCommand(ctx)
	if err != nil {
		return nil, err
	}

	// get creds json on process's stdout
	output := bytes.NewBuffer(make([]byte, 0, int(8*sdkio.KibiByte)))
	if cmd.Stdout != nil {
		cmd.Stdout = io.MultiWriter(cmd.Stdout, output)
	} else {
		cmd.Stdout = output
	}

	execCh := make(chan error, 1)
	go executeCommand(cmd, execCh)

	select {
	case execError := <-execCh:
		if execError == nil {
			break
		}
		select {
		case <-ctx.Done():
			return output.Bytes(), &ProviderError{
				Err: fmt.Errorf("credential process timed out: %w", execError),
			}
		default:
			return output.Bytes(), &ProviderError{
				Err: fmt.Errorf("error in credential_process: %w", execError),
			}
		}
	}

	out := output.Bytes()
	if runtime.GOOS == "windows" {
		// windows adds slashes to quotes
		out = bytes.ReplaceAll(out, []byte(`\"`), []byte(`"`))
	}

	return out, nil
}

// ProviderSources returns the credential chain that was used to construct this provider
func (p *Provider) ProviderSources() []aws.CredentialSource {
	if p.options.CredentialSources == nil {
		return []aws.CredentialSource{aws.CredentialSourceProcess}
	}
	return p.options.CredentialSources
}

func executeCommand(cmd *exec.Cmd, exec chan error) {
	// Start the command
	err := cmd.Start()
	if err == nil {
		err = cmd.Wait()
	}

	exec <- err
}
