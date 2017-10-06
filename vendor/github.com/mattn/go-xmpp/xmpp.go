// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// TODO(rsc):
//	More precise error handling.
//	Presence functionality.
// TODO(mattn):
//  Add proxy authentication.

// Package xmpp implements a simple Google Talk client
// using the XMPP protocol described in RFC 3920 and RFC 3921.
package xmpp

import (
	"bufio"
	"bytes"
	"crypto/md5"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/binary"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	nsStream  = "http://etherx.jabber.org/streams"
	nsTLS     = "urn:ietf:params:xml:ns:xmpp-tls"
	nsSASL    = "urn:ietf:params:xml:ns:xmpp-sasl"
	nsBind    = "urn:ietf:params:xml:ns:xmpp-bind"
	nsClient  = "jabber:client"
	nsSession = "urn:ietf:params:xml:ns:xmpp-session"
)

// Default TLS configuration options
var DefaultConfig tls.Config

// DebugWriter is the writer used to write debugging output to.
var DebugWriter io.Writer = os.Stderr

// Cookie is a unique XMPP session identifier
type Cookie uint64

func getCookie() Cookie {
	var buf [8]byte
	if _, err := rand.Reader.Read(buf[:]); err != nil {
		panic("Failed to read random bytes: " + err.Error())
	}
	return Cookie(binary.LittleEndian.Uint64(buf[:]))
}

// Client holds XMPP connection opitons
type Client struct {
	conn   net.Conn // connection to server
	jid    string   // Jabber ID for our connection
	domain string
	p      *xml.Decoder
}

func (c *Client) JID() string {
	return c.jid
}

func containsIgnoreCase(s, substr string) bool {
	s, substr = strings.ToUpper(s), strings.ToUpper(substr)
	return strings.Contains(s, substr)
}

func connect(host, user, passwd string) (net.Conn, error) {
	addr := host

	if strings.TrimSpace(host) == "" {
		a := strings.SplitN(user, "@", 2)
		if len(a) == 2 {
			addr = a[1]
		}
	}
	a := strings.SplitN(host, ":", 2)
	if len(a) == 1 {
		addr += ":5222"
	}

	proxy := os.Getenv("HTTP_PROXY")
	if proxy == "" {
		proxy = os.Getenv("http_proxy")
	}
	// test for no proxy, takes a comma separated list with substrings to match
	if proxy != "" {
		noproxy := os.Getenv("NO_PROXY")
		if noproxy == "" {
			noproxy = os.Getenv("no_proxy")
		}
		if noproxy != "" {
			nplist := strings.Split(noproxy, ",")
			for _, s := range nplist {
				if containsIgnoreCase(addr, s) {
					proxy = ""
					break
				}
			}
		}
	}
	if proxy != "" {
		url, err := url.Parse(proxy)
		if err == nil {
			addr = url.Host
		}
	}

	c, err := net.Dial("tcp", addr)
	if err != nil {
		return nil, err
	}

	if proxy != "" {
		fmt.Fprintf(c, "CONNECT %s HTTP/1.1\r\n", host)
		fmt.Fprintf(c, "Host: %s\r\n", host)
		fmt.Fprintf(c, "\r\n")
		br := bufio.NewReader(c)
		req, _ := http.NewRequest("CONNECT", host, nil)
		resp, err := http.ReadResponse(br, req)
		if err != nil {
			return nil, err
		}
		if resp.StatusCode != 200 {
			f := strings.SplitN(resp.Status, " ", 2)
			return nil, errors.New(f[1])
		}
	}
	return c, nil
}

