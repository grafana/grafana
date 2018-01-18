// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/url"
	"strings"

	"golang.org/x/net/context"

	"gopkg.in/olivere/elastic.v3/uritemplates"
)

// TasksCancelService can cancel long-running tasks.
// It is supported as of Elasticsearch 2.3.0.
//
// See http://www.elastic.co/guide/en/elasticsearch/reference/master/tasks-cancel.html
// for details.
type TasksCancelService struct {
	client     *Client
	pretty     bool
	taskId     *int64
	actions    []string
	nodeId     []string
	parentNode string
	parentTask *int64
}

// NewTasksCancelService creates a new TasksCancelService.
func NewTasksCancelService(client *Client) *TasksCancelService {
	return &TasksCancelService{
		client:  client,
		actions: make([]string, 0),
		nodeId:  make([]string, 0),
	}
}

// TaskId specifies the task to cancel. Set to -1 to cancel all tasks.
func (s *TasksCancelService) TaskId(taskId int64) *TasksCancelService {
	s.taskId = &taskId
	return s
}

// Actions is a list of actions that should be cancelled. Leave empty to cancel all.
func (s *TasksCancelService) Actions(actions []string) *TasksCancelService {
	s.actions = actions
	return s
}

// NodeId is a list of node IDs or names to limit the returned information;
// use `_local` to return information from the node you're connecting to,
// leave empty to get information from all nodes.
func (s *TasksCancelService) NodeId(nodeId []string) *TasksCancelService {
	s.nodeId = nodeId
	return s
}

// ParentNode specifies to cancel tasks with specified parent node.
func (s *TasksCancelService) ParentNode(parentNode string) *TasksCancelService {
	s.parentNode = parentNode
	return s
}

// ParentTask specifies to cancel tasks with specified parent task id.
// Set to -1 to cancel all.
func (s *TasksCancelService) ParentTask(parentTask int64) *TasksCancelService {
	s.parentTask = &parentTask
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *TasksCancelService) Pretty(pretty bool) *TasksCancelService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *TasksCancelService) buildURL() (string, url.Values, error) {
	// Build URL
	var err error
	var path string
	if s.taskId != nil {
		path, err = uritemplates.Expand("/_tasks/{task_id}/_cancel", map[string]string{
			"task_id": fmt.Sprintf("%d", *s.taskId),
		})
	} else {
		path = "/_tasks/_cancel"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if len(s.actions) > 0 {
		params.Set("actions", strings.Join(s.actions, ","))
	}
	if len(s.nodeId) > 0 {
		params.Set("node_id", strings.Join(s.nodeId, ","))
	}
	if s.parentNode != "" {
		params.Set("parent_node", s.parentNode)
	}
	if s.parentTask != nil {
		params.Set("parent_task", fmt.Sprintf("%v", *s.parentTask))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *TasksCancelService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *TasksCancelService) Do() (*TasksListResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *TasksCancelService) DoC(ctx context.Context) (*TasksListResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequestC(ctx, "POST", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(TasksListResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}
