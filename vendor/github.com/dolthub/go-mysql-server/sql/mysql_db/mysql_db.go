// Copyright 2022 Dolthub, Inc.
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

package mysql_db

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"regexp"
	"sort"
	"strings"
	"sync"
	"sync/atomic"

	flatbuffers "github.com/dolthub/flatbuffers/v23/go"
	"github.com/dolthub/vitess/go/mysql"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/in_mem_table"
	"github.com/dolthub/go-mysql-server/sql/mysql_db/serial"
)

// MySQLDbPersistence is used to determine the behavior of how certain tables in MySQLDb will be persisted.
type MySQLDbPersistence interface {
	Persist(ctx *sql.Context, data []byte) error
}

// NoopPersister is used when nothing in mysql db should be persisted
type NoopPersister struct{}

var _ MySQLDbPersistence = &NoopPersister{}

// Persist implements the MySQLDbPersistence interface
func (p *NoopPersister) Persist(ctx *sql.Context, data []byte) error {
	return nil
}

type PlaintextAuthPlugin interface {
	Authenticate(db *MySQLDb, user string, userEntry *User, pass string) (bool, error)
}

// MySQLDb are the collection of tables that are in the MySQL database
type MySQLDb struct {
	persister MySQLDbPersistence
	*authServer

	role_edges          *in_mem_table.IndexedSetTable[*RoleEdge]
	replica_source_info *in_mem_table.IndexedSetTable[*ReplicaSourceInfo]
	user                *in_mem_table.IndexedSetTable[*User]
	db                  *in_mem_table.MultiIndexedSetTable[*User]
	tables_priv         *in_mem_table.MultiIndexedSetTable[*User]
	procs_priv          *in_mem_table.MultiIndexedSetTable[*User]
	global_grants       *in_mem_table.MultiIndexedSetTable[*User]

	help_relation *mysqlTable
	help_topic    *mysqlTable
	help_keyword  *mysqlTable
	help_category *mysqlTable

	//TODO: add the rest of these tables
	//columns_priv     *mysqlTable
	//proxies_priv     *mysqlTable
	//default_roles    *mysqlTable
	//password_history *mysqlTable

	plugins       map[string]PlaintextAuthPlugin
	updateCounter atomic.Uint64
	lock          sync.RWMutex
	enabled       atomic.Bool
}

var _ sql.Database = (*MySQLDb)(nil)
var _ mysql.AuthServer = (*MySQLDb)(nil)

// CreateEmptyMySQLDb returns a collection of MySQL Tables that do not contain any data.
func CreateEmptyMySQLDb() *MySQLDb {
	// original tables
	mysqlDb := &MySQLDb{}

	mysqlDb.authServer = newAuthServer(mysqlDb)

	lock, rlock := &mysqlDb.lock, mysqlDb.lock.RLocker()

	userSet, userTable := NewUserIndexedSetTable(lock, rlock)
	mysqlDb.user = userTable
	mysqlDb.role_edges = NewRoleEdgesIndexedSetTable(lock, rlock)
	mysqlDb.replica_source_info = NewReplicaSourceInfoIndexedSetTable(lock, rlock)

	// Help tables
	mysqlDb.help_topic = newEmptyMySQLTable(
		"help_topic",
		helpTopicSchema,
		mysqlDb)
	mysqlDb.help_keyword = newEmptyMySQLTable(
		"help_keyword",
		helpKeywordSchema,
		mysqlDb)
	mysqlDb.help_category = newEmptyMySQLTable(
		"help_category",
		helpCategorySchema,
		mysqlDb)
	mysqlDb.help_relation = newEmptyMySQLTable(
		"help_relation",
		helpRelationSchema,
		mysqlDb)

	// multi tables
	mysqlDb.db = NewUserDBIndexedSetTable(userSet, lock, rlock)
	mysqlDb.tables_priv = NewUserTablesIndexedSetTable(userSet, lock, rlock)
	mysqlDb.procs_priv = NewUserProcsIndexedSetTable(userSet, lock, rlock)
	mysqlDb.global_grants = NewUserGlobalGrantsIndexedSetTable(userSet, lock, rlock)

	// Start the counter at 1, all new sessions will start at zero so this forces an update for any new session
	mysqlDb.updateCounter.Store(1)

	return mysqlDb
}

