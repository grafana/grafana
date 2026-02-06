// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

type Usage struct {
	// Usage is a map of datacenter -> usage information
	Usage map[string]ServiceUsage
}

// ServiceUsage contains information about the number of services and service instances for a datacenter.
type ServiceUsage struct {
	Nodes                   int
	Services                int
	ServiceInstances        int
	ConnectServiceInstances map[string]int

	// Billable services are of "typical" service kind (i.e. non-connect or connect-native),
	// excluding the "consul" service.
	BillableServiceInstances int

	// A map of partition+namespace to number of unique services registered in that namespace
	PartitionNamespaceServices map[string]map[string]int

	// A map of partition+namespace to number of service instances registered in that namespace
	PartitionNamespaceServiceInstances map[string]map[string]int

	// A map of partition+namespace+kind to number of service-mesh instances registered in that namespace
	PartitionNamespaceConnectServiceInstances map[string]map[string]map[string]int

	// A map of partition+namespace to number of billable instances registered in that namespace
	PartitionNamespaceBillableServiceInstances map[string]map[string]int
}

// Usage is used to query for usage information in the given datacenter.
func (op *Operator) Usage(q *QueryOptions) (*Usage, *QueryMeta, error) {
	r := op.c.newRequest("GET", "/v1/operator/usage")
	r.setQueryOptions(q)
	rtt, resp, err := op.c.doRequest(r)
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

	var out *Usage
	if err := decodeBody(resp, &out); err != nil {
		return nil, nil, err
	}
	return out, qm, nil
}
