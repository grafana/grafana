package mssql

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
)

//go:generate stringer -type token

type token byte

// token ids
const (
	tokenReturnStatus token = 121 // 0x79
	tokenColMetadata  token = 129 // 0x81
	tokenOrder        token = 169 // 0xA9
	tokenError        token = 170 // 0xAA
	tokenInfo         token = 171 // 0xAB
	tokenReturnValue  token = 0xAC
	tokenLoginAck     token = 173 // 0xad
	tokenRow          token = 209 // 0xd1
	tokenNbcRow       token = 210 // 0xd2
	tokenEnvChange    token = 227 // 0xE3
	tokenSSPI         token = 237 // 0xED
	tokenDone         token = 253 // 0xFD
	tokenDoneProc     token = 254
	tokenDoneInProc   token = 255
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

// COLMETADATA flags
// https://msdn.microsoft.com/en-us/library/dd357363.aspx
const (
	colFlagNullable = 1
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
	if len(d.errors) > 0 {
		return d.errors[len(d.errors)-1]
	} else {
		return Error{Message: "Request failed but didn't provide reason"}
	}
}

type doneInProcStruct doneStruct

var doneFlags2str = map[uint16]string{
	doneFinal:    "final",
	doneMore:     "more",
	doneError:    "error",
	doneInxact:   "inxact",
	doneCount:    "count",
	doneAttn:     "attn",
	doneSrvError: "srverror",
}

func doneFlags2Str(flags uint16) string {
	strs := make([]string, 0, len(doneFlags2str))
	for flag, tag := range doneFlags2str {
		if flags&flag != 0 {
			strs = append(strs, tag)
		}
	}
	return strings.Join(strs, "|")
}

// ENVCHANGE stream
// http://msdn.microsoft.com/en-us/library/dd303449.aspx
func processEnvChg(sess *tdsSession) {
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
			if sess.logFlags&logTransaction != 0 {
				sess.log.Printf("BEGIN TRANSACTION %x\n", sess.tranid)
			}
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
			if sess.logFlags&logTransaction != 0 {
				if envtype == envTypCommitTran {
					sess.log.Printf("COMMIT TRANSACTION %x\n", sess.tranid)
				} else {
					sess.log.Printf("ROLLBACK TRANSACTION %x\n", sess.tranid)
				}
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
			sess.log.Printf("WARN: Unknown ENVCHANGE record detected with type id = %d\n", envtype)
			break
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

// http://msdn.microsoft.com/en-us/library/dd357363.aspx
func parseColMetadata72(r *tdsBuffer) (columns []columnStruct) {
	count := r.uint16()
	if count == 0xffff {
		// no metadata is sent
		return nil
	}
	columns = make([]columnStruct, count)
	for i := range columns {
		column := &columns[i]
		column.UserType = r.uint32()
		column.Flags = r.uint16()

		// parsing TYPE_INFO structure
		column.ti = readTypeInfo(r)
		column.ColName = r.BVarChar()
	}
	return columns
}

// http://msdn.microsoft.com/en-us/library/dd357254.aspx
func parseRow(r *tdsBuffer, columns []columnStruct, row []interface{}) {
	for i, column := range columns {
		row[i] = column.ti.Reader(&column.ti, r)
	}
}

// http://msdn.microsoft.com/en-us/library/dd304783.aspx
func parseNbcRow(r *tdsBuffer, columns []columnStruct, row []interface{}) {
	bitlen := (len(columns) + 7) / 8
	pres := make([]byte, bitlen)
	r.ReadFull(pres)
	for i, col := range columns {
		if pres[i/8]&(1<<(uint(i)%8)) != 0 {
			row[i] = nil
			continue
		}
		row[i] = col.ti.Reader(&col.ti, r)
	}
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
func parseReturnValue(r *tdsBuffer) (nv namedValue) {
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
	r.uint16()
	nv.Name = r.BVarChar()
	r.byte()
	r.uint32() // UserType (uint16 prior to 7.2)
	r.uint16()
	ti := readTypeInfo(r)
	nv.Value = ti.Reader(&ti, r)
	return
}

func processSingleResponse(sess *tdsSession, ch chan tokenStruct, outs map[string]interface{}) {
	defer func() {
		if err := recover(); err != nil {
			if sess.logFlags&logErrors != 0 {
				sess.log.Printf("ERROR: Intercepted panic %v", err)
			}
			ch <- err
		}
		close(ch)
	}()

	packet_type, err := sess.buf.BeginRead()
	if err != nil {
		if sess.logFlags&logErrors != 0 {
			sess.log.Printf("ERROR: BeginRead failed %v", err)
		}
		ch <- err
		return
	}
	if packet_type != packReply {
		badStreamPanic(fmt.Errorf("unexpected packet type in reply: got %v, expected %v", packet_type, packReply))
	}
	var columns []columnStruct
	errs := make([]Error, 0, 5)
	for {
		token := token(sess.buf.byte())
		if sess.logFlags&logDebug != 0 {
			sess.log.Printf("got token %v", token)
		}
		switch token {
		case tokenSSPI:
			ch <- parseSSPIMsg(sess.buf)
			return
		case tokenReturnStatus:
			returnStatus := parseReturnStatus(sess.buf)
			ch <- returnStatus
		case tokenLoginAck:
			loginAck := parseLoginAck(sess.buf)
			ch <- loginAck
		case tokenOrder:
			order := parseOrder(sess.buf)
			ch <- order
		case tokenDoneInProc:
			done := parseDoneInProc(sess.buf)
			if sess.logFlags&logRows != 0 && done.Status&doneCount != 0 {
				sess.log.Printf("(%d row(s) affected)\n", done.RowCount)
			}
			ch <- done
		case tokenDone, tokenDoneProc:
			done := parseDone(sess.buf)
			done.errors = errs
			if sess.logFlags&logDebug != 0 {
				sess.log.Printf("got DONE or DONEPROC status=%d", done.Status)
			}
			if done.Status&doneSrvError != 0 {
				ch <- errors.New("SQL Server had internal error")
				return
			}
			if sess.logFlags&logRows != 0 && done.Status&doneCount != 0 {
				sess.log.Printf("(%d row(s) affected)\n", done.RowCount)
			}
			ch <- done
			if done.Status&doneMore == 0 {
				return
			}
		case tokenColMetadata:
			columns = parseColMetadata72(sess.buf)
			ch <- columns
		case tokenRow:
			row := make([]interface{}, len(columns))
			parseRow(sess.buf, columns, row)
			ch <- row
		case tokenNbcRow:
			row := make([]interface{}, len(columns))
			parseNbcRow(sess.buf, columns, row)
			ch <- row
		case tokenEnvChange:
			processEnvChg(sess)
		case tokenError:
			err := parseError72(sess.buf)
			if sess.logFlags&logDebug != 0 {
				sess.log.Printf("got ERROR %d %s", err.Number, err.Message)
			}
			errs = append(errs, err)
			if sess.logFlags&logErrors != 0 {
				sess.log.Println(err.Message)
			}
		case tokenInfo:
			info := parseInfo(sess.buf)
			if sess.logFlags&logDebug != 0 {
				sess.log.Printf("got INFO %d %s", info.Number, info.Message)
			}
			if sess.logFlags&logMessages != 0 {
				sess.log.Println(info.Message)
			}
		case tokenReturnValue:
			nv := parseReturnValue(sess.buf)
			if len(nv.Name) > 0 {
				name := nv.Name[1:] // Remove the leading "@".
				if ov, has := outs[name]; has {
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

type parseRespIter byte

const (
	parseRespIterContinue parseRespIter = iota // Continue parsing current token.
	parseRespIterNext                          // Fetch the next token.
	parseRespIterDone                          // Done with parsing the response.
)

type parseRespState byte

const (
	parseRespStateNormal  parseRespState = iota // Normal response state.
	parseRespStateCancel                        // Query is canceled, wait for server to confirm.
	parseRespStateClosing                       // Waiting for tokens to come through.
)

type parseResp struct {
	sess        *tdsSession
	ctxDone     <-chan struct{}
	state       parseRespState
	cancelError error
}

func (ts *parseResp) sendAttention(ch chan tokenStruct) parseRespIter {
	if err := sendAttention(ts.sess.buf); err != nil {
		ts.dlogf("failed to send attention signal %v", err)
		ch <- err
		return parseRespIterDone
	}
	ts.state = parseRespStateCancel
	return parseRespIterContinue
}

func (ts *parseResp) dlog(msg string) {
	if ts.sess.logFlags&logDebug != 0 {
		ts.sess.log.Println(msg)
	}
}
func (ts *parseResp) dlogf(f string, v ...interface{}) {
	if ts.sess.logFlags&logDebug != 0 {
		ts.sess.log.Printf(f, v...)
	}
}

func (ts *parseResp) iter(ctx context.Context, ch chan tokenStruct, tokChan chan tokenStruct) parseRespIter {
	switch ts.state {
	default:
		panic("unknown state")
	case parseRespStateNormal:
		select {
		case tok, ok := <-tokChan:
			if !ok {
				ts.dlog("response finished")
				return parseRespIterDone
			}
			if err, ok := tok.(net.Error); ok && err.Timeout() {
				ts.cancelError = err
				ts.dlog("got timeout error, sending attention signal to server")
				return ts.sendAttention(ch)
			}
			// Pass the token along.
			ch <- tok
			return parseRespIterContinue

		case <-ts.ctxDone:
			ts.ctxDone = nil
			ts.dlog("got cancel message, sending attention signal to server")
			return ts.sendAttention(ch)
		}
	case parseRespStateCancel: // Read all responses until a DONE or error is received.Auth
		select {
		case tok, ok := <-tokChan:
			if !ok {
				ts.dlog("response finished but waiting for attention ack")
				return parseRespIterNext
			}
			switch tok := tok.(type) {
			default:
				// Ignore all other tokens while waiting.
				// The TDS spec says other tokens may arrive after an attention
				// signal is sent. Ignore these tokens and continue looking for
				// a DONE with attention confirm mark.
			case doneStruct:
				if tok.Status&doneAttn != 0 {
					ts.dlog("got cancellation confirmation from server")
					if ts.cancelError != nil {
						ch <- ts.cancelError
						ts.cancelError = nil
					} else {
						ch <- ctx.Err()
					}
					return parseRespIterDone
				}

			// If an error happens during cancel, pass it along and just stop.
			// We are uncertain to receive more tokens.
			case error:
				ch <- tok
				ts.state = parseRespStateClosing
			}
			return parseRespIterContinue
		case <-ts.ctxDone:
			ts.ctxDone = nil
			ts.state = parseRespStateClosing
			return parseRespIterContinue
		}
	case parseRespStateClosing: // Wait for current token chan to close.
		if _, ok := <-tokChan; !ok {
			ts.dlog("response finished")
			return parseRespIterDone
		}
		return parseRespIterContinue
	}
}

func processResponse(ctx context.Context, sess *tdsSession, ch chan tokenStruct, outs map[string]interface{}) {
	ts := &parseResp{
		sess:    sess,
		ctxDone: ctx.Done(),
	}
	defer func() {
		// Ensure any remaining error is piped through
		// or the query may look like it executed when it actually failed.
		if ts.cancelError != nil {
			ch <- ts.cancelError
			ts.cancelError = nil
		}
		close(ch)
	}()

	// Loop over multiple responses.
	for {
		ts.dlog("initiating response reading")

		tokChan := make(chan tokenStruct)
		go processSingleResponse(sess, tokChan, outs)

		// Loop over multiple tokens in response.
	tokensLoop:
		for {
			switch ts.iter(ctx, ch, tokChan) {
			case parseRespIterContinue:
				// Nothing, continue to next token.
			case parseRespIterNext:
				break tokensLoop
			case parseRespIterDone:
				return
			}
		}
	}
}
