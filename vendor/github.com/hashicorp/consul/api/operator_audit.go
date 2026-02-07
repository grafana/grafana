// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

// The /v1/operator/audit-hash endpoint is available only in Consul Enterprise and
// interact with its audit logging subsystem.

package api

type AuditHashRequest struct {
	Input string
}

type AuditHashResponse struct {
	Hash string
}

func (op *Operator) AuditHash(a *AuditHashRequest, q *QueryOptions) (*AuditHashResponse, error) {
	r := op.c.newRequest("POST", "/v1/operator/audit-hash")
	r.setQueryOptions(q)
	r.obj = a

	rtt, resp, err := op.c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	wm := &WriteMeta{}
	wm.RequestTime = rtt

	var out AuditHashResponse
	if err := decodeBody(resp, &out); err != nil {
		return nil, err
	}

	return &out, nil
}
