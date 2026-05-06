gtreap
------

gtreap is an immutable treap implementation in the Go Language

[![GoDoc](https://godoc.org/github.com/steveyen/gtreap?status.svg)](https://godoc.org/github.com/steveyen/gtreap) [![Build Status](https://drone.io/github.com/steveyen/gtreap/status.png)](https://drone.io/github.com/steveyen/gtreap/latest) [![Coverage Status](https://coveralls.io/repos/steveyen/gtreap/badge.png)](https://coveralls.io/r/steveyen/gtreap)

Overview
========

gtreap implements an immutable treap data structure in golang.

By treap, this data structure is both a heap and a binary search tree.

By immutable, any updates/deletes to a treap will return a new treap
which can share internal nodes with the previous treap.  All nodes in
this implementation are read-only after their creation.  This allows
concurrent readers to operate safely with concurrent writers as
modifications only create new data structures and never modify
existing data structures.  This is a simple approach to achieving MVCC
or multi-version concurrency control.

By heap, items in the treap follow the heap-priority property, where a
parent node will have higher priority than its left and right children
nodes.

By binary search tree, items are store lexigraphically, ordered by a
user-supplied Compare function.

To get a probabilistic O(lg N) tree height, you should use a random
priority number during the Upsert() operation.

LICENSE
=======

MIT

Example
=======

    import (
        "math/rand"
        "github.com/steveyen/gtreap"
    )
    
    func stringCompare(a, b interface{}) int {
	    return bytes.Compare([]byte(a.(string)), []byte(b.(string)))
    }
    
    t := gtreap.NewTreap(stringCompare)
    t = t.Upsert("hi", rand.Int())
    t = t.Upsert("hola", rand.Int())
    t = t.Upsert("bye", rand.Int())
    t = t.Upsert("adios", rand.Int())
    
    hi = t.Get("hi")
    bye = t.Get("bye")
    
    // Some example Delete()'s...
    t = t.Delete("bye")
    nilValueHere = t.Get("bye")
    t2 = t.Delete("hi")
    nilValueHere2 = t2.Get("hi")
    
    // Since we still hold onto treap t, we can still access "hi".
    hiStillExistsInTreapT = t.Get("hi")
    
    t.VisitAscend("cya", func(i Item) bool {
        // This visitor callback will be invoked with every item
        // from "cya" onwards.  So: "hi", "hola".
        // If we want to stop visiting, return false;
        // otherwise a true return result means keep visiting items.
        return true
    })

Tips
====

The Upsert() method takes both an Item (an interface{}) and a heap
priority.  Usually, that priority should be a random int
(math/rand.Int()) or perhaps even a hash of the item.  However, if you
want to shuffle more commonly accessed items nearer to the top of the
treap for faster access, at the potential cost of not approaching a
probabilistic O(lg N) tree height, then you might tweak the priority.

See also
========

For a simple, ordered, key-value storage or persistence library built
on immutable treaps, see: https://github.com/steveyen/gkvlite
