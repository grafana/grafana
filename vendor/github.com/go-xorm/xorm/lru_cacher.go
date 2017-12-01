// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"container/list"
	"fmt"
	"sync"
	"time"

	"github.com/go-xorm/core"
)

// LRUCacher implments cache object facilities
type LRUCacher struct {
	idList   *list.List
	sqlList  *list.List
	idIndex  map[string]map[string]*list.Element
	sqlIndex map[string]map[string]*list.Element
	store    core.CacheStore
	mutex    sync.Mutex
	// maxSize    int
	MaxElementSize int
	Expired        time.Duration
	GcInterval     time.Duration
}

// NewLRUCacher creates a cacher
func NewLRUCacher(store core.CacheStore, maxElementSize int) *LRUCacher {
	return NewLRUCacher2(store, 3600*time.Second, maxElementSize)
}

// NewLRUCacher2 creates a cache include different params
func NewLRUCacher2(store core.CacheStore, expired time.Duration, maxElementSize int) *LRUCacher {
	cacher := &LRUCacher{store: store, idList: list.New(),
		sqlList: list.New(), Expired: expired,
		GcInterval: core.CacheGcInterval, MaxElementSize: maxElementSize,
		sqlIndex: make(map[string]map[string]*list.Element),
		idIndex:  make(map[string]map[string]*list.Element),
	}
	cacher.RunGC()
	return cacher
}

// RunGC run once every m.GcInterval
func (m *LRUCacher) RunGC() {
	time.AfterFunc(m.GcInterval, func() {
		m.RunGC()
		m.GC()
	})
}

// GC check ids lit and sql list to remove all element expired
func (m *LRUCacher) GC() {
	//fmt.Println("begin gc ...")
	//defer fmt.Println("end gc ...")
	m.mutex.Lock()
	defer m.mutex.Unlock()
	var removedNum int
	for e := m.idList.Front(); e != nil; {
		if removedNum <= core.CacheGcMaxRemoved &&
			time.Now().Sub(e.Value.(*idNode).lastVisit) > m.Expired {
			removedNum++
			next := e.Next()
			//fmt.Println("removing ...", e.Value)
			node := e.Value.(*idNode)
			m.delBean(node.tbName, node.id)
			e = next
		} else {
			//fmt.Printf("removing %d cache nodes ..., left %d\n", removedNum, m.idList.Len())
			break
		}
	}

	removedNum = 0
	for e := m.sqlList.Front(); e != nil; {
		if removedNum <= core.CacheGcMaxRemoved &&
			time.Now().Sub(e.Value.(*sqlNode).lastVisit) > m.Expired {
			removedNum++
			next := e.Next()
			//fmt.Println("removing ...", e.Value)
			node := e.Value.(*sqlNode)
			m.delIds(node.tbName, node.sql)
			e = next
		} else {
			//fmt.Printf("removing %d cache nodes ..., left %d\n", removedNum, m.sqlList.Len())
			break
		}
	}
}

// GetIds returns all bean's ids according to sql and parameter from cache
func (m *LRUCacher) GetIds(tableName, sql string) interface{} {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if _, ok := m.sqlIndex[tableName]; !ok {
		m.sqlIndex[tableName] = make(map[string]*list.Element)
	}
	if v, err := m.store.Get(sql); err == nil {
		if el, ok := m.sqlIndex[tableName][sql]; !ok {
			el = m.sqlList.PushBack(newSQLNode(tableName, sql))
			m.sqlIndex[tableName][sql] = el
		} else {
			lastTime := el.Value.(*sqlNode).lastVisit
			// if expired, remove the node and return nil
			if time.Now().Sub(lastTime) > m.Expired {
				m.delIds(tableName, sql)
				return nil
			}
			m.sqlList.MoveToBack(el)
			el.Value.(*sqlNode).lastVisit = time.Now()
		}
		return v
	}

	m.delIds(tableName, sql)

	return nil
}

// GetBean returns bean according tableName and id from cache
func (m *LRUCacher) GetBean(tableName string, id string) interface{} {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if _, ok := m.idIndex[tableName]; !ok {
		m.idIndex[tableName] = make(map[string]*list.Element)
	}
	tid := genID(tableName, id)
	if v, err := m.store.Get(tid); err == nil {
		if el, ok := m.idIndex[tableName][id]; ok {
			lastTime := el.Value.(*idNode).lastVisit
			// if expired, remove the node and return nil
			if time.Now().Sub(lastTime) > m.Expired {
				m.delBean(tableName, id)
				//m.clearIds(tableName)
				return nil
			}
			m.idList.MoveToBack(el)
			el.Value.(*idNode).lastVisit = time.Now()
		} else {
			el = m.idList.PushBack(newIDNode(tableName, id))
			m.idIndex[tableName][id] = el
		}
		return v
	}

	// store bean is not exist, then remove memory's index
	m.delBean(tableName, id)
	//m.clearIds(tableName)
	return nil
}

