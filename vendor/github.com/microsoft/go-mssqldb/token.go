package mssql

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"strconv"

	"github.com/golang-sql/sqlexp"
	"github.com/microsoft/go-mssqldb/aecmk"
	"github.com/microsoft/go-mssqldb/internal/github.com/swisscom/mssql-always-encrypted/pkg/algorithms"
	"github.com/microsoft/go-mssqldb/internal/github.com/swisscom/mssql-always-encrypted/pkg/encryption"
	"github.com/microsoft/go-mssqldb/internal/github.com/swisscom/mssql-always-encrypted/pkg/keys"
	"github.com/microsoft/go-mssqldb/msdsn"
	"golang.org/x/text/encoding/unicode"
)

//go:generate go run golang.org/x/tools/cmd/stringer -type token

type token byte

// token ids
const (
	tokenReturnStatus  token = 121 // 0x79
	tokenColMetadata   token = 129 // 0x81
	tokenOrder         token = 169 // 0xA9
	tokenError         token = 170 // 0xAA
	tokenInfo          token = 171 // 0xAB
	tokenReturnValue   token = 0xAC
	tokenLoginAck      token = 173 // 0xad
	tokenFeatureExtAck token = 174 // 0xae
	tokenRow           token = 209 // 0xd1
	tokenNbcRow        token = 210 // 0xd2
	tokenEnvChange     token = 227 // 0xE3
	tokenSSPI          token = 237 // 0xED
	tokenFedAuthInfo   token = 238 // 0xEE
	tokenDone          token = 253 // 0xFD
	tokenDoneProc      token = 254
	tokenDoneInProc    token = 255
)

// done flags
// https://msdn.microsoft.com/en-us/library/dd340421.aspx
const (
	doneFinal    = 0
	doneMore     = 1
	doneError    = 2
	doneInxact   = 4
	doneCount    = 0x10
	doneAttn     = 0x20
	doneSrvError = 0x100
)

// CurCmd values in done (undocumented)
const (
	cmdSelect = 0xc1
	// cmdInsert     = 0xc3
	// cmdDelete     = 0xc4
	// cmdUpdate     = 0xc5
	// cmdAbort      = 0xd2
	// cmdBeginXaxt  = 0xd4
	// cmdEndXact    = 0xd5
	// cmdBulkInsert = 0xf0
	// cmdOpenCursor = 0x20
	// cmdMerge      = 0x117
)

// ENVCHANGE types
// http://msdn.microsoft.com/en-us/library/dd303449.aspx
const (
	envTypDatabase           = 1
	envTypLanguage           = 2
	envTypCharset            = 3
	envTypPacketSize         = 4
	envSortId                = 5
	envSortFlags             = 6
	envSqlCollation          = 7
	envTypBeginTran          = 8
	envTypCommitTran         = 9
	envTypRollbackTran       = 10
	envEnlistDTC             = 11
	envDefectTran            = 12
	envDatabaseMirrorPartner = 13
	envPromoteTran           = 15
	envTranMgrAddr           = 16
	envTranEnded             = 17
	envResetConnAck          = 18
	envStartedInstanceName   = 19
	envRouting               = 20
)

const (
	fedAuthInfoSTSURL = 0x01
	fedAuthInfoSPN    = 0x02
)

const (
	cipherAlgCustom = 0x00
)

// COLMETADATA flags
// https://msdn.microsoft.com/en-us/library/dd357363.aspx
const (
	colFlagNullable  = 1
	colFlagEncrypted = 0x0800
	// TODO implement more flags
)

// interface for all tokens
type tokenStruct interface{}

type orderStruct struct {
	ColIds []uint16
}

type doneStruct struct {
	Status   uint16
	CurCmd   uint16
	RowCount uint64
	errors   []Error
}

func (d doneStruct) isError() bool {
	return d.Status&doneError != 0 || len(d.errors) > 0
}

func (d doneStruct) getError() Error {
	n := len(d.errors)
	if n == 0 {
		return Error{Message: "Request failed but didn't provide reason"}
	}
	err := d.errors[n-1]
	// should this return the most severe error?
	err.All = make([]Error, n)
	copy(err.All, d.errors)
	return err
}

type doneInProcStruct doneStruct

