// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"time"
)

const (
	JOB_TYPE_DATA_RETENTION                 = "data_retention"
	JOB_TYPE_MESSAGE_EXPORT                 = "message_export"
	JOB_TYPE_ELASTICSEARCH_POST_INDEXING    = "elasticsearch_post_indexing"
	JOB_TYPE_ELASTICSEARCH_POST_AGGREGATION = "elasticsearch_post_aggregation"
	JOB_TYPE_LDAP_SYNC                      = "ldap_sync"

	JOB_STATUS_PENDING          = "pending"
	JOB_STATUS_IN_PROGRESS      = "in_progress"
	JOB_STATUS_SUCCESS          = "success"
	JOB_STATUS_ERROR            = "error"
	JOB_STATUS_CANCEL_REQUESTED = "cancel_requested"
	JOB_STATUS_CANCELED         = "canceled"
)

type Job struct {
	Id             string            `json:"id"`
	Type           string            `json:"type"`
	Priority       int64             `json:"priority"`
	CreateAt       int64             `json:"create_at"`
	StartAt        int64             `json:"start_at"`
	LastActivityAt int64             `json:"last_activity_at"`
	Status         string            `json:"status"`
	Progress       int64             `json:"progress"`
	Data           map[string]string `json:"data"`
}

func (j *Job) IsValid() *AppError {
	if len(j.Id) != 26 {
		return NewAppError("Job.IsValid", "model.job.is_valid.id.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	if j.CreateAt == 0 {
		return NewAppError("Job.IsValid", "model.job.is_valid.create_at.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	switch j.Type {
	case JOB_TYPE_DATA_RETENTION:
	case JOB_TYPE_ELASTICSEARCH_POST_INDEXING:
	case JOB_TYPE_ELASTICSEARCH_POST_AGGREGATION:
	case JOB_TYPE_LDAP_SYNC:
	case JOB_TYPE_MESSAGE_EXPORT:
	default:
		return NewAppError("Job.IsValid", "model.job.is_valid.type.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	switch j.Status {
	case JOB_STATUS_PENDING:
	case JOB_STATUS_IN_PROGRESS:
	case JOB_STATUS_SUCCESS:
	case JOB_STATUS_ERROR:
	case JOB_STATUS_CANCEL_REQUESTED:
	case JOB_STATUS_CANCELED:
	default:
		return NewAppError("Job.IsValid", "model.job.is_valid.status.app_error", nil, "id="+j.Id, http.StatusBadRequest)
	}

	return nil
}

func (js *Job) ToJson() string {
	if b, err := json.Marshal(js); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func JobFromJson(data io.Reader) *Job {
	var job Job
	if err := json.NewDecoder(data).Decode(&job); err == nil {
		return &job
	} else {
		return nil
	}
}

func JobsToJson(jobs []*Job) string {
	if b, err := json.Marshal(jobs); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func JobsFromJson(data io.Reader) []*Job {
	var jobs []*Job
	if err := json.NewDecoder(data).Decode(&jobs); err == nil {
		return jobs
	} else {
		return nil
	}
}

func (js *Job) DataToJson() string {
	if b, err := json.Marshal(js.Data); err != nil {
		return ""
	} else {
		return string(b)
	}
}

type Worker interface {
	Run()
	Stop()
	JobChannel() chan<- Job
}

type Scheduler interface {
	Name() string
	JobType() string
	Enabled(cfg *Config) bool
	NextScheduleTime(cfg *Config, now time.Time, pendingJobs bool, lastSuccessfulJob *Job) *time.Time
	ScheduleJob(cfg *Config, pendingJobs bool, lastSuccessfulJob *Job) (*Job, *AppError)
}
