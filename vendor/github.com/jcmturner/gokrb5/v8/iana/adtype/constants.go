// Package adtype provides Authenticator type assigned numbers.
package adtype

// Authenticator type IDs.
const (
	ADIfRelevant                  int32 = 1
	ADIntendedForServer           int32 = 2
	ADIntendedForApplicationClass int32 = 3
	ADKDCIssued                   int32 = 4
	ADAndOr                       int32 = 5
	ADMandatoryTicketExtensions   int32 = 6
	ADInTicketExtensions          int32 = 7
	ADMandatoryForKDC             int32 = 8
	OSFDCE                        int32 = 64
	SESAME                        int32 = 65
	ADOSFDCEPKICertID             int32 = 66
	ADAuthenticationStrength      int32 = 70
	ADFXFastArmor                 int32 = 71
	ADFXFastUsed                  int32 = 72
	ADWin2KPAC                    int32 = 128
	ADEtypeNegotiation            int32 = 129
	//Reserved values                   9-63
)
