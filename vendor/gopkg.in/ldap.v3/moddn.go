// Package ldap - moddn.go contains ModifyDN functionality
//
// https://tools.ietf.org/html/rfc4511
// ModifyDNRequest ::= [APPLICATION 12] SEQUENCE {
//      entry           LDAPDN,
//      newrdn          RelativeLDAPDN,
//      deleteoldrdn    BOOLEAN,
//      newSuperior     [0] LDAPDN OPTIONAL }
//
//
package ldap

import (
	"errors"
	"log"

	"gopkg.in/asn1-ber.v1"
)

// ModifyDNRequest holds the request to modify a DN
type ModifyDNRequest struct {
	DN           string
	NewRDN       string
	DeleteOldRDN bool
	NewSuperior  string
}

// NewModifyDNRequest creates a new request which can be passed to ModifyDN().
//
// To move an object in the tree, set the "newSup" to the new parent entry DN. Use an
// empty string for just changing the object's RDN.
//
// For moving the object without renaming, the "rdn" must be the first
// RDN of the given DN.
//
// A call like
//   mdnReq := NewModifyDNRequest("uid=someone,dc=example,dc=org", "uid=newname", true, "")
// will setup the request to just rename uid=someone,dc=example,dc=org to
// uid=newname,dc=example,dc=org.
func NewModifyDNRequest(dn string, rdn string, delOld bool, newSup string) *ModifyDNRequest {
	return &ModifyDNRequest{
		DN:           dn,
		NewRDN:       rdn,
		DeleteOldRDN: delOld,
		NewSuperior:  newSup,
	}
}

func (m ModifyDNRequest) encode() *ber.Packet {
	request := ber.Encode(ber.ClassApplication, ber.TypeConstructed, ApplicationModifyDNRequest, nil, "Modify DN Request")
	request.AppendChild(ber.NewString(ber.ClassUniversal, ber.TypePrimitive, ber.TagOctetString, m.DN, "DN"))
	request.AppendChild(ber.NewString(ber.ClassUniversal, ber.TypePrimitive, ber.TagOctetString, m.NewRDN, "New RDN"))
	request.AppendChild(ber.NewBoolean(ber.ClassUniversal, ber.TypePrimitive, ber.TagBoolean, m.DeleteOldRDN, "Delete old RDN"))
	if m.NewSuperior != "" {
		request.AppendChild(ber.NewString(ber.ClassContext, ber.TypePrimitive, 0, m.NewSuperior, "New Superior"))
	}
	return request
}

// ModifyDN renames the given DN and optionally move to another base (when the "newSup" argument
// to NewModifyDNRequest() is not "").
func (l *Conn) ModifyDN(m *ModifyDNRequest) error {
	packet := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSequence, nil, "LDAP Request")
	packet.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagInteger, l.nextMessageID(), "MessageID"))
	packet.AppendChild(m.encode())

	l.Debug.PrintPacket(packet)

	msgCtx, err := l.sendMessage(packet)
	if err != nil {
		return err
	}
	defer l.finishMessage(msgCtx)

	l.Debug.Printf("%d: waiting for response", msgCtx.id)
	packetResponse, ok := <-msgCtx.responses
	if !ok {
		return NewError(ErrorNetwork, errors.New("ldap: channel closed"))
	}
	packet, err = packetResponse.ReadPacket()
	l.Debug.Printf("%d: got response %p", msgCtx.id, packet)
	if err != nil {
		return err
	}

	if l.Debug {
		if err := addLDAPDescriptions(packet); err != nil {
			return err
		}
		ber.PrintPacket(packet)
	}

	if packet.Children[1].Tag == ApplicationModifyDNResponse {
		err := GetLDAPError(packet)
		if err != nil {
			return err
		}
	} else {
		log.Printf("Unexpected Response: %d", packet.Children[1].Tag)
	}

	l.Debug.Printf("%d: returning", msgCtx.id)
	return nil
}
