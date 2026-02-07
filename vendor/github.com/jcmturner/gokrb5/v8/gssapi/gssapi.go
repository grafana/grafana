// Package gssapi implements Generic Security Services Application Program Interface required for SPNEGO kerberos authentication.
package gssapi

import (
	"context"
	"fmt"

	"github.com/jcmturner/gofork/encoding/asn1"
)

// GSS-API OID names
const (
	// GSS-API OID names
	OIDKRB5         OIDName = "KRB5"         // MechType OID for Kerberos 5
	OIDMSLegacyKRB5 OIDName = "MSLegacyKRB5" // MechType OID for Kerberos 5
	OIDSPNEGO       OIDName = "SPNEGO"
	OIDGSSIAKerb    OIDName = "GSSIAKerb" // Indicates the client cannot get a service ticket and asks the server to serve as an intermediate to the target KDC. http://k5wiki.kerberos.org/wiki/Projects/IAKERB#IAKERB_mech
)

// GSS-API status values
const (
	StatusBadBindings = 1 << iota
	StatusBadMech
	StatusBadName
	StatusBadNameType
	StatusBadStatus
	StatusBadSig
	StatusBadMIC
	StatusContextExpired
	StatusCredentialsExpired
	StatusDefectiveCredential
	StatusDefectiveToken
	StatusFailure
	StatusNoContext
	StatusNoCred
	StatusBadQOP
	StatusUnauthorized
	StatusUnavailable
	StatusDuplicateElement
	StatusNameNotMN
	StatusComplete
	StatusContinueNeeded
	StatusDuplicateToken
	StatusOldToken
	StatusUnseqToken
	StatusGapToken
)

// ContextToken is an interface for a GSS-API context token.
type ContextToken interface {
	Marshal() ([]byte, error)
	Unmarshal(b []byte) error
	Verify() (bool, Status)
	Context() context.Context
}

/*
CREDENTIAL MANAGEMENT

GSS_Acquire_cred             acquire credentials for use
GSS_Release_cred             release credentials after use
GSS_Inquire_cred             display information about credentials
GSS_Add_cred                 construct credentials incrementally
GSS_Inquire_cred_by_mech     display per-mechanism credential information

CONTEXT-LEVEL CALLS

GSS_Init_sec_context         initiate outbound security context
GSS_Accept_sec_context       accept inbound security context
GSS_Delete_sec_context       flush context when no longer needed
GSS_Process_context_token    process received control token on context
GSS_Context_time             indicate validity time remaining on context
GSS_Inquire_context          display information about context
GSS_Wrap_size_limit          determine GSS_Wrap token size limit
GSS_Export_sec_context       transfer context to other process
GSS_Import_sec_context       import transferred context

PER-MESSAGE CALLS

GSS_GetMIC                   apply integrity check, receive as token separate from message
GSS_VerifyMIC                validate integrity check token along with message
GSS_Wrap                     sign, optionally encrypt, encapsulate
GSS_Unwrap                   decapsulate, decrypt if needed, validate integrity check

SUPPORT CALLS

GSS_Display_status           translate status codes to printable form
GSS_Indicate_mechs           indicate mech_types supported on local system
GSS_Compare_name             compare two names for equality
GSS_Display_name             translate name to printable form
GSS_Import_name              convert printable name to normalized form
GSS_Release_name             free storage of normalized-form name
GSS_Release_buffer           free storage of general GSS-allocated object
GSS_Release_OID_set          free storage of OID set object
GSS_Create_empty_OID_set     create empty OID set
GSS_Add_OID_set_member       add member to OID set
GSS_Test_OID_set_member      test if OID is member of OID set
GSS_Inquire_names_for_mech   indicate name types supported by mechanism
GSS_Inquire_mechs_for_name   indicates mechanisms supporting name type
GSS_Canonicalize_name        translate name to per-mechanism form
GSS_Export_name              externalize per-mechanism name
GSS_Duplicate_name           duplicate name object
*/

// Mechanism is the GSS-API interface for authentication mechanisms.
type Mechanism interface {
	OID() asn1.ObjectIdentifier
	AcquireCred() error                                               // acquire credentials for use (eg. AS exchange for KRB5)
	InitSecContext() (ContextToken, error)                            // initiate outbound security context (eg TGS exchange builds AP_REQ to go into ContextToken to send to service)
	AcceptSecContext(ct ContextToken) (bool, context.Context, Status) // service verifies the token server side to establish a context
	MIC() MICToken                                                    // apply integrity check, receive as token separate from message
	VerifyMIC(mt MICToken) (bool, error)                              // validate integrity check token along with message
	Wrap(msg []byte) WrapToken                                        // sign, optionally encrypt, encapsulate
	Unwrap(wt WrapToken) []byte                                       // decapsulate, decrypt if needed, validate integrity check
}

// OIDName is the type for defined GSS-API OIDs.
type OIDName string

// OID returns the OID for the provided OID name.
func (o OIDName) OID() asn1.ObjectIdentifier {
	switch o {
	case OIDSPNEGO:
		return asn1.ObjectIdentifier{1, 3, 6, 1, 5, 5, 2}
	case OIDKRB5:
		return asn1.ObjectIdentifier{1, 2, 840, 113554, 1, 2, 2}
	case OIDMSLegacyKRB5:
		return asn1.ObjectIdentifier{1, 2, 840, 48018, 1, 2, 2}
	case OIDGSSIAKerb:
		return asn1.ObjectIdentifier{1, 3, 6, 1, 5, 2, 5}
	}
	return asn1.ObjectIdentifier{}
}

// Status is the GSS-API status and implements the error interface.
type Status struct {
	Code    int
	Message string
}

// Error returns the Status description.
func (s Status) Error() string {
	var str string
	switch s.Code {
	case StatusBadBindings:
		str = "channel binding mismatch"
	case StatusBadMech:
		str = "unsupported mechanism requested"
	case StatusBadName:
		str = "invalid name provided"
	case StatusBadNameType:
		str = "name of unsupported type provided"
	case StatusBadStatus:
		str = "invalid input status selector"
	case StatusBadSig:
		str = "token had invalid integrity check"
	case StatusBadMIC:
		str = "preferred alias for GSS_S_BAD_SIG"
	case StatusContextExpired:
		str = "specified security context expired"
	case StatusCredentialsExpired:
		str = "expired credentials detected"
	case StatusDefectiveCredential:
		str = "defective credential detected"
	case StatusDefectiveToken:
		str = "defective token detected"
	case StatusFailure:
		str = "failure, unspecified at GSS-API level"
	case StatusNoContext:
		str = "no valid security context specified"
	case StatusNoCred:
		str = "no valid credentials provided"
	case StatusBadQOP:
		str = "unsupported QOP valu"
	case StatusUnauthorized:
		str = "operation unauthorized"
	case StatusUnavailable:
		str = "operation unavailable"
	case StatusDuplicateElement:
		str = "duplicate credential element requested"
	case StatusNameNotMN:
		str = "name contains multi-mechanism elements"
	case StatusComplete:
		str = "normal completion"
	case StatusContinueNeeded:
		str = "continuation call to routine required"
	case StatusDuplicateToken:
		str = "duplicate per-message token detected"
	case StatusOldToken:
		str = "timed-out per-message token detected"
	case StatusUnseqToken:
		str = "reordered (early) per-message token detected"
	case StatusGapToken:
		str = "skipped predecessor token(s) detected"
	default:
		str = "unknown GSS-API error status"
	}
	if s.Message != "" {
		return fmt.Sprintf("%s: %s", str, s.Message)
	}
	return str
}
