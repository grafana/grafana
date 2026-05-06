// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

package api

import (
	"context"
	"fmt"
	"time"

	"github.com/influxdata/influxdb-client-go/v2/domain"
)

// TaskFilter defines filtering options for FindTasks functions.
type TaskFilter struct {
	// Returns task with a specific name
	Name string
	// Filter tasks to a specific organization name.
	OrgName string
	// Filter tasks to a specific organization ID.
	OrgID string
	// Filter tasks to a specific user ID.
	User string
	// Filter tasks by a status--"inactive" or "active".
	Status domain.TaskStatusType
	// Return tasks after a specified ID.
	After string
	// The number of tasks to return.
	// Default 100, minimum: 1, maximum 500
	Limit int
}

// RunFilter defines filtering options for FindRun* functions.
type RunFilter struct {
	// Return runs after a specified ID.
	After string
	// The number of runs to return.
	// Default 100, minimum 1, maximum 500.
	Limit int
	// Filter runs to those scheduled before this time.
	BeforeTime time.Time
	// Filter runs to those scheduled after this time.
	AfterTime time.Time
}

// TasksAPI provides methods for managing tasks and task runs in an InfluxDB server.
type TasksAPI interface {
	// FindTasks retrieves tasks according to the filter. More fields can be applied. Filter can be nil.
	FindTasks(ctx context.Context, filter *TaskFilter) ([]domain.Task, error)
	// GetTask retrieves a refreshed instance of task.
	GetTask(ctx context.Context, task *domain.Task) (*domain.Task, error)
	// GetTaskByID retrieves a task found using taskID.
	GetTaskByID(ctx context.Context, taskID string) (*domain.Task, error)
	// CreateTask creates a new task according the task object.
	// It copies OrgId, Name, Description, Flux, Status and Every or Cron properties. Every and Cron are mutually exclusive.
	// Every has higher priority.
	CreateTask(ctx context.Context, task *domain.Task) (*domain.Task, error)
	// CreateTaskWithEvery creates a new task with the name, flux script and every repetition setting, in the org orgID.
	// Every means duration values.
	CreateTaskWithEvery(ctx context.Context, name, flux, every, orgID string) (*domain.Task, error)
	// CreateTaskWithCron creates a new task with the name, flux script and cron repetition setting, in the org orgID
	// Cron holds cron-like setting, e.g. once an hour at beginning of the hour "0 * * * *".
	CreateTaskWithCron(ctx context.Context, name, flux, cron, orgID string) (*domain.Task, error)
	// CreateTaskByFlux creates a new task with complete definition in flux script, in the org orgID
	CreateTaskByFlux(ctx context.Context, flux, orgID string) (*domain.Task, error)
	// UpdateTask updates a task.
	// It copies Description, Flux, Status, Offset and Every or Cron properties. Every and Cron are mutually exclusive.
	// Every has higher priority.
	UpdateTask(ctx context.Context, task *domain.Task) (*domain.Task, error)
	// DeleteTask deletes a task.
	DeleteTask(ctx context.Context, task *domain.Task) error
	// DeleteTaskWithID deletes a task with taskID.
	DeleteTaskWithID(ctx context.Context, taskID string) error
	// FindMembers retrieves members of a task.
	FindMembers(ctx context.Context, task *domain.Task) ([]domain.ResourceMember, error)
	// FindMembersWithID retrieves members of a task with taskID.
	FindMembersWithID(ctx context.Context, taskID string) ([]domain.ResourceMember, error)
	// AddMember adds a member to a task.
	AddMember(ctx context.Context, task *domain.Task, user *domain.User) (*domain.ResourceMember, error)
	// AddMemberWithID adds a member with id memberID to a task with taskID.
	AddMemberWithID(ctx context.Context, taskID, memberID string) (*domain.ResourceMember, error)
	// RemoveMember removes a member from a task.
	RemoveMember(ctx context.Context, task *domain.Task, user *domain.User) error
	// RemoveMemberWithID removes a member with id memberID from a task with taskID.
	RemoveMemberWithID(ctx context.Context, taskID, memberID string) error
	// FindOwners retrieves owners of a task.
	FindOwners(ctx context.Context, task *domain.Task) ([]domain.ResourceOwner, error)
	// FindOwnersWithID retrieves owners of a task with taskID.
	FindOwnersWithID(ctx context.Context, taskID string) ([]domain.ResourceOwner, error)
	// AddOwner adds an owner to a task.
	AddOwner(ctx context.Context, task *domain.Task, user *domain.User) (*domain.ResourceOwner, error)
	// AddOwnerWithID adds an owner with id memberID to a task with taskID.
	AddOwnerWithID(ctx context.Context, taskID, memberID string) (*domain.ResourceOwner, error)
	// RemoveOwner removes an owner from a task.
	RemoveOwner(ctx context.Context, task *domain.Task, user *domain.User) error
	// RemoveOwnerWithID removes a member with id memberID from a task with taskID.
	RemoveOwnerWithID(ctx context.Context, taskID, memberID string) error
	// FindRuns retrieves a task runs according the filter. More fields can be applied. Filter can be nil.
	FindRuns(ctx context.Context, task *domain.Task, filter *RunFilter) ([]domain.Run, error)
	// FindRunsWithID retrieves runs of a task with taskID according the filter. More fields can be applied. Filter can be nil.
	FindRunsWithID(ctx context.Context, taskID string, filter *RunFilter) ([]domain.Run, error)
	// GetRun retrieves a refreshed instance if a task run.
	GetRun(ctx context.Context, run *domain.Run) (*domain.Run, error)
	// GetRunByID retrieves a specific task run by taskID and runID
	GetRunByID(ctx context.Context, taskID, runID string) (*domain.Run, error)
	// FindRunLogs return all log events for a task run.
	FindRunLogs(ctx context.Context, run *domain.Run) ([]domain.LogEvent, error)
	// FindRunLogsWithID return all log events for a run with runID of a task with taskID.
	FindRunLogsWithID(ctx context.Context, taskID, runID string) ([]domain.LogEvent, error)
	// RunManually manually start a run of the task now, overriding the current schedule.
	RunManually(ctx context.Context, task *domain.Task) (*domain.Run, error)
	// RunManuallyWithID manually start a run of a task with taskID now, overriding the current schedule.
	RunManuallyWithID(ctx context.Context, taskID string) (*domain.Run, error)
	// RetryRun retry a task run.
	RetryRun(ctx context.Context, run *domain.Run) (*domain.Run, error)
	// RetryRunWithID retry a run with runID of a task with taskID.
	RetryRunWithID(ctx context.Context, taskID, runID string) (*domain.Run, error)
	// CancelRun cancels a running task.
	CancelRun(ctx context.Context, run *domain.Run) error
	// CancelRunWithID cancels a running task.
	CancelRunWithID(ctx context.Context, taskID, runID string) error
	// FindLogs retrieves all logs for a task.
	FindLogs(ctx context.Context, task *domain.Task) ([]domain.LogEvent, error)
	// FindLogsWithID retrieves all logs for a task with taskID.
	FindLogsWithID(ctx context.Context, taskID string) ([]domain.LogEvent, error)
	// FindLabels retrieves labels of a task.
	FindLabels(ctx context.Context, task *domain.Task) ([]domain.Label, error)
	// FindLabelsWithID retrieves labels of a task with taskID.
	FindLabelsWithID(ctx context.Context, taskID string) ([]domain.Label, error)
	// AddLabel adds a label to a task.
	AddLabel(ctx context.Context, task *domain.Task, label *domain.Label) (*domain.Label, error)
	// AddLabelWithID adds a label with id labelID to a task with taskID.
	AddLabelWithID(ctx context.Context, taskID, labelID string) (*domain.Label, error)
	// RemoveLabel removes a label from a task.
	RemoveLabel(ctx context.Context, task *domain.Task, label *domain.Label) error
	// RemoveLabelWithID removes a label with id labelID from a task with taskID.
	RemoveLabelWithID(ctx context.Context, taskID, labelID string) error
}

