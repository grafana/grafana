// Basic stream implementation.

package miniredis

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// a Stream is a list of entries, lowest ID (oldest) first, and all "groups".
type streamKey struct {
	entries         []StreamEntry
	groups          map[string]*streamGroup
	lastAllocatedID string
	mu              sync.Mutex
}

// a StreamEntry is an entry in a stream. The ID is always of the form
// "123-123".
// Values is an ordered list of key-value pairs.
type StreamEntry struct {
	ID     string
	Values []string
}

type streamGroup struct {
	stream    *streamKey
	lastID    string
	pending   []pendingEntry
	consumers map[string]*consumer
}

type consumer struct {
	numPendingEntries int
	// these timestamps aren't tracked perfectly
	lastSeen    time.Time // "idle" XINFO key
	lastSuccess time.Time // "inactive" XINFO key
}

type pendingEntry struct {
	id            string
	consumer      string
	deliveryCount int
	lastDelivery  time.Time
}

func newStreamKey() *streamKey {
	return &streamKey{
		groups: map[string]*streamGroup{},
	}
}

// generateID doesn't lock the mutex
func (s *streamKey) generateID(now time.Time) string {
	ts := uint64(now.UnixNano()) / 1_000_000

	next := fmt.Sprintf("%d-%d", ts, 0)
	if s.lastAllocatedID != "" && streamCmp(s.lastAllocatedID, next) >= 0 {
		last, _ := parseStreamID(s.lastAllocatedID)
		next = fmt.Sprintf("%d-%d", last[0], last[1]+1)
	}

	lastID := s.lastIDUnlocked()
	if streamCmp(lastID, next) >= 0 {
		last, _ := parseStreamID(lastID)
		next = fmt.Sprintf("%d-%d", last[0], last[1]+1)
	}

	s.lastAllocatedID = next
	return next
}

// lastID locks the mutex
func (s *streamKey) lastID() string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.lastIDUnlocked()
}

// lastID doesn't lock the mutex
func (s *streamKey) lastIDUnlocked() string {
	if len(s.entries) == 0 {
		return "0-0"
	}

	return s.entries[len(s.entries)-1].ID
}

func (s *streamKey) copy() *streamKey {
	s.mu.Lock()
	defer s.mu.Unlock()

	cpy := &streamKey{
		entries: s.entries,
	}
	groups := map[string]*streamGroup{}
	for k, v := range s.groups {
		gr := v.copy()
		gr.stream = cpy
		groups[k] = gr
	}
	cpy.groups = groups
	return cpy
}

func parseStreamID(id string) ([2]uint64, error) {
	var (
		res [2]uint64
		err error
	)
	parts := strings.SplitN(id, "-", 2)
	res[0], err = strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		return res, errors.New(msgInvalidStreamID)
	}
	if len(parts) == 2 {
		res[1], err = strconv.ParseUint(parts[1], 10, 64)
		if err != nil {
			return res, errors.New(msgInvalidStreamID)
		}
	}
	return res, nil
}

// compares two stream IDs (of the full format: "123-123"). Returns: -1, 0, 1
// The given IDs should be valid stream IDs.
func streamCmp(a, b string) int {
	ap, _ := parseStreamID(a)
	bp, _ := parseStreamID(b)

	switch {
	case ap[0] < bp[0]:
		return -1
	case ap[0] > bp[0]:
		return 1
	case ap[1] < bp[1]:
		return -1
	case ap[1] > bp[1]:
		return 1
	default:
		return 0
	}
}

// formatStreamID makes a full id ("42-42") out of a partial one ("42")
func formatStreamID(id string) (string, error) {
	var ts [2]uint64
	parts := strings.SplitN(id, "-", 2)

	if len(parts) > 0 {
		p, err := strconv.ParseUint(parts[0], 10, 64)
		if err != nil {
			return "", errInvalidEntryID
		}
		ts[0] = p
	}
	if len(parts) > 1 {
		p, err := strconv.ParseUint(parts[1], 10, 64)
		if err != nil {
			return "", errInvalidEntryID
		}
		ts[1] = p
	}
	return fmt.Sprintf("%d-%d", ts[0], ts[1]), nil
}