// Options are used to specify additional options for new clients, such as a Resource.
type Options struct {
	// Host specifies what host to connect to, as either "hostname" or "hostname:port"
	// If host is not specified, the  DNS SRV should be used to find the host from the domainpart of the JID.
	// Default the port to 5222.
	Host string

	// User specifies what user to authenticate to the remote server.
	User string

	// Password supplies the password to use for authentication with the remote server.
	Password string

	// Resource specifies an XMPP client resource, like "bot", instead of accepting one
	// from the server.  Use "" to let the server generate one for your client.
	Resource string

	// OAuthScope provides go-xmpp the required scope for OAuth2 authentication.
	OAuthScope string

	// OAuthToken provides go-xmpp with the required OAuth2 token used to authenticate
	OAuthToken string

	// OAuthXmlNs provides go-xmpp with the required namespaced used for OAuth2 authentication.  This is
	// provided to the server as the xmlns:auth attribute of the OAuth2 authentication request.
	OAuthXmlNs string

	// TLS Config
	TLSConfig *tls.Config

	// InsecureAllowUnencryptedAuth permits authentication over a TCP connection that has not been promoted to
	// TLS by STARTTLS; this could leak authentication information over the network, or permit man in the middle
	// attacks.
	InsecureAllowUnencryptedAuth bool

	// NoTLS directs go-xmpp to not use TLS initially to contact the server; instead, a plain old unencrypted
	// TCP connection should be used. (Can be combined with StartTLS to support STARTTLS-based servers.)
	NoTLS bool

	// StartTLS directs go-xmpp to STARTTLS if the server supports it; go-xmpp will automatically STARTTLS
	// if the server requires it regardless of this option.
	StartTLS bool

	// Debug output
	Debug bool

	// Use server sessions
	Session bool

	// Presence Status
	Status string

	// Status message
	StatusMessage string
}

// NewClient establishes a new Client connection based on a set of Options.
func (o Options) NewClient() (*Client, error) {
	host := o.Host
	c, err := connect(host, o.User, o.Password)
	if err != nil {
		return nil, err
	}

	if strings.LastIndex(o.Host, ":") > 0 {
		host = host[:strings.LastIndex(o.Host, ":")]
	}

	client := new(Client)
	if o.NoTLS {
		client.conn = c
	} else {
		var tlsconn *tls.Conn
		if o.TLSConfig != nil {
			tlsconn = tls.Client(c, o.TLSConfig)
		} else {
			DefaultConfig.ServerName = host
			newconfig := DefaultConfig
			newconfig.ServerName = host
			tlsconn = tls.Client(c, &newconfig)
		}
		if err = tlsconn.Handshake(); err != nil {
			return nil, err
		}
		insecureSkipVerify := DefaultConfig.InsecureSkipVerify
		if o.TLSConfig != nil {
			insecureSkipVerify = o.TLSConfig.InsecureSkipVerify
		}
		if !insecureSkipVerify {
			if err = tlsconn.VerifyHostname(host); err != nil {
				return nil, err
			}
		}
		client.conn = tlsconn
	}

	if err := client.init(&o); err != nil {
		client.Close()
		return nil, err
	}

	return client, nil
}

// NewClient creates a new connection to a host given as "hostname" or "hostname:port".
// If host is not specified, the  DNS SRV should be used to find the host from the domainpart of the JID.
// Default the port to 5222.
func NewClient(host, user, passwd string, debug bool) (*Client, error) {
	opts := Options{
		Host:     host,
		User:     user,
		Password: passwd,
		Debug:    debug,
		Session:  false,
	}
	return opts.NewClient()
}

// NewClientNoTLS creates a new client without TLS
func NewClientNoTLS(host, user, passwd string, debug bool) (*Client, error) {
	opts := Options{
		Host:     host,
		User:     user,
		Password: passwd,
		NoTLS:    true,
		Debug:    debug,
		Session:  false,
	}
	return opts.NewClient()
}

// Close closes the XMPP connection
func (c *Client) Close() error {
	if c.conn != (*tls.Conn)(nil) {
		return c.conn.Close()
	}
	return nil
}

