/*
Copyright 2017 Google Inc. All Rights Reserved.

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

package testutil

import (
	"errors"
	"fmt"
	"reflect"
	"sync"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/golang/protobuf/ptypes/empty"
	proto3 "github.com/golang/protobuf/ptypes/struct"
	pbt "github.com/golang/protobuf/ptypes/timestamp"

	sppb "google.golang.org/genproto/googleapis/spanner/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
)

// Action is a mocked RPC activity that MockCloudSpannerClient will take.
type Action struct {
	Method string
	Err    error
}

// MockCloudSpannerClient is a mock implementation of sppb.SpannerClient.
type MockCloudSpannerClient struct {
	sppb.SpannerClient

	mu sync.Mutex
	t  *testing.T
	// Live sessions on the client.
	sessions map[string]bool
	// Expected set of actions that will be executed by the client.
	actions []Action
	// Session ping history.
	pings []string
	// Injected error, will be returned by all APIs.
	injErr map[string]error
	// Client will not fail on any request.
	nice bool
	// Client will stall on any requests.
	freezed chan struct{}
}

// NewMockCloudSpannerClient creates new MockCloudSpannerClient instance.
func NewMockCloudSpannerClient(t *testing.T, acts ...Action) *MockCloudSpannerClient {
	mc := &MockCloudSpannerClient{t: t, sessions: map[string]bool{}, injErr: map[string]error{}}
	mc.SetActions(acts...)
	// Produce a closed channel, so the default action of ready is to not block.
	mc.Freeze()
	mc.Unfreeze()
	return mc
}

// MakeNice makes this a nice mock which will not fail on any request.
func (m *MockCloudSpannerClient) MakeNice() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.nice = true
}

// MakeStrict makes this a strict mock which will fail on any unexpected request.
func (m *MockCloudSpannerClient) MakeStrict() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.nice = false
}

// InjectError injects a global error that will be returned by all calls to method
// regardless of the actions array.
func (m *MockCloudSpannerClient) InjectError(method string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.injErr[method] = err
}

// SetActions sets the new set of expected actions to MockCloudSpannerClient.
func (m *MockCloudSpannerClient) SetActions(acts ...Action) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.actions = nil
	for _, act := range acts {
		m.actions = append(m.actions, act)
	}
}

// DumpPings dumps the ping history.
func (m *MockCloudSpannerClient) DumpPings() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]string(nil), m.pings...)
}

// DumpSessions dumps the internal session table.
func (m *MockCloudSpannerClient) DumpSessions() map[string]bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	st := map[string]bool{}
	for s, v := range m.sessions {
		st[s] = v
	}
	return st
}

// CreateSession is a placeholder for SpannerClient.CreateSession.
func (m *MockCloudSpannerClient) CreateSession(c context.Context, r *sppb.CreateSessionRequest, opts ...grpc.CallOption) (*sppb.Session, error) {
	m.ready()
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.injErr["CreateSession"]; err != nil {
		return nil, err
	}
	s := &sppb.Session{}
	if r.Database != "mockdb" {
		// Reject other databases
		return s, grpc.Errorf(codes.NotFound, fmt.Sprintf("database not found: %v", r.Database))
	}
	// Generate & record session name.
	s.Name = fmt.Sprintf("mockdb-%v", time.Now().UnixNano())
	m.sessions[s.Name] = true
	return s, nil
}

// GetSession is a placeholder for SpannerClient.GetSession.
func (m *MockCloudSpannerClient) GetSession(c context.Context, r *sppb.GetSessionRequest, opts ...grpc.CallOption) (*sppb.Session, error) {
	m.ready()
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.injErr["GetSession"]; err != nil {
		return nil, err
	}
	m.pings = append(m.pings, r.Name)
	if _, ok := m.sessions[r.Name]; !ok {
		return nil, grpc.Errorf(codes.NotFound, fmt.Sprintf("Session not found: %v", r.Name))
	}
	return &sppb.Session{Name: r.Name}, nil
}

// DeleteSession is a placeholder for SpannerClient.DeleteSession.
func (m *MockCloudSpannerClient) DeleteSession(c context.Context, r *sppb.DeleteSessionRequest, opts ...grpc.CallOption) (*empty.Empty, error) {
	m.ready()
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.injErr["DeleteSession"]; err != nil {
		return nil, err
	}
	if _, ok := m.sessions[r.Name]; !ok {
		// Session not found.
		return &empty.Empty{}, grpc.Errorf(codes.NotFound, fmt.Sprintf("Session not found: %v", r.Name))
	}
	// Delete session from in-memory table.
	delete(m.sessions, r.Name)
	return &empty.Empty{}, nil
}

// ExecuteStreamingSql is a mock implementation of SpannerClient.ExecuteStreamingSql.
func (m *MockCloudSpannerClient) ExecuteStreamingSql(c context.Context, r *sppb.ExecuteSqlRequest, opts ...grpc.CallOption) (sppb.Spanner_ExecuteStreamingSqlClient, error) {
	m.ready()
	m.mu.Lock()
	defer m.mu.Unlock()
	act, err := m.expectAction("ExecuteStreamingSql")
	if err != nil {
		return nil, err
	}
	wantReq := &sppb.ExecuteSqlRequest{
		Session: "mocksession",
		Transaction: &sppb.TransactionSelector{
			Selector: &sppb.TransactionSelector_SingleUse{
				SingleUse: &sppb.TransactionOptions{
					Mode: &sppb.TransactionOptions_ReadOnly_{
						ReadOnly: &sppb.TransactionOptions_ReadOnly{
							TimestampBound: &sppb.TransactionOptions_ReadOnly_Strong{
								Strong: true,
							},
							ReturnReadTimestamp: false,
						},
					},
				},
			},
		},
		Sql: "mockquery",
		Params: &proto3.Struct{
			Fields: map[string]*proto3.Value{"var1": &proto3.Value{Kind: &proto3.Value_StringValue{StringValue: "abc"}}},
		},
		ParamTypes: map[string]*sppb.Type{"var1": &sppb.Type{Code: sppb.TypeCode_STRING}},
	}
	if !reflect.DeepEqual(r, wantReq) {
		return nil, fmt.Errorf("got query request: %v, want: %v", r, wantReq)
	}
	if act.Err != nil {
		return nil, act.Err
	}
	return nil, errors.New("query never succeeds on mock client")
}

// StreamingRead is a placeholder for SpannerClient.StreamingRead.
func (m *MockCloudSpannerClient) StreamingRead(c context.Context, r *sppb.ReadRequest, opts ...grpc.CallOption) (sppb.Spanner_StreamingReadClient, error) {
	m.ready()
	m.mu.Lock()
	defer m.mu.Unlock()
	act, err := m.expectAction("StreamingRead", "StreamingReadIndex")
	if err != nil {
		return nil, err
	}
	wantReq := &sppb.ReadRequest{
		Session: "mocksession",
		Transaction: &sppb.TransactionSelector{
			Selector: &sppb.TransactionSelector_SingleUse{
				SingleUse: &sppb.TransactionOptions{
					Mode: &sppb.TransactionOptions_ReadOnly_{
						ReadOnly: &sppb.TransactionOptions_ReadOnly{
							TimestampBound: &sppb.TransactionOptions_ReadOnly_Strong{
								Strong: true,
							},
							ReturnReadTimestamp: false,
						},
					},
				},
			},
		},
		Table:   "t_mock",
		Columns: []string{"col1", "col2"},
		KeySet: &sppb.KeySet{
			Keys: []*proto3.ListValue{
				&proto3.ListValue{
					Values: []*proto3.Value{
						&proto3.Value{Kind: &proto3.Value_StringValue{StringValue: "foo"}},
					},
				},
			},
			Ranges: []*sppb.KeyRange{},
			All:    false,
		},
	}
	if act.Method == "StreamingIndexRead" {
		wantReq.Index = "idx1"
	}
	if !reflect.DeepEqual(r, wantReq) {
		return nil, fmt.Errorf("got query request: %v, want: %v", r, wantReq)
	}
	if act.Err != nil {
		return nil, act.Err
	}
	return nil, errors.New("read never succeeds on mock client")
}

// BeginTransaction is a placeholder for SpannerClient.BeginTransaction.
func (m *MockCloudSpannerClient) BeginTransaction(c context.Context, r *sppb.BeginTransactionRequest, opts ...grpc.CallOption) (*sppb.Transaction, error) {
	m.ready()
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.nice {
		act, err := m.expectAction("BeginTransaction")
		if err != nil {
			return nil, err
		}
		if act.Err != nil {
			return nil, act.Err
		}
	}
	resp := &sppb.Transaction{Id: []byte("transaction-1")}
	if _, ok := r.Options.Mode.(*sppb.TransactionOptions_ReadOnly_); ok {
		resp.ReadTimestamp = &pbt.Timestamp{Seconds: 3, Nanos: 4}
	}
	return resp, nil
}

// Commit is a placeholder for SpannerClient.Commit.
func (m *MockCloudSpannerClient) Commit(c context.Context, r *sppb.CommitRequest, opts ...grpc.CallOption) (*sppb.CommitResponse, error) {
	m.ready()
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.nice {
		act, err := m.expectAction("Commit")
		if err != nil {
			return nil, err
		}
		if act.Err != nil {
			return nil, act.Err
		}
	}
	return &sppb.CommitResponse{CommitTimestamp: &pbt.Timestamp{Seconds: 1, Nanos: 2}}, nil
}

// Rollback is a placeholder for SpannerClient.Rollback.
func (m *MockCloudSpannerClient) Rollback(c context.Context, r *sppb.RollbackRequest, opts ...grpc.CallOption) (*empty.Empty, error) {
	m.ready()
	m.mu.Lock()
	defer m.mu.Unlock()
	if !m.nice {
		act, err := m.expectAction("Rollback")
		if err != nil {
			return nil, err
		}
		if act.Err != nil {
			return nil, act.Err
		}
	}
	return nil, nil
}

func (m *MockCloudSpannerClient) expectAction(methods ...string) (Action, error) {
	for _, me := range methods {
		if err := m.injErr[me]; err != nil {
			return Action{}, err
		}
	}
	if len(m.actions) == 0 {
		m.t.Fatalf("unexpected %v executed", methods)
	}
	act := m.actions[0]
	m.actions = m.actions[1:]
	for _, me := range methods {
		if me == act.Method {
			return act, nil
		}
	}
	m.t.Fatalf("unexpected call of one of %v, want method %s", methods, act.Method)
	return Action{}, nil
}

// Freeze stalls all requests.
func (m *MockCloudSpannerClient) Freeze() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.freezed = make(chan struct{})
}

// Unfreeze restores processing requests.
func (m *MockCloudSpannerClient) Unfreeze() {
	m.mu.Lock()
	defer m.mu.Unlock()
	close(m.freezed)
}

// CheckActionsConsumed checks that all actions have been consumed.
func (m *MockCloudSpannerClient) CheckActionsConsumed() {
	if len(m.actions) != 0 {
		m.t.Fatalf("unconsumed mock client actions: %v", m.actions)
	}
}

// ready checks conditions before executing requests
// TODO: add checks for injected errors, actions
func (m *MockCloudSpannerClient) ready() {
	m.mu.Lock()
	freezed := m.freezed
	m.mu.Unlock()
	// check if client should be freezed
	<-freezed
}
