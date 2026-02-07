// +build !go1.18

package msdsn

// disableRetryDefault is true for versions of Go less than 1.18. This matches
// the behavior requested in issue #275. A query that fails at the start due to
// a bad connection is not retried. Instead, the detailed error is immediately
// returned to the caller.
const disableRetryDefault bool = true
