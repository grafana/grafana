// Copyright 2015 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bigquery

import (
	"errors"
	"fmt"
	"math/rand"
	"os"
	"sync"
	"time"

	"cloud.google.com/go/internal"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	bq "google.golang.org/api/bigquery/v2"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/iterator"
)

// A Job represents an operation which has been submitted to BigQuery for processing.
type Job struct {
	c         *Client
	projectID string
	jobID     string

	config     *bq.JobConfiguration
	lastStatus *JobStatus
}

// JobFromID creates a Job which refers to an existing BigQuery job. The job
// need not have been created by this package. For example, the job may have
// been created in the BigQuery console.
func (c *Client) JobFromID(ctx context.Context, id string) (*Job, error) {
	bqjob, err := c.getJobInternal(ctx, id, "configuration", "jobReference", "status", "statistics")
	if err != nil {
		return nil, err
	}
	return bqToJob(bqjob, c)
}

// ID returns the job's ID.
func (j *Job) ID() string {
	return j.jobID
}

// State is one of a sequence of states that a Job progresses through as it is processed.
type State int

const (
	StateUnspecified State = iota // used only as a default in JobIterator
	Pending
	Running
	Done
)

// JobStatus contains the current State of a job, and errors encountered while processing that job.
type JobStatus struct {
	State State

	err error

	// All errors encountered during the running of the job.
	// Not all Errors are fatal, so errors here do not necessarily mean that the job has completed or was unsuccessful.
	Errors []*Error

	// Statistics about the job.
	Statistics *JobStatistics
}

// JobConfig contains configuration information for a job. It is implemented by
// *CopyConfig, *ExtractConfig, *LoadConfig and *QueryConfig.
type JobConfig interface {
	isJobConfig()
}

func (*CopyConfig) isJobConfig()    {}
func (*ExtractConfig) isJobConfig() {}
func (*LoadConfig) isJobConfig()    {}
func (*QueryConfig) isJobConfig()   {}

// Config returns the configuration information for j.
func (j *Job) Config() (JobConfig, error) {
	return bqToJobConfig(j.config, j.c)
}

func bqToJobConfig(q *bq.JobConfiguration, c *Client) (JobConfig, error) {
	switch {
	case q == nil:
		return nil, nil
	case q.Copy != nil:
		return bqToCopyConfig(q, c), nil
	case q.Extract != nil:
		return bqToExtractConfig(q, c), nil
	case q.Load != nil:
		return bqToLoadConfig(q, c), nil
	case q.Query != nil:
		return bqToQueryConfig(q, c)
	default:
		return nil, nil
	}
}

// JobIDConfig  describes how to create an ID for a job.
type JobIDConfig struct {
	// JobID is the ID to use for the job. If empty, a random job ID will be generated.
	JobID string

	// If AddJobIDSuffix is true, then a random string will be appended to JobID.
	AddJobIDSuffix bool
}

// createJobRef creates a JobReference.
// projectID must be non-empty.
func (j *JobIDConfig) createJobRef(projectID string) *bq.JobReference {
	// We don't check whether projectID is empty; the server will return an
	// error when it encounters the resulting JobReference.
	jr := &bq.JobReference{ProjectId: projectID}
	if j.JobID == "" {
		jr.JobId = randomIDFn()
	} else if j.AddJobIDSuffix {
		jr.JobId = j.JobID + "-" + randomIDFn()
	} else {
		jr.JobId = j.JobID
	}
	return jr
}

const alphanum = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

var (
	rngMu sync.Mutex
	rng   = rand.New(rand.NewSource(time.Now().UnixNano() ^ int64(os.Getpid())))
)

// For testing.
var randomIDFn = randomID

// As of August 2017, the BigQuery service uses 27 alphanumeric characters for
// suffixes.
const randomIDLen = 27

func randomID() string {
	// This is used for both job IDs and insert IDs.
	var b [randomIDLen]byte
	rngMu.Lock()
	for i := 0; i < len(b); i++ {
		b[i] = alphanum[rng.Intn(len(alphanum))]
	}
	rngMu.Unlock()
	return string(b[:])
}

