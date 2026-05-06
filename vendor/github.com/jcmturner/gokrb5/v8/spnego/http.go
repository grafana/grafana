package spnego

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"

	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/goidentity/v6"
	"github.com/jcmturner/gokrb5/v8/client"
	"github.com/jcmturner/gokrb5/v8/credentials"
	"github.com/jcmturner/gokrb5/v8/gssapi"
	"github.com/jcmturner/gokrb5/v8/iana/nametype"
	"github.com/jcmturner/gokrb5/v8/keytab"
	"github.com/jcmturner/gokrb5/v8/krberror"
	"github.com/jcmturner/gokrb5/v8/service"
	"github.com/jcmturner/gokrb5/v8/types"
)

// Client side functionality //

// Client will negotiate authentication with a server using SPNEGO.
type Client struct {
	*http.Client
	krb5Client *client.Client
	spn        string
	reqs       []*http.Request
}

type redirectErr struct {
	reqTarget *http.Request
}

func (e redirectErr) Error() string {
	return fmt.Sprintf("redirect to %v", e.reqTarget.URL)
}

type teeReadCloser struct {
	io.Reader
	io.Closer
}

// NewClient returns a SPNEGO enabled HTTP client.
// Be careful when passing in the *http.Client if it is beginning reused in multiple calls to this function.
// Ensure reuse of the provided *http.Client is for the same user as a session cookie may have been added to
// http.Client's cookie jar.
// Incorrect reuse of the provided *http.Client could lead to access to the wrong user's session.
func NewClient(krb5Cl *client.Client, httpCl *http.Client, spn string) *Client {
	if httpCl == nil {
		httpCl = &http.Client{}
	}
	// Add a cookie jar if there isn't one
	if httpCl.Jar == nil {
		httpCl.Jar, _ = cookiejar.New(nil)
	}
	// Add a CheckRedirect function that will execute any functional already defined and then error with a redirectErr
	f := httpCl.CheckRedirect
	httpCl.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if f != nil {
			err := f(req, via)
			if err != nil {
				return err
			}
		}
		return redirectErr{reqTarget: req}
	}
	return &Client{
		Client:     httpCl,
		krb5Client: krb5Cl,
		spn:        spn,
	}
}