type Reader struct {
	close             func()
	users             in_mem_table.IndexedSet[*User]
	roleEdges         in_mem_table.IndexedSet[*RoleEdge]
	replicaSourceInfo in_mem_table.IndexedSet[*ReplicaSourceInfo]
}

type UserFetcher interface {
	GetUser(u UserPrimaryKey) (res *User, ok bool)
	GetUsersByUsername(username string) []*User
}

func (r *Reader) GetReplicaSourceInfo(k ReplicaSourceInfoPrimaryKey) (res *ReplicaSourceInfo, ok bool) {
	sources := r.replicaSourceInfo.GetMany(ReplicaSourceInfoPrimaryKeyer{}, k)
	if len(sources) > 1 {
		panic("too many matching replica sources")
	}
	if len(sources) > 0 {
		res = sources[0]
		ok = true
	}
	return
}

func (r *Reader) GetUser(u UserPrimaryKey) (res *User, ok bool) {
	users := r.users.GetMany(UserPrimaryKeyer{}, u)
	if len(users) > 1 {
		panic("too many matching users")
	}
	if len(users) > 0 {
		res = users[0]
		ok = true
	}
	return
}

func (r *Reader) GetUsersByUsername(username string) []*User {
	return r.users.GetMany(UserSecondaryKeyer{}, UserSecondaryKey{
		User: username,
	})
}

func (r *Reader) GetToUserRoleEdges(key RoleEdgesToKey) []*RoleEdge {
	return r.roleEdges.GetMany(RoleEdgeToKeyer{}, key)
}

func (r *Reader) VisitUsers(cb func(*User)) {
	r.users.VisitEntries(cb)
}

func (r *Reader) VisitRoleEdges(cb func(*RoleEdge)) {
	r.roleEdges.VisitEntries(cb)
}

func (r *Reader) VisitReplicaSourceInfos(cb func(*ReplicaSourceInfo)) {
	r.replicaSourceInfo.VisitEntries(cb)
}

func (r *Reader) Close() {
	if r.close != nil {
		r.close()
		r.close = nil
	}
}

type Editor struct {
	db     *MySQLDb
	reader *Reader
}

func (ed *Editor) GetReplicaSourceInfo(k ReplicaSourceInfoPrimaryKey) (res *ReplicaSourceInfo, ok bool) {
	sources := ed.reader.replicaSourceInfo.GetMany(ReplicaSourceInfoPrimaryKeyer{}, k)
	if len(sources) > 1 {
		panic("too many matching replica sources")
	}
	if len(sources) > 0 {
		res = sources[0]
		ok = true
	}
	return
}

func (ed *Editor) GetUsersByUsername(username string) []*User {
	return ed.reader.GetUsersByUsername(username)
}

func (ed *Editor) GetUser(u UserPrimaryKey) (res *User, ok bool) {
	return ed.reader.GetUser(u)
}

func (ed *Editor) GetToUserRoleEdges(key RoleEdgesToKey) []*RoleEdge {
	return ed.reader.GetToUserRoleEdges(key)
}

func (ed *Editor) VisitUsers(cb func(*User)) {
	ed.reader.VisitUsers(cb)
}

func (ed *Editor) VisitRoleEdges(cb func(*RoleEdge)) {
	ed.reader.VisitRoleEdges(cb)
}

func (ed *Editor) VisitReplicaSourceInfos(cb func(*ReplicaSourceInfo)) {
	ed.reader.VisitReplicaSourceInfos(cb)
}

func (ed *Editor) PutUser(u *User) {
	if old, ok := ed.reader.users.Get(u); ok {
		ed.reader.users.Remove(old)
	}
	ed.reader.users.Put(u)
}

func (ed *Editor) RemoveUser(pk UserPrimaryKey) {
	ed.reader.users.RemoveMany(UserPrimaryKeyer{}, pk)
}

func (ed *Editor) PutRoleEdge(re *RoleEdge) {
	if old, ok := ed.reader.roleEdges.Get(re); ok {
		ed.reader.roleEdges.Remove(old)
	}
	ed.reader.roleEdges.Put(re)
}

func (ed *Editor) RemoveRoleEdge(pk RoleEdgesPrimaryKey) {
	ed.reader.roleEdges.RemoveMany(RoleEdgePrimaryKeyer{}, pk)
}

