package gssapi

import (
	"bytes"
	"crypto/hmac"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/jcmturner/gokrb5/v8/crypto"
	"github.com/jcmturner/gokrb5/v8/iana/keyusage"
	"github.com/jcmturner/gokrb5/v8/types"
)

// RFC 4121, section 4.2.6.2

const (
	// HdrLen is the length of the Wrap Token's header
	HdrLen = 16
	// FillerByte is a filler in the WrapToken structure
	FillerByte byte = 0xFF
)

// WrapToken represents a GSS API Wrap token, as defined in RFC 4121.
// It contains the header fields, the payload and the checksum, and provides
// the logic for converting to/from bytes plus computing and verifying checksums
type WrapToken struct {
	// const GSS Token ID: 0x0504
	Flags byte // contains three flags: acceptor, sealed, acceptor subkey
	// const Filler: 0xFF
	EC        uint16 // checksum length. big-endian
	RRC       uint16 // right rotation count. big-endian
	SndSeqNum uint64 // sender's sequence number. big-endian
	Payload   []byte // your data! :)
	CheckSum  []byte // authenticated checksum of { payload | header }
}

// Return the 2 bytes identifying a GSS API Wrap token
func getGssWrapTokenId() *[2]byte {
	return &[2]byte{0x05, 0x04}
}

// Marshal the WrapToken into a byte slice.
// The payload should have been set and the checksum computed, otherwise an error is returned.
func (wt *WrapToken) Marshal() ([]byte, error) {
	if wt.CheckSum == nil {
		return nil, errors.New("checksum has not been set")
	}
	if wt.Payload == nil {
		return nil, errors.New("payload has not been set")
	}

	pldOffset := HdrLen                    // Offset of the payload in the token
	chkSOffset := HdrLen + len(wt.Payload) // Offset of the checksum in the token

	bytes := make([]byte, chkSOffset+int(wt.EC))
	copy(bytes[0:], getGssWrapTokenId()[:])
	bytes[2] = wt.Flags
	bytes[3] = FillerByte
	binary.BigEndian.PutUint16(bytes[4:6], wt.EC)
	binary.BigEndian.PutUint16(bytes[6:8], wt.RRC)
	binary.BigEndian.PutUint64(bytes[8:16], wt.SndSeqNum)
	copy(bytes[pldOffset:], wt.Payload)
	copy(bytes[chkSOffset:], wt.CheckSum)
	return bytes, nil
}

// SetCheckSum uses the passed encryption key and key usage to compute the checksum over the payload and
// the header, and sets the CheckSum field of this WrapToken.
// If the payload has not been set or the checksum has already been set, an error is returned.
func (wt *WrapToken) SetCheckSum(key types.EncryptionKey, keyUsage uint32) error {
	if wt.Payload == nil {
		return errors.New("payload has not been set")
	}
	if wt.CheckSum != nil {
		return errors.New("checksum has already been computed")
	}
	chkSum, cErr := wt.computeCheckSum(key, keyUsage)
	if cErr != nil {
		return cErr
	}
	wt.CheckSum = chkSum
	return nil
}

// ComputeCheckSum computes and returns the checksum of this token, computed using the passed key and key usage.
// Note: This will NOT update the struct's Checksum field.
func (wt *WrapToken) computeCheckSum(key types.EncryptionKey, keyUsage uint32) ([]byte, error) {
	if wt.Payload == nil {
		return nil, errors.New("cannot compute checksum with uninitialized payload")
	}
	// Build a slice containing { payload | header }
	checksumMe := make([]byte, HdrLen+len(wt.Payload))
	copy(checksumMe[0:], wt.Payload)
	copy(checksumMe[len(wt.Payload):], getChecksumHeader(wt.Flags, wt.SndSeqNum))

	encType, err := crypto.GetEtype(key.KeyType)
	if err != nil {
		return nil, err
	}
	return encType.GetChecksumHash(key.KeyValue, checksumMe, keyUsage)
}