// ENVCHANGE stream
// http://msdn.microsoft.com/en-us/library/dd303449.aspx
func processEnvChg(ctx context.Context, sess *tdsSession) {
	size := sess.buf.uint16()
	r := &io.LimitedReader{R: sess.buf, N: int64(size)}
	for {
		var err error
		var envtype uint8
		err = binary.Read(r, binary.LittleEndian, &envtype)
		if err == io.EOF {
			return
		}
		if err != nil {
			badStreamPanic(err)
		}
		switch envtype {
		case envTypDatabase:
			sess.database, err = readBVarChar(r)
			if err != nil {
				badStreamPanic(err)
			}
			_, err = readBVarChar(r)
			if err != nil {
				badStreamPanic(err)
			}
		case envTypLanguage:
			// currently ignored
			// new value
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
			// old value
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envTypCharset:
			// currently ignored
			// new value
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
			// old value
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envTypPacketSize:
			packetsize, err := readBVarChar(r)
			if err != nil {
				badStreamPanic(err)
			}
			_, err = readBVarChar(r)
			if err != nil {
				badStreamPanic(err)
			}
			packetsizei, err := strconv.Atoi(packetsize)
			if err != nil {
				badStreamPanicf("Invalid Packet size value returned from server (%s): %s", packetsize, err.Error())
			}
			sess.buf.ResizeBuffer(packetsizei)
		case envSortId:
			// currently ignored
			// new value
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
			// old value, should be 0
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envSortFlags:
			// currently ignored
			// new value
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
			// old value, should be 0
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envSqlCollation:
			// currently ignored
			var collationSize uint8
			err = binary.Read(r, binary.LittleEndian, &collationSize)
			if err != nil {
				badStreamPanic(err)
			}

			// SQL Collation data should contain 5 bytes in length
			if collationSize != 5 {
				badStreamPanicf("Invalid SQL Collation size value returned from server: %d", collationSize)
			}

			// 4 bytes, contains: LCID ColFlags Version
			var info uint32
			err = binary.Read(r, binary.LittleEndian, &info)
			if err != nil {
				badStreamPanic(err)
			}

			// 1 byte, contains: sortID
			var sortID uint8
			err = binary.Read(r, binary.LittleEndian, &sortID)
			if err != nil {
				badStreamPanic(err)
			}

			// old value, should be 0
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envTypBeginTran:
			tranid, err := readBVarByte(r)
			if len(tranid) != 8 {
				badStreamPanicf("invalid size of transaction identifier: %d", len(tranid))
			}
			sess.tranid = binary.LittleEndian.Uint64(tranid)
			if err != nil {
				badStreamPanic(err)
			}
			sess.LogF(ctx, msdsn.LogTransaction, "BEGIN TRANSACTION %x", sess.tranid)
			_, err = readBVarByte(r)
			if err != nil {
				badStreamPanic(err)
			}
		case envTypCommitTran, envTypRollbackTran:
			_, err = readBVarByte(r)
			if err != nil {
				badStreamPanic(err)
			}
			_, err = readBVarByte(r)
			if err != nil {
				badStreamPanic(err)
			}
			if envtype == envTypCommitTran {
				sess.LogF(ctx, msdsn.LogTransaction, "COMMIT TRANSACTION %x", sess.tranid)
			} else {
				sess.LogF(ctx, msdsn.LogTransaction, "ROLLBACK TRANSACTION %x", sess.tranid)
			}
			sess.tranid = 0
		case envEnlistDTC:
			// currently ignored
			// new value, should be 0
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
			// old value
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envDefectTran:
			// currently ignored
			// new value
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
			// old value, should be 0
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envDatabaseMirrorPartner:
			sess.partner, err = readBVarChar(r)
			if err != nil {
				badStreamPanic(err)
			}
			_, err = readBVarChar(r)
			if err != nil {
				badStreamPanic(err)
			}
		case envPromoteTran:
			// currently ignored
			// old value, should be 0
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
			// dtc token
			// spec says it should be L_VARBYTE, so this code might be wrong
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envTranMgrAddr:
			// currently ignored
			// old value, should be 0
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
			// XACT_MANAGER_ADDRESS = B_VARBYTE
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envTranEnded:
			// currently ignored
			// old value, B_VARBYTE
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
			// should be 0
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envResetConnAck:
			// currently ignored
			// old value, should be 0
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
			// should be 0
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envStartedInstanceName:
			// currently ignored
			// old value, should be 0
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
			// instance name
			if _, err = readBVarChar(r); err != nil {
				badStreamPanic(err)
			}
		case envRouting:
			// RoutingData message is:
			// ValueLength                 USHORT
			// Protocol (TCP = 0)          BYTE
			// ProtocolProperty (new port) USHORT
			// AlternateServer             US_VARCHAR
			_, err := readUshort(r)
			if err != nil {
				badStreamPanic(err)
			}
			protocol, err := readByte(r)
			if err != nil || protocol != 0 {
				badStreamPanic(err)
			}
			newPort, err := readUshort(r)
			if err != nil {
				badStreamPanic(err)
			}
			newServer, err := readUsVarChar(r)
			if err != nil {
				badStreamPanic(err)
			}
			// consume the OLDVALUE = %x00 %x00
			_, err = readUshort(r)
			if err != nil {
				badStreamPanic(err)
			}
			sess.routedServer = newServer
			sess.routedPort = newPort
		default:
			// ignore rest of records because we don't know how to skip those
			sess.LogF(ctx, msdsn.LogDebug, "WARN: Unknown ENVCHANGE record detected with type id = %d", envtype)
			return
		}
	}
}