func (ed *Editor) RemoveRoleEdgesFromKey(key RoleEdgesFromKey) {
	ed.reader.roleEdges.RemoveMany(RoleEdgeFromKeyer{}, key)
}

func (ed *Editor) RemoveRoleEdgesToKey(key RoleEdgesToKey) {
	ed.reader.roleEdges.RemoveMany(RoleEdgeToKeyer{}, key)
}

func (ed *Editor) RemoveReplicaSourceInfo(k ReplicaSourceInfoPrimaryKey) {
	ed.reader.replicaSourceInfo.RemoveMany(ReplicaSourceInfoPrimaryKeyer{}, k)
}

func (ed *Editor) PutReplicaSourceInfo(rsi *ReplicaSourceInfo) {
	if old, ok := ed.reader.replicaSourceInfo.Get(rsi); ok {
		ed.reader.replicaSourceInfo.Remove(old)
	}
	ed.reader.replicaSourceInfo.Put(rsi)
}

func (ed *Editor) Close() {
	ed.db.updateCounter.Add(1)
	ed.reader.Close()
	ed.db.lock.Unlock()
}

func (db *MySQLDb) unlockedReader() *Reader {
	return &Reader{
		users:             db.user.Set(),
		roleEdges:         db.role_edges.Set(),
		replicaSourceInfo: db.replica_source_info.Set(),
	}
}

func (db *MySQLDb) Reader() *Reader {
	db.lock.RLock()
	return &Reader{
		users:             db.user.Set(),
		roleEdges:         db.role_edges.Set(),
		replicaSourceInfo: db.replica_source_info.Set(),
		close: func() {
			db.lock.RUnlock()
		},
	}
}

func (db *MySQLDb) Editor() *Editor {
	db.lock.Lock()
	return &Editor{
		db,
		db.unlockedReader(),
	}
}

func (db *MySQLDb) Enabled() bool {
	return db.enabled.Load()
}

func (db *MySQLDb) SetEnabled(v bool) {
	db.enabled.Store(v)
}

// LoadPrivilegeData adds the given data to the MySQL Tables. It does not remove any current data, but will overwrite any
// pre-existing data. This has been deprecated in favor of LoadData.
func (db *MySQLDb) LoadPrivilegeData(ctx *sql.Context, users []*User, roleConnections []*RoleEdge) error {
	db.SetEnabled(true)

	ed := db.Editor()
	defer ed.Close()

	for _, user := range users {
		if user == nil {
			continue
		}
		ed.PutUser(user)
	}

	for _, role := range roleConnections {
		if role == nil {
			continue
		}
		ed.PutRoleEdge(role)
	}

	return nil
}

// LoadData adds the given data to the MySQL Tables. It does not remove any current data, but will overwrite any
// pre-existing data.
func (db *MySQLDb) LoadData(ctx *sql.Context, buf []byte) (err error) {
	// Do nothing if data file doesn't exist or is empty
	if buf == nil || len(buf) == 0 {
		return nil
	}

	type privDataJson struct {
		Users []*User
		Roles []*RoleEdge
	}

	// if it's a json file, read it; will be rewritten as flatbuffer later
	data := &privDataJson{}
	if err := json.Unmarshal(buf, data); err == nil {
		return db.LoadPrivilegeData(ctx, data.Users, data.Roles)
	}

	// Indicate that mysql db exists
	db.SetEnabled(true)

	// Recover from panics
	defer func() {
		if recover() != nil {
			err = fmt.Errorf("ill formatted privileges file")
		}
	}()

	// Deserialize the flatbuffer
	serialMySQLDb := serial.GetRootAsMySQLDb(buf, 0)

	ed := db.Editor()
	defer ed.Close()

	// Fill in user table
	for i := 0; i < serialMySQLDb.UserLength(); i++ {
		serialUser := new(serial.User)
		if !serialMySQLDb.User(serialUser, i) {
			continue
		}
		user := LoadUser(serialUser)
		ed.PutUser(user)
	}

	// Fill in Roles table
	for i := 0; i < serialMySQLDb.RoleEdgesLength(); i++ {
		serialRoleEdge := new(serial.RoleEdge)
		if !serialMySQLDb.RoleEdges(serialRoleEdge, i) {
			continue
		}
		role := LoadRoleEdge(serialRoleEdge)
		ed.PutRoleEdge(role)
	}

	// Fill in the ReplicaSourceInfo table
	for i := 0; i < serialMySQLDb.ReplicaSourceInfoLength(); i++ {
		serialReplicaSourceInfo := new(serial.ReplicaSourceInfo)
		if !serialMySQLDb.ReplicaSourceInfo(serialReplicaSourceInfo, i) {
			continue
		}
		replicaSourceInfo := LoadReplicaSourceInfo(serialReplicaSourceInfo)
		ed.PutReplicaSourceInfo(replicaSourceInfo)
	}

	// Load superusers
	for i := 0; i < serialMySQLDb.SuperUserLength(); i++ {
		serialUser := new(serial.User)
		if !serialMySQLDb.SuperUser(serialUser, i) {
			continue
		}
		ed.PutUser(LoadUser(serialUser))
	}

	// TODO: fill in other tables when they exist
	return
}