// Build a header suitable for a checksum computation
func getChecksumHeader(flags byte, senderSeqNum uint64) []byte {
	header := make([]byte, 16)
	copy(header[0:], []byte{0x05, 0x04, flags, 0xFF, 0x00, 0x00, 0x00, 0x00})
	binary.BigEndian.PutUint64(header[8:], senderSeqNum)
	return header
}

// Verify computes the token's checksum with the provided key and usage,
// and compares it to the checksum present in the token.
// In case of any failure, (false, Err) is returned, with Err an explanatory error.
func (wt *WrapToken) Verify(key types.EncryptionKey, keyUsage uint32) (bool, error) {
	computed, cErr := wt.computeCheckSum(key, keyUsage)
	if cErr != nil {
		return false, cErr
	}
	if !hmac.Equal(computed, wt.CheckSum) {
		return false, fmt.Errorf(
			"checksum mismatch. Computed: %s, Contained in token: %s",
			hex.EncodeToString(computed), hex.EncodeToString(wt.CheckSum))
	}
	return true, nil
}

// Unmarshal bytes into the corresponding WrapToken.
// If expectFromAcceptor is true, we expect the token to have been emitted by the gss acceptor,
// and will check the according flag, returning an error if the token does not match the expectation.
func (wt *WrapToken) Unmarshal(b []byte, expectFromAcceptor bool) error {
	// Check if we can read a whole header
	if len(b) < 16 {
		return errors.New("bytes shorter than header length")
	}
	// Is the Token ID correct?
	if !bytes.Equal(getGssWrapTokenId()[:], b[0:2]) {
		return fmt.Errorf("wrong Token ID. Expected %s, was %s",
			hex.EncodeToString(getGssWrapTokenId()[:]),
			hex.EncodeToString(b[0:2]))
	}
	// Check the acceptor flag
	flags := b[2]
	isFromAcceptor := flags&0x01 == 1
	if isFromAcceptor && !expectFromAcceptor {
		return errors.New("unexpected acceptor flag is set: not expecting a token from the acceptor")
	}
	if !isFromAcceptor && expectFromAcceptor {
		return errors.New("expected acceptor flag is not set: expecting a token from the acceptor, not the initiator")
	}
	// Check the filler byte
	if b[3] != FillerByte {
		return fmt.Errorf("unexpected filler byte: expecting 0xFF, was %s ", hex.EncodeToString(b[3:4]))
	}
	checksumL := binary.BigEndian.Uint16(b[4:6])
	// Sanity check on the checksum length
	if int(checksumL) > len(b)-HdrLen {
		return fmt.Errorf("inconsistent checksum length: %d bytes to parse, checksum length is %d", len(b), checksumL)
	}

	wt.Flags = flags
	wt.EC = checksumL
	wt.RRC = binary.BigEndian.Uint16(b[6:8])
	wt.SndSeqNum = binary.BigEndian.Uint64(b[8:16])
	wt.Payload = b[16 : len(b)-int(checksumL)]
	wt.CheckSum = b[len(b)-int(checksumL):]
	return nil
}

// NewInitiatorWrapToken builds a new initiator token (acceptor flag will be set to 0) and computes the authenticated checksum.
// Other flags are set to 0, and the RRC and sequence number are initialized to 0.
// Note that in certain circumstances you may need to provide a sequence number that has been defined earlier.
// This is currently not supported.
func NewInitiatorWrapToken(payload []byte, key types.EncryptionKey) (*WrapToken, error) {
	encType, err := crypto.GetEtype(key.KeyType)
	if err != nil {
		return nil, err
	}

	token := WrapToken{
		Flags: 0x00, // all zeroed out (this is a token sent by the initiator)
		// Checksum size: length of output of the HMAC function, in bytes.
		EC:        uint16(encType.GetHMACBitLength() / 8),
		RRC:       0,
		SndSeqNum: 0,
		Payload:   payload,
	}

	if err := token.SetCheckSum(key, keyusage.GSSAPI_INITIATOR_SEAL); err != nil {
		return nil, err
	}

	return &token, nil
}