// tasksAPI implements TasksAPI
type tasksAPI struct {
	apiClient *domain.Client
}

// NewTasksAPI creates new instance of TasksAPI
func NewTasksAPI(apiClient *domain.Client) TasksAPI {
	return &tasksAPI{
		apiClient: apiClient,
	}
}

func (t *tasksAPI) FindTasks(ctx context.Context, filter *TaskFilter) ([]domain.Task, error) {
	params := &domain.GetTasksParams{}
	if filter != nil {
		if filter.Name != "" {
			params.Name = &filter.Name
		}
		if filter.User != "" {
			params.User = &filter.User
		}
		if filter.OrgID != "" {
			params.OrgID = &filter.OrgID
		}
		if filter.OrgName != "" {
			params.Org = &filter.OrgName
		}
		if filter.Status != "" {
			status := domain.GetTasksParamsStatus(filter.Status)
			params.Status = &status
		}
		if filter.Limit > 0 {
			params.Limit = &filter.Limit
		}
		if filter.After != "" {
			params.After = &filter.After
		}
	}

	response, err := t.apiClient.GetTasks(ctx, params)
	if err != nil {
		return nil, err
	}
	return *response.Tasks, nil
}

func (t *tasksAPI) GetTask(ctx context.Context, task *domain.Task) (*domain.Task, error) {
	return t.GetTaskByID(ctx, task.Id)
}