// http://msdn.microsoft.com/en-us/library/dd358180.aspx
func parseReturnStatus(r *tdsBuffer) ReturnStatus {
	return ReturnStatus(r.int32())
}

func parseOrder(r *tdsBuffer) (res orderStruct) {
	len := int(r.uint16())
	res.ColIds = make([]uint16, len/2)
	for i := 0; i < len/2; i++ {
		res.ColIds[i] = r.uint16()
	}
	return res
}

// https://msdn.microsoft.com/en-us/library/dd340421.aspx
func parseDone(r *tdsBuffer) (res doneStruct) {
	res.Status = r.uint16()
	res.CurCmd = r.uint16()
	res.RowCount = r.uint64()
	return res
}

// https://msdn.microsoft.com/en-us/library/dd340553.aspx
func parseDoneInProc(r *tdsBuffer) (res doneInProcStruct) {
	res.Status = r.uint16()
	res.CurCmd = r.uint16()
	res.RowCount = r.uint64()
	return res
}

type sspiMsg []byte

func parseSSPIMsg(r *tdsBuffer) sspiMsg {
	size := r.uint16()
	buf := make([]byte, size)
	r.ReadFull(buf)
	return sspiMsg(buf)
}

type fedAuthInfoStruct struct {
	STSURL    string
	ServerSPN string
}

type fedAuthInfoOpt struct {
	fedAuthInfoID          byte
	dataLength, dataOffset uint32
}

func parseFedAuthInfo(r *tdsBuffer) fedAuthInfoStruct {
	size := r.uint32()

	var STSURL, SPN string
	var err error

	// Each fedAuthInfoOpt is one byte to indicate the info ID,
	// then a four byte offset and a four byte length.
	count := r.uint32()
	offset := uint32(4)
	opts := make([]fedAuthInfoOpt, count)

	for i := uint32(0); i < count; i++ {
		fedAuthInfoID := r.byte()
		dataLength := r.uint32()
		dataOffset := r.uint32()
		offset += 1 + 4 + 4

		opts[i] = fedAuthInfoOpt{
			fedAuthInfoID: fedAuthInfoID,
			dataLength:    dataLength,
			dataOffset:    dataOffset,
		}
	}

	data := make([]byte, size-offset)
	r.ReadFull(data)

	for i := uint32(0); i < count; i++ {
		if opts[i].dataOffset < offset {
			badStreamPanicf("Fed auth info opt stated data offset %d is before data begins in packet at %d",
				opts[i].dataOffset, offset)
			// returns via panic
		}

		if opts[i].dataOffset+opts[i].dataLength > size {
			badStreamPanicf("Fed auth info opt stated data length %d added to stated offset exceeds size of packet %d",
				opts[i].dataOffset+opts[i].dataLength, size)
			// returns via panic
		}

		optData := data[opts[i].dataOffset-offset : opts[i].dataOffset-offset+opts[i].dataLength]
		switch opts[i].fedAuthInfoID {
		case fedAuthInfoSTSURL:
			STSURL, err = ucs22str(optData)
		case fedAuthInfoSPN:
			SPN, err = ucs22str(optData)
		default:
			err = fmt.Errorf("unexpected fed auth info opt ID %d", int(opts[i].fedAuthInfoID))
		}

		if err != nil {
			badStreamPanic(err)
		}
	}

	return fedAuthInfoStruct{
		STSURL:    STSURL,
		ServerSPN: SPN,
	}
}

type loginAckStruct struct {
	Interface  uint8
	TDSVersion uint32
	ProgName   string
	ProgVer    uint32
}

func parseLoginAck(r *tdsBuffer) loginAckStruct {
	size := r.uint16()
	buf := make([]byte, size)
	r.ReadFull(buf)
	var res loginAckStruct
	res.Interface = buf[0]
	res.TDSVersion = binary.BigEndian.Uint32(buf[1:])
	prognamelen := buf[1+4]
	var err error
	if res.ProgName, err = ucs22str(buf[1+4+1 : 1+4+1+prognamelen*2]); err != nil {
		badStreamPanic(err)
	}
	res.ProgVer = binary.BigEndian.Uint32(buf[size-4:])
	return res
}

// https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-tds/2eb82f8e-11f0-46dc-b42d-27302fa4701a
type fedAuthAckStruct struct {
	Nonce     []byte
	Signature []byte
}

type colAckStruct struct {
	Version     int
	EnclaveType string
}

type featureExtAck map[byte]interface{}

