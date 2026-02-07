package pgproto3

import (
	"bytes"
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync"
	"time"
)

// tracer traces the messages send to and from a Backend or Frontend. The format it produces roughly mimics the
// format produced by the libpq C function PQtrace.
type tracer struct {
	TracerOptions

	mux sync.Mutex
	w   io.Writer
	buf *bytes.Buffer
}

// TracerOptions controls tracing behavior. It is roughly equivalent to the libpq function PQsetTraceFlags.
type TracerOptions struct {
	// SuppressTimestamps prevents printing of timestamps.
	SuppressTimestamps bool

	// RegressMode redacts fields that may be vary between executions.
	RegressMode bool
}

func (t *tracer) traceMessage(sender byte, encodedLen int32, msg Message) {
	switch msg := msg.(type) {
	case *AuthenticationCleartextPassword:
		t.traceAuthenticationCleartextPassword(sender, encodedLen, msg)
	case *AuthenticationGSS:
		t.traceAuthenticationGSS(sender, encodedLen, msg)
	case *AuthenticationGSSContinue:
		t.traceAuthenticationGSSContinue(sender, encodedLen, msg)
	case *AuthenticationMD5Password:
		t.traceAuthenticationMD5Password(sender, encodedLen, msg)
	case *AuthenticationOk:
		t.traceAuthenticationOk(sender, encodedLen, msg)
	case *AuthenticationSASL:
		t.traceAuthenticationSASL(sender, encodedLen, msg)
	case *AuthenticationSASLContinue:
		t.traceAuthenticationSASLContinue(sender, encodedLen, msg)
	case *AuthenticationSASLFinal:
		t.traceAuthenticationSASLFinal(sender, encodedLen, msg)
	case *BackendKeyData:
		t.traceBackendKeyData(sender, encodedLen, msg)
	case *Bind:
		t.traceBind(sender, encodedLen, msg)
	case *BindComplete:
		t.traceBindComplete(sender, encodedLen, msg)
	case *CancelRequest:
		t.traceCancelRequest(sender, encodedLen, msg)
	case *Close:
		t.traceClose(sender, encodedLen, msg)
	case *CloseComplete:
		t.traceCloseComplete(sender, encodedLen, msg)
	case *CommandComplete:
		t.traceCommandComplete(sender, encodedLen, msg)
	case *CopyBothResponse:
		t.traceCopyBothResponse(sender, encodedLen, msg)
	case *CopyData:
		t.traceCopyData(sender, encodedLen, msg)
	case *CopyDone:
		t.traceCopyDone(sender, encodedLen, msg)
	case *CopyFail:
		t.traceCopyFail(sender, encodedLen, msg)
	case *CopyInResponse:
		t.traceCopyInResponse(sender, encodedLen, msg)
	case *CopyOutResponse:
		t.traceCopyOutResponse(sender, encodedLen, msg)
	case *DataRow:
		t.traceDataRow(sender, encodedLen, msg)
	case *Describe:
		t.traceDescribe(sender, encodedLen, msg)
	case *EmptyQueryResponse:
		t.traceEmptyQueryResponse(sender, encodedLen, msg)
	case *ErrorResponse:
		t.traceErrorResponse(sender, encodedLen, msg)
	case *Execute:
		t.TraceQueryute(sender, encodedLen, msg)
	case *Flush:
		t.traceFlush(sender, encodedLen, msg)
	case *FunctionCall:
		t.traceFunctionCall(sender, encodedLen, msg)
	case *FunctionCallResponse:
		t.traceFunctionCallResponse(sender, encodedLen, msg)
	case *GSSEncRequest:
		t.traceGSSEncRequest(sender, encodedLen, msg)
	case *NoData:
		t.traceNoData(sender, encodedLen, msg)
	case *NoticeResponse:
		t.traceNoticeResponse(sender, encodedLen, msg)
	case *NotificationResponse:
		t.traceNotificationResponse(sender, encodedLen, msg)
	case *ParameterDescription:
		t.traceParameterDescription(sender, encodedLen, msg)
	case *ParameterStatus:
		t.traceParameterStatus(sender, encodedLen, msg)
	case *Parse:
		t.traceParse(sender, encodedLen, msg)
	case *ParseComplete:
		t.traceParseComplete(sender, encodedLen, msg)
	case *PortalSuspended:
		t.tracePortalSuspended(sender, encodedLen, msg)
	case *Query:
		t.traceQuery(sender, encodedLen, msg)
	case *ReadyForQuery:
		t.traceReadyForQuery(sender, encodedLen, msg)
	case *RowDescription:
		t.traceRowDescription(sender, encodedLen, msg)
	case *SSLRequest:
		t.traceSSLRequest(sender, encodedLen, msg)
	case *StartupMessage:
		t.traceStartupMessage(sender, encodedLen, msg)
	case *Sync:
		t.traceSync(sender, encodedLen, msg)
	case *Terminate:
		t.traceTerminate(sender, encodedLen, msg)
	default:
		t.writeTrace(sender, encodedLen, "Unknown", nil)
	}
}