// OverwriteUsersAndGrantData replaces the users and grant data served by this
// MySQL DB instance with the data which is present in the provided byte
// buffer, which is a persisted copy of a MySQLDb created with `Persist`. In
// contrast to LoadData, it *does* remove current data in the database.
//
// This interface is appropriate for replication, when a replica needs to be
// brought up to date with a primary server.
//
// This method does not support the legacy JSON serialization of users and
// grant data. In contrast to most methods which operate with persisted users
// and grants in *MySQLDb, this method _does_ restore persisted super users.
func (db *MySQLDb) OverwriteUsersAndGrantData(ctx *sql.Context, ed *Editor, buf []byte) (err error) {
	// Recover from panics
	defer func() {
		if recover() != nil {
			err = fmt.Errorf("ill formatted privileges file")
		}
	}()

	// Deserialize the flatbuffer
	serialMySQLDb := serial.GetRootAsMySQLDb(buf, 0)

	// In order to make certain we can read the entire serialized message,
	// we load it fully into *User and *RoleEdge instances before we mutate
	// our maps at all.
	var users []*User
	var edges []*RoleEdge

	// Load all users
	for i := 0; i < serialMySQLDb.UserLength(); i++ {
		serialUser := new(serial.User)
		if !serialMySQLDb.User(serialUser, i) {
			continue
		}
		users = append(users, LoadUser(serialUser))
	}
	for i := 0; i < serialMySQLDb.SuperUserLength(); i++ {
		serialUser := new(serial.User)
		if !serialMySQLDb.SuperUser(serialUser, i) {
			continue
		}
		user := LoadUser(serialUser)
		user.IsSuperUser = true
		users = append(users, user)
	}

	// Load all role edges
	for i := 0; i < serialMySQLDb.RoleEdgesLength(); i++ {
		serialRoleEdge := new(serial.RoleEdge)
		if !serialMySQLDb.RoleEdges(serialRoleEdge, i) {
			continue
		}
		edges = append(edges, LoadRoleEdge(serialRoleEdge))
	}

	ed.reader.users.Clear()
	ed.reader.roleEdges.Clear()
	for _, u := range users {
		ed.PutUser(u)
	}
	for _, e := range edges {
		ed.PutRoleEdge(e)
	}

	return
}

// SetPersister sets the custom persister to be used when the MySQL Db tables have been updated and need to be persisted.
func (db *MySQLDb) SetPersister(persister MySQLDbPersistence) {
	db.persister = persister
}

func (db *MySQLDb) SetPlugins(plugins map[string]PlaintextAuthPlugin) {
	db.plugins = plugins
}

func (db *MySQLDb) VerifyPlugin(plugin string) error {
	_, ok := db.plugins[plugin]
	if ok {
		return nil
	}
	return fmt.Errorf(`must provide authentication plugin for unsupported authentication format`)
}

// AddRootAccount adds the root account to the list of accounts.
func (db *MySQLDb) AddRootAccount() {
	ed := db.Editor()
	defer ed.Close()
	db.AddSuperUser(ed, "root", "localhost", "")
}