func (t *tasksAPI) GetTaskByID(ctx context.Context, taskID string) (*domain.Task, error) {
	params := &domain.GetTasksIDAllParams{
		TaskID: taskID,
	}
	return t.apiClient.GetTasksID(ctx, params)
}

func (t *tasksAPI) createTask(ctx context.Context, taskReq *domain.TaskCreateRequest) (*domain.Task, error) {
	params := &domain.PostTasksAllParams{
		Body: domain.PostTasksJSONRequestBody(*taskReq),
	}
	return t.apiClient.PostTasks(ctx, params)
}

func createTaskReqDetailed(name, flux string, every, cron *string, orgID string) *domain.TaskCreateRequest {
	repetition := ""
	if every != nil {
		repetition = fmt.Sprintf("every: %s", *every)
	} else if cron != nil {
		repetition = fmt.Sprintf(`cron: "%s"`, *cron)
	}
	fullFlux := fmt.Sprintf(`option task = { name: "%s", %s } %s`, name, repetition, flux)
	return createTaskReq(fullFlux, orgID)
}
func createTaskReq(flux string, orgID string) *domain.TaskCreateRequest {

	status := domain.TaskStatusTypeActive
	taskReq := &domain.TaskCreateRequest{
		Flux:   flux,
		Status: &status,
		OrgID:  &orgID,
	}
	return taskReq
}

func (t *tasksAPI) CreateTask(ctx context.Context, task *domain.Task) (*domain.Task, error) {
	taskReq := createTaskReqDetailed(task.Name, task.Flux, task.Every, task.Cron, task.OrgID)
	taskReq.Description = task.Description
	taskReq.Status = task.Status
	return t.createTask(ctx, taskReq)
}

func (t *tasksAPI) CreateTaskWithEvery(ctx context.Context, name, flux, every, orgID string) (*domain.Task, error) {
	taskReq := createTaskReqDetailed(name, flux, &every, nil, orgID)
	return t.createTask(ctx, taskReq)
}

func (t *tasksAPI) CreateTaskWithCron(ctx context.Context, name, flux, cron, orgID string) (*domain.Task, error) {
	taskReq := createTaskReqDetailed(name, flux, nil, &cron, orgID)
	return t.createTask(ctx, taskReq)
}

func (t *tasksAPI) CreateTaskByFlux(ctx context.Context, flux, orgID string) (*domain.Task, error) {
	taskReq := createTaskReq(flux, orgID)
	return t.createTask(ctx, taskReq)
}

func (t *tasksAPI) DeleteTask(ctx context.Context, task *domain.Task) error {
	return t.DeleteTaskWithID(ctx, task.Id)
}

func (t *tasksAPI) DeleteTaskWithID(ctx context.Context, taskID string) error {
	params := &domain.DeleteTasksIDAllParams{
		TaskID: taskID,
	}
	return t.apiClient.DeleteTasksID(ctx, params)
}

func (t *tasksAPI) UpdateTask(ctx context.Context, task *domain.Task) (*domain.Task, error) {
	params := &domain.PatchTasksIDAllParams{
		Body: domain.PatchTasksIDJSONRequestBody(domain.TaskUpdateRequest{
			Description: task.Description,
			Flux:        &task.Flux,
			Name:        &task.Name,
			Offset:      task.Offset,
			Status:      task.Status,
		}),
		TaskID: task.Id,
	}
	if task.Every != nil {
		params.Body.Every = task.Every
	} else {
		params.Body.Cron = task.Cron
	}
	return t.apiClient.PatchTasksID(ctx, params)
}

func (t *tasksAPI) FindMembers(ctx context.Context, task *domain.Task) ([]domain.ResourceMember, error) {
	return t.FindMembersWithID(ctx, task.Id)
}

func (t *tasksAPI) FindMembersWithID(ctx context.Context, taskID string) ([]domain.ResourceMember, error) {
	params := &domain.GetTasksIDMembersAllParams{
		TaskID: taskID,
	}
	response, err := t.apiClient.GetTasksIDMembers(ctx, params)
	if err != nil {
		return nil, err
	}
	return *response.Users, nil
}

