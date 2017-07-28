package elastic

import (
	"context"
	"fmt"
	"net/url"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// TasksGetTaskService retrieves the state of a task in the cluster. It is part of the Task Management API
// documented at http://www.elastic.co/guide/en/elasticsearch/reference/5.2/tasks-list.html.
//
// It is supported as of Elasticsearch 2.3.0.
type TasksGetTaskService struct {
	client            *Client
	pretty            bool
	taskId            string
	waitForCompletion *bool
}

// NewTasksGetTaskService creates a new TasksGetTaskService.
func NewTasksGetTaskService(client *Client) *TasksGetTaskService {
	return &TasksGetTaskService{
		client: client,
	}
}

// TaskId indicates to return the task with specified id.
func (s *TasksGetTaskService) TaskId(taskId string) *TasksGetTaskService {
	s.taskId = taskId
	return s
}

// WaitForCompletion indicates whether to wait for the matching tasks
// to complete (default: false).
func (s *TasksGetTaskService) WaitForCompletion(waitForCompletion bool) *TasksGetTaskService {
	s.waitForCompletion = &waitForCompletion
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *TasksGetTaskService) Pretty(pretty bool) *TasksGetTaskService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *TasksGetTaskService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/_tasks/{task_id}", map[string]string{
		"task_id": s.taskId,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.waitForCompletion != nil {
		params.Set("wait_for_completion", fmt.Sprintf("%v", *s.waitForCompletion))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *TasksGetTaskService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *TasksGetTaskService) Do(ctx context.Context) (*TasksGetTaskResponse, error) {
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
	res, err := s.client.PerformRequest(ctx, "GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(TasksGetTaskResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

type TasksGetTaskResponse struct {
	Completed bool      `json:"completed"`
	Task      *TaskInfo `json:"task,omitempty"`
}