// AddEphemeralSuperUser adds a new temporary superuser account for the specified username, host,
// and password. The superuser account will only exist for the lifetime of the server process; once
// the server is restarted, this superuser account will not be present.
func (db *MySQLDb) AddEphemeralSuperUser(ed *Editor, username string, host string, password string) {
	db.SetEnabled(true)

	if len(password) > 0 {
		hash := sha1.New()
		hash.Write([]byte(password))
		s1 := hash.Sum(nil)
		hash.Reset()
		hash.Write(s1)
		s2 := hash.Sum(nil)
		password = "*" + strings.ToUpper(hex.EncodeToString(s2))
	}

	if _, ok := ed.GetUser(UserPrimaryKey{
		Host: host,
		User: username,
	}); !ok {
		addSuperUser(ed, username, host, password, true)
	}
}

// AddSuperUser adds the given username and password to the list of accounts. This is a temporary function, which is
// meant to replace the "auth.New..." functions while the remaining functions are added.
func (db *MySQLDb) AddSuperUser(ed *Editor, username string, host string, password string) {
	//TODO: remove this function and the called function
	db.SetEnabled(true)

	if len(password) > 0 {
		hash := sha1.New()
		hash.Write([]byte(password))
		s1 := hash.Sum(nil)
		hash.Reset()
		hash.Write(s1)
		s2 := hash.Sum(nil)
		password = "*" + strings.ToUpper(hex.EncodeToString(s2))
	}

	if _, ok := ed.GetUser(UserPrimaryKey{
		Host: host,
		User: username,
	}); !ok {
		addSuperUser(ed, username, host, password, false)
	}
}

// AddLockedSuperUser adds a new superuser with the specified |username|, |host|, and |password|
// and sets the account to be locked so that it cannot be used to log in.
func (db *MySQLDb) AddLockedSuperUser(ed *Editor, username string, host string, password string) {
	user := db.GetUser(ed, username, host, false)

	// If the user doesn't exist yet, create it and lock it
	if user == nil {
		db.AddSuperUser(ed, username, host, password)
		user = db.GetUser(ed, username, host, false)
		if user == nil {
			panic("unable to load newly created superuser: " + username)
		}

		// Lock the account to prevent it being used to log in
		user.Locked = true
		ed.PutUser(user)
	}

	// If the user exists, but isn't a superuser or locked, fix it
	if user.IsSuperUser == false || user.Locked == false {
		user.IsSuperUser = true
		user.Locked = true
		ed.PutUser(user)
	}
}

// matchesHostPattern checks if a host matches a host pattern with wildcards.
func matchesHostPattern(host, pattern string) bool {
	// No wildcard, not a pattern
	if !strings.Contains(pattern, "%") {
		return false
	}

	// Escape regex metacharacters, then replace % with .*
	regexPattern := regexp.QuoteMeta(pattern)
	regexPattern = strings.ReplaceAll(regexPattern, "%", ".*")
	regexPattern = "^" + regexPattern + "$"

	matched, err := regexp.MatchString(regexPattern, host)
	return err == nil && matched
}

// GetUser returns a user matching the given user and host if it exists. Due to the slight difference between users and
// roles, roleSearch changes whether the search matches against user or role rules.
func (db *MySQLDb) GetUser(fetcher UserFetcher, user string, host string, roleSearch bool) *User {
	//TODO: Determine what the localhost is on the machine, then handle the conversion between IP and localhost.
	// For now, loopback addresses are treated as localhost.
	//TODO: Determine how to match anonymous roles (roles with an empty user string), which differs from users
	//TODO: Treat '%' as a proper wildcard for hostnames, allowing for regex-like matches.
	// Hostnames representing an IP address that have a wildcard have additional restrictions on what may match
	//TODO: Match non-existent users to the most relevant anonymous user if multiple exist (''@'localhost' vs ''@'%')
	// It appears that ''@'localhost' can use the privileges set on ''@'%', which seems to be unique behavior.
	// For example, 'abc'@'localhost' CANNOT use any privileges set on 'abc'@'%'.
	// Unknown if this is special for ''@'%', or applies to any matching anonymous user.
	//TODO: Hostnames representing IPs can use masks, such as 'abc'@'54.244.85.0/255.255.255.0'
	//TODO: Allow for CIDR notation in hostnames
	//TODO: Which user do we choose when multiple host names match (e.g. host name with most characters matched, etc.)

	// Store the original host for pattern matching against IP patterns
	originalHost := host

	if "127.0.0.1" == host || "::1" == host {
		host = "localhost"
	}

	if user, ok := fetcher.GetUser(UserPrimaryKey{
		Host: host,
		User: user,
	}); ok {
		return user
	}

	// First we check for matches on the same user, then we try the anonymous user
	for _, targetUser := range []string{user, ""} {
		users := fetcher.GetUsersByUsername(targetUser)
		for _, user := range users {
			//TODO: use the most specific match first, using "%" only if there isn't a more specific match
			if host == user.Host ||
				(host == "localhost" && user.Host == "::1") ||
				(host == "localhost" && user.Host == "127.0.0.1") ||
				(user.Host == "%" && (!roleSearch || host == "")) ||
				matchesHostPattern(host, user.Host) ||
				(originalHost != host && matchesHostPattern(originalHost, user.Host)) {
				return user
			}
		}
	}
	return nil
}