func (t *tracer) traceAuthenticationCleartextPassword(sender byte, encodedLen int32, msg *AuthenticationCleartextPassword) {
	t.writeTrace(sender, encodedLen, "AuthenticationCleartextPassword", nil)
}

func (t *tracer) traceAuthenticationGSS(sender byte, encodedLen int32, msg *AuthenticationGSS) {
	t.writeTrace(sender, encodedLen, "AuthenticationGSS", nil)
}

func (t *tracer) traceAuthenticationGSSContinue(sender byte, encodedLen int32, msg *AuthenticationGSSContinue) {
	t.writeTrace(sender, encodedLen, "AuthenticationGSSContinue", nil)
}

func (t *tracer) traceAuthenticationMD5Password(sender byte, encodedLen int32, msg *AuthenticationMD5Password) {
	t.writeTrace(sender, encodedLen, "AuthenticationMD5Password", nil)
}

func (t *tracer) traceAuthenticationOk(sender byte, encodedLen int32, msg *AuthenticationOk) {
	t.writeTrace(sender, encodedLen, "AuthenticationOk", nil)
}

func (t *tracer) traceAuthenticationSASL(sender byte, encodedLen int32, msg *AuthenticationSASL) {
	t.writeTrace(sender, encodedLen, "AuthenticationSASL", nil)
}

func (t *tracer) traceAuthenticationSASLContinue(sender byte, encodedLen int32, msg *AuthenticationSASLContinue) {
	t.writeTrace(sender, encodedLen, "AuthenticationSASLContinue", nil)
}

func (t *tracer) traceAuthenticationSASLFinal(sender byte, encodedLen int32, msg *AuthenticationSASLFinal) {
	t.writeTrace(sender, encodedLen, "AuthenticationSASLFinal", nil)
}

func (t *tracer) traceBackendKeyData(sender byte, encodedLen int32, msg *BackendKeyData) {
	t.writeTrace(sender, encodedLen, "BackendKeyData", func() {
		if t.RegressMode {
			t.buf.WriteString("\t NNNN NNNN")
		} else {
			fmt.Fprintf(t.buf, "\t %d %d", msg.ProcessID, msg.SecretKey)
		}
	})
}

func (t *tracer) traceBind(sender byte, encodedLen int32, msg *Bind) {
	t.writeTrace(sender, encodedLen, "Bind", func() {
		fmt.Fprintf(t.buf, "\t %s %s %d", traceDoubleQuotedString([]byte(msg.DestinationPortal)), traceDoubleQuotedString([]byte(msg.PreparedStatement)), len(msg.ParameterFormatCodes))
		for _, fc := range msg.ParameterFormatCodes {
			fmt.Fprintf(t.buf, " %d", fc)
		}
		fmt.Fprintf(t.buf, " %d", len(msg.Parameters))
		for _, p := range msg.Parameters {
			fmt.Fprintf(t.buf, " %s", traceSingleQuotedString(p))
		}
		fmt.Fprintf(t.buf, " %d", len(msg.ResultFormatCodes))
		for _, fc := range msg.ResultFormatCodes {
			fmt.Fprintf(t.buf, " %d", fc)
		}
	})
}

func (t *tracer) traceBindComplete(sender byte, encodedLen int32, msg *BindComplete) {
	t.writeTrace(sender, encodedLen, "BindComplete", nil)
}

func (t *tracer) traceCancelRequest(sender byte, encodedLen int32, msg *CancelRequest) {
	t.writeTrace(sender, encodedLen, "CancelRequest", nil)
}

func (t *tracer) traceClose(sender byte, encodedLen int32, msg *Close) {
	t.writeTrace(sender, encodedLen, "Close", nil)
}

func (t *tracer) traceCloseComplete(sender byte, encodedLen int32, msg *CloseComplete) {
	t.writeTrace(sender, encodedLen, "CloseComplete", nil)
}

func (t *tracer) traceCommandComplete(sender byte, encodedLen int32, msg *CommandComplete) {
	t.writeTrace(sender, encodedLen, "CommandComplete", func() {
		fmt.Fprintf(t.buf, "\t %s", traceDoubleQuotedString(msg.CommandTag))
	})
}

