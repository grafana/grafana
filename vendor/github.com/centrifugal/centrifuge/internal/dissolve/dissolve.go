package dissolve

import (
	"errors"
	"runtime"
)

// Dissolver allows to put function to in-memory queue and process
// it with workers until success. The order of execution is not maintained.
// Jobs will be lost after closing. Jobs not saved to persistent store so
// do not survive process restart.
// Centrifuge uses this for asynchronously unsubscribing node from channels
// in broker. As soon as process restarts all connections to broker get
// closed automatically so it's ok to lose jobs inside Dissolver queue.
type Dissolver struct {
	queue      queue
	numWorkers int
}

// New creates new Dissolver.
func New(numWorkers int) *Dissolver {
	return &Dissolver{
		queue:      newQueue(),
		numWorkers: numWorkers,
	}
}

// Run launches workers to process Jobs from queue concurrently.
func (d *Dissolver) Run() error {
	for i := 0; i < d.numWorkers; i++ {
		go d.runWorker()
	}
	return nil
}

// Close stops processing Jobs, no more Jobs can be submitted after closing.
func (d *Dissolver) Close() error {
	d.queue.Close()
	return nil
}

// Submit Job to be reliably processed.
func (d *Dissolver) Submit(job Job) error {
	if !d.queue.Add(job) {
		return errors.New("can not submit job to closed dissolver")
	}
	return nil
}

func (d *Dissolver) runWorker() {
	for {
		job, ok := d.queue.Wait()
		if !ok {
			if d.queue.Closed() {
				break
			}
			continue
		}
		err := job()
		if err != nil {
			// Put to the end of queue.
			runtime.Gosched()
			d.queue.Add(job)
		}
	}
}