// UserActivePrivilegeSet fetches the User, and returns their entire active privilege set. This takes into account the
// active roles, which are set in the context, therefore the user is also pulled from the context.
func (db *MySQLDb) UserActivePrivilegeSet(ctx *sql.Context) PrivilegeSet {
	if privSet, counter := ctx.Session.GetPrivilegeSet(); db.updateCounter.Load() == counter {
		// If the counters are equal, we can guarantee that the privilege set exists and is valid
		return privSet.(PrivilegeSet)
	}

	rd := db.Reader()
	defer rd.Close()

	client := ctx.Session.Client()
	user := db.GetUser(rd, client.User, client.Address, false)
	if user == nil {
		return NewPrivilegeSet()
	}

	privSet := user.PrivilegeSet.Copy()
	roleEdgeEntries := rd.GetToUserRoleEdges(RoleEdgesToKey{
		ToHost: user.Host,
		ToUser: user.User,
	})
	//TODO: filter the active roles using the context, rather than using every granted roles
	//TODO: System variable "activate_all_roles_on_login", if set, will set all roles as active upon logging in
	for _, roleEdgeEntry := range roleEdgeEntries {
		roleEdge := roleEdgeEntry
		role := db.GetUser(rd, roleEdge.FromUser, roleEdge.FromHost, true)
		if role != nil {
			privSet.UnionWith(role.PrivilegeSet)
		}
	}

	ctx.Session.SetPrivilegeSet(privSet, db.updateCounter.Load())
	return privSet
}

// RoutineAdminCheck fetches the User from the context, and specifically evaluates, the permission check
// assuming the operation is for a stored procedure or function. This allows us to have more fine grain control over
// permissions for stored procedures (many of which are critical to Dolt). This method specifically checks exists
// for the use of AdminOnly procedures which require more fine-grained access control. For procedures which are
// not AdminOnly, then |UserHasPrivileges| should be used instead.
func (db *MySQLDb) RoutineAdminCheck(ctx *sql.Context, operations ...sql.PrivilegedOperation) bool {
	privSet := db.UserActivePrivilegeSet(ctx)

	if privSet.Has(sql.PrivilegeType_Super) {
		// Superpowers allow you to fly and look through walls, surely you can execute whatever you want.
		return true
	}

	for _, operation := range operations {
		for _, operationPriv := range operation.StaticPrivileges {
			database := operation.Database
			if database == "" {
				database = ctx.GetCurrentDatabase()
			}
			dbSet := privSet.Database(database)
			routineSet := dbSet.Routine(operation.Routine, operation.IsProcedure)
			if routineSet.Has(operationPriv) {
				continue
			}

			// User does not have permission to perform the operation.
			return false
		}
	}
	return true
}

