// Package msgtype provides Kerberos 5 message type assigned numbers.
package msgtype

// KRB message type IDs.
const (
	KRB_AS_REQ     = 10 //Request for initial authentication
	KRB_AS_REP     = 11 //Response to KRB_AS_REQ request
	KRB_TGS_REQ    = 12 //Request for authentication based on TGT
	KRB_TGS_REP    = 13 //Response to KRB_TGS_REQ request
	KRB_AP_REQ     = 14 //Application request to server
	KRB_AP_REP     = 15 //Response to KRB_AP_REQ_MUTUAL
	KRB_RESERVED16 = 16 //Reserved for user-to-user krb_tgt_request
	KRB_RESERVED17 = 17 //Reserved for user-to-user krb_tgt_reply
	KRB_SAFE       = 20 // Safe (checksummed) application message
	KRB_PRIV       = 21 // Private (encrypted) application message
	KRB_CRED       = 22 //Private (encrypted) message to forward credentials
	KRB_ERROR      = 30 //Error response
)
