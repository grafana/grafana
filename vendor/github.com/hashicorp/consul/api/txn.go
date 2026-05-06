// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

// Txn is used to manipulate the Txn API
type Txn struct {
	c *Client
}

// Txn is used to return a handle to the K/V apis
func (c *Client) Txn() *Txn {
	return &Txn{c}
}

// TxnOp is the internal format we send to Consul. Currently only K/V and
// check operations are supported.
type TxnOp struct {
	KV      *KVTxnOp
	Node    *NodeTxnOp
	Service *ServiceTxnOp
	Check   *CheckTxnOp
}

// TxnOps is a list of transaction operations.
type TxnOps []*TxnOp

// TxnResult is the internal format we receive from Consul.
type TxnResult struct {
	KV      *KVPair
	Node    *Node
	Service *CatalogService
	Check   *HealthCheck
}

// TxnResults is a list of TxnResult objects.
type TxnResults []*TxnResult

// TxnError is used to return information about an operation in a transaction.
type TxnError struct {
	OpIndex int
	What    string
}

// TxnErrors is a list of TxnError objects.
type TxnErrors []*TxnError

// TxnResponse is the internal format we receive from Consul.
type TxnResponse struct {
	Results TxnResults
	Errors  TxnErrors
}

// KVOp constants give possible operations available in a transaction.
type KVOp string

const (
	KVSet            KVOp = "set"
	KVDelete         KVOp = "delete"
	KVDeleteCAS      KVOp = "delete-cas"
	KVDeleteTree     KVOp = "delete-tree"
	KVCAS            KVOp = "cas"
	KVLock           KVOp = "lock"
	KVUnlock         KVOp = "unlock"
	KVGet            KVOp = "get"
	KVGetOrEmpty     KVOp = "get-or-empty"
	KVGetTree        KVOp = "get-tree"
	KVCheckSession   KVOp = "check-session"
	KVCheckIndex     KVOp = "check-index"
	KVCheckNotExists KVOp = "check-not-exists"
)

// KVTxnOp defines a single operation inside a transaction.
type KVTxnOp struct {
	Verb      KVOp
	Key       string
	Value     []byte
	Flags     uint64
	Index     uint64
	Session   string
	Namespace string `json:",omitempty"`
	Partition string `json:",omitempty"`
}

// KVTxnOps defines a set of operations to be performed inside a single
// transaction.
type KVTxnOps []*KVTxnOp

// KVTxnResponse has the outcome of a transaction.
type KVTxnResponse struct {
	Results []*KVPair
	Errors  TxnErrors
}

// SessionOp constants give possible operations available in a transaction.
type SessionOp string

const (
	SessionDelete SessionOp = "delete"
)

// SessionTxnOp defines a single operation inside a transaction.
type SessionTxnOp struct {
	Verb    SessionOp
	Session Session
}

// NodeOp constants give possible operations available in a transaction.
type NodeOp string

const (
	NodeGet       NodeOp = "get"
	NodeSet       NodeOp = "set"
	NodeCAS       NodeOp = "cas"
	NodeDelete    NodeOp = "delete"
	NodeDeleteCAS NodeOp = "delete-cas"
)

// NodeTxnOp defines a single operation inside a transaction.
type NodeTxnOp struct {
	Verb NodeOp
	Node Node
}

// ServiceOp constants give possible operations available in a transaction.
type ServiceOp string

const (
	ServiceGet       ServiceOp = "get"
	ServiceSet       ServiceOp = "set"
	ServiceCAS       ServiceOp = "cas"
	ServiceDelete    ServiceOp = "delete"
	ServiceDeleteCAS ServiceOp = "delete-cas"
)

// ServiceTxnOp defines a single operation inside a transaction.
type ServiceTxnOp struct {
	Verb    ServiceOp
	Node    string
	Service AgentService
}

// CheckOp constants give possible operations available in a transaction.
type CheckOp string

const (
	CheckGet       CheckOp = "get"
	CheckSet       CheckOp = "set"
	CheckCAS       CheckOp = "cas"
	CheckDelete    CheckOp = "delete"
	CheckDeleteCAS CheckOp = "delete-cas"
)

// CheckTxnOp defines a single operation inside a transaction.
type CheckTxnOp struct {
	Verb  CheckOp
	Check HealthCheck
}

// Txn is used to apply multiple Consul operations in a single, atomic transaction.
//
// Note that Go will perform the required base64 encoding on the values
// automatically because the type is a byte slice. Transactions are defined as a
// list of operations to perform, using the different fields in the TxnOp structure
// to define operations. If any operation fails, none of the changes are applied
// to the state store.
//
// Even though this is generally a write operation, we take a QueryOptions input
// and return a QueryMeta output. If the transaction contains only read ops, then
// Consul will fast-path it to a different endpoint internally which supports
// consistency controls, but not blocking. If there are write operations then
// the request will always be routed through raft and any consistency settings
// will be ignored.
//
// Here's an example:
//
//	   ops := KVTxnOps{
//		   &KVTxnOp{
//			   Verb:    KVLock,
//			   Key:     "test/lock",
//			   Session: "adf4238a-882b-9ddc-4a9d-5b6758e4159e",
//			   Value:   []byte("hello"),
//		   },
//		   &KVTxnOp{
//			   Verb:    KVGet,
//			   Key:     "another/key",
//		   },
//		   &CheckTxnOp{
//			   Verb:        CheckSet,
//			   HealthCheck: HealthCheck{
//				   Node:    "foo",
//				   CheckID: "redis:a",
//				   Name:    "Redis Health Check",
//				   Status:  "passing",
//			   },
//		   }
//	   }
//	   ok, response, _, err := kv.Txn(&ops, nil)
//
// If there is a problem making the transaction request then an error will be
// returned. Otherwise, the ok value will be true if the transaction succeeded
// or false if it was rolled back. The response is a structured return value which
// will have the outcome of the transaction. Its Results member will have entries
// for each operation. For KV operations, Deleted keys will have a nil entry in the
// results, and to save space, the Value of each key in the Results will be nil
// unless the operation is a KVGet. If the transaction was rolled back, the Errors
// member will have entries referencing the index of the operation that failed
// along with an error message.
func (t *Txn) Txn(txn TxnOps, q *QueryOptions) (bool, *TxnResponse, *QueryMeta, error) {
	return t.c.txn(txn, q)
}

func (c *Client) txn(txn TxnOps, q *QueryOptions) (bool, *TxnResponse, *QueryMeta, error) {
	r := c.newRequest("PUT", "/v1/txn")
	r.setQueryOptions(q)

	r.obj = txn
	rtt, resp, err := c.doRequest(r)
	if err != nil {
		return false, nil, nil, err
	}
	defer closeResponseBody(resp)

	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt

	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusConflict {
		var txnResp TxnResponse
		if err := decodeBody(resp, &txnResp); err != nil {
			return false, nil, nil, err
		}

		return resp.StatusCode == http.StatusOK, &txnResp, qm, nil
	}

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, resp.Body); err != nil {
		return false, nil, nil, fmt.Errorf("Failed to read response: %v", err)
	}
	return false, nil, nil, fmt.Errorf("Failed request: %s", buf.String())
}