func (t *tracer) traceCopyBothResponse(sender byte, encodedLen int32, msg *CopyBothResponse) {
	t.writeTrace(sender, encodedLen, "CopyBothResponse", nil)
}

func (t *tracer) traceCopyData(sender byte, encodedLen int32, msg *CopyData) {
	t.writeTrace(sender, encodedLen, "CopyData", nil)
}

func (t *tracer) traceCopyDone(sender byte, encodedLen int32, msg *CopyDone) {
	t.writeTrace(sender, encodedLen, "CopyDone", nil)
}

func (t *tracer) traceCopyFail(sender byte, encodedLen int32, msg *CopyFail) {
	t.writeTrace(sender, encodedLen, "CopyFail", func() {
		fmt.Fprintf(t.buf, "\t %s", traceDoubleQuotedString([]byte(msg.Message)))
	})
}

func (t *tracer) traceCopyInResponse(sender byte, encodedLen int32, msg *CopyInResponse) {
	t.writeTrace(sender, encodedLen, "CopyInResponse", nil)
}

func (t *tracer) traceCopyOutResponse(sender byte, encodedLen int32, msg *CopyOutResponse) {
	t.writeTrace(sender, encodedLen, "CopyOutResponse", nil)
}

func (t *tracer) traceDataRow(sender byte, encodedLen int32, msg *DataRow) {
	t.writeTrace(sender, encodedLen, "DataRow", func() {
		fmt.Fprintf(t.buf, "\t %d", len(msg.Values))
		for _, v := range msg.Values {
			if v == nil {
				t.buf.WriteString(" -1")
			} else {
				fmt.Fprintf(t.buf, " %d %s", len(v), traceSingleQuotedString(v))
			}
		}
	})
}

func (t *tracer) traceDescribe(sender byte, encodedLen int32, msg *Describe) {
	t.writeTrace(sender, encodedLen, "Describe", func() {
		fmt.Fprintf(t.buf, "\t %c %s", msg.ObjectType, traceDoubleQuotedString([]byte(msg.Name)))
	})
}

func (t *tracer) traceEmptyQueryResponse(sender byte, encodedLen int32, msg *EmptyQueryResponse) {
	t.writeTrace(sender, encodedLen, "EmptyQueryResponse", nil)
}

func (t *tracer) traceErrorResponse(sender byte, encodedLen int32, msg *ErrorResponse) {
	t.writeTrace(sender, encodedLen, "ErrorResponse", nil)
}

func (t *tracer) TraceQueryute(sender byte, encodedLen int32, msg *Execute) {
	t.writeTrace(sender, encodedLen, "Execute", func() {
		fmt.Fprintf(t.buf, "\t %s %d", traceDoubleQuotedString([]byte(msg.Portal)), msg.MaxRows)
	})
}

func (t *tracer) traceFlush(sender byte, encodedLen int32, msg *Flush) {
	t.writeTrace(sender, encodedLen, "Flush", nil)
}

func (t *tracer) traceFunctionCall(sender byte, encodedLen int32, msg *FunctionCall) {
	t.writeTrace(sender, encodedLen, "FunctionCall", nil)
}

func (t *tracer) traceFunctionCallResponse(sender byte, encodedLen int32, msg *FunctionCallResponse) {
	t.writeTrace(sender, encodedLen, "FunctionCallResponse", nil)
}

func (t *tracer) traceGSSEncRequest(sender byte, encodedLen int32, msg *GSSEncRequest) {
	t.writeTrace(sender, encodedLen, "GSSEncRequest", nil)
}

func (t *tracer) traceNoData(sender byte, encodedLen int32, msg *NoData) {
	t.writeTrace(sender, encodedLen, "NoData", nil)
}

func (t *tracer) traceNoticeResponse(sender byte, encodedLen int32, msg *NoticeResponse) {
	t.writeTrace(sender, encodedLen, "NoticeResponse", nil)
}

func (t *tracer) traceNotificationResponse(sender byte, encodedLen int32, msg *NotificationResponse) {
	t.writeTrace(sender, encodedLen, "NotificationResponse", func() {
		fmt.Fprintf(t.buf, "\t %d %s %s", msg.PID, traceDoubleQuotedString([]byte(msg.Channel)), traceDoubleQuotedString([]byte(msg.Payload)))
	})
}

func (t *tracer) traceParameterDescription(sender byte, encodedLen int32, msg *ParameterDescription) {
	t.writeTrace(sender, encodedLen, "ParameterDescription", nil)
}

func (t *tracer) traceParameterStatus(sender byte, encodedLen int32, msg *ParameterStatus) {
	t.writeTrace(sender, encodedLen, "ParameterStatus", func() {
		fmt.Fprintf(t.buf, "\t %s %s", traceDoubleQuotedString([]byte(msg.Name)), traceDoubleQuotedString([]byte(msg.Value)))
	})
}

