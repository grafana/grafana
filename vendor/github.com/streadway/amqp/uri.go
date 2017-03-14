// Copyright (c) 2012, Sean Treadway, SoundCloud Ltd.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
// Source code and contact info at http://github.com/streadway/amqp

package amqp

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

var errURIScheme = errors.New("AMQP scheme must be either 'amqp://' or 'amqps://'")

var schemePorts = map[string]int{
	"amqp":  5672,
	"amqps": 5671,
}

var defaultURI = URI{
	Scheme:   "amqp",
	Host:     "localhost",
	Port:     5672,
	Username: "guest",
	Password: "guest",
	Vhost:    "/",
}

// URI represents a parsed AMQP URI string.
type URI struct {
	Scheme   string
	Host     string
	Port     int
	Username string
	Password string
	Vhost    string
}

// ParseURI attempts to parse the given AMQP URI according to the spec.
// See http://www.rabbitmq.com/uri-spec.html.
//
// Default values for the fields are:
//
//   Scheme: amqp
//   Host: localhost
//   Port: 5672
//   Username: guest
//   Password: guest
//   Vhost: /
//
func ParseURI(uri string) (URI, error) {
	me := defaultURI

	u, err := url.Parse(uri)
	if err != nil {
		return me, err
	}

	defaultPort, okScheme := schemePorts[u.Scheme]

	if okScheme {
		me.Scheme = u.Scheme
	} else {
		return me, errURIScheme
	}

	host, port := splitHostPort(u.Host)

	if host != "" {
		me.Host = host
	}

	if port != "" {
		port32, err := strconv.ParseInt(port, 10, 32)
		if err != nil {
			return me, err
		}
		me.Port = int(port32)
	} else {
		me.Port = defaultPort
	}

	if u.User != nil {
		me.Username = u.User.Username()
		if password, ok := u.User.Password(); ok {
			me.Password = password
		}
	}

	if u.Path != "" {
		if strings.HasPrefix(u.Path, "/") {
			if u.Host == "" && strings.HasPrefix(u.Path, "///") {
				// net/url doesn't handle local context authorities and leaves that up
				// to the scheme handler.  In our case, we translate amqp:/// into the
				// default host and whatever the vhost should be
				if len(u.Path) > 3 {
					me.Vhost = u.Path[3:]
				}
			} else if len(u.Path) > 1 {
				me.Vhost = u.Path[1:]
			}
		} else {
			me.Vhost = u.Path
		}
	}

	return me, nil
}

// Splits host:port, host, [ho:st]:port, or [ho:st].  Unlike net.SplitHostPort
// which splits :port, host:port or [host]:port
//
// Handles hosts that have colons that are in brackets like [::1]:http
func splitHostPort(addr string) (host, port string) {
	i := strings.LastIndex(addr, ":")

	if i >= 0 {
		host, port = addr[:i], addr[i+1:]

		if len(port) > 0 && port[len(port)-1] == ']' && addr[0] == '[' {
			// we've split on an inner colon, the port was missing outside of the
			// brackets so use the full addr.  We could assert that host should not
			// contain any colons here
			host, port = addr, ""
		}
	} else {
		host = addr
	}

	return
}

// PlainAuth returns a PlainAuth structure based on the parsed URI's
// Username and Password fields.
func (me URI) PlainAuth() *PlainAuth {
	return &PlainAuth{
		Username: me.Username,
		Password: me.Password,
	}
}

func (me URI) String() string {
	var authority string

	if me.Username != defaultURI.Username || me.Password != defaultURI.Password {
		authority += me.Username

		if me.Password != defaultURI.Password {
			authority += ":" + me.Password
		}

		authority += "@"
	}

	authority += me.Host

	if defaultPort, found := schemePorts[me.Scheme]; !found || defaultPort != me.Port {
		authority += ":" + strconv.FormatInt(int64(me.Port), 10)
	}

	var vhost string
	if me.Vhost != defaultURI.Vhost {
		vhost = me.Vhost
	}

	return fmt.Sprintf("%s://%s/%s", me.Scheme, authority, url.QueryEscape(vhost))
}