func formatStreamRangeBound(id string, start bool, reverse bool) (string, error) {
	if id == "-" {
		return "0-0", nil
	}

	if id == "+" {
		return fmt.Sprintf("%d-%d", uint64(math.MaxUint64), uint64(math.MaxUint64)), nil
	}

	if id == "0" {
		return "0-0", nil
	}

	parts := strings.Split(id, "-")
	if len(parts) == 2 {
		return formatStreamID(id)
	}

	// Incomplete IDs case
	ts, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		return "", errInvalidEntryID
	}

	if (!start && !reverse) || (start && reverse) {
		return fmt.Sprintf("%d-%d", ts, uint64(math.MaxUint64)), nil
	}

	return fmt.Sprintf("%d-%d", ts, 0), nil
}

func reversedStreamEntries(o []StreamEntry) []StreamEntry {
	newStream := make([]StreamEntry, len(o))
	for i, e := range o {
		newStream[len(o)-i-1] = e
	}
	return newStream
}

func (s *streamKey) createGroup(group, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.groups[group]; ok {
		return errors.New("BUSYGROUP Consumer Group name already exists")
	}

	if id == "$" {
		id = s.lastIDUnlocked()
	}
	s.groups[group] = &streamGroup{
		stream:    s,
		lastID:    id,
		consumers: map[string]*consumer{},
	}
	return nil
}

// streamAdd adds an entry to a stream. Returns the new entry ID.
// If id is empty or "*" the ID will be generated automatically.
// `values` should have an even length.
func (s *streamKey) add(entryID string, values []string, now time.Time) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if entryID == "" || entryID == "*" {
		entryID = s.generateID(now)
	}

	entryID, err := formatStreamID(entryID)
	if err != nil {
		return "", err
	}
	if entryID == "0-0" {
		return "", errors.New(msgStreamIDZero)
	}
	if streamCmp(s.lastIDUnlocked(), entryID) != -1 {
		return "", errors.New(msgStreamIDTooSmall)
	}

	s.entries = append(s.entries, StreamEntry{
		ID:     entryID,
		Values: values,
	})
	return entryID, nil
}

func (s *streamKey) trim(n int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.entries) > n {
		s.entries = s.entries[len(s.entries)-n:]
	}
}

// trimBefore deletes entries with an id less than the provided id
// and returns the number of entries deleted
func (s *streamKey) trimBefore(id string) int {
	s.mu.Lock()
	var delete []string
	for _, entry := range s.entries {
		if streamCmp(entry.ID, id) < 0 {
			delete = append(delete, entry.ID)
		} else {
			break
		}
	}
	s.mu.Unlock()
	s.delete(delete)
	return len(delete)
}

// all entries after "id"
func (s *streamKey) after(id string) []StreamEntry {
	s.mu.Lock()
	defer s.mu.Unlock()

	pos := sort.Search(len(s.entries), func(i int) bool {
		return streamCmp(id, s.entries[i].ID) < 0
	})
	return s.entries[pos:]
}

// get a stream entry by ID
// Also returns the position in the entries slice, if found.
func (s *streamKey) get(id string) (int, *StreamEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pos := sort.Search(len(s.entries), func(i int) bool {
		return streamCmp(id, s.entries[i].ID) <= 0
	})
	if len(s.entries) <= pos || s.entries[pos].ID != id {
		return 0, nil
	}
	return pos, &s.entries[pos]
}