func saslDigestResponse(username, realm, passwd, nonce, cnonceStr, authenticate, digestURI, nonceCountStr string) string {
	h := func(text string) []byte {
		h := md5.New()
		h.Write([]byte(text))
		return h.Sum(nil)
	}
	hex := func(bytes []byte) string {
		return fmt.Sprintf("%x", bytes)
	}
	kd := func(secret, data string) []byte {
		return h(secret + ":" + data)
	}

	a1 := string(h(username+":"+realm+":"+passwd)) + ":" + nonce + ":" + cnonceStr
	a2 := authenticate + ":" + digestURI
	response := hex(kd(hex(h(a1)), nonce+":"+nonceCountStr+":"+cnonceStr+":auth:"+hex(h(a2))))
	return response
}

func cnonce() string {
	randSize := big.NewInt(0)
	randSize.Lsh(big.NewInt(1), 64)
	cn, err := rand.Int(rand.Reader, randSize)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%016x", cn)
}

func (c *Client) init(o *Options) error {

	var domain string
	var user string
	a := strings.SplitN(o.User, "@", 2)
	if len(o.User) > 0 {
		if len(a) != 2 {
			return errors.New("xmpp: invalid username (want user@domain): " + o.User)
		}
		user = a[0]
		domain = a[1]
	} // Otherwise, we'll be attempting ANONYMOUS

	// Declare intent to be a jabber client and gather stream features.
	f, err := c.startStream(o, domain)
	if err != nil {
		return err
	}

	// If the server requires we STARTTLS, attempt to do so.
	if f, err = c.startTLSIfRequired(f, o, domain); err != nil {
		return err
	}

	if o.User == "" && o.Password == "" {
		foundAnonymous := false
		for _, m := range f.Mechanisms.Mechanism {
			if m == "ANONYMOUS" {
				fmt.Fprintf(c.conn, "<auth xmlns='%s' mechanism='ANONYMOUS' />\n", nsSASL)
				foundAnonymous = true
				break
			}
		}
		if !foundAnonymous {
			return fmt.Errorf("ANONYMOUS authentication is not an option and username and password were not specified")
		}
	} else {
		// Even digest forms of authentication are unsafe if we do not know that the host
		// we are talking to is the actual server, and not a man in the middle playing
		// proxy.
		if !c.IsEncrypted() && !o.InsecureAllowUnencryptedAuth {
			return errors.New("refusing to authenticate over unencrypted TCP connection")
		}

		mechanism := ""
		for _, m := range f.Mechanisms.Mechanism {
			if m == "X-OAUTH2" && o.OAuthToken != "" && o.OAuthScope != "" {
				mechanism = m
				// Oauth authentication: send base64-encoded \x00 user \x00 token.
				raw := "\x00" + user + "\x00" + o.OAuthToken
				enc := make([]byte, base64.StdEncoding.EncodedLen(len(raw)))
				base64.StdEncoding.Encode(enc, []byte(raw))
				fmt.Fprintf(c.conn, "<auth xmlns='%s' mechanism='X-OAUTH2' auth:service='oauth2' "+
					"xmlns:auth='%s'>%s</auth>\n", nsSASL, o.OAuthXmlNs, enc)
				break
			}
			if m == "PLAIN" {
				mechanism = m
				// Plain authentication: send base64-encoded \x00 user \x00 password.
				raw := "\x00" + user + "\x00" + o.Password
				enc := make([]byte, base64.StdEncoding.EncodedLen(len(raw)))
				base64.StdEncoding.Encode(enc, []byte(raw))
				fmt.Fprintf(c.conn, "<auth xmlns='%s' mechanism='PLAIN'>%s</auth>\n", nsSASL, enc)
				break
			}
			if m == "DIGEST-MD5" {
				mechanism = m
				// Digest-MD5 authentication
				fmt.Fprintf(c.conn, "<auth xmlns='%s' mechanism='DIGEST-MD5'/>\n", nsSASL)
				var ch saslChallenge
				if err = c.p.DecodeElement(&ch, nil); err != nil {
					return errors.New("unmarshal <challenge>: " + err.Error())
				}
				b, err := base64.StdEncoding.DecodeString(string(ch))
				if err != nil {
					return err
				}
				tokens := map[string]string{}
				for _, token := range strings.Split(string(b), ",") {
					kv := strings.SplitN(strings.TrimSpace(token), "=", 2)
					if len(kv) == 2 {
						if kv[1][0] == '"' && kv[1][len(kv[1])-1] == '"' {
							kv[1] = kv[1][1 : len(kv[1])-1]
						}
						tokens[kv[0]] = kv[1]
					}
				}
				realm, _ := tokens["realm"]
				nonce, _ := tokens["nonce"]
				qop, _ := tokens["qop"]
				charset, _ := tokens["charset"]
				cnonceStr := cnonce()
				digestURI := "xmpp/" + domain
				nonceCount := fmt.Sprintf("%08x", 1)
				digest := saslDigestResponse(user, realm, o.Password, nonce, cnonceStr, "AUTHENTICATE", digestURI, nonceCount)
				message := "username=\"" + user + "\", realm=\"" + realm + "\", nonce=\"" + nonce + "\", cnonce=\"" + cnonceStr +
					"\", nc=" + nonceCount + ", qop=" + qop + ", digest-uri=\"" + digestURI + "\", response=" + digest + ", charset=" + charset

				fmt.Fprintf(c.conn, "<response xmlns='%s'>%s</response>\n", nsSASL, base64.StdEncoding.EncodeToString([]byte(message)))

				var rspauth saslRspAuth
				if err = c.p.DecodeElement(&rspauth, nil); err != nil {
					return errors.New("unmarshal <challenge>: " + err.Error())
				}
				b, err = base64.StdEncoding.DecodeString(string(rspauth))
				if err != nil {
					return err
				}
				fmt.Fprintf(c.conn, "<response xmlns='%s'/>\n", nsSASL)
				break
			}
		}
		if mechanism == "" {
			return fmt.Errorf("PLAIN authentication is not an option: %v", f.Mechanisms.Mechanism)
		}
	}
	// Next message should be either success or failure.
	name, val, err := next(c.p)
	if err != nil {
		return err
	}
	switch v := val.(type) {
	case *saslSuccess:
	case *saslFailure:
		errorMessage := v.Text
		if errorMessage == "" {
			// v.Any is type of sub-element in failure,
			// which gives a description of what failed if there was no text element
			errorMessage = v.Any.Local
		}
		return errors.New("auth failure: " + errorMessage)
	default:
		return errors.New("expected <success> or <failure>, got <" + name.Local + "> in " + name.Space)
	}

	// Now that we're authenticated, we're supposed to start the stream over again.
	// Declare intent to be a jabber client.
	if f, err = c.startStream(o, domain); err != nil {
		return err
	}

	// Generate a unique cookie
	cookie := getCookie()

	// Send IQ message asking to bind to the local user name.
	if o.Resource == "" {
		fmt.Fprintf(c.conn, "<iq type='set' id='%x'><bind xmlns='%s'></bind></iq>\n", cookie, nsBind)
	} else {
		fmt.Fprintf(c.conn, "<iq type='set' id='%x'><bind xmlns='%s'><resource>%s</resource></bind></iq>\n", cookie, nsBind, o.Resource)
	}
	var iq clientIQ
	if err = c.p.DecodeElement(&iq, nil); err != nil {
		return errors.New("unmarshal <iq>: " + err.Error())
	}
	if &iq.Bind == nil {
		return errors.New("<iq> result missing <bind>")
	}
	c.jid = iq.Bind.Jid // our local id
	c.domain = domain

	if o.Session {
		//if server support session, open it
		fmt.Fprintf(c.conn, "<iq to='%s' type='set' id='%x'><session xmlns='%s'/></iq>", xmlEscape(domain), cookie, nsSession)
	}

	// We're connected and can now receive and send messages.
	fmt.Fprintf(c.conn, "<presence xml:lang='en'><show>%s</show><status>%s</status></presence>", o.Status, o.StatusMessage)

	return nil
}