// Done reports whether the job has completed.
// After Done returns true, the Err method will return an error if the job completed unsuccesfully.
func (s *JobStatus) Done() bool {
	return s.State == Done
}

// Err returns the error that caused the job to complete unsuccesfully (if any).
func (s *JobStatus) Err() error {
	return s.err
}

// Status retrieves the current status of the job from BigQuery. It fails if the Status could not be determined.
func (j *Job) Status(ctx context.Context) (*JobStatus, error) {
	bqjob, err := j.c.getJobInternal(ctx, j.jobID, "status", "statistics")
	if err != nil {
		return nil, err
	}
	if err := j.setStatus(bqjob.Status); err != nil {
		return nil, err
	}
	j.setStatistics(bqjob.Statistics, j.c)
	return j.lastStatus, nil
}

// LastStatus returns the most recently retrieved status of the job. The status is
// retrieved when a new job is created, or when JobFromID or Job.Status is called.
// Call Job.Status to get the most up-to-date information about a job.
func (j *Job) LastStatus() *JobStatus {
	return j.lastStatus
}

// Cancel requests that a job be cancelled. This method returns without waiting for
// cancellation to take effect. To check whether the job has terminated, use Job.Status.
// Cancelled jobs may still incur costs.
func (j *Job) Cancel(ctx context.Context) error {
	// Jobs.Cancel returns a job entity, but the only relevant piece of
	// data it may contain (the status of the job) is unreliable.  From the
	// docs: "This call will return immediately, and the client will need
	// to poll for the job status to see if the cancel completed
	// successfully".  So it would be misleading to return a status.
	call := j.c.bqs.Jobs.Cancel(j.projectID, j.jobID).
		Fields(). // We don't need any of the response data.
		Context(ctx)
	setClientHeader(call.Header())
	return runWithRetry(ctx, func() error {
		_, err := call.Do()
		return err
	})
}

// Wait blocks until the job or the context is done. It returns the final status
// of the job.
// If an error occurs while retrieving the status, Wait returns that error. But
// Wait returns nil if the status was retrieved successfully, even if
// status.Err() != nil. So callers must check both errors. See the example.
func (j *Job) Wait(ctx context.Context) (*JobStatus, error) {
	if j.isQuery() {
		// We can avoid polling for query jobs.
		if _, err := j.waitForQuery(ctx, j.projectID); err != nil {
			return nil, err
		}
		// Note: extra RPC even if you just want to wait for the query to finish.
		js, err := j.Status(ctx)
		if err != nil {
			return nil, err
		}
		return js, nil
	}
	// Non-query jobs must poll.
	var js *JobStatus
	err := internal.Retry(ctx, gax.Backoff{}, func() (stop bool, err error) {
		js, err = j.Status(ctx)
		if err != nil {
			return true, err
		}
		if js.Done() {
			return true, nil
		}
		return false, nil
	})
	if err != nil {
		return nil, err
	}
	return js, nil
}

// Read fetches the results of a query job.
// If j is not a query job, Read returns an error.
func (j *Job) Read(ctx context.Context) (*RowIterator, error) {
	return j.read(ctx, j.waitForQuery, fetchPage)
}

func (j *Job) read(ctx context.Context, waitForQuery func(context.Context, string) (Schema, error), pf pageFetcher) (*RowIterator, error) {
	if !j.isQuery() {
		return nil, errors.New("bigquery: cannot read from a non-query job")
	}
	destTable := j.config.Query.DestinationTable
	// The destination table should only be nil if there was a query error.
	if destTable == nil {
		return nil, errors.New("bigquery: query job missing destination table")
	}
	projectID := destTable.ProjectId
	schema, err := waitForQuery(ctx, projectID)
	if err != nil {
		return nil, err
	}
	dt := bqToTable(destTable, j.c)
	it := newRowIterator(ctx, dt, pf)
	it.schema = schema
	return it, nil
}

