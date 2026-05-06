// Provenance-includes-location: https://github.com/prometheus/prometheus/blob/be3c082539d8/discovery/dns/dns.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-location: https://github.com/thanos-io/thanos/blob/main/pkg/discovery/dns/miekgdns/provider.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Thanos Authors.

package miekgdns

import (
	"bytes"
	"net"

	"github.com/miekg/dns"
	"github.com/pkg/errors"
)

var ErrNoSuchHost = errors.New("no such host")

// Copied and slightly adjusted from Prometheus DNS SD:
// https://github.com/prometheus/prometheus/blob/be3c082539d85908ce03b6d280f83343e7c930eb/discovery/dns/dns.go#L212

// lookupWithSearchPath tries to get an answer for various permutations of
// the given name, appending the system-configured search path as necessary.
//
// There are three possible outcomes:
//
//  1. One of the permutations of the given name is recognized as
//     "valid" by the DNS, in which case we consider ourselves "done"
//     and that answer is returned.  Note that, due to the way the DNS
//     handles "name has resource records, but none of the specified type",
//     the answer received may have an empty set of results.
//
//  2. All of the permutations of the given name are responded to by one of
//     the servers in the "nameservers" list with the answer "that name does
//     not exist" (NXDOMAIN).  In that case, it can be considered
//     pseudo-authoritative that there are no records for that name.
//
//  3. One or more of the names was responded to by all servers with some
//     sort of error indication.  In that case, we can't know if, in fact,
//     there are records for the name or not, so whatever state the
//     configuration is in, we should keep it that way until we know for
//     sure (by, presumably, all the names getting answers in the future).
//
// Outcomes 1 and 2 are indicated by a valid response message (possibly an
// empty one) and no error.  Outcome 3 is indicated by an error return.  The
// error will be generic-looking, because trying to return all the errors
// returned by the combination of all name permutations and servers is a
// nightmare.
func (r *Resolver) lookupWithSearchPath(name string, qtype dns.Type) (*dns.Msg, error) {
	conf, err := dns.ClientConfigFromFile(r.ResolvConf)
	if err != nil {
		return nil, errors.Wrapf(err, "could not load resolv.conf: %s", err)
	}

	var errs []error
	for _, lname := range conf.NameList(name) {
		response, err := lookupFromAnyServer(lname, qtype, conf)
		if err != nil {
			// We can't go home yet, because a later name
			// may give us a valid, successful answer.  However
			// we can no longer say "this name definitely doesn't
			// exist", because we did not get that answer for
			// at least one name.
			errs = append(errs, err)
			continue
		}

		if response.Rcode == dns.RcodeSuccess {
			// Outcome 1: GOLD!
			return response, nil
		}
	}

	if len(errs) == 0 {
		// Outcome 2: everyone says NXDOMAIN.
		return &dns.Msg{}, ErrNoSuchHost
	}
	// Outcome 3: boned.
	return nil, errors.Errorf("could not resolve %q: all servers responded with errors to at least one search domain. Errs %s", name, fmtErrs(errs))
}

// lookupFromAnyServer uses all configured servers to try and resolve a specific
// name.  If a viable answer is received from a server, then it is
// immediately returned, otherwise the other servers in the config are
// tried, and if none of them return a viable answer, an error is returned.
//
// A "viable answer" is one which indicates either:
//
//  1. "yes, I know that name, and here are its records of the requested type"
//     (RCODE==SUCCESS, ANCOUNT > 0);
//  2. "yes, I know that name, but it has no records of the requested type"
//     (RCODE==SUCCESS, ANCOUNT==0); or
//  3. "I know that name doesn't exist" (RCODE==NXDOMAIN).
//
// A non-viable answer is "anything else", which encompasses both various
// system-level problems (like network timeouts) and also
// valid-but-unexpected DNS responses (SERVFAIL, REFUSED, etc).
func lookupFromAnyServer(name string, qtype dns.Type, conf *dns.ClientConfig) (*dns.Msg, error) {
	client := &dns.Client{}

	var errs []error

	// TODO(bwplotka): Worth to do fanout and grab fastest as golang native lib?
	for _, server := range conf.Servers {
		servAddr := net.JoinHostPort(server, conf.Port)
		msg, err := askServerForName(name, qtype, client, servAddr, true)
		if err != nil {
			errs = append(errs, errors.Wrapf(err, "resolution against server %s for %s", server, name))
			continue
		}

		if msg.Rcode == dns.RcodeSuccess || msg.Rcode == dns.RcodeNameError {
			return msg, nil
		}
	}

	return nil, errors.Errorf("could not resolve %s: no servers returned a viable answer. Errs %v", name, fmtErrs(errs))
}

func fmtErrs(errs []error) string {
	b := bytes.Buffer{}
	for _, err := range errs {
		b.WriteString(";")
		b.WriteString(err.Error())
	}
	return b.String()
}

// askServerForName makes a request to a specific DNS server for a specific
// name (and qtype). Retries with TCP in the event of response truncation,
// but otherwise just sends back whatever the server gave, whether that be a
// valid-looking response, or an error.
func askServerForName(name string, qType dns.Type, client *dns.Client, servAddr string, edns bool) (*dns.Msg, error) {
	msg := &dns.Msg{}

	msg.SetQuestion(dns.Fqdn(name), uint16(qType))
	if edns {
		msg.SetEdns0(dns.DefaultMsgSize, false)
	}

	response, _, err := client.Exchange(msg, servAddr)
	if err != nil {
		return nil, errors.Wrapf(err, "exchange")
	}

	if response.Truncated {
		if client.Net == "tcp" {
			return nil, errors.New("got truncated message on TCP (64kiB limit exceeded?)")
		}

		// TCP fallback.
		client.Net = "tcp"
		return askServerForName(name, qType, client, servAddr, false)
	}

	return response, nil
}
