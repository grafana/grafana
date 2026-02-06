package mssql

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/microsoft/go-mssqldb/aecmk"
	"github.com/microsoft/go-mssqldb/msdsn"
)

func newSession(outbuf *tdsBuffer, logger ContextLogger, p msdsn.Config) *tdsSession {
	sess := &tdsSession{
		buf:        outbuf,
		logger:     logger,
		logFlags:   uint64(p.LogFlags),
		aeSettings: &alwaysEncryptedSettings{keyProviders: aecmk.GetGlobalCekProviders()},
		encoding:   p.Encoding,
	}
	_ = sess.activityid.Scan(p.ActivityID)
	// generating a guid has a small chance of failure. Make a best effort
	connid, cerr := uuid.NewRandom()
	if cerr == nil {
		_ = sess.connid.Scan(connid[:])
	}

	return sess
}

func (s *tdsSession) preparePreloginFields(ctx context.Context, p msdsn.Config, fe *featureExtFedAuth) map[uint8][]byte {
	instance_buf := []byte(p.Instance)
	instance_buf = append(instance_buf, 0) // zero terminate instance name

	var encrypt byte
	switch p.Encryption {
	default:
		panic(fmt.Errorf("unsupported encryption config %v", p.Encryption))
	case msdsn.EncryptionDisabled:
		encrypt = encryptNotSup
	case msdsn.EncryptionRequired:
		encrypt = encryptOn
	case msdsn.EncryptionOff:
		encrypt = encryptOff
	case msdsn.EncryptionStrict:
		encrypt = encryptStrict
	}
	v := getDriverVersion(driverVersion)
	fields := map[uint8][]byte{
		// 4 bytes for version and 2 bytes for minor version
		preloginVERSION:    {byte(v), byte(v >> 8), byte(v >> 16), byte(v >> 24), 0, 0},
		preloginENCRYPTION: {encrypt},
		preloginINSTOPT:    instance_buf,
		preloginTHREADID:   {0, 0, 0, 0},
		preloginMARS:       {0}, // MARS disabled
	}

	if !p.NoTraceID {
		traceID := make([]byte, 36) // 16 byte connection id + 16 byte activity id + 4 byte sequence number
		connid, _ := s.connid.Value()
		activityid, _ := s.activityid.Value()
		_ = copy(traceID[:16], connid.([]byte))
		_ = copy(traceID[16:32], activityid.([]byte))
		fields[preloginTRACEID] = traceID
		if (s.logFlags)&logDebug != 0 {
			msg := fmt.Sprintf("Creating prelogin packet with connection id '%s' and activity id '%s'", s.connid, s.activityid)
			s.logger.Log(ctx, msdsn.LogDebug, msg)
		}
	}
	if fe.FedAuthLibrary != FedAuthLibraryReserved {
		fields[preloginFEDAUTHREQUIRED] = []byte{1}
	}

	return fields
}

type logFunc func() string

func (s *tdsSession) logPrefix() string {
	if s.logFlags&uint64(msdsn.LogSessionIDs) != 0 {
		return fmt.Sprintf("aid:%v cid:%v - ", s.activityid, s.connid)
	}
	return ""
}

func (s *tdsSession) LogS(ctx context.Context, category msdsn.Log, msg string) {
	s.Log(ctx, category, func() string { return msg })
}

// Log checks that the session logFlags includes the category before evaluating the logFunc and emitting the trace
func (s *tdsSession) Log(ctx context.Context, category msdsn.Log, logFunc logFunc) {
	if s.logFlags&uint64(category) != 0 {
		s.logger.Log(ctx, category, s.logPrefix()+logFunc())
	}
}

// LogF checks that the session logFlags includes the category before calling fmt.Sprintf and emitting the trace
func (s *tdsSession) LogF(ctx context.Context, category msdsn.Log, format string, a ...any) {
	if s.logFlags&uint64(category) != 0 {
		s.logger.Log(ctx, category, s.logPrefix()+fmt.Sprintf(format, a...))
	}
}