func parseFeatureExtAck(r *tdsBuffer) featureExtAck {
	ack := map[byte]interface{}{}

	for feature := r.byte(); feature != featExtTERMINATOR; feature = r.byte() {
		length := r.uint32()

		switch feature {
		case featExtFEDAUTH:
			// In theory we need to know the federated authentication library to
			// know how to parse, but the alternatives provide compatible structures.
			fedAuthAck := fedAuthAckStruct{}
			if length >= 32 {
				fedAuthAck.Nonce = make([]byte, 32)
				r.ReadFull(fedAuthAck.Nonce)
				length -= 32
			}
			if length >= 32 {
				fedAuthAck.Signature = make([]byte, 32)
				r.ReadFull(fedAuthAck.Signature)
				length -= 32
			}
			ack[feature] = fedAuthAck
		case featExtCOLUMNENCRYPTION:
			colAck := colAckStruct{Version: int(r.byte())}
			length--
			if length > 0 {
				// enclave type is sent as utf16 le
				enclaveLength := r.byte() * 2
				length--
				enclaveBytes := make([]byte, enclaveLength)
				r.ReadFull(enclaveBytes)
				// if the enclave type is malformed we'll just ignore it
				colAck.EnclaveType, _ = ucs22str(enclaveBytes)
				length -= uint32(enclaveLength)

			}
			ack[feature] = colAck
		}

		// Skip unprocessed bytes
		if length > 0 {
			io.CopyN(io.Discard, r, int64(length))
		}
	}

	return ack
}

// http://msdn.microsoft.com/en-us/library/dd357363.aspx
func parseColMetadata72(r *tdsBuffer, s *tdsSession) (columns []columnStruct) {
	count := r.uint16()
	if count == 0xffff {
		// no metadata is sent
		return nil
	}
	columns = make([]columnStruct, count)
	var cekTable *cekTable
	if s.alwaysEncrypted {
		// column encryption key list
		cekTable = readCekTable(r)
	}

	for i := range columns {
		column := &columns[i]
		baseTi := getBaseTypeInfo(r, true)
		typeInfo := readTypeInfo(r, baseTi.TypeId, column.cryptoMeta, s.encoding)
		typeInfo.UserType = baseTi.UserType
		typeInfo.Flags = baseTi.Flags
		typeInfo.TypeId = baseTi.TypeId

		column.Flags = baseTi.Flags
		column.UserType = baseTi.UserType
		column.ti = typeInfo

		if column.isEncrypted() && s.alwaysEncrypted {
			// Read Crypto Metadata
			cryptoMeta := parseCryptoMetadata(r, cekTable, s.encoding)
			cryptoMeta.typeInfo.Flags = baseTi.Flags
			column.cryptoMeta = &cryptoMeta
		} else {
			column.cryptoMeta = nil
		}

		column.ColName = r.BVarChar()
	}
	return columns
}

func getBaseTypeInfo(r *tdsBuffer, parseFlags bool) typeInfo {
	userType := r.uint32()
	flags := uint16(0)
	if parseFlags {
		flags = r.uint16()
	}
	tId := r.byte()

	return typeInfo{
		UserType: userType,
		Flags:    flags,
		TypeId:   tId}
}

type cryptoMetadata struct {
	entry         *cekTableEntry
	ordinal       uint16
	algorithmId   byte
	algorithmName *string
	encType       byte
	normRuleVer   byte
	typeInfo      typeInfo
}

func parseCryptoMetadata(r *tdsBuffer, cekTable *cekTable, encoding msdsn.EncodeParameters) cryptoMetadata {
	ordinal := uint16(0)
	if cekTable != nil {
		ordinal = r.uint16()
	}

	typeInfo := getBaseTypeInfo(r, false)
	ti := readTypeInfo(r, typeInfo.TypeId, nil, encoding)
	ti.UserType = typeInfo.UserType
	ti.Flags = typeInfo.Flags
	ti.TypeId = typeInfo.TypeId

	algorithmId := r.byte()
	var algName *string = nil

	if algorithmId == cipherAlgCustom {
		// Read the name when a custom algorithm is used
		nameLen := int(r.byte())
		var algNameUtf16 = make([]byte, nameLen*2)
		r.ReadFull(algNameUtf16)
		algNameBytes, _ := unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM).NewDecoder().Bytes(algNameUtf16)
		mAlgName := string(algNameBytes)
		algName = &mAlgName
	}

	encType := r.byte()
	normRuleVer := r.byte()

	var entry *cekTableEntry = nil

	if cekTable != nil {
		if int(ordinal) > len(cekTable.entries)-1 {
			badStreamPanicf("invalid ordinal, cekTable only has %d entries", len(cekTable.entries))
		}
		entry = &cekTable.entries[ordinal]
	}

	return cryptoMetadata{
		entry:         entry,
		ordinal:       ordinal,
		algorithmId:   algorithmId,
		algorithmName: algName,
		encType:       encType,
		normRuleVer:   normRuleVer,
		typeInfo:      ti,
	}
}

func readCekTable(r *tdsBuffer) *cekTable {
	tableSize := r.uint16()
	var cekTable *cekTable = nil

	if tableSize != 0 {
		mCekTable := newCekTable(tableSize)
		for i := uint16(0); i < tableSize; i++ {
			mCekTable.entries[i] = readCekTableEntry(r)
		}
		cekTable = &mCekTable
	}

	return cekTable
}

