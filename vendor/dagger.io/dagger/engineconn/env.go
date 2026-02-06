package engineconn

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
)

func FromSessionEnv() (EngineConn, bool, error) {
	portStr, ok := os.LookupEnv("DAGGER_SESSION_PORT")
	if !ok {
		return nil, false, nil
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return nil, false, fmt.Errorf("invalid port in DAGGER_SESSION_PORT: %w", err)
	}

	sessionToken := os.Getenv("DAGGER_SESSION_TOKEN")
	if sessionToken == "" {
		return nil, false, fmt.Errorf("DAGGER_SESSION_TOKEN must be set when using DAGGER_SESSION_PORT")
	}

	httpClient := defaultHTTPClient(&ConnectParams{
		Port:         port,
		SessionToken: sessionToken,
	})

	return &sessionEnvConn{
		Client: httpClient,
		host:   fmt.Sprintf("127.0.0.1:%d", port),
	}, true, nil
}

type sessionEnvConn struct {
	*http.Client
	host string
}

func (c *sessionEnvConn) Host() string {
	return c.host
}

func (c *sessionEnvConn) Close() error {
	return nil
}
