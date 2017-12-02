// +build go1.3

package mssql

import (
	"net"
)

func init() {
	createDialer = func(p *connectParams) dialer {
		return tcpDialer{&net.Dialer{Timeout: p.dial_timeout, KeepAlive: p.keepAlive}}
	}
}