func readCekTableEntry(r *tdsBuffer) cekTableEntry {
	databaseId := r.int32()
	cekID := r.int32()
	cekVersion := r.int32()
	var cekMdVersion = make([]byte, 8)
	_, err := r.Read(cekMdVersion)
	if err != nil {
		badStreamPanicf("unable to read cekMdVersion")
	}

	cekValueCount := uint(r.byte())
	// not using ucs22str because we already know the data is utf16
	enc := unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM)
	utf16dec := enc.NewDecoder()
	cekValues := make([]encryptionKeyInfo, cekValueCount)

	for i := uint(0); i < cekValueCount; i++ {
		encryptedCekLength := r.uint16()
		encryptedCek := make([]byte, encryptedCekLength)
		r.ReadFull(encryptedCek)

		keyStoreLength := r.byte()
		keyStoreNameUtf16 := make([]byte, keyStoreLength*2)
		r.ReadFull(keyStoreNameUtf16)
		keyStoreName, _ := utf16dec.Bytes(keyStoreNameUtf16)

		keyPathLength := r.uint16()
		keyPathUtf16 := make([]byte, keyPathLength*2)
		r.ReadFull(keyPathUtf16)
		keyPath, _ := utf16dec.Bytes(keyPathUtf16)

		algLength := r.byte()
		algNameUtf16 := make([]byte, algLength*2)
		r.ReadFull(algNameUtf16)
		algName, _ := utf16dec.Bytes(algNameUtf16)

		cekValues[i] = encryptionKeyInfo{
			encryptedKey:  encryptedCek,
			databaseID:    int(databaseId),
			cekID:         int(cekID),
			cekVersion:    int(cekVersion),
			cekMdVersion:  cekMdVersion,
			keyPath:       string(keyPath),
			keyStoreName:  string(keyStoreName),
			algorithmName: string(algName),
		}
	}

	return cekTableEntry{
		databaseID: int(databaseId),
		keyId:      int(cekID),
		keyVersion: int(cekVersion),
		mdVersion:  cekMdVersion,
		valueCount: int(cekValueCount),
		cekValues:  cekValues,
	}
}

// http://msdn.microsoft.com/en-us/library/dd357254.aspx
func parseRow(ctx context.Context, r *tdsBuffer, s *tdsSession, columns []columnStruct, row []interface{}) error {
	for i, column := range columns {
		columnContent := column.ti.Reader(&column.ti, r, nil, s.encoding)
		if columnContent == nil {
			row[i] = columnContent
			continue
		}

		if column.isEncrypted() {
			buffer, err := decryptColumn(ctx, column, s, columnContent)
			if err != nil {
				return err
			}
			// Decrypt
			row[i] = column.cryptoMeta.typeInfo.Reader(&column.cryptoMeta.typeInfo, buffer, column.cryptoMeta, s.encoding)
		} else {
			row[i] = columnContent
		}
	}
	return nil
}

type RWCBuffer struct {
	buffer *bytes.Reader
}

func (R RWCBuffer) Read(p []byte) (n int, err error) {
	return R.buffer.Read(p)
}

func (R RWCBuffer) Write(p []byte) (n int, err error) {
	return 0, nil
}

func (R RWCBuffer) Close() error {
	return nil
}

func decryptColumn(ctx context.Context, column columnStruct, s *tdsSession, columnContent interface{}) (*tdsBuffer, error) {
	encType := encryption.From(column.cryptoMeta.encType)
	cekValue := column.cryptoMeta.entry.cekValues[column.cryptoMeta.ordinal]
	if (s.logFlags & uint64(msdsn.LogDebug)) == uint64(msdsn.LogDebug) {
		s.logger.Log(context.Background(), msdsn.LogDebug, fmt.Sprintf("Decrypting column %s. Key path: %s, Key store:%s, Algo: %s", column.ColName, cekValue.keyPath, cekValue.keyStoreName, cekValue.algorithmName))
	}

	cekProvider, ok := s.aeSettings.keyProviders[cekValue.keyStoreName]
	if !ok {
		// The app hasn't installed the key provider it needs
		panic(aecmk.NewError(aecmk.Decryption, fmt.Sprintf("Unable to find provider %s to decrypt CEK", cekValue.keyStoreName), nil))
	}
	cek, err := cekProvider.GetDecryptedKey(ctx, cekValue.keyPath, column.cryptoMeta.entry.cekValues[0].encryptedKey)
	if err != nil {
		return nil, err
	}
	k := keys.NewAeadAes256CbcHmac256(cek)
	alg := algorithms.NewAeadAes256CbcHmac256Algorithm(k, encType, byte(cekValue.cekVersion))
	d, err := alg.Decrypt(columnContent.([]byte))
	if err != nil {
		return nil, aecmk.NewError(aecmk.Decryption, "Unable to decrypt key using AES256", err)
	}

	// Decrypt returns a minimum of 8 bytes so truncate to the actual data size
	if column.cryptoMeta.typeInfo.Size > 0 && column.cryptoMeta.typeInfo.Size < len(d) {
		d = d[:column.cryptoMeta.typeInfo.Size]
	}
	var newBuff []byte
	newBuff = append(newBuff, d...)

	rwc := RWCBuffer{
		buffer: bytes.NewReader(newBuff),
	}

	column.cryptoMeta.typeInfo.Buffer = d
	buffer := tdsBuffer{rpos: 0, rsize: len(newBuff), rbuf: newBuff, transport: rwc}
	return &buffer, nil
}