// UserHasPrivileges fetches the User, and returns whether they have the desired privileges necessary to perform the
// privileged operation(s). This takes into account the active roles, which are set in the context, therefore both
// the user and the active roles are pulled from the context. This method is sufficient for all MySQL behaviors.
// The one exception, currently, is for stored procedures and functions, which have a more fine-grained permission
// due to Dolt's use of the AdminOnly flag in procedure definitions.
//
// This functions implements the global/database/table|routine hierarchy of permissions. If a user has Execute permissions
// on the database, then they implicitly have that same permission on all tables and routines in that database. This
// is how all MySQL permissions work.
func (db *MySQLDb) UserHasPrivileges(ctx *sql.Context, operations ...sql.PrivilegedOperation) bool {
	privSet := db.UserActivePrivilegeSet(ctx)
	// Super users have all privileges, so if they have global super privs, then
	// they have all dynamic privs and we don't need to check them.
	if privSet.Has(sql.PrivilegeType_Super) {
		return true
	}

	if !db.Enabled() {
		return true
	}
	for _, operation := range operations {

		for _, operationPriv := range operation.StaticPrivileges {
			if privSet.Has(operationPriv) {
				//TODO: Handle partial revokes
				continue
			}
			database := operation.Database
			if database == "" {
				database = ctx.GetCurrentDatabase()
			}
			dbSet := privSet.Database(database)
			if dbSet.Has(operationPriv) {
				continue
			}
			tblSet := dbSet.Table(operation.Table)
			if tblSet.Has(operationPriv) {
				continue
			}

			// TODO: Complete the column check support.
			// colSet := tblSet.Column(operation.Column)
			// if colSet.Has(operationPriv) {
			//  	continue
			// }

			routineSet := dbSet.Routine(operation.Routine, operation.IsProcedure)
			if routineSet.Has(operationPriv) {
				continue
			}

			// User does not have permission to perform the operation.
			return false
		}

		for _, operationPriv := range operation.DynamicPrivileges {
			if privSet.HasDynamic(operationPriv) {
				continue
			}

			// Dynamic privileges are only allowed at a global scope, so no need to check
			// for database, table, or column privileges.
			return false
		}
	}
	return true
}

// Name implements the interface sql.Database.
func (db *MySQLDb) Name() string {
	return "mysql"
}

// GetTableInsensitive implements the interface sql.Database.
func (db *MySQLDb) GetTableInsensitive(_ *sql.Context, tblName string) (sql.Table, bool, error) {
	switch strings.ToLower(tblName) {
	case userTblName:
		return db.user, true, nil
	case roleEdgesTblName:
		return db.role_edges, true, nil
	case dbTblName:
		return db.db, true, nil
	case tablesPrivTblName:
		return db.tables_priv, true, nil
	case procsPrivTblName:
		return db.procs_priv, true, nil
	case replicaSourceInfoTblName:
		return db.replica_source_info, true, nil
	case helpTopicTableName:
		return db.help_topic, true, nil
	case helpKeywordTableName:
		return db.help_keyword, true, nil
	case helpCategoryTableName:
		return db.help_category, true, nil
	case helpRelationTableName:
		return db.help_relation, true, nil
	default:
		return nil, false, nil
	}
}

// GetTableNames implements the interface sql.Database.
func (db *MySQLDb) GetTableNames(ctx *sql.Context) ([]string, error) {
	return []string{
		userTblName,
		dbTblName,
		tablesPrivTblName,
		procsPrivTblName,
		roleEdgesTblName,
		replicaSourceInfoTblName,
		helpTopicTableName,
		helpKeywordTableName,
		helpCategoryTableName,
		helpRelationTableName,
	}, nil
}

// ValidateHash was previously used as part of authentication, but is no longer used by the Vitess authentication
// logic. This method is still used by the sql util class in Dolt to authenticate a user connecting to a local
// Dolt sql-server by running a "dolt sql" command.
// TODO: The dolt sql utils.go code should be refactored to use a different API, so that we can delete this method.
func (db *MySQLDb) ValidateHash(salt []byte, user string, authResponse []byte, addr net.Addr) (mysql.Getter, error) {
	host, err := extractHostAddress(addr)
	if err != nil {
		return nil, err
	}

	rd := db.Reader()
	defer rd.Close()

	if !db.Enabled() {
		return sql.MysqlConnectionUser{User: user, Host: host}, nil
	}

	userEntry := db.GetUser(rd, user, host, false)
	if userEntry == nil || userEntry.Locked {
		return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError, "Access denied for user '%v'", user)
	}
	if len(userEntry.AuthString) > 0 {
		if !validateMysqlNativePassword(authResponse, salt, userEntry.AuthString) {
			return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError, "Access denied for user '%v'", user)
		}
	} else if len(authResponse) > 0 { // password is nil or empty, therefore no password is set
		// a password was given and the account has no password set, therefore access is denied
		return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError, "Access denied for user '%v'", user)
	}

	return sql.MysqlConnectionUser{User: userEntry.User, Host: userEntry.Host}, nil
}

