package query

import (
	"sync"
)

type UncommittedViews struct {
	mtx     *sync.RWMutex
	Created map[string]*FileInfo
	Updated map[string]*FileInfo
}

func NewUncommittedViews() UncommittedViews {
	return UncommittedViews{
		mtx:     &sync.RWMutex{},
		Created: make(map[string]*FileInfo),
		Updated: make(map[string]*FileInfo),
	}
}

func (m *UncommittedViews) SetForCreatedView(fileInfo *FileInfo) {
	ufpath := fileInfo.IdentifiedPath()

	m.mtx.Lock()
	defer m.mtx.Unlock()

	if _, ok := m.Created[ufpath]; !ok {
		if _, ok := m.Updated[ufpath]; !ok {
			m.Created[ufpath] = fileInfo
		}
	}
}

func (m *UncommittedViews) SetForUpdatedView(fileInfo *FileInfo) {
	ufpath := fileInfo.IdentifiedPath()

	m.mtx.Lock()
	defer m.mtx.Unlock()

	if _, ok := m.Created[ufpath]; !ok {
		if _, ok := m.Updated[ufpath]; !ok {
			m.Updated[ufpath] = fileInfo
		}
	}
}

func (m *UncommittedViews) Unset(fileInfo *FileInfo) {
	ufpath := fileInfo.IdentifiedPath()

	m.mtx.Lock()
	defer m.mtx.Unlock()

	if _, ok := m.Updated[ufpath]; ok {
		delete(m.Updated, ufpath)
		return
	}

	if _, ok := m.Created[ufpath]; ok {
		delete(m.Created, ufpath)
	}
}

func (m *UncommittedViews) Clean() {
	m.mtx.Lock()
	defer m.mtx.Unlock()

	for k := range m.Updated {
		delete(m.Updated, k)
	}
	for k := range m.Created {
		delete(m.Created, k)
	}
}

func (m *UncommittedViews) UncommittedFiles() (map[string]*FileInfo, map[string]*FileInfo) {
	m.mtx.RLock()
	defer m.mtx.RUnlock()

	var createdFiles = make(map[string]*FileInfo)
	var updatedFiles = make(map[string]*FileInfo)

	for k, v := range m.Created {
		if v.IsFile() {
			createdFiles[k] = v
		}
	}
	for k, v := range m.Updated {
		if v.IsFile() {
			updatedFiles[k] = v
		}
	}

	return createdFiles, updatedFiles
}

func (m *UncommittedViews) UncommittedTempViews() map[string]*FileInfo {
	m.mtx.RLock()
	defer m.mtx.RUnlock()

	var updatedViews = map[string]*FileInfo{}

	for k, v := range m.Updated {
		if v.IsInMemoryTable() {
			updatedViews[k] = v
		}
	}

	return updatedViews
}

func (m *UncommittedViews) IsEmpty() bool {
	m.mtx.RLock()
	defer m.mtx.RUnlock()

	if 0 < len(m.Created) {
		return false
	}
	if 0 < len(m.Updated) {
		return false
	}
	return true
}

func (m *UncommittedViews) CountCreatedTables() int {
	m.mtx.RLock()
	defer m.mtx.RUnlock()

	return len(m.Created)
}

func (m *UncommittedViews) CountUpdatedTables() int {
	m.mtx.RLock()
	defer m.mtx.RUnlock()

	cnt := 0
	for _, v := range m.Updated {
		if v.IsFile() {
			cnt++
		}
	}
	return cnt
}

func (m *UncommittedViews) CountUpdatedViews() int {
	m.mtx.RLock()
	defer m.mtx.RUnlock()

	cnt := 0
	for _, v := range m.Updated {
		if v.IsInMemoryTable() {
			cnt++
		}
	}
	return cnt
}
