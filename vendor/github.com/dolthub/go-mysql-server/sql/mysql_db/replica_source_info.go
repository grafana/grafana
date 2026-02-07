// Copyright 2023 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package mysql_db

import (
	"encoding/json"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/in_mem_table"
)

// ReplicaSourceInfo represents the binlog replication metadata persisted
// in the mysql database.
// For more details, see: https://dev.mysql.com/doc/refman/8.0/en/replica-logs-status.html
type ReplicaSourceInfo struct {
	Host                 string
	User                 string
	Password             string
	Uuid                 string
	ConnectRetryCount    uint64
	ConnectRetryInterval uint32
	Port                 uint16
	Ssl                  bool
}

func ReplicaSourceInfoToRow(ctx *sql.Context, v *ReplicaSourceInfo) (sql.Row, error) {
	row := make(sql.Row, len(replicaSourceInfoTblSchema))
	var err error
	for i, col := range replicaSourceInfoTblSchema {
		row[i], err = col.Default.Eval(ctx, nil)
		if err != nil {
			panic(err) // Should never happen, schema is static
		}
	}
	//TODO: once the remaining fields are added, fill those in as well
	if v.Host != "" {
		row[replicaSourceInfoTblColIndex_Host] = v.Host
	}
	if v.User != "" {
		row[replicaSourceInfoTblColIndex_User_name] = v.User
	}
	if v.Uuid != "" {
		row[replicaSourceInfoTblColIndex_Uuid] = v.Uuid
	}
	row[replicaSourceInfoTblColIndex_User_password] = v.Password
	row[replicaSourceInfoTblColIndex_Port] = v.Port
	row[replicaSourceInfoTblColIndex_Connect_retry] = v.ConnectRetryInterval
	row[replicaSourceInfoTblColIndex_Retry_count] = v.ConnectRetryCount

	if v.Ssl {
		row[replicaSourceInfoTblColIndex_Enabled_ssl] = 1
	} else {
		row[replicaSourceInfoTblColIndex_Enabled_ssl] = 0
	}

	return row, nil
}

func ReplicaSourceInfoFromRow(ctx *sql.Context, row sql.Row) (*ReplicaSourceInfo, error) {
	if err := replicaSourceInfoTblSchema.CheckRow(ctx, row); err != nil {
		return nil, err
	}

	ssl := row[replicaSourceInfoTblColIndex_Enabled_ssl] == 1

	return &ReplicaSourceInfo{
		Host:                 row[replicaSourceInfoTblColIndex_Host].(string),
		User:                 row[replicaSourceInfoTblColIndex_User_name].(string),
		Ssl:                  ssl,
		Password:             row[replicaSourceInfoTblColIndex_User_password].(string),
		Port:                 row[replicaSourceInfoTblColIndex_Port].(uint16),
		Uuid:                 row[replicaSourceInfoTblColIndex_Uuid].(string),
		ConnectRetryInterval: row[replicaSourceInfoTblColIndex_Connect_retry].(uint32),
		ConnectRetryCount:    row[replicaSourceInfoTblColIndex_Retry_count].(uint64),
	}, nil
}

func ReplicaSourceInfoEquals(left, right *ReplicaSourceInfo) bool {
	return left.User == right.User &&
		left.Ssl == right.Ssl &&
		left.Host == right.Host &&
		left.Port == right.Port &&
		left.Password == right.Password &&
		left.Uuid == right.Uuid &&
		left.ConnectRetryInterval == right.ConnectRetryInterval &&
		left.ConnectRetryCount == right.ConnectRetryCount
}

var ReplicaSourceInfoOps = in_mem_table.ValueOps[*ReplicaSourceInfo]{
	ToRow:   ReplicaSourceInfoToRow,
	FromRow: ReplicaSourceInfoFromRow,
	UpdateWithRow: func(ctx *sql.Context, row sql.Row, e *ReplicaSourceInfo) (*ReplicaSourceInfo, error) {
		return ReplicaSourceInfoFromRow(ctx, row)
	},
}

// NewReplicaSourceInfo constructs a new ReplicaSourceInfo instance, with defaults applied.
func NewReplicaSourceInfo() *ReplicaSourceInfo {
	return &ReplicaSourceInfo{
		Port:                 3306,
		ConnectRetryInterval: 60,
		ConnectRetryCount:    86400,
	}
}

// FromJson implements the interface in_mem_table.Entry.
func (r *ReplicaSourceInfo) FromJson(_ *sql.Context, jsonStr string) (*ReplicaSourceInfo, error) {
	newInstance := &ReplicaSourceInfo{}
	if err := json.Unmarshal([]byte(jsonStr), newInstance); err != nil {
		return nil, err
	}
	return newInstance, nil
}

// ToJson implements the interface in_mem_table.Entry.
func (r *ReplicaSourceInfo) ToJson(_ *sql.Context) (string, error) {
	jsonData, err := json.Marshal(*r)
	if err != nil {
		return "", err
	}
	return string(jsonData), nil
}
