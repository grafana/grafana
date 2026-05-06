// Copyright 2020-2021 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package sql

import (
	"strings"
	"sync"
)

// View is the parsed version of ViewDefinition
// Not meant to be used externally
type View struct {
	name           string
	definition     Node
	textDefinition string
	createViewStmt string
}

// NewView creates a View with the specified name and definition.
func NewView(name string, definition Node, textDefinition, createViewStmt string) *View {
	return &View{name, definition, textDefinition, createViewStmt}
}

// Name returns the name of the view.
func (v *View) Name() string {
	return v.name
}

// WithDefinition returns a new view with the updated definition
func (v *View) WithDefinition(def Node) *View {
	ret := *v
	ret.definition = def
	return &ret
}

// Definition returns the definition of the view.
func (v *View) Definition() Node {
	return v.definition
}

// TextDefinition returns the text definition of the view as originally defined.
func (v *View) TextDefinition() string {
	return v.textDefinition
}

// CreateStatement returns the text create view statement of the view as originally defined.
func (v *View) CreateStatement() string {
	return v.createViewStmt
}

// ViewKey is the key used to store view definitions
type ViewKey struct {
	dbName, viewName string
}

// NewViewKey creates a ViewKey ensuring both names are lowercase.
func NewViewKey(databaseName, viewName string) ViewKey {
	return ViewKey{strings.ToLower(databaseName), strings.ToLower(viewName)}
}

// ViewRegistry stores session-local views for databases that don't implement view storage. Each session gets a new
// view registry by default. Integrators that want views to persist across sessions should either implement
// sql.ViewDatabase, or construct their sessions to reuse the same ViewRegistry for each session.
type ViewRegistry struct {
	views map[ViewKey]*View
	mutex sync.RWMutex
}

// NewViewRegistry creates an empty ViewRegistry.
func NewViewRegistry() *ViewRegistry {
	return &ViewRegistry{
		views: make(map[ViewKey]*View),
	}
}

// Register adds the view specified by the pair {database, view.Name()},
// returning an error if there is already an element with that key.
func (r *ViewRegistry) Register(database string, view *View) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	key := NewViewKey(database, view.Name())

	if _, ok := r.views[key]; ok {
		return ErrExistingView.New(database, view.Name())
	}

	r.views[key] = view
	return nil
}

// Delete deletes the view specified by the pair {databaseName, viewName},
// returning an error if it does not exist.
func (r *ViewRegistry) Delete(databaseName, viewName string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	key := NewViewKey(databaseName, viewName)

	if _, ok := r.views[key]; !ok {
		return ErrViewDoesNotExist.New(databaseName, viewName)
	}

	delete(r.views, key)
	return nil
}

// View returns a pointer to the view specified by the pair {databaseName,
// viewName}, returning an error if it does not exist.
func (r *ViewRegistry) View(databaseName, viewName string) (*View, bool) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	key := NewViewKey(databaseName, viewName)

	view, ok := r.views[key]
	return view, ok
}

// ViewsInDatabase returns an array of all the views registered under the
// specified database.
func (r *ViewRegistry) ViewsInDatabase(databaseName string) (views []*View) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	for key, value := range r.views {
		if key.dbName == databaseName {
			views = append(views, value)
		}
	}

	return views
}

func (r *ViewRegistry) exists(databaseName, viewName string) bool {
	key := NewViewKey(databaseName, viewName)
	_, ok := r.views[key]

	return ok
}

// Exists returns whether the specified key is already registered
func (r *ViewRegistry) Exists(databaseName, viewName string) bool {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	return r.exists(databaseName, viewName)
}