// Do is the SPNEGO enabled HTTP client's equivalent of the http.Client's Do method.
func (c *Client) Do(req *http.Request) (resp *http.Response, err error) {
	var body bytes.Buffer
	if req.Body != nil {
		// Use a tee reader to capture any body sent in case we have to replay it again
		teeR := io.TeeReader(req.Body, &body)
		teeRC := teeReadCloser{teeR, req.Body}
		req.Body = teeRC
	}
	resp, err = c.Client.Do(req)
	if err != nil {
		if ue, ok := err.(*url.Error); ok {
			if e, ok := ue.Err.(redirectErr); ok {
				// Picked up a redirect
				e.reqTarget.Header.Del(HTTPHeaderAuthRequest)
				c.reqs = append(c.reqs, e.reqTarget)
				if len(c.reqs) >= 10 {
					return resp, errors.New("stopped after 10 redirects")
				}
				if req.Body != nil {
					// Refresh the body reader so the body can be sent again
					e.reqTarget.Body = io.NopCloser(&body)
				}
				return c.Do(e.reqTarget)
			}
		}
		return resp, err
	}
	if respUnauthorizedNegotiate(resp) {
		err := SetSPNEGOHeader(c.krb5Client, req, c.spn)
		if err != nil {
			return resp, err
		}
		if req.Body != nil {
			// Refresh the body reader so the body can be sent again
			req.Body = io.NopCloser(&body)
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		return c.Do(req)
	}
	return resp, err
}

// Get is the SPNEGO enabled HTTP client's equivalent of the http.Client's Get method.
func (c *Client) Get(url string) (resp *http.Response, err error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(req)
}

// Post is the SPNEGO enabled HTTP client's equivalent of the http.Client's Post method.
func (c *Client) Post(url, contentType string, body io.Reader) (resp *http.Response, err error) {
	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", contentType)
	return c.Do(req)
}

// PostForm is the SPNEGO enabled HTTP client's equivalent of the http.Client's PostForm method.
func (c *Client) PostForm(url string, data url.Values) (resp *http.Response, err error) {
	return c.Post(url, "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
}

// Head is the SPNEGO enabled HTTP client's equivalent of the http.Client's Head method.
func (c *Client) Head(url string) (resp *http.Response, err error) {
	req, err := http.NewRequest("HEAD", url, nil)
	if err != nil {
		return nil, err
	}
	return c.Do(req)
}

func respUnauthorizedNegotiate(resp *http.Response) bool {
	if resp.StatusCode == http.StatusUnauthorized {
		if resp.Header.Get(HTTPHeaderAuthResponse) == HTTPHeaderAuthResponseValueKey {
			return true
		}
	}
	return false
}

func setRequestSPN(r *http.Request) (types.PrincipalName, error) {
	h := strings.TrimSuffix(r.URL.Host, ".")
	// This if statement checks if the host includes a port number
	if strings.LastIndex(r.URL.Host, ":") > strings.LastIndex(r.URL.Host, "]") {
		// There is a port number in the URL
		h, p, err := net.SplitHostPort(h)
		if err != nil {
			return types.PrincipalName{}, err
		}
		name, err := net.LookupCNAME(h)
		if name != "" && err == nil {
			// Underlyng canonical name should be used for SPN
			h = strings.ToLower(name)
		}
		h = strings.TrimSuffix(h, ".")
		r.Host = fmt.Sprintf("%s:%s", h, p)
		return types.NewPrincipalName(nametype.KRB_NT_PRINCIPAL, "HTTP/"+h), nil
	}
	name, err := net.LookupCNAME(h)
	if name != "" && err == nil {
		// Underlyng canonical name should be used for SPN
		h = strings.ToLower(name)
	}
	h = strings.TrimSuffix(h, ".")
	r.Host = h
	return types.NewPrincipalName(nametype.KRB_NT_PRINCIPAL, "HTTP/"+h), nil
}

// SetSPNEGOHeader gets the service ticket and sets it as the SPNEGO authorization header on HTTP request object.
// To auto generate the SPN from the request object pass a null string "".
func SetSPNEGOHeader(cl *client.Client, r *http.Request, spn string) error {
	if spn == "" {
		pn, err := setRequestSPN(r)
		if err != nil {
			return err
		}
		spn = pn.PrincipalNameString()
	}
	cl.Log("using SPN %s", spn)
	s := SPNEGOClient(cl, spn)
	err := s.AcquireCred()
	if err != nil {
		return fmt.Errorf("could not acquire client credential: %v", err)
	}
	st, err := s.InitSecContext()
	if err != nil {
		return fmt.Errorf("could not initialize context: %v", err)
	}
	nb, err := st.Marshal()
	if err != nil {
		return krberror.Errorf(err, krberror.EncodingError, "could not marshal SPNEGO")
	}
	hs := "Negotiate " + base64.StdEncoding.EncodeToString(nb)
	r.Header.Set(HTTPHeaderAuthRequest, hs)
	return nil
}

// Service side functionality //

const (
	// spnegoNegTokenRespKRBAcceptCompleted - The response on successful authentication always has this header. Capturing as const so we don't have marshaling and encoding overhead.
	spnegoNegTokenRespKRBAcceptCompleted = "Negotiate oRQwEqADCgEAoQsGCSqGSIb3EgECAg=="
	// spnegoNegTokenRespReject - The response on a failed authentication always has this rejection header. Capturing as const so we don't have marshaling and encoding overhead.
	spnegoNegTokenRespReject = "Negotiate oQcwBaADCgEC"
	// spnegoNegTokenRespIncompleteKRB5 - Response token specifying incomplete context and KRB5 as the supported mechtype.
	spnegoNegTokenRespIncompleteKRB5 = "Negotiate oRQwEqADCgEBoQsGCSqGSIb3EgECAg=="
	// sessionCredentials is the session value key holding the credentials jcmturner/goidentity/Identity object.
	sessionCredentials = "github.com/jcmturner/gokrb5/v8/sessionCredentials"
	// ctxCredentials is the SPNEGO context key holding the credentials jcmturner/goidentity/Identity object.
	ctxCredentials = "github.com/jcmturner/gokrb5/v8/ctxCredentials"
	// HTTPHeaderAuthRequest is the header that will hold authn/z information.
	HTTPHeaderAuthRequest = "Authorization"
	// HTTPHeaderAuthResponse is the header that will hold SPNEGO data from the server.
	HTTPHeaderAuthResponse = "WWW-Authenticate"
	// HTTPHeaderAuthResponseValueKey is the key in the auth header for SPNEGO.
	HTTPHeaderAuthResponseValueKey = "Negotiate"
	// UnauthorizedMsg is the message returned in the body when authentication fails.
	UnauthorizedMsg = "Unauthorised.\n"
)

// SPNEGOKRB5Authenticate is a Kerberos SPNEGO authentication HTTP handler wrapper.
func SPNEGOKRB5Authenticate(inner http.Handler, kt *keytab.Keytab, settings ...func(*service.Settings)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set up the SPNEGO GSS-API mechanism
		var spnego *SPNEGO
		h, err := types.GetHostAddress(r.RemoteAddr)
		if err == nil {
			// put in this order so that if the user provides a ClientAddress it will override the one here.
			o := append([]func(*service.Settings){service.ClientAddress(h)}, settings...)
			spnego = SPNEGOService(kt, o...)
		} else {
			spnego = SPNEGOService(kt, settings...)
			spnego.Log("%s - SPNEGO could not parse client address: %v", r.RemoteAddr, err)
		}

		// Check if there is a session manager and if there is an already established session for this client
		id, err := getSessionCredentials(spnego, r)
		if err == nil && id.Authenticated() {
			// There is an established session so bypass auth and serve
			spnego.Log("%s - SPNEGO request served under session %s", r.RemoteAddr, id.SessionID())
			inner.ServeHTTP(w, goidentity.AddToHTTPRequestContext(&id, r))
			return
		}

		st, err := getAuthorizationNegotiationHeaderAsSPNEGOToken(spnego, r, w)
		if st == nil || err != nil {
			// response to client and logging handled in function above so just return
			return
		}

		// Validate the context token
		authed, ctx, status := spnego.AcceptSecContext(st)
		if status.Code != gssapi.StatusComplete && status.Code != gssapi.StatusContinueNeeded {
			spnegoResponseReject(spnego, w, "%s - SPNEGO validation error: %v", r.RemoteAddr, status)
			return
		}
		if status.Code == gssapi.StatusContinueNeeded {
			spnegoNegotiateKRB5MechType(spnego, w, "%s - SPNEGO GSS-API continue needed", r.RemoteAddr)
			return
		}

		if authed {
			// Authentication successful; get user's credentials from the context
			id := ctx.Value(ctxCredentials).(*credentials.Credentials)
			// Create a new session if a session manager has been configured
			err = newSession(spnego, r, w, id)
			if err != nil {
				return
			}
			spnegoResponseAcceptCompleted(spnego, w, "%s %s@%s - SPNEGO authentication succeeded", r.RemoteAddr, id.UserName(), id.Domain())
			// Add the identity to the context and serve the inner/wrapped handler
			inner.ServeHTTP(w, goidentity.AddToHTTPRequestContext(id, r))
			return
		}
		// If we get to here we have not authenticationed so just reject
		spnegoResponseReject(spnego, w, "%s - SPNEGO Kerberos authentication failed", r.RemoteAddr)
		return
	})
}