// startTlsIfRequired examines the server's stream features and, if STARTTLS is required or supported, performs the TLS handshake.
// f will be updated if the handshake completes, as the new stream's features are typically different from the original.
func (c *Client) startTLSIfRequired(f *streamFeatures, o *Options, domain string) (*streamFeatures, error) {
	// whether we start tls is a matter of opinion: the server's and the user's.
	switch {
	case f.StartTLS == nil:
		// the server does not support STARTTLS
		return f, nil
	case !o.StartTLS && f.StartTLS.Required == nil:
		return f, nil
	case f.StartTLS.Required != nil:
		// the server requires STARTTLS.
	case !o.StartTLS:
		// the user wants STARTTLS and the server supports it.
	}
	var err error

	fmt.Fprintf(c.conn, "<starttls xmlns='urn:ietf:params:xml:ns:xmpp-tls'/>\n")
	var k tlsProceed
	if err = c.p.DecodeElement(&k, nil); err != nil {
		return f, errors.New("unmarshal <proceed>: " + err.Error())
	}

	tc := o.TLSConfig
	if tc == nil {
		tc = new(tls.Config)
		*tc = DefaultConfig
		//TODO(scott): we should consider using the server's address or reverse lookup
		tc.ServerName = domain
	}
	t := tls.Client(c.conn, tc)

	if err = t.Handshake(); err != nil {
		return f, errors.New("starttls handshake: " + err.Error())
	}
	c.conn = t

	// restart our declaration of XMPP stream intentions.
	tf, err := c.startStream(o, domain)
	if err != nil {
		return f, err
	}
	return tf, nil
}

