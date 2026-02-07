package testcontainers

import (
	"context"
	"fmt"
	"sync"
)

const (
	defaultWorkersCount = 8
)

type ParallelContainerRequest []GenericContainerRequest

// ParallelContainersOptions represents additional options for parallel running
type ParallelContainersOptions struct {
	WorkersCount int // count of parallel workers. If field empty(zero), default value will be 'defaultWorkersCount'
}

// ParallelContainersRequestError represents error from parallel request
type ParallelContainersRequestError struct {
	Request GenericContainerRequest
	Error   error
}

type ParallelContainersError struct {
	Errors []ParallelContainersRequestError
}

func (gpe ParallelContainersError) Error() string {
	return fmt.Sprintf("%v", gpe.Errors)
}

// parallelContainersResult represents result.
type parallelContainersResult struct {
	ParallelContainersRequestError
	Container Container
}

func parallelContainersRunner(
	ctx context.Context,
	requests <-chan GenericContainerRequest,
	results chan<- parallelContainersResult,
	wg *sync.WaitGroup,
) {
	defer wg.Done()
	for req := range requests {
		c, err := GenericContainer(ctx, req)
		res := parallelContainersResult{Container: c}
		if err != nil {
			res.Request = req
			res.Error = err
		}
		results <- res
	}
}

// ParallelContainers creates a generic containers with parameters and run it in parallel mode
func ParallelContainers(ctx context.Context, reqs ParallelContainerRequest, opt ParallelContainersOptions) ([]Container, error) {
	if opt.WorkersCount == 0 {
		opt.WorkersCount = defaultWorkersCount
	}

	tasksChanSize := opt.WorkersCount
	if tasksChanSize > len(reqs) {
		tasksChanSize = len(reqs)
	}

	tasksChan := make(chan GenericContainerRequest, tasksChanSize)
	resultsChan := make(chan parallelContainersResult, tasksChanSize)
	done := make(chan struct{})

	var wg sync.WaitGroup
	wg.Add(tasksChanSize)

	// run workers
	for i := 0; i < tasksChanSize; i++ {
		go parallelContainersRunner(ctx, tasksChan, resultsChan, &wg)
	}

	var errs []ParallelContainersRequestError
	containers := make([]Container, 0, len(reqs))
	go func() {
		defer close(done)
		for res := range resultsChan {
			if res.Error != nil {
				errs = append(errs, res.ParallelContainersRequestError)
			} else {
				containers = append(containers, res.Container)
			}
		}
	}()

	for _, req := range reqs {
		tasksChan <- req
	}
	close(tasksChan)

	wg.Wait()

	close(resultsChan)

	<-done

	if len(errs) != 0 {
		return containers, ParallelContainersError{Errors: errs}
	}

	return containers, nil
}
