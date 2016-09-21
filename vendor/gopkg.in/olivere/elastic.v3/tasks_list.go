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

// TasksListService retrieves the list of currently executing tasks
// on one ore more nodes in the cluster. It is part of the Task Management API
// documented at http://www.elastic.co/guide/en/elasticsearch/reference/master/tasks-list.html.
//
// It is supported as of Elasticsearch 2.3.0.
type TasksListService struct {
	client            *Client
	pretty            bool
	taskId            []int64
	actions           []string
	detailed          *bool
	nodeId            []string
	parentNode        string
	parentTask        *int64
	waitForCompletion *bool
}

// NewTasksListService creates a new TasksListService.
func NewTasksListService(client *Client) *TasksListService {
	return &TasksListService{
		client:  client,
		taskId:  make([]int64, 0),
		actions: make([]string, 0),
		nodeId:  make([]string, 0),
	}
}

// TaskId indicates to returns the task(s) with specified id(s).
func (s *TasksListService) TaskId(taskId ...int64) *TasksListService {
	s.taskId = append(s.taskId, taskId...)
	return s
}

// Actions is a list of actions that should be returned. Leave empty to return all.
func (s *TasksListService) Actions(actions ...string) *TasksListService {
	s.actions = append(s.actions, actions...)
	return s
}

// Detailed indicates whether to return detailed task information (default: false).
func (s *TasksListService) Detailed(detailed bool) *TasksListService {
	s.detailed = &detailed
	return s
}

// NodeId is a list of node IDs or names to limit the returned information;
// use `_local` to return information from the node you're connecting to,
// leave empty to get information from all nodes.
func (s *TasksListService) NodeId(nodeId ...string) *TasksListService {
	s.nodeId = append(s.nodeId, nodeId...)
	return s
}

// ParentNode returns tasks with specified parent node.
func (s *TasksListService) ParentNode(parentNode string) *TasksListService {
	s.parentNode = parentNode
	return s
}

// ParentTask returns tasks with specified parent task id. Set to -1 to return all.
func (s *TasksListService) ParentTask(parentTask int64) *TasksListService {
	s.parentTask = &parentTask
	return s
}

// WaitForCompletion indicates whether to wait for the matching tasks
// to complete (default: false).
func (s *TasksListService) WaitForCompletion(waitForCompletion bool) *TasksListService {
	s.waitForCompletion = &waitForCompletion
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *TasksListService) Pretty(pretty bool) *TasksListService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *TasksListService) buildURL() (string, url.Values, error) {
	// Build URL
	var err error
	var path string
	if len(s.taskId) > 0 {
		var tasks []string
		for _, taskId := range s.taskId {
			tasks = append(tasks, fmt.Sprintf("%d", taskId))
		}
		path, err = uritemplates.Expand("/_tasks/{task_id}", map[string]string{
			"task_id": strings.Join(tasks, ","),
		})
	} else {
		path = "/_tasks"
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
	if s.detailed != nil {
		params.Set("detailed", fmt.Sprintf("%v", *s.detailed))
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
	if s.waitForCompletion != nil {
		params.Set("wait_for_completion", fmt.Sprintf("%v", *s.waitForCompletion))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *TasksListService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *TasksListService) Do() (*TasksListResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *TasksListService) DoC(ctx context.Context) (*TasksListResponse, error) {
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
	res, err := s.client.PerformRequestC(ctx, "GET", path, params, nil)
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

// TasksListResponse is the response of TasksListService.Do.
type TasksListResponse struct {
	TaskFailures []*TaskOperationFailure `json:"task_failures"`
	NodeFailures []*FailedNodeException  `json:"node_failures"`
	// Nodes returns the tasks per node. The key is the node id.
	Nodes map[string]*DiscoveryNode `json:"nodes"`
}

type TaskOperationFailure struct {
	TaskId int64         `json:"task_id"`
	NodeId string        `json:"node_id"`
	Status string        `json:"status"`
	Reason *ErrorDetails `json:"reason"`
}

type FailedNodeException struct {
	*ErrorDetails
	NodeId string `json:"node_id"`
}

type DiscoveryNode struct {
	Name             string                 `json:"name"`
	TransportAddress string                 `json:"transport_address"`
	Host             string                 `json:"host"`
	IP               string                 `json:"ip"`
	Attributes       map[string]interface{} `json:"attributes"`
	// Tasks returns the tasks by its id (as a string).
	Tasks map[string]*TaskInfo `json:"tasks"`
}

type TaskInfo struct {
	Node               string      `json:"node"`
	Id                 int64       `json:"id"` // the task id
	Type               string      `json:"type"`
	Action             string      `json:"action"`
	Status             interface{} `json:"status"`
	Description        interface{} `json:"description"`
	StartTime          string      `json:"start_time"`
	StartTimeInMillis  int64       `json:"start_time_in_millis"`
	RunningTime        string      `json:"running_time"`
	RunningTimeInNanos int64       `json:"running_time_in_nanos"`
	ParentTaskId       string      `json:"parent_task_id"` // like "YxJnVYjwSBm_AUbzddTajQ:12356"
}