func getAuthorizationNegotiationHeaderAsSPNEGOToken(spnego *SPNEGO, r *http.Request, w http.ResponseWriter) (*SPNEGOToken, error) {
	s := strings.SplitN(r.Header.Get(HTTPHeaderAuthRequest), " ", 2)
	if len(s) != 2 || s[0] != HTTPHeaderAuthResponseValueKey {
		// No Authorization header set so return 401 with WWW-Authenticate Negotiate header
		w.Header().Set(HTTPHeaderAuthResponse, HTTPHeaderAuthResponseValueKey)
		http.Error(w, UnauthorizedMsg, http.StatusUnauthorized)
		return nil, errors.New("client did not provide a negotiation authorization header")
	}

	// Decode the header into an SPNEGO context token
	b, err := base64.StdEncoding.DecodeString(s[1])
	if err != nil {
		err = fmt.Errorf("error in base64 decoding negotiation header: %v", err)
		spnegoNegotiateKRB5MechType(spnego, w, "%s - SPNEGO %v", r.RemoteAddr, err)
		return nil, err
	}
	var st SPNEGOToken
	err = st.Unmarshal(b)
	if err != nil {
		// Check if this is a raw KRB5 context token - issue #347.
		var k5t KRB5Token
		if k5t.Unmarshal(b) != nil {
			err = fmt.Errorf("error in unmarshaling SPNEGO token: %v", err)
			spnegoNegotiateKRB5MechType(spnego, w, "%s - SPNEGO %v", r.RemoteAddr, err)
			return nil, err
		}
		// Wrap it into an SPNEGO context token
		st.Init = true
		st.NegTokenInit = NegTokenInit{
			MechTypes:      []asn1.ObjectIdentifier{k5t.OID},
			MechTokenBytes: b,
		}
	}
	return &st, nil
}

