package mssql

import (
	"context"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"

	"github.com/microsoft/go-mssqldb/msdsn"
)

type MssqlProtocolDialer interface {
	// DialSqlConnection creates a net.Conn from a Connector based on the Config
	DialSqlConnection(ctx context.Context, c *Connector, p *msdsn.Config) (conn net.Conn, err error)
}

type tcpDialer struct{}

func (t tcpDialer) ParseBrowserData(data msdsn.BrowserData, p *msdsn.Config) error {
	// If instance is specified, but no port, check SQL Server Browser
	// for the instance and discover its port.
	ok := len(data) > 0
	strport := ""
	inst := ""
	if ok {
		p.Instance = strings.ToUpper(p.Instance)
		instanceName := stringForInstanceNameComparison(p.Instance)
		for _, i := range data {
			inst, ok = i["InstanceName"]
			if ok && stringForInstanceNameComparison(inst) == instanceName {
				strport, ok = i["tcp"]
				break
			}
			ok = false
		}
	}
	if !ok {
		f := "no instance matching '%v' returned from host '%v'"
		return fmt.Errorf(f, p.Instance, p.Host)
	}
	port, err := strconv.ParseUint(strport, 0, 16)
	if err != nil {
		f := "invalid tcp port returned from Sql Server Browser '%v': %v"
		return fmt.Errorf(f, strport, err.Error())
	}
	p.Port = port
	return nil
}

// SQL returns ASCII encoded instance names with \x## escaped UTF16 code points.
// We use QuoteToASCII to normalize strings like TJUTVÅ
// SQL returns 0xc5 as the byte value for Å while the UTF8 bytes in a Go string are [195 133]
// QuoteToASCII returns "TJUTV\u00c5" for both
func stringForInstanceNameComparison(inst string) (instanceName string) {
	instanceName = strings.Replace(strconv.QuoteToASCII(inst), `\u00`, `\x`, -1)
	instanceName = strings.Replace(instanceName, `\u`, `\x`, -1)
	return
}

func (t tcpDialer) DialConnection(ctx context.Context, p *msdsn.Config) (conn net.Conn, err error) {
	return nil, fmt.Errorf("tcp dialer requires a Connector instance")
}

// SQL Server AlwaysOn Availability Group Listeners are bound by DNS to a
// list of IP addresses.  So if there is more than one, try them all and
// use the first one that allows a connection.
func (t tcpDialer) DialSqlConnection(ctx context.Context, c *Connector, p *msdsn.Config) (conn net.Conn, err error) {
	var ips []net.IP
	ip := net.ParseIP(p.Host)
	portStr := strconv.Itoa(int(resolveServerPort(p.Port)))

	if ip == nil {
		// if the custom dialer is a host dialer, the DNS is resolved within the network
		// the dialer is sending the request to, rather than the one the driver is running on
		d := c.getDialer(p)
		if _, ok := d.(HostDialer); ok {
			addr := net.JoinHostPort(p.Host, portStr)
			return d.DialContext(ctx, "tcp", addr)
		}

		ips, err = net.LookupIP(p.Host)
		if err != nil {
			return
		}
	} else {
		ips = []net.IP{ip}
	}

	if len(ips) == 1 || !p.MultiSubnetFailover {
		// Try to connect to IPs sequentially until one is successful per MultiSubnetFailover false rules
		for _, ipaddress := range ips {
			d := c.getDialer(p)
			addr := net.JoinHostPort(ipaddress.String(), portStr)
			conn, err = d.DialContext(ctx, "tcp", addr)
			if err == nil {
				break
			}
		}
	} else {
		//Try Dials in parallel to avoid waiting for timeouts.
		connChan := make(chan net.Conn, len(ips))
		errChan := make(chan error, len(ips))

		for _, ip := range ips {
			go func(ip net.IP) {
				d := c.getDialer(p)
				addr := net.JoinHostPort(ip.String(), portStr)
				conn, err := d.DialContext(ctx, "tcp", addr)
				if err == nil {
					connChan <- conn
				} else {
					errChan <- err
				}
			}(ip)
		}
		// Wait for either the *first* successful connection, or all the errors
	wait_loop:
		for i := range ips {
			select {
			case conn = <-connChan:
				// Got a connection to use, close any others
				go func(n int) {
					for i := 0; i < n; i++ {
						select {
						case conn := <-connChan:
							conn.Close()
						case <-errChan:
						}
					}
				}(len(ips) - i - 1)
				// Remove any earlier errors we may have collected
				err = nil
				break wait_loop
			case err = <-errChan:
			}
		}
	}
	// Can't do the usual err != nil check, as it is possible to have gotten an error before a successful connection
	if conn == nil {
		return nil, wrapConnErr(p, err)
	}
	if p.ServerSPN == "" {
		p.ServerSPN = generateSpn(p.Host, instanceOrPort(p.Instance, p.Port))
	}
	p.Port = resolveServerPort(p.Port)
	return conn, err
}

func (t tcpDialer) CallBrowser(p *msdsn.Config) bool {
	return len(p.Instance) > 0 && p.Port == 0
}

func instanceOrPort(instance string, port uint64) string {
	if len(instance) > 0 {
		return instance
	}
	port = resolveServerPort(port)
	return strconv.FormatInt(int64(port), 10)
}

func resolveServerPort(port uint64) uint64 {
	if port == 0 {
		return defaultServerPort
	}

	return port
}

func generateSpn(host string, port string) string {
	ip := net.ParseIP(host)
	if ip != nil && ip.IsLoopback() {
		host, _ = os.Hostname()
	}
	return fmt.Sprintf("MSSQLSvc/%s:%s", host, port)
}