// waitForQuery waits for the query job to complete and returns its schema.
func (j *Job) waitForQuery(ctx context.Context, projectID string) (Schema, error) {
	// Use GetQueryResults only to wait for completion, not to read results.
	call := j.c.bqs.Jobs.GetQueryResults(projectID, j.jobID).Context(ctx).MaxResults(0)
	setClientHeader(call.Header())
	backoff := gax.Backoff{
		Initial:    1 * time.Second,
		Multiplier: 2,
		Max:        60 * time.Second,
	}
	var res *bq.GetQueryResultsResponse
	err := internal.Retry(ctx, backoff, func() (stop bool, err error) {
		res, err = call.Do()
		if err != nil {
			return !retryableError(err), err
		}
		if !res.JobComplete { // GetQueryResults may return early without error; retry.
			return false, nil
		}
		return true, nil
	})
	if err != nil {
		return nil, err
	}
	return bqToSchema(res.Schema), nil
}

// JobStatistics contains statistics about a job.
type JobStatistics struct {
	CreationTime        time.Time
	StartTime           time.Time
	EndTime             time.Time
	TotalBytesProcessed int64

	Details Statistics
}

// Statistics is one of ExtractStatistics, LoadStatistics or QueryStatistics.
type Statistics interface {
	implementsStatistics()
}

// ExtractStatistics contains statistics about an extract job.
type ExtractStatistics struct {
	// The number of files per destination URI or URI pattern specified in the
	// extract configuration. These values will be in the same order as the
	// URIs specified in the 'destinationUris' field.
	DestinationURIFileCounts []int64
}

// LoadStatistics contains statistics about a load job.
type LoadStatistics struct {
	// The number of bytes of source data in a load job.
	InputFileBytes int64

	// The number of source files in a load job.
	InputFiles int64

	// Size of the loaded data in bytes. Note that while a load job is in the
	// running state, this value may change.
	OutputBytes int64

	// The number of rows imported in a load job. Note that while an import job is
	// in the running state, this value may change.
	OutputRows int64
}

// QueryStatistics contains statistics about a query job.
type QueryStatistics struct {
	// Billing tier for the job.
	BillingTier int64

	// Whether the query result was fetched from the query cache.
	CacheHit bool

	// The type of query statement, if valid.
	StatementType string

	// Total bytes billed for the job.
	TotalBytesBilled int64

	// Total bytes processed for the job.
	TotalBytesProcessed int64

	// Describes execution plan for the query.
	QueryPlan []*ExplainQueryStage

	// The number of rows affected by a DML statement. Present only for DML
	// statements INSERT, UPDATE or DELETE.
	NumDMLAffectedRows int64

	// ReferencedTables: [Output-only, Experimental] Referenced tables for
	// the job. Queries that reference more than 50 tables will not have a
	// complete list.
	ReferencedTables []*Table

	// The schema of the results. Present only for successful dry run of
	// non-legacy SQL queries.
	Schema Schema

	// Standard SQL: list of undeclared query parameter names detected during a
	// dry run validation.
	UndeclaredQueryParameterNames []string
}

// ExplainQueryStage describes one stage of a query.
type ExplainQueryStage struct {
	// Relative amount of the total time the average shard spent on CPU-bound tasks.
	ComputeRatioAvg float64

	// Relative amount of the total time the slowest shard spent on CPU-bound tasks.
	ComputeRatioMax float64

	// Unique ID for stage within plan.
	ID int64

	// Human-readable name for stage.
	Name string

	// Relative amount of the total time the average shard spent reading input.
	ReadRatioAvg float64

	// Relative amount of the total time the slowest shard spent reading input.
	ReadRatioMax float64

	// Number of records read into the stage.
	RecordsRead int64

	// Number of records written by the stage.
	RecordsWritten int64

	// Current status for the stage.
	Status string

	// List of operations within the stage in dependency order (approximately
	// chronological).
	Steps []*ExplainQueryStep

	// Relative amount of the total time the average shard spent waiting to be scheduled.
	WaitRatioAvg float64

	// Relative amount of the total time the slowest shard spent waiting to be scheduled.
	WaitRatioMax float64

	// Relative amount of the total time the average shard spent on writing output.
	WriteRatioAvg float64

	// Relative amount of the total time the slowest shard spent on writing output.
	WriteRatioMax float64
}