func getSessionCredentials(spnego *SPNEGO, r *http.Request) (credentials.Credentials, error) {
	var creds credentials.Credentials
	// Check if there is a session manager and if there is an already established session for this client
	if sm := spnego.serviceSettings.SessionManager(); sm != nil {
		cb, err := sm.Get(r, sessionCredentials)
		if err != nil || cb == nil || len(cb) < 1 {
			return creds, fmt.Errorf("%s - SPNEGO error getting session and credentials for request: %v", r.RemoteAddr, err)
		}
		err = creds.Unmarshal(cb)
		if err != nil {
			return creds, fmt.Errorf("%s - SPNEGO credentials malformed in session: %v", r.RemoteAddr, err)
		}
		return creds, nil
	}
	return creds, errors.New("no session manager configured")
}

func newSession(spnego *SPNEGO, r *http.Request, w http.ResponseWriter, id *credentials.Credentials) error {
	if sm := spnego.serviceSettings.SessionManager(); sm != nil {
		// create new session
		idb, err := id.Marshal()
		if err != nil {
			spnegoInternalServerError(spnego, w, "SPNEGO could not marshal credentials to add to the session: %v", err)
			return err
		}
		err = sm.New(w, r, sessionCredentials, idb)
		if err != nil {
			spnegoInternalServerError(spnego, w, "SPNEGO could not create new session: %v", err)
			return err
		}
		spnego.Log("%s %s@%s - SPNEGO new session (%s) created", r.RemoteAddr, id.UserName(), id.Domain(), id.SessionID())
	}
	return nil
}

// Log and respond to client for error conditions

func spnegoNegotiateKRB5MechType(s *SPNEGO, w http.ResponseWriter, format string, v ...interface{}) {
	s.Log(format, v...)
	w.Header().Set(HTTPHeaderAuthResponse, spnegoNegTokenRespIncompleteKRB5)
	http.Error(w, UnauthorizedMsg, http.StatusUnauthorized)
}

func spnegoResponseReject(s *SPNEGO, w http.ResponseWriter, format string, v ...interface{}) {
	s.Log(format, v...)
	w.Header().Set(HTTPHeaderAuthResponse, spnegoNegTokenRespReject)
	http.Error(w, UnauthorizedMsg, http.StatusUnauthorized)
}

func spnegoResponseAcceptCompleted(s *SPNEGO, w http.ResponseWriter, format string, v ...interface{}) {
	s.Log(format, v...)
	w.Header().Set(HTTPHeaderAuthResponse, spnegoNegTokenRespKRBAcceptCompleted)
}

func spnegoInternalServerError(s *SPNEGO, w http.ResponseWriter, format string, v ...interface{}) {
	s.Log(format, v...)
	http.Error(w, "Internal Server Error", http.StatusInternalServerError)
}
