// Package patype provides Kerberos 5 pre-authentication type assigned numbers.
package patype

// Kerberos pre-authentication type assigned numbers.
const (
	PA_TGS_REQ       int32 = 1
	PA_ENC_TIMESTAMP int32 = 2
	PA_PW_SALT       int32 = 3
	//RESERVED : 4
	PA_ENC_UNIX_TIME       int32 = 5
	PA_SANDIA_SECUREID     int32 = 6
	PA_SESAME              int32 = 7
	PA_OSF_DCE             int32 = 8
	PA_CYBERSAFE_SECUREID  int32 = 9
	PA_AFS3_SALT           int32 = 10
	PA_ETYPE_INFO          int32 = 11
	PA_SAM_CHALLENGE       int32 = 12
	PA_SAM_RESPONSE        int32 = 13
	PA_PK_AS_REQ_OLD       int32 = 14
	PA_PK_AS_REP_OLD       int32 = 15
	PA_PK_AS_REQ           int32 = 16
	PA_PK_AS_REP           int32 = 17
	PA_PK_OCSP_RESPONSE    int32 = 18
	PA_ETYPE_INFO2         int32 = 19
	PA_USE_SPECIFIED_KVNO  int32 = 20
	PA_SVR_REFERRAL_INFO   int32 = 20
	PA_SAM_REDIRECT        int32 = 21
	PA_GET_FROM_TYPED_DATA int32 = 22
	TD_PADATA              int32 = 22
	PA_SAM_ETYPE_INFO      int32 = 23
	PA_ALT_PRINC           int32 = 24
	PA_SERVER_REFERRAL     int32 = 25
	//UNASSIGNED : 26-29
	PA_SAM_CHALLENGE2 int32 = 30
	PA_SAM_RESPONSE2  int32 = 31
	//UNASSIGNED : 32-40
	PA_EXTRA_TGT int32 = 41
	//UNASSIGNED : 42-100
	TD_PKINIT_CMS_CERTIFICATES int32 = 101
	TD_KRB_PRINCIPAL           int32 = 102
	TD_KRB_REALM               int32 = 103
	TD_TRUSTED_CERTIFIERS      int32 = 104
	TD_CERTIFICATE_INDEX       int32 = 105
	TD_APP_DEFINED_ERROR       int32 = 106
	TD_REQ_NONCE               int32 = 107
	TD_REQ_SEQ                 int32 = 108
	TD_DH_PARAMETERS           int32 = 109
	//UNASSIGNED : 110
	TD_CMS_DIGEST_ALGORITHMS  int32 = 111
	TD_CERT_DIGEST_ALGORITHMS int32 = 112
	//UNASSIGNED : 113-127
	PA_PAC_REQUEST         int32 = 128
	PA_FOR_USER            int32 = 129
	PA_FOR_X509_USER       int32 = 130
	PA_FOR_CHECK_DUPS      int32 = 131
	PA_AS_CHECKSUM         int32 = 132
	PA_FX_COOKIE           int32 = 133
	PA_AUTHENTICATION_SET  int32 = 134
	PA_AUTH_SET_SELECTED   int32 = 135
	PA_FX_FAST             int32 = 136
	PA_FX_ERROR            int32 = 137
	PA_ENCRYPTED_CHALLENGE int32 = 138
	//UNASSIGNED : 139-140
	PA_OTP_CHALLENGE  int32 = 141
	PA_OTP_REQUEST    int32 = 142
	PA_OTP_CONFIRM    int32 = 143
	PA_OTP_PIN_CHANGE int32 = 144
	PA_EPAK_AS_REQ    int32 = 145
	PA_EPAK_AS_REP    int32 = 146
	PA_PKINIT_KX      int32 = 147
	PA_PKU2U_NAME     int32 = 148
	PA_REQ_ENC_PA_REP int32 = 149
	PA_AS_FRESHNESS   int32 = 150
	//UNASSIGNED : 151-164
	PA_SUPPORTED_ETYPES int32 = 165
	PA_EXTENDED_ERROR   int32 = 166
)