// startStream will start a new XML decoder for the connection, signal the start of a stream to the server and verify that the server has
// also started the stream; if o.Debug is true, startStream will tee decoded XML data to stderr.  The features advertised by the server
// will be returned.
func (c *Client) startStream(o *Options, domain string) (*streamFeatures, error) {
	if o.Debug {
		c.p = xml.NewDecoder(tee{c.conn, DebugWriter})
	} else {
		c.p = xml.NewDecoder(c.conn)
	}

	_, err := fmt.Fprintf(c.conn, "<?xml version='1.0'?>\n"+
		"<stream:stream to='%s' xmlns='%s'\n"+
		" xmlns:stream='%s' version='1.0'>\n",
		xmlEscape(domain), nsClient, nsStream)
	if err != nil {
		return nil, err
	}

	// We expect the server to start a <stream>.
	se, err := nextStart(c.p)
	if err != nil {
		return nil, err
	}
	if se.Name.Space != nsStream || se.Name.Local != "stream" {
		return nil, fmt.Errorf("expected <stream> but got <%v> in %v", se.Name.Local, se.Name.Space)
	}

	// Now we're in the stream and can use Unmarshal.
	// Next message should be <features> to tell us authentication options.
	// See section 4.6 in RFC 3920.
	f := new(streamFeatures)
	if err = c.p.DecodeElement(f, nil); err != nil {
		return f, errors.New("unmarshal <features>: " + err.Error())
	}
	return f, nil
}

// IsEncrypted will return true if the client is connected using a TLS transport, either because it used.
// TLS to connect from the outset, or because it successfully used STARTTLS to promote a TCP connection to TLS.
func (c *Client) IsEncrypted() bool {
	_, ok := c.conn.(*tls.Conn)
	return ok
}

// Chat is an incoming or outgoing XMPP chat message.
type Chat struct {
	Remote    string
	Type      string
	Text      string
	Subject   string
	Thread    string
	Roster    Roster
	Other     []string
	OtherElem []XMLElement
	Stamp     time.Time
}

type Roster []Contact

type Contact struct {
	Remote string
	Name   string
	Group  []string
}

// Presence is an XMPP presence notification.
type Presence struct {
	From   string
	To     string
	Type   string
	Show   string
	Status string
}

