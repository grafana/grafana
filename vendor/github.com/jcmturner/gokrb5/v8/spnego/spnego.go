// Package spnego implements the Simple and Protected GSSAPI Negotiation Mechanism for Kerberos authentication.
package spnego

import (
	"context"
	"errors"
	"fmt"

	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/gokrb5/v8/asn1tools"
	"github.com/jcmturner/gokrb5/v8/client"
	"github.com/jcmturner/gokrb5/v8/gssapi"
	"github.com/jcmturner/gokrb5/v8/keytab"
	"github.com/jcmturner/gokrb5/v8/service"
)

// SPNEGO implements the GSS-API mechanism for RFC 4178
type SPNEGO struct {
	serviceSettings *service.Settings
	client          *client.Client
	spn             string
}

// SPNEGOClient configures the SPNEGO mechanism suitable for client side use.
func SPNEGOClient(cl *client.Client, spn string) *SPNEGO {
	s := new(SPNEGO)
	s.client = cl
	s.spn = spn
	s.serviceSettings = service.NewSettings(nil, service.SName(spn))
	return s
}

// SPNEGOService configures the SPNEGO mechanism suitable for service side use.
func SPNEGOService(kt *keytab.Keytab, options ...func(*service.Settings)) *SPNEGO {
	s := new(SPNEGO)
	s.serviceSettings = service.NewSettings(kt, options...)
	return s
}

// OID returns the GSS-API assigned OID for SPNEGO.
func (s *SPNEGO) OID() asn1.ObjectIdentifier {
	return gssapi.OIDSPNEGO.OID()
}

// AcquireCred is the GSS-API method to acquire a client credential via Kerberos for SPNEGO.
func (s *SPNEGO) AcquireCred() error {
	return s.client.AffirmLogin()
}

// InitSecContext is the GSS-API method for the client to a generate a context token to the service via Kerberos.
func (s *SPNEGO) InitSecContext() (gssapi.ContextToken, error) {
	tkt, key, err := s.client.GetServiceTicket(s.spn)
	if err != nil {
		return &SPNEGOToken{}, err
	}
	negTokenInit, err := NewNegTokenInitKRB5(s.client, tkt, key)
	if err != nil {
		return &SPNEGOToken{}, fmt.Errorf("could not create NegTokenInit: %v", err)
	}
	return &SPNEGOToken{
		Init:         true,
		NegTokenInit: negTokenInit,
		settings:     s.serviceSettings,
	}, nil
}

// AcceptSecContext is the GSS-API method for the service to verify the context token provided by the client and
// establish a context.
func (s *SPNEGO) AcceptSecContext(ct gssapi.ContextToken) (bool, context.Context, gssapi.Status) {
	var ctx context.Context
	t, ok := ct.(*SPNEGOToken)
	if !ok {
		return false, ctx, gssapi.Status{Code: gssapi.StatusDefectiveToken, Message: "context token provided was not an SPNEGO token"}
	}
	t.settings = s.serviceSettings
	var oid asn1.ObjectIdentifier
	if t.Init {
		oid = t.NegTokenInit.MechTypes[0]
	}
	if t.Resp {
		oid = t.NegTokenResp.SupportedMech
	}
	if !(oid.Equal(gssapi.OIDKRB5.OID()) || oid.Equal(gssapi.OIDMSLegacyKRB5.OID())) {
		return false, ctx, gssapi.Status{Code: gssapi.StatusDefectiveToken, Message: "SPNEGO OID of MechToken is not of type KRB5"}
	}
	// Flags in the NegInit must be used 	t.NegTokenInit.ReqFlags
	ok, status := t.Verify()
	ctx = t.Context()
	return ok, ctx, status
}

// Log will write to the service's logger if it is configured.
func (s *SPNEGO) Log(format string, v ...interface{}) {
	if s.serviceSettings.Logger() != nil {
		s.serviceSettings.Logger().Output(2, fmt.Sprintf(format, v...))
	}
}

// SPNEGOToken is a GSS-API context token
type SPNEGOToken struct {
	Init         bool
	Resp         bool
	NegTokenInit NegTokenInit
	NegTokenResp NegTokenResp
	settings     *service.Settings
	context      context.Context
}

// Marshal SPNEGO context token
func (s *SPNEGOToken) Marshal() ([]byte, error) {
	var b []byte
	if s.Init {
		hb, _ := asn1.Marshal(gssapi.OIDSPNEGO.OID())
		tb, err := s.NegTokenInit.Marshal()
		if err != nil {
			return b, fmt.Errorf("could not marshal NegTokenInit: %v", err)
		}
		b = append(hb, tb...)
		return asn1tools.AddASNAppTag(b, 0), nil
	}
	if s.Resp {
		b, err := s.NegTokenResp.Marshal()
		if err != nil {
			return b, fmt.Errorf("could not marshal NegTokenResp: %v", err)
		}
		return b, nil
	}
	return b, errors.New("SPNEGO cannot be marshalled. It contains neither a NegTokenInit or NegTokenResp")
}

// Unmarshal SPNEGO context token
func (s *SPNEGOToken) Unmarshal(b []byte) error {
	var r []byte
	var err error
	// We need some data in the array
	if len(b) < 1 {
		return fmt.Errorf("provided byte array is empty")
	}
	if b[0] != byte(161) {
		// Not a NegTokenResp/Targ could be a NegTokenInit
		var oid asn1.ObjectIdentifier
		r, err = asn1.UnmarshalWithParams(b, &oid, fmt.Sprintf("application,explicit,tag:%v", 0))
		if err != nil {
			return fmt.Errorf("not a valid SPNEGO token: %v", err)
		}
		// Check the OID is the SPNEGO OID value
		SPNEGOOID := gssapi.OIDSPNEGO.OID()
		if !oid.Equal(SPNEGOOID) {
			return fmt.Errorf("OID %s does not match SPNEGO OID %s", oid.String(), SPNEGOOID.String())
		}
	} else {
		// Could be a NegTokenResp/Targ
		r = b
	}

	_, nt, err := UnmarshalNegToken(r)
	if err != nil {
		return err
	}
	switch v := nt.(type) {
	case NegTokenInit:
		s.Init = true
		s.NegTokenInit = v
		s.NegTokenInit.settings = s.settings
	case NegTokenResp:
		s.Resp = true
		s.NegTokenResp = v
		s.NegTokenResp.settings = s.settings
	default:
		return errors.New("unknown choice type for NegotiationToken")
	}
	return nil
}

// Verify the SPNEGOToken
func (s *SPNEGOToken) Verify() (bool, gssapi.Status) {
	if (!s.Init && !s.Resp) || (s.Init && s.Resp) {
		return false, gssapi.Status{Code: gssapi.StatusDefectiveToken, Message: "invalid SPNEGO token, unclear if NegTokenInit or NegTokenResp"}
	}
	if s.Init {
		s.NegTokenInit.settings = s.settings
		ok, status := s.NegTokenInit.Verify()
		if ok {
			s.context = s.NegTokenInit.Context()
		}
		return ok, status
	}
	if s.Resp {
		s.NegTokenResp.settings = s.settings
		ok, status := s.NegTokenResp.Verify()
		if ok {
			s.context = s.NegTokenResp.Context()
		}
		return ok, status
	}
	// should not be possible to get here
	return false, gssapi.Status{Code: gssapi.StatusFailure, Message: "unable to verify SPNEGO token"}
}

// Context returns the SPNEGO context which will contain any verify user identity information.
func (s *SPNEGOToken) Context() context.Context {
	return s.context
}
