package awsds

import (
	"context"
	"fmt"
)

func startQuery(ctx context.Context, db AsyncDB, query *AsyncQuery) (string, error) {
	if db == nil {
		return "", fmt.Errorf("async handler not defined")
	}

	found, queryID, err := db.GetQueryID(ctx, query.RawSQL)
	if found || err != nil {
		return queryID, err
	}

	return db.StartQuery(ctx, query.RawSQL)
}

func queryStatus(ctx context.Context, db AsyncDB, query *AsyncQuery) (QueryStatus, error) {
	if db == nil {
		return QueryUnknown, fmt.Errorf("async handler not defined")
	}
	return db.QueryStatus(ctx, query.QueryID)
}
