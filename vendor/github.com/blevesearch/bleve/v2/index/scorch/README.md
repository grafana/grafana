# scorch

## Definitions

Batch

- A collection of Documents to mutate in the index.

Document

- Has a unique identifier (arbitrary bytes).
- Is comprised of a list of fields.

Field

- Has a name (string).
- Has a type (text, number, date, geopoint).
- Has a value (depending on type).
- Can be indexed, stored, or both.
- If indexed, can be analyzed.
-m If indexed, can optionally store term vectors.

## Scope

Scorch *MUST* implement the bleve.index API without requiring any changes to this API.

Scorch *MAY* introduce new interfaces, which can be discovered to allow use of new capabilities not in the current API.

## Implementation

The scorch implementation starts with the concept of a segmented index.

A segment is simply a slice, subset, or portion of the entire index.  A segmented index is one which is composed of one or more segments.  Although segments are created in a particular order, knowing this ordering is not required to achieve correct semantics when querying.  Because there is no ordering, this means that when searching an index, you can (and should) search all the segments concurrently.

### Internal Wrapper

In order to accommodate the existing APIs while also improving the implementation, the scorch implementation includes some wrapper functionality that must be described.

#### \_id field

In scorch, field 0 is prearranged to be named \_id.  All documents have a value for this field, which is the documents external identifier.  In this version the field *MUST* be both indexed AND stored.  The scorch wrapper adds this field, as it will not be present in the Document from the calling bleve code.

NOTE: If a document already contains a field \_id, it will be replaced.  If this is problematic, the caller must ensure such a scenario does not happen.

### Proposed Structures

```go
type Segment interface {

  Dictionary(field string) TermDictionary

}

type TermDictionary interface {

  PostingsList(term string, excluding PostingsList) PostingsList

}

type PostingsList interface {

  Next() Posting

  And(other PostingsList) PostingsList
  Or(other PostingsList) PostingsList

}

type Posting interface {
  Number() uint64

  Frequency() uint64
  Norm() float64

  Locations() Locations
}

type Locations interface {
  Start() uint64
  End() uint64
  Pos() uint64
  ArrayPositions() ...
}

type DeletedDocs {

}

type SegmentSnapshot struct {
  segment Segment
  deleted PostingsList
}

type IndexSnapshot struct {
  segment []SegmentSnapshot
}
```

**What about errors?**
**What about memory mgmnt or context?**
**Postings List separate iterator to separate stateful from stateless**

### Mutating the Index

The bleve.index API has methods for directly making individual mutations (Update/Delete/SetInternal/DeleteInternal), however for this first implementation, we assume that all of these calls can simply be turned into a Batch of size 1.  This may be highly inefficient, but it will be correct.  This decision is made based on the fact that Couchbase FTS always uses Batches.

NOTE: As a side-effect of this decision, it should be clear that performance tuning may depend on the batch size, which may in-turn require changes in FTS.

From this point forward, only Batch mutations will be discussed.

Sequence of Operations:

1. For each document in the batch, search through all existing segments.  The goal is to build up a per-segment bitset which tells us which documents in that segment are obsoleted by the addition of the new segment we're currently building.  NOTE: we're not ready for this change to take effect yet, so rather than this operation mutating anything, they simply return bitsets, which we can apply later.  Logically, this is something like:

    ```go
      foreach segment {
        dict := segment.Dictionary("\_id")
        postings := empty postings list
        foreach docID {
          postings = postings.Or(dict.PostingsList(docID, nil))
        }
      }
    ```

    NOTE: it is illustrated above as nested for loops, but some or all of these could be concurrently.  The end result is that for each segment, we have (possibly empty) bitset.

2. Also concurrent with 1, the documents in the batch are analyzed.  This analysis proceeds using the existing analyzer pool.

3. (after 2 completes) Analyzed documents are fed into a function which builds a new Segment representing this information.

4. We now have everything we need to update the state of the system to include this new snapshot.
    - Acquire a lock
    - Create a new IndexSnapshot
    - For each SegmentSnapshot in the IndexSnapshot, take the deleted PostingsList and OR it with the new postings list for this Segment.  Construct a new SegmentSnapshot for the segment using this new deleted PostingsList.  Append this SegmentSnapshot to the IndexSnapshot.
    - Create a new SegmentSnapshot wrapping our new segment with nil deleted docs.
    - Append the new SegmentSnapshot to the IndexSnapshot
    - Release the lock

An ASCII art example:

