// Go MySQL Driver - A MySQL-Driver for Go's database/sql package
//
// Copyright 2016 The Go-MySQL-Driver Authors. All rights reserved.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at http://mozilla.org/MPL/2.0/.

package mysql

import (
	"crypto/tls"
	"fmt"
	"net/url"
	"testing"
)

var testDSNs = []struct {
	in  string
	out string
}{
	{"username:password@protocol(address)/dbname?param=value", "&{User:username Passwd:password Net:protocol Addr:address DBName:dbname Params:map[param:value] Collation:utf8_general_ci Loc:UTC TLSConfig: tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"username:password@protocol(address)/dbname?param=value&columnsWithAlias=true", "&{User:username Passwd:password Net:protocol Addr:address DBName:dbname Params:map[param:value] Collation:utf8_general_ci Loc:UTC TLSConfig: tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:true InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"username:password@protocol(address)/dbname?param=value&columnsWithAlias=true&multiStatements=true", "&{User:username Passwd:password Net:protocol Addr:address DBName:dbname Params:map[param:value] Collation:utf8_general_ci Loc:UTC TLSConfig: tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:true InterpolateParams:false MultiStatements:true ParseTime:false Strict:false}"},
	{"user@unix(/path/to/socket)/dbname?charset=utf8", "&{User:user Passwd: Net:unix Addr:/path/to/socket DBName:dbname Params:map[charset:utf8] Collation:utf8_general_ci Loc:UTC TLSConfig: tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"user:password@tcp(localhost:5555)/dbname?charset=utf8&tls=true", "&{User:user Passwd:password Net:tcp Addr:localhost:5555 DBName:dbname Params:map[charset:utf8] Collation:utf8_general_ci Loc:UTC TLSConfig:true tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"user:password@tcp(localhost:5555)/dbname?charset=utf8mb4,utf8&tls=skip-verify", "&{User:user Passwd:password Net:tcp Addr:localhost:5555 DBName:dbname Params:map[charset:utf8mb4,utf8] Collation:utf8_general_ci Loc:UTC TLSConfig:skip-verify tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"user:password@/dbname?loc=UTC&timeout=30s&readTimeout=1s&writeTimeout=1s&allowAllFiles=1&clientFoundRows=true&allowOldPasswords=TRUE&collation=utf8mb4_unicode_ci", "&{User:user Passwd:password Net:tcp Addr:127.0.0.1:3306 DBName:dbname Params:map[] Collation:utf8mb4_unicode_ci Loc:UTC TLSConfig: tls:<nil> Timeout:30s ReadTimeout:1s WriteTimeout:1s AllowAllFiles:true AllowCleartextPasswords:false AllowOldPasswords:true ClientFoundRows:true ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"user:p@ss(word)@tcp([de:ad:be:ef::ca:fe]:80)/dbname?loc=Local", "&{User:user Passwd:p@ss(word) Net:tcp Addr:[de:ad:be:ef::ca:fe]:80 DBName:dbname Params:map[] Collation:utf8_general_ci Loc:Local TLSConfig: tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"/dbname", "&{User: Passwd: Net:tcp Addr:127.0.0.1:3306 DBName:dbname Params:map[] Collation:utf8_general_ci Loc:UTC TLSConfig: tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"@/", "&{User: Passwd: Net:tcp Addr:127.0.0.1:3306 DBName: Params:map[] Collation:utf8_general_ci Loc:UTC TLSConfig: tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"/", "&{User: Passwd: Net:tcp Addr:127.0.0.1:3306 DBName: Params:map[] Collation:utf8_general_ci Loc:UTC TLSConfig: tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"", "&{User: Passwd: Net:tcp Addr:127.0.0.1:3306 DBName: Params:map[] Collation:utf8_general_ci Loc:UTC TLSConfig: tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"user:p@/ssword@/", "&{User:user Passwd:p@/ssword Net:tcp Addr:127.0.0.1:3306 DBName: Params:map[] Collation:utf8_general_ci Loc:UTC TLSConfig: tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
	{"unix/?arg=%2Fsome%2Fpath.ext", "&{User: Passwd: Net:unix Addr:/tmp/mysql.sock DBName: Params:map[arg:/some/path.ext] Collation:utf8_general_ci Loc:UTC TLSConfig: tls:<nil> Timeout:0 ReadTimeout:0 WriteTimeout:0 AllowAllFiles:false AllowCleartextPasswords:false AllowOldPasswords:false ClientFoundRows:false ColumnsWithAlias:false InterpolateParams:false MultiStatements:false ParseTime:false Strict:false}"},
}

func TestDSNParser(t *testing.T) {
	var cfg *Config
	var err error
	var res string

	for i, tst := range testDSNs {
		cfg, err = ParseDSN(tst.in)
		if err != nil {
			t.Error(err.Error())
		}

		// pointer not static
		cfg.tls = nil

		res = fmt.Sprintf("%+v", cfg)
		if res != tst.out {
			t.Errorf("%d. ParseDSN(%q) => %q, want %q", i, tst.in, res, tst.out)
		}
	}
}

func TestDSNParserInvalid(t *testing.T) {
	var invalidDSNs = []string{
		"@net(addr/",                  // no closing brace
		"@tcp(/",                      // no closing brace
		"tcp(/",                       // no closing brace
		"(/",                          // no closing brace
		"net(addr)//",                 // unescaped
		"User:pass@tcp(1.2.3.4:3306)", // no trailing slash
		//"/dbname?arg=/some/unescaped/path",
	}

	for i, tst := range invalidDSNs {
		if _, err := ParseDSN(tst); err == nil {
			t.Errorf("invalid DSN #%d. (%s) didn't error!", i, tst)
		}
	}
}

func TestDSNReformat(t *testing.T) {
	for i, tst := range testDSNs {
		dsn1 := tst.in
		cfg1, err := ParseDSN(dsn1)
		if err != nil {
			t.Error(err.Error())
			continue
		}
		cfg1.tls = nil // pointer not static
		res1 := fmt.Sprintf("%+v", cfg1)

		dsn2 := cfg1.FormatDSN()
		cfg2, err := ParseDSN(dsn2)
		if err != nil {
			t.Error(err.Error())
			continue
		}
		cfg2.tls = nil // pointer not static
		res2 := fmt.Sprintf("%+v", cfg2)

		if res1 != res2 {
			t.Errorf("%d. %q does not match %q", i, res2, res1)
		}
	}
}

func TestDSNWithCustomTLS(t *testing.T) {
	baseDSN := "User:password@tcp(localhost:5555)/dbname?tls="
	tlsCfg := tls.Config{}

	RegisterTLSConfig("utils_test", &tlsCfg)

	// Custom TLS is missing
	tst := baseDSN + "invalid_tls"
	cfg, err := ParseDSN(tst)
	if err == nil {
		t.Errorf("invalid custom TLS in DSN (%s) but did not error. Got config: %#v", tst, cfg)
	}

	tst = baseDSN + "utils_test"

	// Custom TLS with a server name
	name := "foohost"
	tlsCfg.ServerName = name
	cfg, err = ParseDSN(tst)

	if err != nil {
		t.Error(err.Error())
	} else if cfg.tls.ServerName != name {
		t.Errorf("did not get the correct TLS ServerName (%s) parsing DSN (%s).", name, tst)
	}

	// Custom TLS without a server name
	name = "localhost"
	tlsCfg.ServerName = ""
	cfg, err = ParseDSN(tst)

	if err != nil {
		t.Error(err.Error())
	} else if cfg.tls.ServerName != name {
		t.Errorf("did not get the correct ServerName (%s) parsing DSN (%s).", name, tst)
	}

	DeregisterTLSConfig("utils_test")
}

func TestDSNWithCustomTLSQueryEscape(t *testing.T) {
	const configKey = "&%!:"
	dsn := "User:password@tcp(localhost:5555)/dbname?tls=" + url.QueryEscape(configKey)
	name := "foohost"
	tlsCfg := tls.Config{ServerName: name}

	RegisterTLSConfig(configKey, &tlsCfg)

	cfg, err := ParseDSN(dsn)

	if err != nil {
		t.Error(err.Error())
	} else if cfg.tls.ServerName != name {
		t.Errorf("did not get the correct TLS ServerName (%s) parsing DSN (%s).", name, dsn)
	}
}

func TestDSNUnsafeCollation(t *testing.T) {
	_, err := ParseDSN("/dbname?collation=gbk_chinese_ci&interpolateParams=true")
	if err != errInvalidDSNUnsafeCollation {
		t.Errorf("expected %v, got %v", errInvalidDSNUnsafeCollation, err)
	}

	_, err = ParseDSN("/dbname?collation=gbk_chinese_ci&interpolateParams=false")
	if err != nil {
		t.Errorf("expected %v, got %v", nil, err)
	}

	_, err = ParseDSN("/dbname?collation=gbk_chinese_ci")
	if err != nil {
		t.Errorf("expected %v, got %v", nil, err)
	}

	_, err = ParseDSN("/dbname?collation=ascii_bin&interpolateParams=true")
	if err != nil {
		t.Errorf("expected %v, got %v", nil, err)
	}

	_, err = ParseDSN("/dbname?collation=latin1_german1_ci&interpolateParams=true")
	if err != nil {
		t.Errorf("expected %v, got %v", nil, err)
	}

	_, err = ParseDSN("/dbname?collation=utf8_general_ci&interpolateParams=true")
	if err != nil {
		t.Errorf("expected %v, got %v", nil, err)
	}

	_, err = ParseDSN("/dbname?collation=utf8mb4_general_ci&interpolateParams=true")
	if err != nil {
		t.Errorf("expected %v, got %v", nil, err)
	}
}

func BenchmarkParseDSN(b *testing.B) {
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		for _, tst := range testDSNs {
			if _, err := ParseDSN(tst.in); err != nil {
				b.Error(err.Error())
			}
		}
	}
}