type IQ struct {
	ID    string
	From  string
	To    string
	Type  string
	Query []byte
}

// Recv waits to receive the next XMPP stanza.
// Return type is either a presence notification or a chat message.
func (c *Client) Recv() (stanza interface{}, err error) {
	for {
		_, val, err := next(c.p)
		if err != nil {
			return Chat{}, err
		}
		switch v := val.(type) {
		case *clientMessage:
			stamp, _ := time.Parse(
				"2006-01-02T15:04:05Z",
				v.Delay.Stamp,
			)
			chat := Chat{
				Remote:    v.From,
				Type:      v.Type,
				Text:      v.Body,
				Subject:   v.Subject,
				Thread:    v.Thread,
				Other:     v.OtherStrings(),
				OtherElem: v.Other,
				Stamp:     stamp,
			}
			return chat, nil
		case *clientQuery:
			var r Roster
			for _, item := range v.Item {
				r = append(r, Contact{item.Jid, item.Name, item.Group})
			}
			return Chat{Type: "roster", Roster: r}, nil
		case *clientPresence:
			return Presence{v.From, v.To, v.Type, v.Show, v.Status}, nil
		case *clientIQ:
			// TODO check more strictly
			if bytes.Equal(bytes.TrimSpace(v.Query), []byte(`<ping xmlns='urn:xmpp:ping'/>`)) || bytes.Equal(bytes.TrimSpace(v.Query), []byte(`<ping xmlns="urn:xmpp:ping"/>`)) {
				err := c.SendResultPing(v.ID, v.From)
				if err != nil {
					return Chat{}, err
				}
			}
			return IQ{ID: v.ID, From: v.From, To: v.To, Type: v.Type, Query: v.Query}, nil
		}
	}
}

// Send sends the message wrapped inside an XMPP message stanza body.
func (c *Client) Send(chat Chat) (n int, err error) {
	var subtext = ``
	var thdtext = ``
	if chat.Subject != `` {
		subtext = `<subject>` + xmlEscape(chat.Subject) + `</subject>`
	}
	if chat.Thread != `` {
		thdtext = `<thread>` + xmlEscape(chat.Thread) + `</thread>`
	}

	stanza := "<message to='%s' type='%s' id='%s' xml:lang='en'>" + subtext + "<body>%s</body>" + thdtext + "</message>"

	return fmt.Fprintf(c.conn, stanza,
		xmlEscape(chat.Remote), xmlEscape(chat.Type), cnonce(), xmlEscape(chat.Text))
}

// SendOrg sends the original text without being wrapped in an XMPP message stanza.
func (c *Client) SendOrg(org string) (n int, err error) {
	return fmt.Fprint(c.conn, org)
}

func (c *Client) SendPresence(presence Presence) (n int, err error) {
	return fmt.Fprintf(c.conn, "<presence from='%s' to='%s'/>", xmlEscape(presence.From), xmlEscape(presence.To))
}

// SendKeepAlive sends a "whitespace keepalive" as described in chapter 4.6.1 of RFC6120.
func (c *Client) SendKeepAlive() (n int, err error) {
	return fmt.Fprintf(c.conn, " ")
}

// SendHtml sends the message as HTML as defined by XEP-0071
func (c *Client) SendHtml(chat Chat) (n int, err error) {
	return fmt.Fprintf(c.conn, "<message to='%s' type='%s' xml:lang='en'>"+
		"<body>%s</body>"+
		"<html xmlns='http://jabber.org/protocol/xhtml-im'><body xmlns='http://www.w3.org/1999/xhtml'>%s</body></html></message>",
		xmlEscape(chat.Remote), xmlEscape(chat.Type), xmlEscape(chat.Text), chat.Text)
}

// Roster asks for the chat roster.
func (c *Client) Roster() error {
	fmt.Fprintf(c.conn, "<iq from='%s' type='get' id='roster1'><query xmlns='jabber:iq:roster'/></iq>\n", xmlEscape(c.jid))
	return nil
}

