package mssql

import (
	"context"
	"database/sql/driver"
	"encoding/binary"
	"fmt"
	"io"
	"strings"

	"github.com/microsoft/go-mssqldb/internal/github.com/swisscom/mssql-always-encrypted/pkg/algorithms"
	"github.com/microsoft/go-mssqldb/internal/github.com/swisscom/mssql-always-encrypted/pkg/encryption"
	"github.com/microsoft/go-mssqldb/internal/github.com/swisscom/mssql-always-encrypted/pkg/keys"
)

type ColumnEncryptionType int

var (
	ColumnEncryptionPlainText     ColumnEncryptionType = 0
	ColumnEncryptionDeterministic ColumnEncryptionType = 1
	ColumnEncryptionRandomized    ColumnEncryptionType = 2
)

type cekData struct {
	ordinal         int
	database_id     int
	id              int
	version         int
	metadataVersion []byte
	encryptedValue  []byte
	cmkStoreName    string
	cmkPath         string
	algorithm       string
	//byEnclave       bool
	//cmkSignature    string
	decryptedValue []byte
}

type parameterEncData struct {
	ordinal     int
	name        string
	algorithm   int
	encType     ColumnEncryptionType
	cekOrdinal  int
	ruleVersion int
}

type paramMapEntry struct {
	cek *cekData
	p   *parameterEncData
}

// when Always Encrypted is turned on, we have to ask the server for metadata about how to encrypt input parameters.
// This function stores the relevant encryption parameters in a copy of the args so they can be
// encrypted just before being sent to the server
func (s *Stmt) encryptArgs(ctx context.Context, args []namedValue) (encryptedArgs []namedValue, err error) {
	q := Stmt{c: s.c,
		paramCount:     s.paramCount,
		query:          "sp_describe_parameter_encryption",
		skipEncryption: true,
	}
	oldouts := s.c.outs
	s.c.clearOuts()
	newArgs, err := s.prepareEncryptionQuery(isProc(s.query), s.query, args)
	if err != nil {
		return
	}
	// TODO: Consider not using recursion.
	rows, err := q.queryContext(ctx, newArgs)
	if err != nil {
		s.c.outs = oldouts
		return
	}
	cekInfo, paramsInfo, err := processDescribeParameterEncryption(rows)
	rows.Close()
	s.c.outs = oldouts
	if err != nil {
		return
	}
	if len(cekInfo) == 0 {
		return args, nil
	}
	err = s.decryptCek(ctx, cekInfo)
	if err != nil {
		return
	}
	paramMap := make(map[string]paramMapEntry)
	for _, p := range paramsInfo {
		if p.encType == ColumnEncryptionPlainText {
			paramMap[p.name] = paramMapEntry{nil, p}
		} else {
			paramMap[p.name] = paramMapEntry{cekInfo[p.cekOrdinal-1], p}
		}
	}
	encryptedArgs = make([]namedValue, len(args))
	for i, a := range args {
		encryptedArgs[i] = a
		name := ""
		if len(a.Name) > 0 {
			name = "@" + a.Name
		} else {
			name = fmt.Sprintf("@p%d", a.Ordinal)
		}
		info := paramMap[name]

		if info.p.encType == ColumnEncryptionPlainText || a.Value == nil {
			continue
		}

		encryptedArgs[i].encrypt = getEncryptor(info)
	}
	return encryptedArgs, nil
}

// returns the arguments to sp_describe_parameter_encryption
// sp_describe_parameter_encryption
// [ @tsql = ] N'Transact-SQL_batch' ,
// [ @params = ] N'parameters'
// [ ;]
func (s *Stmt) prepareEncryptionQuery(isProc bool, q string, args []namedValue) (newArgs []namedValue, err error) {
	newArgs = make([]namedValue, 2)
	if isProc {
		newArgs[0] = namedValue{Name: "tsql", Ordinal: 0, Value: buildStoredProcedureStatementForColumnEncryption(q, args)}
	} else {
		newArgs[0] = namedValue{Name: "tsql", Ordinal: 0, Value: q}
	}
	params, err := s.buildParametersForColumnEncryption(args)
	if err != nil {
		return
	}
	newArgs[1] = namedValue{Name: "params", Ordinal: 1, Value: params}
	return
}

func (s *Stmt) buildParametersForColumnEncryption(args []namedValue) (parameters string, err error) {
	_, decls, err := s.makeRPCParams(args, false)
	if err != nil {
		return
	}
	parameters = strings.Join(decls, ", ")
	return
}

func (s *Stmt) decryptCek(ctx context.Context, cekInfo []*cekData) error {
	for _, info := range cekInfo {
		kp, ok := s.c.sess.aeSettings.keyProviders[info.cmkStoreName]
		if !ok {
			return fmt.Errorf("no provider found for key store %s", info.cmkStoreName)
		}
		dk, err := kp.GetDecryptedKey(ctx, info.cmkPath, info.encryptedValue)
		if err != nil {
			return err
		}
		info.decryptedValue = dk
	}
	return nil
}

