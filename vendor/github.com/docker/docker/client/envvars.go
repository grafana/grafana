package client // import "github.com/docker/docker/client"

const (
	// EnvOverrideHost is the name of the environment variable that can be used
	// to override the default host to connect to (DefaultDockerHost).
	//
	// This env-var is read by FromEnv and WithHostFromEnv and when set to a
	// non-empty value, takes precedence over the default host (which is platform
	// specific), or any host already set.
	EnvOverrideHost = "DOCKER_HOST"

	// EnvOverrideAPIVersion is the name of the environment variable that can
	// be used to override the API version to use. Value should be
	// formatted as MAJOR.MINOR, for example, "1.19".
	//
	// This env-var is read by FromEnv and WithVersionFromEnv and when set to a
	// non-empty value, takes precedence over API version negotiation.
	//
	// This environment variable should be used for debugging purposes only, as
	// it can set the client to use an incompatible (or invalid) API version.
	EnvOverrideAPIVersion = "DOCKER_API_VERSION"

	// EnvOverrideCertPath is the name of the environment variable that can be
	// used to specify the directory from which to load the TLS certificates
	// (ca.pem, cert.pem, key.pem) from. These certificates are used to configure
	// the Client for a TCP connection protected by TLS client authentication.
	//
	// TLS certificate verification is enabled by default if the Client is configured
	// to use a TLS connection. Refer to EnvTLSVerify below to learn how to
	// disable verification for testing purposes.
	//
	// WARNING: Access to the remote API is equivalent to root access to the
	// host where the daemon runs. Do not expose the API without protection,
	// and only if needed. Make sure you are familiar with the "daemon attack
	// surface" (https://docs.docker.com/go/attack-surface/).
	//
	// For local access to the API, it is recommended to connect with the daemon
	// using the default local socket connection (on Linux), or the named pipe
	// (on Windows).
	//
	// If you need to access the API of a remote daemon, consider using an SSH
	// (ssh://) connection, which is easier to set up, and requires no additional
	// configuration if the host is accessible using ssh.
	//
	// If you cannot use the alternatives above, and you must expose the API over
	// a TCP connection, refer to https://docs.docker.com/engine/security/protect-access/
	// to learn how to configure the daemon and client to use a TCP connection
	// with TLS client authentication. Make sure you know the differences between
	// a regular TLS connection and a TLS connection protected by TLS client
	// authentication, and verify that the API cannot be accessed by other clients.
	EnvOverrideCertPath = "DOCKER_CERT_PATH"

	// EnvTLSVerify is the name of the environment variable that can be used to
	// enable or disable TLS certificate verification. When set to a non-empty
	// value, TLS certificate verification is enabled, and the client is configured
	// to use a TLS connection, using certificates from the default directories
	// (within `~/.docker`); refer to EnvOverrideCertPath above for additional
	// details.
	//
	// WARNING: Access to the remote API is equivalent to root access to the
	// host where the daemon runs. Do not expose the API without protection,
	// and only if needed. Make sure you are familiar with the "daemon attack
	// surface" (https://docs.docker.com/go/attack-surface/).
	//
	// Before setting up your client and daemon to use a TCP connection with TLS
	// client authentication, consider using one of the alternatives mentioned
	// in EnvOverrideCertPath above.
	//
	// Disabling TLS certificate verification (for testing purposes)
	//
	// TLS certificate verification is enabled by default if the Client is configured
	// to use a TLS connection, and it is highly recommended to keep verification
	// enabled to prevent machine-in-the-middle attacks. Refer to the documentation
	// at https://docs.docker.com/engine/security/protect-access/ and pages linked
	// from that page to learn how to configure the daemon and client to use a
	// TCP connection with TLS client authentication enabled.
	//
	// Set the "DOCKER_TLS_VERIFY" environment to an empty string ("") to
	// disable TLS certificate verification. Disabling verification is insecure,
	// so should only be done for testing purposes. From the Go documentation
	// (https://pkg.go.dev/crypto/tls#Config):
	//
	// InsecureSkipVerify controls whether a client verifies the server's
	// certificate chain and host name. If InsecureSkipVerify is true, crypto/tls
	// accepts any certificate presented by the server and any host name in that
	// certificate. In this mode, TLS is susceptible to machine-in-the-middle
	// attacks unless custom verification is used. This should be used only for
	// testing or in combination with VerifyConnection or VerifyPeerCertificate.
	EnvTLSVerify = "DOCKER_TLS_VERIFY"
)
