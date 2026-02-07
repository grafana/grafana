// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import "context"

// Internal can be used to query endpoints that are intended for
// Hashicorp internal-use only.
type Internal struct {
	c *Client
}

// Internal returns a handle to endpoints that are for internal
// Hashicorp usage only. There is not guarantee that these will
// be backwards-compatible or supported, so usage of these is
// not encouraged.
func (c *Client) Internal() *Internal {
	return &Internal{c}
}

type AssignServiceManualVIPsRequest struct {
	Service    string
	ManualVIPs []string
}

type AssignServiceManualVIPsResponse struct {
	ServiceFound   bool `json:"Found"`
	UnassignedFrom []PeeredServiceName
}

type PeeredServiceName struct {
	ServiceName CompoundServiceName
	Peer        string
}

func (i *Internal) AssignServiceVirtualIP(
	ctx context.Context,
	service string,
	manualVIPs []string,
	wo *WriteOptions,
) (*AssignServiceManualVIPsResponse, *QueryMeta, error) {
	req := i.c.newRequest("PUT", "/v1/internal/service-virtual-ip")
	req.setWriteOptions(wo)
	req.ctx = ctx
	req.obj = AssignServiceManualVIPsRequest{
		Service:    service,
		ManualVIPs: manualVIPs,
	}
	rtt, resp, err := i.c.doRequest(req)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}

	qm := &QueryMeta{RequestTime: rtt}
	parseQueryMeta(resp, qm)

	var out AssignServiceManualVIPsResponse
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return &out, qm, nil
}
