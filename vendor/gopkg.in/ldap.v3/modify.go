// File contains Modify functionality
//
// https://tools.ietf.org/html/rfc4511
//
// ModifyRequest ::= [APPLICATION 6] SEQUENCE {
//      object          LDAPDN,
//      changes         SEQUENCE OF change SEQUENCE {
//           operation       ENUMERATED {
//                add     (0),
//                delete  (1),
//                replace (2),
//                ...  },
//           modification    PartialAttribute } }
//
// PartialAttribute ::= SEQUENCE {
//      type       AttributeDescription,
//      vals       SET OF value AttributeValue }
//
// AttributeDescription ::= LDAPString
//                         -- Constrained to <attributedescription>
//                         -- [RFC4512]
//
// AttributeValue ::= OCTET STRING
//

package ldap

import (
	"errors"
	"log"

	"gopkg.in/asn1-ber.v1"
)

// Change operation choices
const (
	AddAttribute     = 0
	DeleteAttribute  = 1
	ReplaceAttribute = 2
)

// PartialAttribute for a ModifyRequest as defined in https://tools.ietf.org/html/rfc4511
type PartialAttribute struct {
	// Type is the type of the partial attribute
	Type string
	// Vals are the values of the partial attribute
	Vals []string
}

func (p *PartialAttribute) encode() *ber.Packet {
	seq := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSequence, nil, "PartialAttribute")
	seq.AppendChild(ber.NewString(ber.ClassUniversal, ber.TypePrimitive, ber.TagOctetString, p.Type, "Type"))
	set := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSet, nil, "AttributeValue")
	for _, value := range p.Vals {
		set.AppendChild(ber.NewString(ber.ClassUniversal, ber.TypePrimitive, ber.TagOctetString, value, "Vals"))
	}
	seq.AppendChild(set)
	return seq
}

// Change for a ModifyRequest as defined in https://tools.ietf.org/html/rfc4511
type Change struct {
	// Operation is the type of change to be made
	Operation uint
	// Modification is the attribute to be modified
	Modification PartialAttribute
}

func (c *Change) encode() *ber.Packet {
	change := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSequence, nil, "Change")
	change.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagEnumerated, uint64(c.Operation), "Operation"))
	change.AppendChild(c.Modification.encode())
	return change
}

// ModifyRequest as defined in https://tools.ietf.org/html/rfc4511
type ModifyRequest struct {
	// DN is the distinguishedName of the directory entry to modify
	DN string
	// Changes contain the attributes to modify
	Changes []Change
	// Controls hold optional controls to send with the request
	Controls []Control
}

// Add appends the given attribute to the list of changes to be made
func (m *ModifyRequest) Add(attrType string, attrVals []string) {
	m.appendChange(AddAttribute, attrType, attrVals)
}

// Delete appends the given attribute to the list of changes to be made
func (m *ModifyRequest) Delete(attrType string, attrVals []string) {
	m.appendChange(DeleteAttribute, attrType, attrVals)
}

// Replace appends the given attribute to the list of changes to be made
func (m *ModifyRequest) Replace(attrType string, attrVals []string) {
	m.appendChange(ReplaceAttribute, attrType, attrVals)
}

func (m *ModifyRequest) appendChange(operation uint, attrType string, attrVals []string) {
	m.Changes = append(m.Changes, Change{operation, PartialAttribute{Type: attrType, Vals: attrVals}})
}

func (m ModifyRequest) encode() *ber.Packet {
	request := ber.Encode(ber.ClassApplication, ber.TypeConstructed, ApplicationModifyRequest, nil, "Modify Request")
	request.AppendChild(ber.NewString(ber.ClassUniversal, ber.TypePrimitive, ber.TagOctetString, m.DN, "DN"))
	changes := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSequence, nil, "Changes")
	for _, change := range m.Changes {
		changes.AppendChild(change.encode())
	}
	request.AppendChild(changes)
	return request
}

// NewModifyRequest creates a modify request for the given DN
func NewModifyRequest(
	dn string,
	controls []Control,
) *ModifyRequest {
	return &ModifyRequest{
		DN:       dn,
		Controls: controls,
	}
}

// Modify performs the ModifyRequest
func (l *Conn) Modify(modifyRequest *ModifyRequest) error {
	packet := ber.Encode(ber.ClassUniversal, ber.TypeConstructed, ber.TagSequence, nil, "LDAP Request")
	packet.AppendChild(ber.NewInteger(ber.ClassUniversal, ber.TypePrimitive, ber.TagInteger, l.nextMessageID(), "MessageID"))
	packet.AppendChild(modifyRequest.encode())
	if len(modifyRequest.Controls) > 0 {
		packet.AppendChild(encodeControls(modifyRequest.Controls))
	}

	l.Debug.PrintPacket(packet)

	msgCtx, err := l.sendMessage(packet)
	if err != nil {
		return err
	}
	defer l.finishMessage(msgCtx)

	l.Debug.Printf("%d: waiting for response", msgCtx.id)
	packetResponse, ok := <-msgCtx.responses
	if !ok {
		return NewError(ErrorNetwork, errors.New("ldap: response channel closed"))
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

	if packet.Children[1].Tag == ApplicationModifyResponse {
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