func (g *streamGroup) readGroup(
	now time.Time,
	consumerID,
	id string,
	count int,
	noack bool,
) []StreamEntry {
	if id == ">" {
		// undelivered messages
		msgs := g.stream.after(g.lastID)
		if len(msgs) == 0 {
			return nil
		}

		if count > 0 && len(msgs) > count {
			msgs = msgs[:count]
		}

		if !noack {
			shouldAppend := len(g.pending) == 0
			for _, msg := range msgs {
				if !shouldAppend {
					shouldAppend = streamCmp(msg.ID, g.pending[len(g.pending)-1].id) == 1
				}

				var entry *pendingEntry
				if shouldAppend {
					g.pending = append(g.pending, pendingEntry{})
					entry = &g.pending[len(g.pending)-1]
				} else {
					var pos int
					pos, entry = g.searchPending(msg.ID)
					if entry == nil {
						g.pending = append(g.pending[:pos+1], g.pending[pos:]...)
						entry = &g.pending[pos]
					} else {
						g.consumers[entry.consumer].numPendingEntries--
					}
				}

				*entry = pendingEntry{
					id:            msg.ID,
					consumer:      consumerID,
					deliveryCount: 1,
					lastDelivery:  now,
				}
			}
		}
		if _, ok := g.consumers[consumerID]; !ok {
			g.consumers[consumerID] = &consumer{}
		}
		g.consumers[consumerID].numPendingEntries += len(msgs)
		g.lastID = msgs[len(msgs)-1].ID
		return msgs
	}

	// re-deliver messages from the pending list.
	// con := gr.consumers[consumerID]
	msgs := g.pendingAfter(id)
	var res []StreamEntry
	for i, p := range msgs {
		if p.consumer != consumerID {
			continue
		}
		_, entry := g.stream.get(p.id)
		// not found. Weird?
		if entry == nil {
			continue
		}
		p.deliveryCount += 1
		p.lastDelivery = now
		msgs[i] = p
		res = append(res, *entry)
	}
	return res
}

func (g *streamGroup) searchPending(id string) (int, *pendingEntry) {
	pos := sort.Search(len(g.pending), func(i int) bool {
		return streamCmp(id, g.pending[i].id) <= 0
	})
	if pos >= len(g.pending) || g.pending[pos].id != id {
		return pos, nil
	}
	return pos, &g.pending[pos]
}

func (g *streamGroup) ack(ids []string) (int, error) {
	count := 0
	for _, id := range ids {
		if _, err := parseStreamID(id); err != nil {
			return 0, errors.New(msgInvalidStreamID)
		}

		pos, entry := g.searchPending(id)
		if entry == nil {
			continue
		}

		consumer := g.consumers[entry.consumer]
		consumer.numPendingEntries--

		g.pending = append(g.pending[:pos], g.pending[pos+1:]...)
		// don't count deleted entries
		if _, e := g.stream.get(id); e == nil {
			continue
		}
		count++
	}
	return count, nil
}

func (s *streamKey) delete(ids []string) (int, error) {
	count := 0
	for _, id := range ids {
		if _, err := parseStreamID(id); err != nil {
			return 0, errors.New(msgInvalidStreamID)
		}

		i, entry := s.get(id)
		if entry == nil {
			continue
		}

		s.entries = append(s.entries[:i], s.entries[i+1:]...)
		count++
	}
	return count, nil
}

func (g *streamGroup) pendingAfter(id string) []pendingEntry {
	pos := sort.Search(len(g.pending), func(i int) bool {
		return streamCmp(id, g.pending[i].id) < 0
	})
	return g.pending[pos:]
}

func (g *streamGroup) pendingCount(consumer string) int {
	n := 0
	for _, p := range g.activePending() {
		if p.consumer == consumer {
			n++
		}
	}
	return n
}

// pending entries without the entries deleted from the group
func (g *streamGroup) activePending() []pendingEntry {
	var pe []pendingEntry
	for _, p := range g.pending {
		// drop deleted ones
		if _, e := g.stream.get(p.id); e == nil {
			continue
		}
		p := p
		pe = append(pe, p)
	}
	return pe
}

func (g *streamGroup) copy() *streamGroup {
	cns := map[string]*consumer{}
	for k, v := range g.consumers {
		c := *v
		cns[k] = &c
	}
	return &streamGroup{
		// don't copy stream
		lastID:    g.lastID,
		pending:   g.pending,
		consumers: cns,
	}
}

func (g *streamGroup) setLastSeen(c string, t time.Time) {
	cons, ok := g.consumers[c]
	if !ok {
		cons = &consumer{}
	}
	cons.lastSeen = t
	g.consumers[c] = cons
}

func (g *streamGroup) setLastSuccess(c string, t time.Time) {
	g.setLastSeen(c, t)
	g.consumers[c].lastSuccess = t
}