// Persist passes along all changes to the integrator.
//
// This takes an Editor, instead of a Reader, since presumably we have just
// done a write. In any case, it's nice to not ACK a write until it is
// persisted, and the write lock which the Editor takes can help with not
// making these changes visible until it is persisted as well.
func (db *MySQLDb) Persist(ctx *sql.Context, ed *Editor) error {
	// Extract all user entries from table, and sort
	var users []*User
	var superUsers []*User
	ed.VisitUsers(func(u *User) {
		if !u.IsEphemeral {
			if !u.IsSuperUser {
				users = append(users, u)
			} else {
				superUsers = append(superUsers, u)
			}
		}
	})
	sort.Slice(users, func(i, j int) bool {
		if users[i].Host == users[j].Host {
			return users[i].User < users[j].User
		}
		return users[i].Host < users[j].Host
	})
	sort.Slice(superUsers, func(i, j int) bool {
		if superUsers[i].Host == superUsers[j].Host {
			return superUsers[i].User < superUsers[j].User
		}
		return superUsers[i].Host < superUsers[j].Host
	})

	// Extract all role entries from table, and sort
	var roles []*RoleEdge
	ed.VisitRoleEdges(func(v *RoleEdge) {
		roles = append(roles, v)
	})
	sort.Slice(roles, func(i, j int) bool {
		if roles[i].FromHost == roles[j].FromHost {
			if roles[i].FromUser == roles[j].FromUser {
				if roles[i].ToHost == roles[j].ToHost {
					return roles[i].ToUser < roles[j].ToUser
				}
				return roles[i].ToHost < roles[j].ToHost
			}
			return roles[i].FromUser < roles[j].FromUser
		}
		return roles[i].FromHost < roles[j].FromHost
	})

	// Extract all replica source info entries from table, and sort
	var replicaSourceInfos []*ReplicaSourceInfo
	ed.VisitReplicaSourceInfos(func(v *ReplicaSourceInfo) {
		replicaSourceInfos = append(replicaSourceInfos, v)
	})
	sort.Slice(replicaSourceInfos, func(i, j int) bool {
		if replicaSourceInfos[i].Host == replicaSourceInfos[j].Host {
			if replicaSourceInfos[i].Port == replicaSourceInfos[j].Port {
				return replicaSourceInfos[i].User < replicaSourceInfos[j].User
			}
			return replicaSourceInfos[i].Port < replicaSourceInfos[j].Port
		}
		return replicaSourceInfos[i].Host < replicaSourceInfos[j].Host
	})

	// TODO: serialize other tables when they exist

	// Create flatbuffer
	b := flatbuffers.NewBuilder(0)
	user := serializeUser(b, users)
	roleEdge := serializeRoleEdge(b, roles)
	replicaSourceInfo := serializeReplicaSourceInfo(b, replicaSourceInfos)
	superUser := serializeUser(b, superUsers)

	// Write MySQL DB
	serial.MySQLDbStart(b)
	serial.MySQLDbAddUser(b, user)
	serial.MySQLDbAddRoleEdges(b, roleEdge)
	serial.MySQLDbAddReplicaSourceInfo(b, replicaSourceInfo)
	serial.MySQLDbAddSuperUser(b, superUser)
	mysqlDbOffset := serial.MySQLDbEnd(b)

	// Finish writing
	b.Finish(mysqlDbOffset)

	// Persist data
	return db.persister.Persist(ctx, b.FinishedBytes())
}

// columnTemplate takes in a column as a template, and returns a new column with a different name based on the given
// template.
func columnTemplate(name string, source string, isPk bool, template *sql.Column) *sql.Column {
	newCol := *template
	if newCol.Default != nil {
		newCol.Default = &(*newCol.Default)
	}
	newCol.Name = name
	newCol.Source = source
	newCol.PrimaryKey = isPk
	return &newCol
}

// mustDefault enforces that no error occurred when constructing the column default value.
func mustDefault(expr sql.Expression, outType sql.Type, representsLiteral bool, mayReturnNil bool) *sql.ColumnDefaultValue {
	colDef, err := sql.NewColumnDefaultValue(expr, outType, representsLiteral, !representsLiteral, mayReturnNil)
	if err != nil {
		panic(err)
	}
	return colDef
}

type dummyPartition struct{}

var _ sql.Partition = dummyPartition{}

// Key implements the interface sql.Partition.
func (d dummyPartition) Key() []byte {
	return nil
}