// ExplainQueryStep describes one step of a query stage.
type ExplainQueryStep struct {
	// Machine-readable operation type.
	Kind string

	// Human-readable stage descriptions.
	Substeps []string
}

func (*ExtractStatistics) implementsStatistics() {}
func (*LoadStatistics) implementsStatistics()    {}
func (*QueryStatistics) implementsStatistics()   {}

// Jobs lists jobs within a project.
func (c *Client) Jobs(ctx context.Context) *JobIterator {
	it := &JobIterator{
		ctx:       ctx,
		c:         c,
		ProjectID: c.projectID,
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(
		it.fetch,
		func() int { return len(it.items) },
		func() interface{} { b := it.items; it.items = nil; return b })
	return it
}

// JobIterator iterates over jobs in a project.
type JobIterator struct {
	ProjectID string // Project ID of the jobs to list. Default is the client's project.
	AllUsers  bool   // Whether to list jobs owned by all users in the project, or just the current caller.
	State     State  // List only jobs in the given state. Defaults to all states.

	ctx      context.Context
	c        *Client
	pageInfo *iterator.PageInfo
	nextFunc func() error
	items    []*Job
}

func (it *JobIterator) PageInfo() *iterator.PageInfo { return it.pageInfo }

func (it *JobIterator) Next() (*Job, error) {
	if err := it.nextFunc(); err != nil {
		return nil, err
	}
	item := it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *JobIterator) fetch(pageSize int, pageToken string) (string, error) {
	var st string
	switch it.State {
	case StateUnspecified:
		st = ""
	case Pending:
		st = "pending"
	case Running:
		st = "running"
	case Done:
		st = "done"
	default:
		return "", fmt.Errorf("bigquery: invalid value for JobIterator.State: %d", it.State)
	}

	req := it.c.bqs.Jobs.List(it.ProjectID).
		Context(it.ctx).
		PageToken(pageToken).
		Projection("full").
		AllUsers(it.AllUsers)
	if st != "" {
		req.StateFilter(st)
	}
	setClientHeader(req.Header())
	if pageSize > 0 {
		req.MaxResults(int64(pageSize))
	}
	res, err := req.Do()
	if err != nil {
		return "", err
	}
	for _, j := range res.Jobs {
		job, err := convertListedJob(j, it.c)
		if err != nil {
			return "", err
		}
		it.items = append(it.items, job)
	}
	return res.NextPageToken, nil
}

func convertListedJob(j *bq.JobListJobs, c *Client) (*Job, error) {
	return bqToJob2(j.JobReference, j.Configuration, j.Status, j.Statistics, c)
}

func (c *Client) getJobInternal(ctx context.Context, jobID string, fields ...googleapi.Field) (*bq.Job, error) {
	var job *bq.Job
	call := c.bqs.Jobs.Get(c.projectID, jobID).Context(ctx)
	if len(fields) > 0 {
		call = call.Fields(fields...)
	}
	setClientHeader(call.Header())
	err := runWithRetry(ctx, func() (err error) {
		job, err = call.Do()
		return err
	})
	if err != nil {
		return nil, err
	}
	return job, nil
}

func bqToJob(q *bq.Job, c *Client) (*Job, error) {
	return bqToJob2(q.JobReference, q.Configuration, q.Status, q.Statistics, c)
}

func bqToJob2(qr *bq.JobReference, qc *bq.JobConfiguration, qs *bq.JobStatus, qt *bq.JobStatistics, c *Client) (*Job, error) {
	j := &Job{
		projectID: qr.ProjectId,
		jobID:     qr.JobId,
		c:         c,
	}
	j.setConfig(qc)
	if err := j.setStatus(qs); err != nil {
		return nil, err
	}
	j.setStatistics(qt, c)
	return j, nil
}

func (j *Job) setConfig(config *bq.JobConfiguration) {
	if config == nil {
		return
	}
	j.config = config
}

func (j *Job) isQuery() bool {
	return j.config != nil && j.config.Query != nil
}

var stateMap = map[string]State{"PENDING": Pending, "RUNNING": Running, "DONE": Done}

func (j *Job) setStatus(qs *bq.JobStatus) error {
	if qs == nil {
		return nil
	}
	state, ok := stateMap[qs.State]
	if !ok {
		return fmt.Errorf("unexpected job state: %v", qs.State)
	}
	j.lastStatus = &JobStatus{
		State: state,
		err:   nil,
	}
	if err := bqToError(qs.ErrorResult); state == Done && err != nil {
		j.lastStatus.err = err
	}
	for _, ep := range qs.Errors {
		j.lastStatus.Errors = append(j.lastStatus.Errors, bqToError(ep))
	}
	return nil
}

func (j *Job) setStatistics(s *bq.JobStatistics, c *Client) {
	if s == nil || j.lastStatus == nil {
		return
	}
	js := &JobStatistics{
		CreationTime:        unixMillisToTime(s.CreationTime),
		StartTime:           unixMillisToTime(s.StartTime),
		EndTime:             unixMillisToTime(s.EndTime),
		TotalBytesProcessed: s.TotalBytesProcessed,
	}
	switch {
	case s.Extract != nil:
		js.Details = &ExtractStatistics{
			DestinationURIFileCounts: []int64(s.Extract.DestinationUriFileCounts),
		}
	case s.Load != nil:
		js.Details = &LoadStatistics{
			InputFileBytes: s.Load.InputFileBytes,
			InputFiles:     s.Load.InputFiles,
			OutputBytes:    s.Load.OutputBytes,
			OutputRows:     s.Load.OutputRows,
		}
	case s.Query != nil:
		var names []string
		for _, qp := range s.Query.UndeclaredQueryParameters {
			names = append(names, qp.Name)
		}
		var tables []*Table
		for _, tr := range s.Query.ReferencedTables {
			tables = append(tables, bqToTable(tr, c))
		}
		js.Details = &QueryStatistics{
			BillingTier:                   s.Query.BillingTier,
			CacheHit:                      s.Query.CacheHit,
			StatementType:                 s.Query.StatementType,
			TotalBytesBilled:              s.Query.TotalBytesBilled,
			TotalBytesProcessed:           s.Query.TotalBytesProcessed,
			NumDMLAffectedRows:            s.Query.NumDmlAffectedRows,
			QueryPlan:                     queryPlanFromProto(s.Query.QueryPlan),
			Schema:                        bqToSchema(s.Query.Schema),
			ReferencedTables:              tables,
			UndeclaredQueryParameterNames: names,
		}
	}
	j.lastStatus.Statistics = js
}

func queryPlanFromProto(stages []*bq.ExplainQueryStage) []*ExplainQueryStage {
	var res []*ExplainQueryStage
	for _, s := range stages {
		var steps []*ExplainQueryStep
		for _, p := range s.Steps {
			steps = append(steps, &ExplainQueryStep{
				Kind:     p.Kind,
				Substeps: p.Substeps,
			})
		}
		res = append(res, &ExplainQueryStage{
			ComputeRatioAvg: s.ComputeRatioAvg,
			ComputeRatioMax: s.ComputeRatioMax,
			ID:              s.Id,
			Name:            s.Name,
			ReadRatioAvg:    s.ReadRatioAvg,
			ReadRatioMax:    s.ReadRatioMax,
			RecordsRead:     s.RecordsRead,
			RecordsWritten:  s.RecordsWritten,
			Status:          s.Status,
			Steps:           steps,
			WaitRatioAvg:    s.WaitRatioAvg,
			WaitRatioMax:    s.WaitRatioMax,
			WriteRatioAvg:   s.WriteRatioAvg,
			WriteRatioMax:   s.WriteRatioMax,
		})
	}
	return res
}
