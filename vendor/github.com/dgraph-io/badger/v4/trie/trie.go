/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package trie

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/dgraph-io/badger/v4/pb"
	"github.com/dgraph-io/badger/v4/y"
)

type node struct {
	children map[byte]*node
	ignore   *node
	ids      []uint64
}

func (n *node) isEmpty() bool {
	return len(n.children) == 0 && len(n.ids) == 0 && n.ignore == nil
}

func newNode() *node {
	return &node{
		children: make(map[byte]*node),
		ids:      []uint64{},
	}
}

// Trie datastructure.
type Trie struct {
	root *node
}

// NewTrie returns Trie.
func NewTrie() *Trie {
	return &Trie{
		root: newNode(),
	}
}

// parseIgnoreBytes would parse the ignore string, and convert it into a list of bools, where
// bool[idx] = true implies that key[idx] can be ignored during comparison.
func parseIgnoreBytes(ig string) ([]bool, error) {
	var out []bool
	if ig == "" {
		return out, nil
	}

	for _, each := range strings.Split(strings.TrimSpace(ig), ",") {
		r := strings.Split(strings.TrimSpace(each), "-")
		if len(r) == 0 || len(r) > 2 {
			return out, fmt.Errorf("Invalid range: %s", each)
		}
		start, end := -1, -1 //nolint:ineffassign
		if len(r) == 2 {
			idx, err := strconv.Atoi(strings.TrimSpace(r[1]))
			if err != nil {
				return out, err
			}
			end = idx
		}
		{
			// Always consider r[0]
			idx, err := strconv.Atoi(strings.TrimSpace(r[0]))
			if err != nil {
				return out, err
			}
			start = idx
		}
		if start == -1 {
			return out, fmt.Errorf("Invalid range: %s", each)
		}
		for start >= len(out) {
			out = append(out, false)
		}
		for end >= len(out) { // end could be -1, so do have the start loop above.
			out = append(out, false)
		}
		if end == -1 {
			out[start] = true
		} else {
			for i := start; i <= end; i++ {
				out[i] = true
			}
		}
	}
	return out, nil
}

// Add adds the id in the trie for the given prefix path.
func (t *Trie) Add(prefix []byte, id uint64) {
	m := pb.Match{
		Prefix: prefix,
	}
	y.Check(t.AddMatch(m, id))
}

// AddMatch allows you to send in a prefix match, with "holes" in the prefix. The holes are
// specified via IgnoreBytes in a comma-separated list of indices starting from 0. A dash can be
// used to denote a range. Valid example is "3, 5-8, 10, 12-15". Length of IgnoreBytes does not need
// to match the length of the Prefix passed.
//
// Consider a prefix = "aaaa". If the IgnoreBytes is set to "0, 2", then along with key "aaaa...",
// a key "baba..." would also match.
func (t *Trie) AddMatch(m pb.Match, id uint64) error {
	return t.fix(m, id, set)
}

const (
	set = iota
	del
)

func (t *Trie) fix(m pb.Match, id uint64, op int) error {
	curNode := t.root

	ignore, err := parseIgnoreBytes(m.IgnoreBytes)
	if err != nil {
		return fmt.Errorf( "while parsing ignore bytes: %s: %w", m.IgnoreBytes,err)
	}
	for len(ignore) < len(m.Prefix) {
		ignore = append(ignore, false)
	}
	for idx, byt := range m.Prefix {
		var child *node
		if ignore[idx] {
			child = curNode.ignore
			if child == nil {
				if op == del {
					// No valid node found for delete operation. Return immediately.
					return nil
				}
				child = newNode()
				curNode.ignore = child
			}
		} else {
			child = curNode.children[byt]
			if child == nil {
				if op == del {
					// No valid node found for delete operation. Return immediately.
					return nil
				}
				child = newNode()
				curNode.children[byt] = child
			}
		}
		curNode = child
	}

	// We only need to add the id to the last node of the given prefix.
	if op == set {
		curNode.ids = append(curNode.ids, id)

	} else if op == del {
		out := curNode.ids[:0]
		for _, cid := range curNode.ids {
			if id != cid {
				out = append(out, cid)
			}
		}
		curNode.ids = out
	} else {
		y.AssertTrue(false)
	}
	return nil
}

func (t *Trie) Get(key []byte) map[uint64]struct{} {
	return t.get(t.root, key)
}

// Get returns prefix matched ids for the given key.
func (t *Trie) get(curNode *node, key []byte) map[uint64]struct{} {
	y.AssertTrue(curNode != nil)

	out := make(map[uint64]struct{})
	// If any node in the path of the key has ids, pick them up.
	// This would also match nil prefixes.
	for _, i := range curNode.ids {
		out[i] = struct{}{}
	}
	if len(key) == 0 {
		return out
	}

	// If we found an ignore node, traverse that path.
	if curNode.ignore != nil {
		res := t.get(curNode.ignore, key[1:])
		for id := range res {
			out[id] = struct{}{}
		}
	}

	if child := curNode.children[key[0]]; child != nil {
		res := t.get(child, key[1:])
		for id := range res {
			out[id] = struct{}{}
		}
	}
	return out
}

func removeEmpty(curNode *node) bool {
	// Go depth first.
	if curNode.ignore != nil {
		if empty := removeEmpty(curNode.ignore); empty {
			curNode.ignore = nil
		}
	}

	for byt, n := range curNode.children {
		if empty := removeEmpty(n); empty {
			delete(curNode.children, byt)
		}
	}

	return curNode.isEmpty()
}

// Delete will delete the id if the id exist in the given index path.
func (t *Trie) Delete(prefix []byte, id uint64) error {
	return t.DeleteMatch(pb.Match{Prefix: prefix}, id)
}

func (t *Trie) DeleteMatch(m pb.Match, id uint64) error {
	if err := t.fix(m, id, del); err != nil {
		return err
	}
	// Would recursively delete empty nodes.
	// Do not remove the t.root even if its empty.
	removeEmpty(t.root)
	return nil
}

func numNodes(curNode *node) int {
	if curNode == nil {
		return 0
	}

	num := numNodes(curNode.ignore)
	for _, n := range curNode.children {
		num += numNodes(n)
	}
	return num + 1
}