func (t *tasksAPI) AddMember(ctx context.Context, task *domain.Task, user *domain.User) (*domain.ResourceMember, error) {
	return t.AddMemberWithID(ctx, task.Id, *user.Id)
}

func (t *tasksAPI) AddMemberWithID(ctx context.Context, taskID, memberID string) (*domain.ResourceMember, error) {
	params := &domain.PostTasksIDMembersAllParams{
		TaskID: taskID,
		Body:   domain.PostTasksIDMembersJSONRequestBody{Id: memberID},
	}

	return t.apiClient.PostTasksIDMembers(ctx, params)
}

func (t *tasksAPI) RemoveMember(ctx context.Context, task *domain.Task, user *domain.User) error {
	return t.RemoveMemberWithID(ctx, task.Id, *user.Id)
}

func (t *tasksAPI) RemoveMemberWithID(ctx context.Context, taskID, memberID string) error {
	params := &domain.DeleteTasksIDMembersIDAllParams{
		TaskID: taskID,
		UserID: memberID,
	}
	return t.apiClient.DeleteTasksIDMembersID(ctx, params)
}

func (t *tasksAPI) FindOwners(ctx context.Context, task *domain.Task) ([]domain.ResourceOwner, error) {
	return t.FindOwnersWithID(ctx, task.Id)
}

func (t *tasksAPI) FindOwnersWithID(ctx context.Context, taskID string) ([]domain.ResourceOwner, error) {
	params := &domain.GetTasksIDOwnersAllParams{
		TaskID: taskID,
	}
	response, err := t.apiClient.GetTasksIDOwners(ctx, params)
	if err != nil {
		return nil, err
	}
	return *response.Users, nil
}

func (t *tasksAPI) AddOwner(ctx context.Context, task *domain.Task, user *domain.User) (*domain.ResourceOwner, error) {
	return t.AddOwnerWithID(ctx, task.Id, *user.Id)
}

func (t *tasksAPI) AddOwnerWithID(ctx context.Context, taskID, memberID string) (*domain.ResourceOwner, error) {
	params := &domain.PostTasksIDOwnersAllParams{
		Body:   domain.PostTasksIDOwnersJSONRequestBody{Id: memberID},
		TaskID: taskID,
	}
	return t.apiClient.PostTasksIDOwners(ctx, params)
}

func (t *tasksAPI) RemoveOwner(ctx context.Context, task *domain.Task, user *domain.User) error {
	return t.RemoveOwnerWithID(ctx, task.Id, *user.Id)
}

func (t *tasksAPI) RemoveOwnerWithID(ctx context.Context, taskID, memberID string) error {
	params := &domain.DeleteTasksIDOwnersIDAllParams{
		TaskID: taskID,
		UserID: memberID,
	}
	return t.apiClient.DeleteTasksIDOwnersID(ctx, params)
}

func (t *tasksAPI) FindRuns(ctx context.Context, task *domain.Task, filter *RunFilter) ([]domain.Run, error) {
	return t.FindRunsWithID(ctx, task.Id, filter)
}

func (t *tasksAPI) FindRunsWithID(ctx context.Context, taskID string, filter *RunFilter) ([]domain.Run, error) {
	params := &domain.GetTasksIDRunsAllParams{TaskID: taskID}
	if filter != nil {
		if !filter.AfterTime.IsZero() {
			params.AfterTime = &filter.AfterTime
		}
		if !filter.BeforeTime.IsZero() {
			params.BeforeTime = &filter.BeforeTime
		}
		if filter.Limit > 0 {
			params.Limit = &filter.Limit
		}
		if filter.After != "" {
			params.After = &filter.After
		}
	}
	response, err := t.apiClient.GetTasksIDRuns(ctx, params)
	if err != nil {
		return nil, err
	}
	return *response.Runs, nil
}

func (t *tasksAPI) GetRun(ctx context.Context, run *domain.Run) (*domain.Run, error) {
	return t.GetRunByID(ctx, *run.TaskID, *run.Id)
}

func (t *tasksAPI) GetRunByID(ctx context.Context, taskID, runID string) (*domain.Run, error) {
	params := &domain.GetTasksIDRunsIDAllParams{
		TaskID: taskID,
		RunID:  runID,
	}
	return t.apiClient.GetTasksIDRunsID(ctx, params)
}

