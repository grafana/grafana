package memberlist

import "time"

// Mergeable is an interface that values used in gossiping KV Client must implement.
// It allows merging of different states, obtained via gossiping or CAS function.
type Mergeable interface {
	// Merge with other value in place. Returns change, that can be sent to other clients.
	// If merge doesn't result in any change, returns nil.
	// Error can be returned if merging with given 'other' value is not possible.
	// Implementors of this method are permitted to modify the other parameter, as the
	// memberlist-based KV store will not use the same "other" parameter in multiple Merge calls.
	//
	// In order for state merging to work correctly, Merge function must have some properties. When talking about the
	// result of the merge in the following text, we don't mean the return value ("change"), but the
	// end-state of receiver. That means Result of A.Merge(B) is end-state of A.
	//
	// Memberlist-based KV store will keep the result even if Merge returned no change. Implementations should
	// be careful about not changing logical value when returning empty change.
	//
	// Idempotency:
	// 		Result of applying the same state "B" to state "A" (A.Merge(B)) multiple times has the same effect as
	// 		applying it only once. Only first Merge will return non-empty change.
	//
	// Commutativity:
	//		A.Merge(B) has the same result as B.Merge(A) (result being the end state of A or B respectively)
	//
	// Associativity:
	//		calling B.Merge(C), and then A.Merge(B) has the same result as
	//		calling A.Merge(B) first, and then calling A.Merge(C),
	//		that is, A will end up in the same state in both cases.
	//
	// LocalCAS flag is used when doing Merge as part of local CAS operation on KV store. It can be used to detect
	// missing entries, and generate tombstones. (This breaks commutativity and associativity [!] so it can *only* be
	// used when doing CAS operation)
	Merge(other Mergeable, localCAS bool) (change Mergeable, err error)

	// MergeContent describes the content of this mergeable value. Used by memberlist client to decide if
	// one change-value can invalidate some other value, that was received previously.
	// Invalidation can happen only if output of MergeContent is a superset of some other MergeContent.
	MergeContent() []string

	// RemoveTombstones remove tombstones older than given limit from this mergeable.
	// If limit is zero time, remove all tombstones. Memberlist client calls this method with zero limit each
	// time when client is accessing value from the store. It can be used to hide tombstones from the clients.
	// Returns the total number of tombstones present and the number of removed tombstones by this invocation.
	RemoveTombstones(limit time.Time) (total, removed int)

	// Clone returns a deep copy of the state.
	Clone() Mergeable
}