// clearIds clears all sql-ids mapping on table tableName from cache
func (m *LRUCacher) clearIds(tableName string) {
	if tis, ok := m.sqlIndex[tableName]; ok {
		for sql, v := range tis {
			m.sqlList.Remove(v)
			m.store.Del(sql)
		}
	}
	m.sqlIndex[tableName] = make(map[string]*list.Element)
}

// ClearIds clears all sql-ids mapping on table tableName from cache
func (m *LRUCacher) ClearIds(tableName string) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.clearIds(tableName)
}

func (m *LRUCacher) clearBeans(tableName string) {
	if tis, ok := m.idIndex[tableName]; ok {
		for id, v := range tis {
			m.idList.Remove(v)
			tid := genID(tableName, id)
			m.store.Del(tid)
		}
	}
	m.idIndex[tableName] = make(map[string]*list.Element)
}

// ClearBeans clears all beans in some table
func (m *LRUCacher) ClearBeans(tableName string) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.clearBeans(tableName)
}

// PutIds pus ids into table
func (m *LRUCacher) PutIds(tableName, sql string, ids interface{}) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if _, ok := m.sqlIndex[tableName]; !ok {
		m.sqlIndex[tableName] = make(map[string]*list.Element)
	}
	if el, ok := m.sqlIndex[tableName][sql]; !ok {
		el = m.sqlList.PushBack(newSQLNode(tableName, sql))
		m.sqlIndex[tableName][sql] = el
	} else {
		el.Value.(*sqlNode).lastVisit = time.Now()
	}
	m.store.Put(sql, ids)
	if m.sqlList.Len() > m.MaxElementSize {
		e := m.sqlList.Front()
		node := e.Value.(*sqlNode)
		m.delIds(node.tbName, node.sql)
	}
}

// PutBean puts beans into table
func (m *LRUCacher) PutBean(tableName string, id string, obj interface{}) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	var el *list.Element
	var ok bool

	if el, ok = m.idIndex[tableName][id]; !ok {
		el = m.idList.PushBack(newIDNode(tableName, id))
		m.idIndex[tableName][id] = el
	} else {
		el.Value.(*idNode).lastVisit = time.Now()
	}

	m.store.Put(genID(tableName, id), obj)
	if m.idList.Len() > m.MaxElementSize {
		e := m.idList.Front()
		node := e.Value.(*idNode)
		m.delBean(node.tbName, node.id)
	}
}

func (m *LRUCacher) delIds(tableName, sql string) {
	if _, ok := m.sqlIndex[tableName]; ok {
		if el, ok := m.sqlIndex[tableName][sql]; ok {
			delete(m.sqlIndex[tableName], sql)
			m.sqlList.Remove(el)
		}
	}
	m.store.Del(sql)
}

// DelIds deletes ids
func (m *LRUCacher) DelIds(tableName, sql string) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.delIds(tableName, sql)
}

func (m *LRUCacher) delBean(tableName string, id string) {
	tid := genID(tableName, id)
	if el, ok := m.idIndex[tableName][id]; ok {
		delete(m.idIndex[tableName], id)
		m.idList.Remove(el)
		m.clearIds(tableName)
	}
	m.store.Del(tid)
}

// DelBean deletes beans in some table
func (m *LRUCacher) DelBean(tableName string, id string) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.delBean(tableName, id)
}

type idNode struct {
	tbName    string
	id        string
	lastVisit time.Time
}

type sqlNode struct {
	tbName    string
	sql       string
	lastVisit time.Time
}

func genSQLKey(sql string, args interface{}) string {
	return fmt.Sprintf("%v-%v", sql, args)
}

func genID(prefix string, id string) string {
	return fmt.Sprintf("%v-%v", prefix, id)
}

func newIDNode(tbName string, id string) *idNode {
	return &idNode{tbName, id, time.Now()}
}

func newSQLNode(tbName, sql string) *sqlNode {
	return &sqlNode{tbName, sql, time.Now()}
}