// http://msdn.microsoft.com/en-us/library/dd304783.aspx
func parseNbcRow(ctx context.Context, r *tdsBuffer, s *tdsSession, columns []columnStruct, row []interface{}) error {
	bitlen := (len(columns) + 7) / 8
	pres := make([]byte, bitlen)
	r.ReadFull(pres)
	for i, col := range columns {
		if pres[i/8]&(1<<(uint(i)%8)) != 0 {
			row[i] = nil
			continue
		}
		columnContent := col.ti.Reader(&col.ti, r, nil, s.encoding)
		if col.isEncrypted() {
			buffer, err := decryptColumn(ctx, col, s, columnContent)
			if err != nil {
				return err
			}
			// Decrypt
			row[i] = col.cryptoMeta.typeInfo.Reader(&col.cryptoMeta.typeInfo, buffer, col.cryptoMeta, s.encoding)
		} else {
			row[i] = columnContent
		}
	}
	return nil
}

// http://msdn.microsoft.com/en-us/library/dd304156.aspx
func parseError72(r *tdsBuffer) (res Error) {
	length := r.uint16()
	_ = length // ignore length
	res.Number = r.int32()
	res.State = r.byte()
	res.Class = r.byte()
	res.Message = r.UsVarChar()
	res.ServerName = r.BVarChar()
	res.ProcName = r.BVarChar()
	res.LineNo = r.int32()
	return
}

// http://msdn.microsoft.com/en-us/library/dd304156.aspx
func parseInfo(r *tdsBuffer) (res Error) {
	length := r.uint16()
	_ = length // ignore length
	res.Number = r.int32()
	res.State = r.byte()
	res.Class = r.byte()
	res.Message = r.UsVarChar()
	res.ServerName = r.BVarChar()
	res.ProcName = r.BVarChar()
	res.LineNo = r.int32()
	return
}

// https://msdn.microsoft.com/en-us/library/dd303881.aspx
func parseReturnValue(r *tdsBuffer, s *tdsSession) (nv namedValue) {
	/*
		ParamOrdinal
		ParamName
		Status
		UserType
		Flags
		TypeInfo
		CryptoMetadata
		Value
	*/
	_ = r.uint16()         // ParamOrdinal
	nv.Name = r.BVarChar() // ParamName
	_ = r.byte()           // Status

	ti := getBaseTypeInfo(r, true) // UserType + Flags + TypeInfo

	var cryptoMetadata *cryptoMetadata = nil
	if s.alwaysEncrypted && (ti.Flags&fEncrypted) == fEncrypted {
		cm := parseCryptoMetadata(r, nil, s.encoding) // CryptoMetadata
		cryptoMetadata = &cm
	}

	ti2 := readTypeInfo(r, ti.TypeId, cryptoMetadata, s.encoding)
	nv.Value = ti2.Reader(&ti2, r, cryptoMetadata, s.encoding)

	return
}