func (t *tracer) traceParse(sender byte, encodedLen int32, msg *Parse) {
	t.writeTrace(sender, encodedLen, "Parse", func() {
		fmt.Fprintf(t.buf, "\t %s %s %d", traceDoubleQuotedString([]byte(msg.Name)), traceDoubleQuotedString([]byte(msg.Query)), len(msg.ParameterOIDs))
		for _, oid := range msg.ParameterOIDs {
			fmt.Fprintf(t.buf, " %d", oid)
		}
	})
}

func (t *tracer) traceParseComplete(sender byte, encodedLen int32, msg *ParseComplete) {
	t.writeTrace(sender, encodedLen, "ParseComplete", nil)
}

func (t *tracer) tracePortalSuspended(sender byte, encodedLen int32, msg *PortalSuspended) {
	t.writeTrace(sender, encodedLen, "PortalSuspended", nil)
}

func (t *tracer) traceQuery(sender byte, encodedLen int32, msg *Query) {
	t.writeTrace(sender, encodedLen, "Query", func() {
		fmt.Fprintf(t.buf, "\t %s", traceDoubleQuotedString([]byte(msg.String)))
	})
}

func (t *tracer) traceReadyForQuery(sender byte, encodedLen int32, msg *ReadyForQuery) {
	t.writeTrace(sender, encodedLen, "ReadyForQuery", func() {
		fmt.Fprintf(t.buf, "\t %c", msg.TxStatus)
	})
}

func (t *tracer) traceRowDescription(sender byte, encodedLen int32, msg *RowDescription) {
	t.writeTrace(sender, encodedLen, "RowDescription", func() {
		fmt.Fprintf(t.buf, "\t %d", len(msg.Fields))
		for _, fd := range msg.Fields {
			fmt.Fprintf(t.buf, ` %s %d %d %d %d %d %d`, traceDoubleQuotedString(fd.Name), fd.TableOID, fd.TableAttributeNumber, fd.DataTypeOID, fd.DataTypeSize, fd.TypeModifier, fd.Format)
		}
	})
}

func (t *tracer) traceSSLRequest(sender byte, encodedLen int32, msg *SSLRequest) {
	t.writeTrace(sender, encodedLen, "SSLRequest", nil)
}

func (t *tracer) traceStartupMessage(sender byte, encodedLen int32, msg *StartupMessage) {
	t.writeTrace(sender, encodedLen, "StartupMessage", nil)
}

func (t *tracer) traceSync(sender byte, encodedLen int32, msg *Sync) {
	t.writeTrace(sender, encodedLen, "Sync", nil)
}

func (t *tracer) traceTerminate(sender byte, encodedLen int32, msg *Terminate) {
	t.writeTrace(sender, encodedLen, "Terminate", nil)
}

func (t *tracer) writeTrace(sender byte, encodedLen int32, msgType string, writeDetails func()) {
	t.mux.Lock()
	defer t.mux.Unlock()
	defer func() {
		if t.buf.Cap() > 1024 {
			t.buf = &bytes.Buffer{}
		} else {
			t.buf.Reset()
		}
	}()

	if !t.SuppressTimestamps {
		now := time.Now()
		t.buf.WriteString(now.Format("2006-01-02 15:04:05.000000"))
		t.buf.WriteByte('\t')
	}

	t.buf.WriteByte(sender)
	t.buf.WriteByte('\t')
	t.buf.WriteString(msgType)
	t.buf.WriteByte('\t')
	t.buf.WriteString(strconv.FormatInt(int64(encodedLen), 10))

	if writeDetails != nil {
		writeDetails()
	}

	t.buf.WriteByte('\n')
	t.buf.WriteTo(t.w)
}

// traceDoubleQuotedString returns t.buf as a double-quoted string without any escaping. It is roughly equivalent to
// pqTraceOutputString in libpq.
func traceDoubleQuotedString(buf []byte) string {
	return `"` + string(buf) + `"`
}

// traceSingleQuotedString returns buf as a single-quoted string with non-printable characters hex-escaped. It is
// roughly equivalent to pqTraceOutputNchar in libpq.
func traceSingleQuotedString(buf []byte) string {
	sb := &strings.Builder{}

	sb.WriteByte('\'')
	for _, b := range buf {
		if b < 32 || b > 126 {
			fmt.Fprintf(sb, `\x%x`, b)
		} else {
			sb.WriteByte(b)
		}
	}
	sb.WriteByte('\'')

	return sb.String()
}