func getEncryptor(info paramMapEntry) valueEncryptor {
	k := keys.NewAeadAes256CbcHmac256(info.cek.decryptedValue)
	alg := algorithms.NewAeadAes256CbcHmac256Algorithm(k, encryption.From(byte(info.p.encType)), byte(info.cek.version))
	// Metadata to append to an encrypted parameter. Doesn't include original typeinfo
	// https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-tds/619c43b6-9495-4a58-9e49-a4950db245b3
	// ParamCipherInfo  =   TYPE_INFO
	// 		EncryptionAlgo (byte)
	// 		[AlgoName] (b_varchar) unused, no custom algorithm
	// 		EncryptionType (byte)
	// 		DatabaseId (ulong)
	// 		CekId      (ulong)
	// 		CekVersion (ulong)
	// 		CekMDVersion (ulonglong) - really a byte array
	// 		NormVersion (byte)
	//              algo+ enctype+ dbid+ keyid+ keyver+ normversion
	metadataLen := 1 + 1 + 4 + 4 + 4 + 1
	metadataLen += len(info.cek.metadataVersion)
	metadata := make([]byte, metadataLen)
	offset := 0
	// AEAD_AES_256_CBC_HMAC_SHA256
	metadata[offset] = byte(info.p.algorithm)
	offset++
	metadata[offset] = byte(info.p.encType)
	offset++
	binary.LittleEndian.PutUint32(metadata[offset:], uint32(info.cek.database_id))
	offset += 4
	binary.LittleEndian.PutUint32(metadata[offset:], uint32(info.cek.id))
	offset += 4
	binary.LittleEndian.PutUint32(metadata[offset:], uint32(info.cek.version))
	offset += 4
	copy(metadata[offset:], info.cek.metadataVersion)
	offset += len(info.cek.metadataVersion)
	metadata[offset] = byte(info.p.ruleVersion)
	return func(b []byte) ([]byte, []byte, error) {
		encryptedData, err := alg.Encrypt(b)
		if err != nil {
			return nil, nil, err
		}
		return encryptedData, metadata, nil
	}
}

// Based on the .Net implementation at https://github.com/dotnet/SqlClient/blob/2b31810ce69b88d707450e2059ee8fbde63f774f/src/Microsoft.Data.SqlClient/netcore/src/Microsoft/Data/SqlClient/SqlCommand.cs#L6040
func buildStoredProcedureStatementForColumnEncryption(sproc string, args []namedValue) string {
	b := new(strings.Builder)
	_, _ = b.WriteString("EXEC ")
	q := TSQLQuoter{}
	sproc = q.ID(sproc)

	b.WriteString(sproc)

	// Unlike ADO.Net, go-mssqldb doesn't support ReturnValue named parameters
	first := true
	for _, a := range args {
		if !first {
			b.WriteRune(',')
		}
		first = false
		b.WriteRune(' ')
		name := a.Name
		if len(name) == 0 {
			name = fmt.Sprintf("@p%d", a.Ordinal)
		}
		appendPrefixedParameterName(b, name)
		if len(a.Name) > 0 {
			b.WriteRune('=')
			appendPrefixedParameterName(b, a.Name)
		}
		if isOutputValue(a.Value) {
			b.WriteString(" OUTPUT")
		}
	}
	return b.String()
}

func appendPrefixedParameterName(b *strings.Builder, p string) {
	if len(p) > 0 {
		if p[0] != '@' {
			b.WriteRune('@')
		}
		b.WriteString(p)
	}
}

func processDescribeParameterEncryption(rows driver.Rows) (cekInfo []*cekData, paramInfo []*parameterEncData, err error) {
	cekInfo = make([]*cekData, 0)
	values := make([]driver.Value, 9)
	qerr := rows.Next(values)
	for qerr == nil {
		cekInfo = append(cekInfo, &cekData{ordinal: int(values[0].(int64)),
			database_id:     int(values[1].(int64)),
			id:              int(values[2].(int64)),
			version:         int(values[3].(int64)),
			metadataVersion: values[4].([]byte),
			encryptedValue:  values[5].([]byte),
			cmkStoreName:    values[6].(string),
			cmkPath:         values[7].(string),
			algorithm:       values[8].(string),
		})
		qerr = rows.Next(values)
	}
	if len(cekInfo) == 0 || qerr != io.EOF {
		if qerr != io.EOF {
			err = qerr
		}
		// No encryption needed
		return
	}
	r := rows.(driver.RowsNextResultSet)
	err = r.NextResultSet()
	if err != nil {
		return
	}
	paramInfo = make([]*parameterEncData, 0)
	qerr = rows.Next(values[:6])
	for qerr == nil {
		paramInfo = append(paramInfo, &parameterEncData{ordinal: int(values[0].(int64)),
			name:        values[1].(string),
			algorithm:   int(values[2].(int64)),
			encType:     ColumnEncryptionType(values[3].(int64)),
			cekOrdinal:  int(values[4].(int64)),
			ruleVersion: int(values[5].(int64)),
		})
		qerr = rows.Next(values[:6])
	}
	if len(paramInfo) == 0 || qerr != io.EOF {
		if qerr != io.EOF {
			err = qerr
		} else {
			badStreamPanic(fmt.Errorf("no parameter encryption rows were returned from sp_describe_parameter_encryption"))
		}
	}
	return
}
