// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

type ResolvedExportedService struct {
	// Service is the name of the service which is exported.
	Service string

	// Partition of the service
	Partition string `json:",omitempty"`

	// Namespace of the service
	Namespace string `json:",omitempty"`

	// Consumers is a list of downstream consumers of the service.
	Consumers ResolvedConsumers
}

type ResolvedConsumers struct {
	Peers      []string `json:",omitempty"`
	Partitions []string `json:",omitempty"`
}

func (c *Client) ExportedServices(q *QueryOptions) ([]ResolvedExportedService, *QueryMeta, error) {

	r := c.newRequest("GET", "/v1/exported-services")
	r.setQueryOptions(q)
	rtt, resp, err := c.doRequest(r)
	if err != nil {
		return nil, nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, nil, err
	}

	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt

	var expSvcs []ResolvedExportedService

	if err := decodeBody(resp, &expSvcs); err != nil {
		return nil, nil, err
	}

	return expSvcs, qm, nil
}