func processSingleResponse(ctx context.Context, sess *tdsSession, ch chan tokenStruct, outs outputs) {
	defer func() {
		if err := recover(); err != nil {
			sess.LogF(ctx, msdsn.LogErrors, "intercepted panic: %v", err)
			if outs.msgq != nil {
				var derr error
				switch e := err.(type) {
				case error:
					derr = e
				default:
					derr = fmt.Errorf("unhandled session error: %v", e)
				}
				_ = sqlexp.ReturnMessageEnqueue(ctx, outs.msgq, sqlexp.MsgError{Error: derr})

			}
			ch <- err
		}
		close(ch)
	}()
	colsReceived := false
	packet_type, err := sess.buf.BeginRead()
	if err != nil {
		sess.LogF(ctx, msdsn.LogErrors, "BeginRead failed %v", err)
		switch e := err.(type) {
		case *net.OpError:
			err = e
		default:
			// the named pipe provider returns a raw win32 error so fake an OpError
			err = &net.OpError{Op: "Read", Err: err}
		}
		ch <- err
		return
	}
	if packet_type != packReply {
		badStreamPanic(fmt.Errorf("unexpected packet type in reply: got %v, expected %v", packet_type, packReply))
	}
	var columns []columnStruct
	errs := make([]Error, 0, 5)
	for tokens := 0; ; tokens += 1 {
		token := token(sess.buf.byte())
		sess.LogF(ctx, msdsn.LogDebug, "got token %v", token)
		switch token {
		case tokenSSPI:
			ch <- parseSSPIMsg(sess.buf)
			return
		case tokenFedAuthInfo:
			ch <- parseFedAuthInfo(sess.buf)
			return
		case tokenReturnStatus:
			returnStatus := parseReturnStatus(sess.buf)
			ch <- returnStatus
		case tokenLoginAck:
			loginAck := parseLoginAck(sess.buf)
			ch <- loginAck
		case tokenFeatureExtAck:
			featureExtAck := parseFeatureExtAck(sess.buf)
			ch <- featureExtAck
		case tokenOrder:
			order := parseOrder(sess.buf)
			ch <- order
		case tokenDoneInProc:
			done := parseDoneInProc(sess.buf)

			if done.Status&doneCount != 0 {
				sess.LogF(ctx, msdsn.LogRows, "(%d rows affected)", done.RowCount)

				if (colsReceived || done.CurCmd != cmdSelect) && outs.msgq != nil {
					_ = sqlexp.ReturnMessageEnqueue(ctx, outs.msgq, sqlexp.MsgRowsAffected{Count: int64(done.RowCount)})
				}
			}

			ch <- done

			if outs.msgq != nil {
				// For now we ignore ctx->Done errors that ReturnMessageEnqueue might return
				// It's not clear how to handle them correctly here, and data/sql seems
				// to set Rows.Err correctly when ctx expires already
				sess.LogF(ctx, msdsn.LogDebug, "queueing MsgNextResultSet after tokenDoneInProc")
				_ = sqlexp.ReturnMessageEnqueue(ctx, outs.msgq, sqlexp.MsgNextResultSet{})
			}
			colsReceived = false
			if done.Status&doneMore == 0 {
				// Rows marks the request as done when seeing this done token. We queue another result set message
				// so the app calls NextResultSet again which will return false.
				if outs.msgq != nil {
					sess.LogF(ctx, msdsn.LogDebug, "queueing MsgNextResultSet after tokenDoneInProc with doneMore=0")
					_ = sqlexp.ReturnMessageEnqueue(ctx, outs.msgq, sqlexp.MsgNextResultSet{})
				}
				return
			}
		case tokenDone, tokenDoneProc:
			done := parseDone(sess.buf)
			done.errors = errs
			if outs.msgq != nil {
				errs = make([]Error, 0, 5)
			}
			sess.LogF(ctx, msdsn.LogDebug, "got DONE or DONEPROC status=%d", done.Status)
			if done.Status&doneSrvError != 0 {
				ch <- ServerError{done.getError()}
				if outs.msgq != nil {
					sess.LogF(ctx, msdsn.LogDebug, "queueing MsgNextResultSet after tokenDone with doneSrvError")
					_ = sqlexp.ReturnMessageEnqueue(ctx, outs.msgq, sqlexp.MsgNextResultSet{})
				}
				return
			}
			if done.Status&doneCount != 0 {
				sess.LogF(ctx, msdsn.LogRows, "(Rows affected: %d)", done.RowCount)

				if (colsReceived || done.CurCmd != cmdSelect) && outs.msgq != nil {
					_ = sqlexp.ReturnMessageEnqueue(ctx, outs.msgq, sqlexp.MsgRowsAffected{Count: int64(done.RowCount)})
				}

			}

			ch <- done

			colsReceived = false
			if outs.msgq != nil {
				sess.LogF(ctx, msdsn.LogDebug, "queueing MsgNextResultSet after tokenDone or tokenDoneProc")
				_ = sqlexp.ReturnMessageEnqueue(ctx, outs.msgq, sqlexp.MsgNextResultSet{})
			}
			if done.Status&doneMore == 0 {
				// Rows marks the request as done when seeing this done token. We queue another result set message
				// so the app calls NextResultSet again which will return false.
				if outs.msgq != nil {
					sess.LogF(ctx, msdsn.LogDebug, "queueing MsgNextResultSet after tokenDone or tokenDoneProc with doneMore=0")
					_ = sqlexp.ReturnMessageEnqueue(ctx, outs.msgq, sqlexp.MsgNextResultSet{})
				}
				return
			}
		case tokenColMetadata:
			columns = parseColMetadata72(sess.buf, sess)
			ch <- columns
			colsReceived = true
			if outs.msgq != nil {
				_ = sqlexp.ReturnMessageEnqueue(ctx, outs.msgq, sqlexp.MsgNext{})
			}

		case tokenRow:
			row := make([]interface{}, len(columns))
			err = parseRow(ctx, sess.buf, sess, columns, row)
			if err != nil {
				ch <- err
				return
			}
			ch <- row
		case tokenNbcRow:
			row := make([]interface{}, len(columns))
			err = parseNbcRow(ctx, sess.buf, sess, columns, row)
			if err != nil {
				ch <- err
				return
			}
			ch <- row
		case tokenEnvChange:
			processEnvChg(ctx, sess)
		case tokenError:
			err := parseError72(sess.buf)
			sess.LogF(ctx, msdsn.LogDebug, "got ERROR %d %s", err.Number, err.Message)
			errs = append(errs, err)
			sess.LogS(ctx, msdsn.LogErrors, err.Message)
			if outs.msgq != nil {
				_ = sqlexp.ReturnMessageEnqueue(ctx, outs.msgq, sqlexp.MsgError{Error: err})
			}
		case tokenInfo:
			info := parseInfo(sess.buf)
			sess.LogF(ctx, msdsn.LogDebug, "got INFO %d %s", info.Number, info.Message)
			sess.LogS(ctx, msdsn.LogMessages, info.Message)
			if outs.msgq != nil {
				_ = sqlexp.ReturnMessageEnqueue(ctx, outs.msgq, sqlexp.MsgNotice{Message: info})
			}
		case tokenReturnValue:
			nv := parseReturnValue(sess.buf, sess)
			if len(nv.Name) > 0 {
				name := nv.Name[1:] // Remove the leading "@".
				if ov, has := outs.params[name]; has {
					err = scanIntoOut(name, nv.Value, ov)
					if err != nil {
						fmt.Println("scan error", err)
						ch <- err
					}
				}
			}
		default:
			badStreamPanic(fmt.Errorf("unknown token type returned: %v", token))
		}
	}
}

