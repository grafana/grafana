/*
Copyright 2015 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package bigtable

import (
	"fmt"
	"regexp"
	"strings"

	btopt "cloud.google.com/go/bigtable/internal/option"
	"cloud.google.com/go/longrunning"
	lroauto "cloud.google.com/go/longrunning/autogen"
	"golang.org/x/net/context"
	"google.golang.org/api/option"
	gtransport "google.golang.org/api/transport/grpc"
	btapb "google.golang.org/genproto/googleapis/bigtable/admin/v2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/codes"
)

const adminAddr = "bigtableadmin.googleapis.com:443"

// AdminClient is a client type for performing admin operations within a specific instance.
type AdminClient struct {
	conn    *grpc.ClientConn
	tClient btapb.BigtableTableAdminClient

	project, instance string

	// Metadata to be sent with each request.
	md metadata.MD
}

// NewAdminClient creates a new AdminClient for a given project and instance.
func NewAdminClient(ctx context.Context, project, instance string, opts ...option.ClientOption) (*AdminClient, error) {
	o, err := btopt.DefaultClientOptions(adminAddr, AdminScope, clientUserAgent)
	if err != nil {
		return nil, err
	}
	o = append(o, opts...)
	conn, err := gtransport.Dial(ctx, o...)
	if err != nil {
		return nil, fmt.Errorf("dialing: %v", err)
	}
	return &AdminClient{
		conn:     conn,
		tClient:  btapb.NewBigtableTableAdminClient(conn),
		project:  project,
		instance: instance,
		md:       metadata.Pairs(resourcePrefixHeader, fmt.Sprintf("projects/%s/instances/%s", project, instance)),
	}, nil
}

// Close closes the AdminClient.
func (ac *AdminClient) Close() error {
	return ac.conn.Close()
}

func (ac *AdminClient) instancePrefix() string {
	return fmt.Sprintf("projects/%s/instances/%s", ac.project, ac.instance)
}

// Tables returns a list of the tables in the instance.
func (ac *AdminClient) Tables(ctx context.Context) ([]string, error) {
	ctx = mergeOutgoingMetadata(ctx, ac.md)
	prefix := ac.instancePrefix()
	req := &btapb.ListTablesRequest{
		Parent: prefix,
	}
	res, err := ac.tClient.ListTables(ctx, req)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(res.Tables))
	for _, tbl := range res.Tables {
		names = append(names, strings.TrimPrefix(tbl.Name, prefix+"/tables/"))
	}
	return names, nil
}

// TableConf contains all of the information necessary to create a table with column families.
type TableConf struct {
	TableID   string
	SplitKeys []string
	// Families is a map from family name to GCPolicy
	Families map[string]GCPolicy
}

// CreateTable creates a new table in the instance.
// This method may return before the table's creation is complete.
func (ac *AdminClient) CreateTable(ctx context.Context, table string) error {
	return ac.CreateTableFromConf(ctx, &TableConf{TableID: table})
}

// CreatePresplitTable creates a new table in the instance.
// The list of row keys will be used to initially split the table into multiple tablets.
// Given two split keys, "s1" and "s2", three tablets will be created,
// spanning the key ranges: [, s1), [s1, s2), [s2, ).
// This method may return before the table's creation is complete.
func (ac *AdminClient) CreatePresplitTable(ctx context.Context, table string, splitKeys []string) error {
	return ac.CreateTableFromConf(ctx, &TableConf{TableID: table, SplitKeys: splitKeys})
}

// CreateTableFromConf creates a new table in the instance from the given configuration.
func (ac *AdminClient) CreateTableFromConf(ctx context.Context, conf *TableConf) error {
	ctx = mergeOutgoingMetadata(ctx, ac.md)
	var req_splits []*btapb.CreateTableRequest_Split
	for _, split := range conf.SplitKeys {
		req_splits = append(req_splits, &btapb.CreateTableRequest_Split{[]byte(split)})
	}
	var tbl btapb.Table
	if conf.Families != nil {
		tbl.ColumnFamilies = make(map[string]*btapb.ColumnFamily)
		for fam, policy := range conf.Families {
			tbl.ColumnFamilies[fam] = &btapb.ColumnFamily{policy.proto()}
		}
	}
	prefix := ac.instancePrefix()
	req := &btapb.CreateTableRequest{
		Parent:        prefix,
		TableId:       conf.TableID,
		Table:         &tbl,
		InitialSplits: req_splits,
	}
	_, err := ac.tClient.CreateTable(ctx, req)
	return err
}

// CreateColumnFamily creates a new column family in a table.
func (ac *AdminClient) CreateColumnFamily(ctx context.Context, table, family string) error {
	// TODO(dsymonds): Permit specifying gcexpr and any other family settings.
	ctx = mergeOutgoingMetadata(ctx, ac.md)
	prefix := ac.instancePrefix()
	req := &btapb.ModifyColumnFamiliesRequest{
		Name: prefix + "/tables/" + table,
		Modifications: []*btapb.ModifyColumnFamiliesRequest_Modification{{
			Id:  family,
			Mod: &btapb.ModifyColumnFamiliesRequest_Modification_Create{&btapb.ColumnFamily{}},
		}},
	}
	_, err := ac.tClient.ModifyColumnFamilies(ctx, req)
	return err
}

// DeleteTable deletes a table and all of its data.
func (ac *AdminClient) DeleteTable(ctx context.Context, table string) error {
	ctx = mergeOutgoingMetadata(ctx, ac.md)
	prefix := ac.instancePrefix()
	req := &btapb.DeleteTableRequest{
		Name: prefix + "/tables/" + table,
	}
	_, err := ac.tClient.DeleteTable(ctx, req)
	return err
}

// DeleteColumnFamily deletes a column family in a table and all of its data.
func (ac *AdminClient) DeleteColumnFamily(ctx context.Context, table, family string) error {
	ctx = mergeOutgoingMetadata(ctx, ac.md)
	prefix := ac.instancePrefix()
	req := &btapb.ModifyColumnFamiliesRequest{
		Name: prefix + "/tables/" + table,
		Modifications: []*btapb.ModifyColumnFamiliesRequest_Modification{{
			Id:  family,
			Mod: &btapb.ModifyColumnFamiliesRequest_Modification_Drop{true},
		}},
	}
	_, err := ac.tClient.ModifyColumnFamilies(ctx, req)
	return err
}

// TableInfo represents information about a table.
type TableInfo struct {
	// DEPRECATED - This field is deprecated. Please use FamilyInfos instead.
	Families    []string
	FamilyInfos []FamilyInfo
}

// FamilyInfo represents information about a column family.
type FamilyInfo struct {
	Name     string
	GCPolicy string
}

// TableInfo retrieves information about a table.
func (ac *AdminClient) TableInfo(ctx context.Context, table string) (*TableInfo, error) {
	ctx = mergeOutgoingMetadata(ctx, ac.md)
	prefix := ac.instancePrefix()
	req := &btapb.GetTableRequest{
		Name: prefix + "/tables/" + table,
	}
	res, err := ac.tClient.GetTable(ctx, req)
	if err != nil {
		return nil, err
	}
	ti := &TableInfo{}
	for name, fam := range res.ColumnFamilies {
		ti.Families = append(ti.Families, name)
		ti.FamilyInfos = append(ti.FamilyInfos, FamilyInfo{Name: name, GCPolicy: GCRuleToString(fam.GcRule)})
	}
	return ti, nil
}

// SetGCPolicy specifies which cells in a column family should be garbage collected.
// GC executes opportunistically in the background; table reads may return data
// matching the GC policy.
func (ac *AdminClient) SetGCPolicy(ctx context.Context, table, family string, policy GCPolicy) error {
	ctx = mergeOutgoingMetadata(ctx, ac.md)
	prefix := ac.instancePrefix()
	req := &btapb.ModifyColumnFamiliesRequest{
		Name: prefix + "/tables/" + table,
		Modifications: []*btapb.ModifyColumnFamiliesRequest_Modification{{
			Id:  family,
			Mod: &btapb.ModifyColumnFamiliesRequest_Modification_Update{&btapb.ColumnFamily{GcRule: policy.proto()}},
		}},
	}
	_, err := ac.tClient.ModifyColumnFamilies(ctx, req)
	return err
}

// DropRowRange permanently deletes a row range from the specified table.
func (ac *AdminClient) DropRowRange(ctx context.Context, table, rowKeyPrefix string) error {
	ctx = mergeOutgoingMetadata(ctx, ac.md)
	prefix := ac.instancePrefix()
	req := &btapb.DropRowRangeRequest{
		Name:   prefix + "/tables/" + table,
		Target: &btapb.DropRowRangeRequest_RowKeyPrefix{[]byte(rowKeyPrefix)},
	}
	_, err := ac.tClient.DropRowRange(ctx, req)
	return err
}

const instanceAdminAddr = "bigtableadmin.googleapis.com:443"

// InstanceAdminClient is a client type for performing admin operations on instances.
// These operations can be substantially more dangerous than those provided by AdminClient.
type InstanceAdminClient struct {
	conn      *grpc.ClientConn
	iClient   btapb.BigtableInstanceAdminClient
	lroClient *lroauto.OperationsClient

	project string

	// Metadata to be sent with each request.
	md metadata.MD
}

// NewInstanceAdminClient creates a new InstanceAdminClient for a given project.
func NewInstanceAdminClient(ctx context.Context, project string, opts ...option.ClientOption) (*InstanceAdminClient, error) {
	o, err := btopt.DefaultClientOptions(instanceAdminAddr, InstanceAdminScope, clientUserAgent)
	if err != nil {
		return nil, err
	}
	o = append(o, opts...)
	conn, err := gtransport.Dial(ctx, o...)
	if err != nil {
		return nil, fmt.Errorf("dialing: %v", err)
	}

	lroClient, err := lroauto.NewOperationsClient(ctx, option.WithGRPCConn(conn))
	if err != nil {
		// This error "should not happen", since we are just reusing old connection
		// and never actually need to dial.
		// If this does happen, we could leak conn. However, we cannot close conn:
		// If the user invoked the function with option.WithGRPCConn,
		// we would close a connection that's still in use.
		// TODO(pongad): investigate error conditions.
		return nil, err
	}

	return &InstanceAdminClient{
		conn:      conn,
		iClient:   btapb.NewBigtableInstanceAdminClient(conn),
		lroClient: lroClient,

		project: project,
		md:      metadata.Pairs(resourcePrefixHeader, "projects/"+project),
	}, nil
}

// Close closes the InstanceAdminClient.
func (iac *InstanceAdminClient) Close() error {
	return iac.conn.Close()
}

// StorageType is the type of storage used for all tables in an instance
type StorageType int

const (
	SSD StorageType = iota
	HDD
)

func (st StorageType) proto() btapb.StorageType {
	if st == HDD {
		return btapb.StorageType_HDD
	}
	return btapb.StorageType_SSD
}

// InstanceType is the type of the instance
type InstanceType int32

const (
	PRODUCTION  InstanceType = InstanceType(btapb.Instance_PRODUCTION)
	DEVELOPMENT              = InstanceType(btapb.Instance_DEVELOPMENT)
)

// InstanceInfo represents information about an instance
type InstanceInfo struct {
	Name        string // name of the instance
	DisplayName string // display name for UIs
}

// InstanceConf contains the information necessary to create an Instance
type InstanceConf struct {
	InstanceId, DisplayName, ClusterId, Zone string
	// NumNodes must not be specified for DEVELOPMENT instance types
	NumNodes     int32
	StorageType  StorageType
	InstanceType InstanceType
}

var instanceNameRegexp = regexp.MustCompile(`^projects/([^/]+)/instances/([a-z][-a-z0-9]*)$`)

// CreateInstance creates a new instance in the project.
// This method will return when the instance has been created or when an error occurs.
func (iac *InstanceAdminClient) CreateInstance(ctx context.Context, conf *InstanceConf) error {
	ctx = mergeOutgoingMetadata(ctx, iac.md)
	req := &btapb.CreateInstanceRequest{
		Parent:     "projects/" + iac.project,
		InstanceId: conf.InstanceId,
		Instance:   &btapb.Instance{DisplayName: conf.DisplayName, Type: btapb.Instance_Type(conf.InstanceType)},
		Clusters: map[string]*btapb.Cluster{
			conf.ClusterId: {
				ServeNodes:         conf.NumNodes,
				DefaultStorageType: conf.StorageType.proto(),
				Location:           "projects/" + iac.project + "/locations/" + conf.Zone,
			},
		},
	}

	lro, err := iac.iClient.CreateInstance(ctx, req)
	if err != nil {
		return err
	}
	resp := btapb.Instance{}
	return longrunning.InternalNewOperation(iac.lroClient, lro).Wait(ctx, &resp)
}

// DeleteInstance deletes an instance from the project.
func (iac *InstanceAdminClient) DeleteInstance(ctx context.Context, instanceId string) error {
	ctx = mergeOutgoingMetadata(ctx, iac.md)
	req := &btapb.DeleteInstanceRequest{"projects/" + iac.project + "/instances/" + instanceId}
	_, err := iac.iClient.DeleteInstance(ctx, req)
	return err
}

// Instances returns a list of instances in the project.
func (iac *InstanceAdminClient) Instances(ctx context.Context) ([]*InstanceInfo, error) {
	ctx = mergeOutgoingMetadata(ctx, iac.md)
	req := &btapb.ListInstancesRequest{
		Parent: "projects/" + iac.project,
	}
	res, err := iac.iClient.ListInstances(ctx, req)
	if err != nil {
		return nil, err
	}
	if len(res.FailedLocations) > 0 {
		// We don't have a good way to return a partial result in the face of some zones being unavailable.
		// Fail the entire request.
		return nil, status.Errorf(codes.Unavailable, "Failed locations: %v", res.FailedLocations)
	}

	var is []*InstanceInfo
	for _, i := range res.Instances {
		m := instanceNameRegexp.FindStringSubmatch(i.Name)
		if m == nil {
			return nil, fmt.Errorf("malformed instance name %q", i.Name)
		}
		is = append(is, &InstanceInfo{
			Name:        m[2],
			DisplayName: i.DisplayName,
		})
	}
	return is, nil
}

// InstanceInfo returns information about an instance.
func (iac *InstanceAdminClient) InstanceInfo(ctx context.Context, instanceId string) (*InstanceInfo, error) {
	ctx = mergeOutgoingMetadata(ctx, iac.md)
	req := &btapb.GetInstanceRequest{
		Name: "projects/" + iac.project + "/instances/" + instanceId,
	}
	res, err := iac.iClient.GetInstance(ctx, req)
	if err != nil {
		return nil, err
	}

	m := instanceNameRegexp.FindStringSubmatch(res.Name)
	if m == nil {
		return nil, fmt.Errorf("malformed instance name %q", res.Name)
	}
	return &InstanceInfo{
		Name:        m[2],
		DisplayName: res.DisplayName,
	}, nil
}
