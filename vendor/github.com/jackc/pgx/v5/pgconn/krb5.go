package pgconn

import (
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgproto3"
)

// NewGSSFunc creates a GSS authentication provider, for use with
// RegisterGSSProvider.
type NewGSSFunc func() (GSS, error)

var newGSS NewGSSFunc

// RegisterGSSProvider registers a GSS authentication provider. For example, if
// you need to use Kerberos to authenticate with your server, add this to your
// main package:
//
//	import "github.com/otan/gopgkrb5"
//
//	func init() {
//		pgconn.RegisterGSSProvider(func() (pgconn.GSS, error) { return gopgkrb5.NewGSS() })
//	}
func RegisterGSSProvider(newGSSArg NewGSSFunc) {
	newGSS = newGSSArg
}

// GSS provides GSSAPI authentication (e.g., Kerberos).
type GSS interface {
	GetInitToken(host, service string) ([]byte, error)
	GetInitTokenFromSPN(spn string) ([]byte, error)
	Continue(inToken []byte) (done bool, outToken []byte, err error)
}

func (c *PgConn) gssAuth() error {
	if newGSS == nil {
		return errors.New("kerberos error: no GSSAPI provider registered, see https://github.com/otan/gopgkrb5")
	}
	cli, err := newGSS()
	if err != nil {
		return err
	}

	var nextData []byte
	if c.config.KerberosSpn != "" {
		// Use the supplied SPN if provided.
		nextData, err = cli.GetInitTokenFromSPN(c.config.KerberosSpn)
	} else {
		// Allow the kerberos service name to be overridden
		service := "postgres"
		if c.config.KerberosSrvName != "" {
			service = c.config.KerberosSrvName
		}
		nextData, err = cli.GetInitToken(c.config.Host, service)
	}
	if err != nil {
		return err
	}

	for {
		gssResponse := &pgproto3.GSSResponse{
			Data: nextData,
		}
		c.frontend.Send(gssResponse)
		err = c.flushWithPotentialWriteReadDeadlock()
		if err != nil {
			return err
		}
		resp, err := c.rxGSSContinue()
		if err != nil {
			return err
		}
		var done bool
		done, nextData, err = cli.Continue(resp.Data)
		if err != nil {
			return err
		}
		if done {
			break
		}
	}
	return nil
}

func (c *PgConn) rxGSSContinue() (*pgproto3.AuthenticationGSSContinue, error) {
	msg, err := c.receiveMessage()
	if err != nil {
		return nil, err
	}

	switch m := msg.(type) {
	case *pgproto3.AuthenticationGSSContinue:
		return m, nil
	case *pgproto3.ErrorResponse:
		return nil, ErrorResponseToPgError(m)
	}

	return nil, fmt.Errorf("expected AuthenticationGSSContinue message but received unexpected message %T", msg)
}