type tokenProcessor struct {
	tokChan    chan tokenStruct
	ctx        context.Context
	sess       *tdsSession
	outs       outputs
	lastRow    []interface{}
	rowCount   int64
	firstError error
	// whether to skip sending attention when ctx is done
	noAttn bool
}

func startReading(sess *tdsSession, ctx context.Context, outs outputs) *tokenProcessor {
	tokChan := make(chan tokenStruct, 5)
	go processSingleResponse(ctx, sess, tokChan, outs)
	return &tokenProcessor{
		tokChan: tokChan,
		ctx:     ctx,
		sess:    sess,
		outs:    outs,
	}
}

func (t *tokenProcessor) iterateResponse() error {
	for {
		tok, err := t.nextToken()
		if err == nil {
			if tok == nil {
				return t.firstError
			} else {
				switch token := tok.(type) {
				case []columnStruct:
					t.sess.columns = token
				case []interface{}:
					t.lastRow = token
				case doneInProcStruct:
					if token.Status&doneCount != 0 {
						t.rowCount += int64(token.RowCount)
					}
				case doneStruct:
					if token.Status&doneCount != 0 {
						t.rowCount += int64(token.RowCount)
					}
					if token.isError() && t.firstError == nil {
						t.firstError = token.getError()
					}
				case ReturnStatus:
					if t.outs.returnStatus != nil {
						*t.outs.returnStatus = token
					}
					/*case error:
					if resultError == nil {
						resultError = token
					}*/
				}
			}
		} else {
			return err
		}
	}
}

func (t tokenProcessor) nextToken() (tokenStruct, error) {
	// we do this separate non-blocking check on token channel to
	// prioritize it over cancellation channel
	select {
	case tok, more := <-t.tokChan:
		err, more := tok.(error)
		if more {
			t.sess.LogF(t.ctx, msdsn.LogDebug, "nextToken returned an error:"+err.Error())
			// this is an error and not a token
			return nil, err
		} else {
			return tok, nil
		}
	default:
		// there are no tokens on the channel, will need to wait
	}

	select {
	case tok, more := <-t.tokChan:
		if more {
			err, ok := tok.(error)
			if ok {
				return nil, err
			} else {
				return tok, nil
			}
		} else {
			// completed reading response
			return nil, nil
		}
	case <-t.ctx.Done():
		if t.noAttn {
			return nil, t.ctx.Err()
		}
		t.sess.LogF(t.ctx, msdsn.LogDebug, "Sending attention to the server")
		if err := sendAttention(t.sess.buf); err != nil {
			// unable to send attention, current connection is bad
			// notify caller and close channel
			return nil, err
		}

		// now the server should send cancellation confirmation
		// it is possible that we already received full response
		// just before we sent cancellation request
		// in this case current response would not contain confirmation
		// and we would need to read one more response

		// first lets finish reading current response and look
		// for confirmation in it
		if readCancelConfirmation(t.tokChan) {
			// we got confirmation in current response
			return nil, t.ctx.Err()
		}
		// we did not get cancellation confirmation in the current response
		// read one more response, it must be there
		t.tokChan = make(chan tokenStruct, 5)
		go processSingleResponse(t.ctx, t.sess, t.tokChan, t.outs)
		if readCancelConfirmation(t.tokChan) {
			return nil, t.ctx.Err()
		}
		// we did not get cancellation confirmation, something is not
		// right, this connection is not usable anymore
		return nil, ServerError{Error{Message: "did not get cancellation confirmation from the server"}}
	}
}

func readCancelConfirmation(tokChan chan tokenStruct) bool {
	for tok := range tokChan {
		switch tok := tok.(type) {
		default:
		// just skip token
		case doneStruct:
			if tok.Status&doneAttn != 0 {
				// got cancellation confirmation, exit
				return true
			}
		}
	}
	return false
}
