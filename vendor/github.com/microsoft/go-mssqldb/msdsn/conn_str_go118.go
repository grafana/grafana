// +build go1.18

package msdsn

// disableRetryDefault is false for Go versions 1.18 and higher. This matches
// the behavior requested in issue #586. A query that fails at the start due to
// a bad connection is automatically retried. An error is returned only if the
// query fails all of its retries.
const disableRetryDefault bool = false
