// Package processcreds is a credentials provider to retrieve credentials from a
// external CLI invoked process.
//
// WARNING: The following describes a method of sourcing credentials from an external
// process. This can potentially be dangerous, so proceed with caution. Other
// credential providers should be preferred if at all possible. If using this
// option, you should make sure that the config file is as locked down as possible
// using security best practices for your operating system.
//
// # Concurrency and caching
//
// The Provider is not safe to be used concurrently, and does not provide any
// caching of credentials retrieved. You should wrap the Provider with a
// `aws.CredentialsCache` to provide concurrency safety, and caching of
// credentials.
//
// # Loading credentials with the SDKs AWS Config
//
// You can use credentials from a AWS shared config `credential_process` in a
// variety of ways.
//
// One way is to setup your shared config file, located in the default
// location, with the `credential_process` key and the command you want to be
// called. You also need to set the AWS_SDK_LOAD_CONFIG environment variable
// (e.g., `export AWS_SDK_LOAD_CONFIG=1`) to use the shared config file.
//
//	[default]
//	credential_process = /command/to/call
//
// Loading configuration using external will use the credential process to
// retrieve credentials. NOTE: If there are credentials in the profile you are
// using, the credential process will not be used.
//
//	// Initialize a session to load credentials.
//	cfg, _ := config.LoadDefaultConfig(context.TODO())
//
//	// Create S3 service client to use the credentials.
//	svc := s3.NewFromConfig(cfg)
//
// # Loading credentials with the Provider directly
//
// Another way to use the credentials process provider is by using the
// `NewProvider` constructor to create the provider and providing a it with a
// command to be executed to retrieve credentials.
//
// The following example creates a credentials provider for a command, and wraps
// it with the CredentialsCache before assigning the provider to the Amazon S3 API
// client's Credentials option.
//
//	 // Create credentials using the Provider.
//		provider := processcreds.NewProvider("/path/to/command")
//
//	 // Create the service client value configured for credentials.
//	 svc := s3.New(s3.Options{
//	   Credentials: aws.NewCredentialsCache(provider),
//	 })
//
// If you need more control, you can set any configurable options in the
// credentials using one or more option functions.
//
//	provider := processcreds.NewProvider("/path/to/command",
//	    func(o *processcreds.Options) {
//	      // Override the provider's default timeout
//	      o.Timeout = 2 * time.Minute
//	    })
//
// You can also use your own `exec.Cmd` value by satisfying a value that satisfies
// the `NewCommandBuilder` interface and use the `NewProviderCommand` constructor.
//
//	// Create an exec.Cmd
//	cmdBuilder := processcreds.NewCommandBuilderFunc(
//		func(ctx context.Context) (*exec.Cmd, error) {
//			cmd := exec.CommandContext(ctx,
//				"customCLICommand",
//				"-a", "argument",
//			)
//			cmd.Env = []string{
//				"ENV_VAR_FOO=value",
//				"ENV_VAR_BAR=other_value",
//			}
//
//			return cmd, nil
//		},
//	)
//
//	// Create credentials using your exec.Cmd and custom timeout
//	provider := processcreds.NewProviderCommand(cmdBuilder,
//		func(opt *processcreds.Provider) {
//			// optionally override the provider's default timeout
//			opt.Timeout = 1 * time.Second
//		})
package processcreds