func (t *tasksAPI) FindRunLogs(ctx context.Context, run *domain.Run) ([]domain.LogEvent, error) {
	return t.FindRunLogsWithID(ctx, *run.TaskID, *run.Id)
}
func (t *tasksAPI) FindRunLogsWithID(ctx context.Context, taskID, runID string) ([]domain.LogEvent, error) {
	params := &domain.GetTasksIDRunsIDLogsAllParams{
		TaskID: taskID,
		RunID:  runID,
	}
	response, err := t.apiClient.GetTasksIDRunsIDLogs(ctx, params)
	if err != nil {
		return nil, err
	}
	if response.Events == nil {
		return nil, fmt.Errorf("logs for task '%s' run '%s 'not found", taskID, runID)
	}
	return *response.Events, nil
}

func (t *tasksAPI) RunManually(ctx context.Context, task *domain.Task) (*domain.Run, error) {
	return t.RunManuallyWithID(ctx, task.Id)
}

func (t *tasksAPI) RunManuallyWithID(ctx context.Context, taskID string) (*domain.Run, error) {
	params := &domain.PostTasksIDRunsAllParams{
		TaskID: taskID,
	}
	return t.apiClient.PostTasksIDRuns(ctx, params)
}

func (t *tasksAPI) RetryRun(ctx context.Context, run *domain.Run) (*domain.Run, error) {
	return t.RetryRunWithID(ctx, *run.TaskID, *run.Id)
}

func (t *tasksAPI) RetryRunWithID(ctx context.Context, taskID, runID string) (*domain.Run, error) {
	params := &domain.PostTasksIDRunsIDRetryAllParams{
		TaskID: taskID,
		RunID:  runID,
	}
	return t.apiClient.PostTasksIDRunsIDRetry(ctx, params)
}

func (t *tasksAPI) CancelRun(ctx context.Context, run *domain.Run) error {
	return t.CancelRunWithID(ctx, *run.TaskID, *run.Id)
}

func (t *tasksAPI) CancelRunWithID(ctx context.Context, taskID, runID string) error {
	params := &domain.DeleteTasksIDRunsIDAllParams{
		TaskID: taskID,
		RunID:  runID,
	}
	return t.apiClient.DeleteTasksIDRunsID(ctx, params)
}

func (t *tasksAPI) FindLogs(ctx context.Context, task *domain.Task) ([]domain.LogEvent, error) {
	return t.FindLogsWithID(ctx, task.Id)
}

func (t *tasksAPI) FindLogsWithID(ctx context.Context, taskID string) ([]domain.LogEvent, error) {
	params := &domain.GetTasksIDLogsAllParams{
		TaskID: taskID,
	}
	response, err := t.apiClient.GetTasksIDLogs(ctx, params)
	if err != nil {
		return nil, err
	}
	if response.Events == nil {
		return nil, fmt.Errorf("logs for task '%s' not found", taskID)
	}
	return *response.Events, nil
}

func (t *tasksAPI) FindLabels(ctx context.Context, task *domain.Task) ([]domain.Label, error) {
	return t.FindLabelsWithID(ctx, task.Id)
}

func (t *tasksAPI) FindLabelsWithID(ctx context.Context, taskID string) ([]domain.Label, error) {
	params := &domain.GetTasksIDLabelsAllParams{
		TaskID: taskID,
	}
	response, err := t.apiClient.GetTasksIDLabels(ctx, params)
	if err != nil {
		return nil, err
	}
	if response.Labels == nil {
		return nil, fmt.Errorf("lables for task '%s' not found", taskID)
	}
	return *response.Labels, nil
}

func (t *tasksAPI) AddLabel(ctx context.Context, task *domain.Task, label *domain.Label) (*domain.Label, error) {
	return t.AddLabelWithID(ctx, task.Id, *label.Id)
}

func (t *tasksAPI) AddLabelWithID(ctx context.Context, taskID, labelID string) (*domain.Label, error) {
	params := &domain.PostTasksIDLabelsAllParams{
		Body:   domain.PostTasksIDLabelsJSONRequestBody{LabelID: &labelID},
		TaskID: taskID,
	}
	response, err := t.apiClient.PostTasksIDLabels(ctx, params)
	if err != nil {
		return nil, err
	}
	return response.Label, nil
}

func (t *tasksAPI) RemoveLabel(ctx context.Context, task *domain.Task, label *domain.Label) error {
	return t.RemoveLabelWithID(ctx, task.Id, *label.Id)
}

func (t *tasksAPI) RemoveLabelWithID(ctx context.Context, taskID, labelID string) error {
	params := &domain.DeleteTasksIDLabelsIDAllParams{
		TaskID:  taskID,
		LabelID: labelID,
	}
	return t.apiClient.DeleteTasksIDLabelsID(ctx, params)
}
