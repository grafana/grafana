package graph

import "time"

type ResolveCheckResponseMetadata struct {
	// Number of Read operations accumulated after this request completes.
	DatastoreQueryCount uint32

	// Number of items read from the database after this request completes.
	DatastoreItemCount uint64

	// Indicates if the ResolveCheck subproblem that was evaluated involved
	// a cycle in the evaluation.
	CycleDetected bool
	// The total time it took to resolve the check request.
	Duration time.Duration
}

// clone clones the provided ResolveCheckResponse.
func (r *ResolveCheckResponse) clone() *ResolveCheckResponse {
	return &ResolveCheckResponse{
		Allowed:            r.GetAllowed(),
		ResolutionMetadata: r.GetResolutionMetadata(),
	}
}

type ResolveCheckResponse struct {
	Allowed            bool
	ResolutionMetadata ResolveCheckResponseMetadata
}

func (r *ResolveCheckResponse) GetCycleDetected() bool {
	if r == nil {
		return false
	}
	return r.GetResolutionMetadata().CycleDetected
}

func (r *ResolveCheckResponse) GetAllowed() bool {
	if r == nil {
		return false
	}
	return r.Allowed
}

func (r *ResolveCheckResponse) GetResolutionMetadata() ResolveCheckResponseMetadata {
	if r == nil {
		return ResolveCheckResponseMetadata{}
	}
	return r.ResolutionMetadata
}