// RFC 3920  C.1  Streams name space
type streamFeatures struct {
	XMLName    xml.Name `xml:"http://etherx.jabber.org/streams features"`
	StartTLS   *tlsStartTLS
	Mechanisms saslMechanisms
	Bind       bindBind
	Session    bool
}

type streamError struct {
	XMLName xml.Name `xml:"http://etherx.jabber.org/streams error"`
	Any     xml.Name
	Text    string
}

// RFC 3920  C.3  TLS name space
type tlsStartTLS struct {
	XMLName  xml.Name `xml:"urn:ietf:params:xml:ns:xmpp-tls starttls"`
	Required *string  `xml:"required"`
}

type tlsProceed struct {
	XMLName xml.Name `xml:"urn:ietf:params:xml:ns:xmpp-tls proceed"`
}

type tlsFailure struct {
	XMLName xml.Name `xml:"urn:ietf:params:xml:ns:xmpp-tls failure"`
}

// RFC 3920  C.4  SASL name space
type saslMechanisms struct {
	XMLName   xml.Name `xml:"urn:ietf:params:xml:ns:xmpp-sasl mechanisms"`
	Mechanism []string `xml:"mechanism"`
}

type saslAuth struct {
	XMLName   xml.Name `xml:"urn:ietf:params:xml:ns:xmpp-sasl auth"`
	Mechanism string   `xml:",attr"`
}

type saslChallenge string

type saslRspAuth string

type saslResponse string

type saslAbort struct {
	XMLName xml.Name `xml:"urn:ietf:params:xml:ns:xmpp-sasl abort"`
}

type saslSuccess struct {
	XMLName xml.Name `xml:"urn:ietf:params:xml:ns:xmpp-sasl success"`
}

type saslFailure struct {
	XMLName xml.Name `xml:"urn:ietf:params:xml:ns:xmpp-sasl failure"`
	Any     xml.Name `xml:",any"`
	Text    string   `xml:"text"`
}

// RFC 3920  C.5  Resource binding name space
type bindBind struct {
	XMLName  xml.Name `xml:"urn:ietf:params:xml:ns:xmpp-bind bind"`
	Resource string
	Jid      string `xml:"jid"`
}

// RFC 3921  B.1  jabber:client
type clientMessage struct {
	XMLName xml.Name `xml:"jabber:client message"`
	From    string   `xml:"from,attr"`
	ID      string   `xml:"id,attr"`
	To      string   `xml:"to,attr"`
	Type    string   `xml:"type,attr"` // chat, error, groupchat, headline, or normal

	// These should technically be []clientText, but string is much more convenient.
	Subject string `xml:"subject"`
	Body    string `xml:"body"`
	Thread  string `xml:"thread"`

	// Any hasn't matched element
	Other []XMLElement `xml:",any"`

	Delay Delay `xml:"delay"`
}

func (m *clientMessage) OtherStrings() []string {
	a := make([]string, len(m.Other))
	for i, e := range m.Other {
		a[i] = e.String()
	}
	return a
}

type XMLElement struct {
	XMLName  xml.Name
	InnerXML string `xml:",innerxml"`
}

func (e *XMLElement) String() string {
	r := bytes.NewReader([]byte(e.InnerXML))
	d := xml.NewDecoder(r)
	var buf bytes.Buffer
	for {
		tok, err := d.Token()
		if err != nil {
			break
		}
		switch v := tok.(type) {
		case xml.StartElement:
			err = d.Skip()
		case xml.CharData:
			_, err = buf.Write(v)
		}
		if err != nil {
			break
		}
	}
	return buf.String()
}

type Delay struct {
	Stamp string `xml:"stamp,attr"`
}

type clientText struct {
	Lang string `xml:",attr"`
	Body string `xml:"chardata"`
}