```text
  0 - Empty Index

  No segments

  IndexSnapshot
    segments []
    deleted []


  1 - Index Batch [ A B C ]

  segment       0
  numbers   [ 1 2 3 ]
  \_id      [ A B C ]

  IndexSnapshot
    segments [ 0 ]
    deleted [ nil ]


  2 - Index Batch [ B' ]

  segment       0           1
  numbers   [ 1 2 3 ]     [ 1 ]
  \_id      [ A B C ]     [ B ]

  Compute bitset segment-0-deleted-by-1:
            [ 0 1 0 ]

  OR it with previous (nil) (call it 0-1)
            [ 0 1 0 ]

  IndexSnapshot
    segments [  0    1 ]
    deleted  [ 0-1 nil ]

  3 - Index Batch [ C' ]

    segment       0           1      2
    numbers   [ 1 2 3 ]     [ 1 ]  [ 1 ]
    \_id      [ A B C ]     [ B ]  [ C ]

    Compute bitset segment-0-deleted-by-2:
              [ 0 0 1 ]

    OR it with previous ([ 0 1 0 ]) (call it 0-12)
              [ 0 1 1 ]

  Compute bitset segment-1-deleted-by-2:
              [ 0 ]

  OR it with previous (nil)
              still just nil


    IndexSnapshot
      segments [  0    1    2 ]
      deleted  [ 0-12 nil  nil ]
  ```

**is there opportunity to stop early when doc is found in one segment**
**also, more efficient way to find bits for long lists of ids?**

### Searching

In the bleve.index API all searching starts by getting an IndexReader, which represents a snapshot of the index at a point in time.

As described in the section above, our index implementation maintains a pointer to the current IndexSnapshot.  When a caller gets an IndexReader, they get a copy of this pointer, and can use it as long as they like.  The IndexSnapshot contains SegmentSnapshots, which only contain pointers to immutable segments.  The deleted posting lists associated with a segment change over time, but the particular deleted posting list in YOUR snapshot is immutable.  This gives a stable view of the data.

#### Term Search

Term search is the only searching primitive exposed in today's bleve.index API.  This ultimately could limit our ability to take advantage of the indexing improvements, but it also means it will be easier to get a first version of this working.

A term search for term T in field F will look something like this:

```go
  searchResultPostings = empty
  foreach segment {
    dict := segment.Dictionary(F)
    segmentResultPostings = dict.PostingsList(T, segmentSnapshotDeleted)
    // make segmentLocal numbers into global numbers, and flip bits in searchResultPostings
  }
```

The searchResultPostings will be a new implementation of the TermFieldReader interface.

As a reminder this interface is:

```go
// TermFieldReader is the interface exposing the enumeration of documents
// containing a given term in a given field. Documents are returned in byte
// lexicographic order over their identifiers.
type TermFieldReader interface {
  // Next returns the next document containing the term in this field, or nil
  // when it reaches the end of the enumeration.  The preAlloced TermFieldDoc
  // is optional, and when non-nil, will be used instead of allocating memory.
  Next(preAlloced *TermFieldDoc) (*TermFieldDoc, error)

  // Advance resets the enumeration at specified document or its immediate
  // follower.
  Advance(ID IndexInternalID, preAlloced *TermFieldDoc) (*TermFieldDoc, error)

  // Count returns the number of documents contains the term in this field.
  Count() uint64
  Close() error
}
```

At first glance this appears problematic, we have no way to return documents in order of their identifiers.  But it turns out the wording of this perhaps too strong, or a bit ambiguous.  Originally, this referred to the external identifiers, but with the introduction of a distinction between internal/external identifiers, returning them in order of their internal identifiers is also acceptable.  **ASIDE**: the reason for this is that most callers just use Next() and literally don't care what the order is, they could be in any order and it would be fine.  There is only one search that cares and that is the ConjunctionSearcher, which relies on Next/Advance having very specific semantics.  Later in this document we will have a proposal to split into multiple interfaces:

- The weakest interface, only supports Next() no ordering at all.
- Ordered, supporting Advance()
- And/Or'able capable of internally efficiently doing these ops with like interfaces (if not capable then can always fall back to external walking)

But, the good news is that we don't even have to do that for our first implementation.  As long as the global numbers we use for internal identifiers are consistent within this IndexSnapshot, then Next() will be ordered by ascending document number, and Advance() will still work correctly.

NOTE: there is another place where we rely on the ordering of these hits, and that is in the "\_id" sort order.  Previously this was the natural order, and a NOOP for the collector, now it must be implemented by actually sorting on the "\_id" field.  We probably should introduce at least a marker interface to detect this.

An ASCII art example:

```text
Let's start with the IndexSnapshot we ended with earlier:

3 - Index Batch [ C' ]

  segment       0           1      2
  numbers   [ 1 2 3 ]     [ 1 ]  [ 1 ]
  \_id      [ A B C ]     [ B ]  [ C ]

  Compute bitset segment-0-deleted-by-2:
            [ 0 0 1 ]

  OR it with previous ([ 0 1 0 ]) (call it 0-12)
            [ 0 1 1 ]

Compute bitset segment-1-deleted-by-2:
            [ 0 0 0 ]

OR it with previous (nil)
            still just nil


  IndexSnapshot
    segments [  0    1    2 ]
    deleted  [ 0-12 nil  nil ]

Now let's search for the term 'cat' in the field 'desc' and let's assume that Document C (both versions) would match it.

Concurrently:

  - Segment 0
   - Get Term Dictionary For Field 'desc'
   - From it get Postings List for term 'cat' EXCLUDING 0-12
   - raw segment matches [ 0 0 1 ] but excluding [ 0 1 1 ] gives [ 0 0 0 ]
  - Segment 1
   - Get Term Dictionary For Field 'desc'
   - From it get Postings List for term 'cat' excluding nil
   - [ 0 ]
  - Segment 2
   - Get Term Dictionary For Field 'desc'
   - From it get Postings List for term 'cat' excluding nil
   - [ 1 ]

Map local bitsets into global number space (global meaning cross-segment but still unique to this snapshot)

IndexSnapshot already should have mapping something like:
0 - Offset 0
1 - Offset 3 (because segment 0 had 3 docs)
2 - Offset 4 (because segment 1 had 1 doc)

This maps to search result bitset:

[ 0 0 0 0 1]

Caller would call Next() and get doc number 5 (assuming 1 based indexing for now)

Caller could then ask to get term locations, stored fields, external doc ID for document number 5.  Internally in the IndexSnapshot, we can now convert that back, and realize doc number 5 comes from segment 2, 5-4=1 so we're looking for doc number 1 in segment 2.  That happens to be C...

```

#### Future improvements

In the future, interfaces to detect these non-serially operating TermFieldReaders could expose their own And() and Or() up to the higher level Conjunction/Disjunction searchers.  Doing this alone offers some win, but also means there would be greater burden on the Searcher code rewriting logical expressions for maximum performance.

Another related topic is that of peak memory usage.  With serially operating TermFieldReaders it was necessary to start them all at the same time and operate in unison.  However, with these non-serially operating TermFieldReaders we have the option of doing a few at a time, consolidating them, dispoting the intermediaries, and then doing a few more.  For very complex queries with many clauses this could reduce peak memory usage.

### Memory Tracking

All segments must be able to produce two statistics, an estimate of their explicit memory usage, and their actual size on disk (if any).  For in-memory segments, disk usage could be zero, and the memory usage represents the entire information content.  For mmap-based disk segments, the memory could be as low as the size of tracking structure itself (say just a few pointers).

This would allow the implementation to throttle or block incoming mutations when a threshold memory usage has (or would be) exceeded.

### Persistence

Obviously, we want to support (but maybe not require) asynchronous persistence of segments.  My expectation is that segments are initially built in memory.  At some point they are persisted to disk.  This poses some interesting challenges.

At runtime, the state of an index (it's IndexSnapshot) is not only the contents of the segments, but also the bitmasks of deleted documents.  These bitmasks indirectly encode an ordering in which the segments were added.  The reason is that the bitmasks encode which items have been obsoleted by other (subsequent or more future) segments.  In the runtime implementation we compute bitmask deltas and then merge them at the same time we bring the new segment in.  One idea is that we could take a similar approach on disk.  When we persist a segment, we persist the bitmask deltas of segments known to exist at that time, and eventually these can get merged up into a base segment deleted bitmask.

This also relates to the topic rollback, addressed next...

### Rollback

One desirable property in the Couchbase ecosystem is the ability to rollback to some previous (though typically not long ago) state.  One idea for keeping this property in this design is to protect some of the most recent segments from merging.  Then, if necessary, they could be "undone" to reveal previous states of the system.  In these scenarios "undone" has to properly undo the deleted bitmasks on the other segments.  Again, the current thinking is that rather than "undo" anything, it could be work that was deferred in the first place, thus making it easier to logically undo.

Another possibly related approach would be to tie this into our existing snapshot mechanism.  Perhaps simulating a slow reader (holding onto index snapshots) for some period of time, can be the mechanism to achieve the desired end goal.

### Internal Storage

The bleve.index API has support for "internal storage".  The ability to store information under a separate name space.

This is not used for high volume storage, so it is tempting to think we could just put a small k/v store alongside the rest of the index.  But, the reality is that this storage is used to maintain key information related to the rollback scenario.  Because of this, its crucial that ordering and overwriting of key/value pairs correspond with actual segment persistence in the index.  Based on this, I believe its important to put the internal key/value pairs inside the segments themselves.  But, this also means that they must follow a similar "deleted" bitmask approach to obsolete values in older segments.  But, this also seems to substantially increase the complexity of the solution because of the separate name space, it would appear to require its own bitmask.  Further keys aren't numeric, which then implies yet another mapping from internal key to number, etc.

More thought is required here.

### Merging

The segmented index approach requires merging to prevent the number of segments from growing too large.

Recent experience with LSMs has taught us that having the correct merge strategy can make a huge difference in the overall performance of the system.  In particular, a simple merge strategy which merges segments too aggressively can lead to high write amplification and unnecessarily rendering cached data useless.

A few simple principles have been identified.

- Roughly we merge multiple smaller segments into a single larger one.
- The larger a segment gets the less likely we should be to ever merge it.
- Segments with large numbers of deleted/obsoleted items are good candidates as the merge will result in a space savings.
- Segments with all items deleted/obsoleted can be dropped.

Merging of a segment should be able to proceed even if that segment is held by an ongoing snapshot, it should only delay the removal of it.
