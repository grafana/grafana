// Package gooseutil provides utility functions we want to keep internal to the package. It's
// intended to be a collection of well-tested helper functions.
package gooseutil

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
)

// UpVersions returns a list of migrations to apply based on the versions in the filesystem and the
// versions in the database. The target version can be used to specify a target version. In most
// cases this will be math.MaxInt64.
//
// The allowMissing flag can be used to allow missing migrations as part of the list of migrations
// to apply. Otherwise, an error will be returned if there are missing migrations in the database.
func UpVersions(
	fsysVersions []int64,
	dbVersions []int64,
	target int64,
	allowMissing bool,
) ([]int64, error) {
	// Sort the list of versions in the filesystem. This should already be sorted, but we do this
	// just in case.
	sortAscending(fsysVersions)

	// dbAppliedVersions is a map of all applied migrations in the database.
	dbAppliedVersions := make(map[int64]bool, len(dbVersions))
	var dbMaxVersion int64
	for _, v := range dbVersions {
		dbAppliedVersions[v] = true
		if v > dbMaxVersion {
			dbMaxVersion = v
		}
	}

	// Get a list of migrations that are missing from the database. A missing migration is one that
	// has a version less than the max version in the database and has not been applied.
	//
	// In most cases the target version is math.MaxInt64, but it can be used to specify a target
	// version. In which case we respect the target version and only surface migrations up to and
	// including that target.
	var missing []int64
	for _, v := range fsysVersions {
		if dbAppliedVersions[v] {
			continue
		}
		if v < dbMaxVersion && v <= target {
			missing = append(missing, v)
		}
	}

	// feat(mf): It is very possible someone may want to apply ONLY new migrations and skip missing
	// migrations entirely. At the moment this is not supported, but leaving this comment because
	// that's where that logic would be handled.
	//
	// For example, if database has 1,4 already applied and 2,3,5 are new, we would apply only 5 and
	// skip 2,3. Not sure if this is a common use case, but it's possible someone may want to do
	// this.
	if len(missing) > 0 && !allowMissing {
		return nil, newMissingError(missing, dbMaxVersion, target)
	}

	var out []int64

	// 1. Add missing migrations to the list of migrations to apply, if any.
	out = append(out, missing...)

	// 2. Add new migrations to the list of migrations to apply, if any.
	for _, v := range fsysVersions {
		if dbAppliedVersions[v] {
			continue
		}
		if v > dbMaxVersion && v <= target {
			out = append(out, v)
		}
	}
	// 3. Sort the list of migrations to apply.
	sortAscending(out)

	return out, nil
}

func newMissingError(
	missing []int64,
	dbMaxVersion int64,
	target int64,
) error {
	sortAscending(missing)

	collected := make([]string, 0, len(missing))
	for _, v := range missing {
		collected = append(collected, strconv.FormatInt(v, 10))
	}

	msg := "migration"
	if len(collected) > 1 {
		msg += "s"
	}

	var versionsMsg string
	if len(collected) > 1 {
		versionsMsg = "versions " + strings.Join(collected, ",")
	} else {
		versionsMsg = "version " + collected[0]
	}

	desiredMsg := fmt.Sprintf("database version (%d)", dbMaxVersion)
	if target != math.MaxInt64 {
		desiredMsg += fmt.Sprintf(", with target version (%d)", target)
	}

	return fmt.Errorf("detected %d missing (out-of-order) %s lower than %s: %s",
		len(missing), msg, desiredMsg, versionsMsg,
	)
}

func sortAscending(versions []int64) {
	sort.Slice(versions, func(i, j int) bool {
		return versions[i] < versions[j]
	})
}