type clientPresence struct {
	XMLName xml.Name `xml:"jabber:client presence"`
	From    string   `xml:"from,attr"`
	ID      string   `xml:"id,attr"`
	To      string   `xml:"to,attr"`
	Type    string   `xml:"type,attr"` // error, probe, subscribe, subscribed, unavailable, unsubscribe, unsubscribed
	Lang    string   `xml:"lang,attr"`

	Show     string `xml:"show"`   // away, chat, dnd, xa
	Status   string `xml:"status"` // sb []clientText
	Priority string `xml:"priority,attr"`
	Error    *clientError
}

type clientIQ struct {
	// info/query
	XMLName xml.Name `xml:"jabber:client iq"`
	From    string   `xml:"from,attr"`
	ID      string   `xml:"id,attr"`
	To      string   `xml:"to,attr"`
	Type    string   `xml:"type,attr"` // error, get, result, set
	Query   []byte   `xml:",innerxml"`
	Error   clientError
	Bind    bindBind
}

type clientError struct {
	XMLName xml.Name `xml:"jabber:client error"`
	Code    string   `xml:",attr"`
	Type    string   `xml:",attr"`
	Any     xml.Name
	Text    string
}

type clientQuery struct {
	Item []rosterItem
}

type rosterItem struct {
	XMLName      xml.Name `xml:"jabber:iq:roster item"`
	Jid          string   `xml:",attr"`
	Name         string   `xml:",attr"`
	Subscription string   `xml:",attr"`
	Group        []string
}

// Scan XML token stream to find next StartElement.
func nextStart(p *xml.Decoder) (xml.StartElement, error) {
	for {
		t, err := p.Token()
		if err != nil || t == nil {
			return xml.StartElement{}, err
		}
		switch t := t.(type) {
		case xml.StartElement:
			return t, nil
		}
	}
}

// Scan XML token stream for next element and save into val.
// If val == nil, allocate new element based on proto map.
// Either way, return val.
func next(p *xml.Decoder) (xml.Name, interface{}, error) {
	// Read start element to find out what type we want.
	se, err := nextStart(p)
	if err != nil {
		return xml.Name{}, nil, err
	}

	// Put it in an interface and allocate one.
	var nv interface{}
	switch se.Name.Space + " " + se.Name.Local {
	case nsStream + " features":
		nv = &streamFeatures{}
	case nsStream + " error":
		nv = &streamError{}
	case nsTLS + " starttls":
		nv = &tlsStartTLS{}
	case nsTLS + " proceed":
		nv = &tlsProceed{}
	case nsTLS + " failure":
		nv = &tlsFailure{}
	case nsSASL + " mechanisms":
		nv = &saslMechanisms{}
	case nsSASL + " challenge":
		nv = ""
	case nsSASL + " response":
		nv = ""
	case nsSASL + " abort":
		nv = &saslAbort{}
	case nsSASL + " success":
		nv = &saslSuccess{}
	case nsSASL + " failure":
		nv = &saslFailure{}
	case nsBind + " bind":
		nv = &bindBind{}
	case nsClient + " message":
		nv = &clientMessage{}
	case nsClient + " presence":
		nv = &clientPresence{}
	case nsClient + " iq":
		nv = &clientIQ{}
	case nsClient + " error":
		nv = &clientError{}
	default:
		return xml.Name{}, nil, errors.New("unexpected XMPP message " +
			se.Name.Space + " <" + se.Name.Local + "/>")
	}

	// Unmarshal into that storage.
	if err = p.DecodeElement(nv, &se); err != nil {
		return xml.Name{}, nil, err
	}

	return se.Name, nv, err
}

func xmlEscape(s string) string {
	var b bytes.Buffer
	xml.Escape(&b, []byte(s))

	return b.String()
}

type tee struct {
	r io.Reader
	w io.Writer
}

func (t tee) Read(p []byte) (n int, err error) {
	n, err = t.r.Read(p)
	if n > 0 {
		t.w.Write(p[0:n])
		t.w.Write([]byte("\n"))
	}
	return
}
