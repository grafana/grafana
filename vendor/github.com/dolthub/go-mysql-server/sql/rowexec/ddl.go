// Copyright 2023 Dolthub, Inc.
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

package rowexec

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/dolthub/vitess/go/mysql"
	"github.com/sirupsen/logrus"

	"github.com/dolthub/go-mysql-server/internal/similartext"
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/fulltext"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/types"
)

func (b *BaseBuilder) buildAlterAutoIncrement(ctx *sql.Context, n *plan.AlterAutoIncrement, row sql.Row) (sql.RowIter, error) {
	err := b.executeAlterAutoInc(ctx, n)
	if err != nil {
		return nil, err
	}

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildDropTrigger(ctx *sql.Context, n *plan.DropTrigger, row sql.Row) (sql.RowIter, error) {
	triggerDb, ok := n.Db.(sql.TriggerDatabase)
	if !ok {
		if n.IfExists {
			return rowIterWithOkResultWithZeroRowsAffected(), nil
		} else {
			return nil, sql.ErrTriggerDoesNotExist.New(n.TriggerName)
		}
	}
	err := triggerDb.DropTrigger(ctx, n.TriggerName)
	if n.IfExists && sql.ErrTriggerDoesNotExist.Is(err) {
		return rowIterWithOkResultWithZeroRowsAffected(), nil
	} else if err != nil {
		return nil, err
	}
	return rowIterWithOkResultWithZeroRowsAffected(), nil
}

func (b *BaseBuilder) buildLoadData(ctx *sql.Context, n *plan.LoadData, row sql.Row) (sql.RowIter, error) {
	var reader io.ReadCloser
	var err error
	if n.Local {
		_, localInfile, ok := sql.SystemVariables.GetGlobal("local_infile")
		if !ok {
			return nil, fmt.Errorf("error: local_infile variable was not found")
		}

		if localInfile.(int8) == 0 {
			return nil, fmt.Errorf("local_infile needs to be set to 1 to use LOCAL")
		}

		reader, err = ctx.LoadInfile(n.File)
		if err != nil {
			return nil, err
		}
	} else {
		_, secureFileDir, ok := sql.SystemVariables.GetGlobal("secure_file_priv")
		if !ok {
			return nil, fmt.Errorf("error: secure_file_priv variable was not found")
		}

		if err = isUnderSecureFileDir(secureFileDir, n.File); err != nil {
			return nil, sql.ErrLoadDataCannotOpen.New(err.Error())
		}
		file, fileErr := os.Open(n.File)
		if fileErr != nil {
			return nil, sql.ErrLoadDataCannotOpen.New(fileErr.Error())
		}
		reader = file
	}

	scanner := bufio.NewScanner(reader)
	scanner.Buffer(nil, int(types.LongTextBlobMax))
	scanner.Split(n.SplitLines)

	sch := n.Schema()
	source := sch[0].Source // Schema will always have at least one column
	colNames := n.ColNames
	if len(colNames) == 0 {
		colNames = make([]string, len(sch))
		for i, col := range sch {
			colNames[i] = col.Name
		}
	}

	fieldToColMap := make([]int, len(n.UserVars))
	for fieldIdx, colIdx := 0, 0; fieldIdx < len(n.UserVars) && colIdx < len(colNames); fieldIdx++ {
		if n.UserVars[fieldIdx] != nil {
			fieldToColMap[fieldIdx] = -1
			continue
		}
		fieldToColMap[fieldIdx] = sch.IndexOf(colNames[colIdx], source)
		colIdx++
	}

	return &loadDataIter{
		destSch:       n.DestSch,
		reader:        reader,
		scanner:       scanner,
		colCount:      len(n.ColNames), // Needs to be the original column count
		fieldToColMap: fieldToColMap,
		setExprs:      n.SetExprs,
		userVars:      n.UserVars,

		ignoreNum: n.IgnoreNum,

		fieldsTerminatedBy:  n.FieldsTerminatedBy,
		fieldsEnclosedBy:    n.FieldsEnclosedBy,
		fieldsEnclosedByOpt: n.FieldsEnclosedByOpt,
		fieldsEscapedBy:     n.FieldsEscapedBy,

		linesTerminatedBy: n.LinesTerminatedBy,
		linesStartingBy:   n.LinesStartingBy,
	}, nil
}

func (b *BaseBuilder) buildDropConstraint(ctx *sql.Context, n *plan.DropConstraint, row sql.Row) (sql.RowIter, error) {
	// DropConstraint should be replaced by another node type (DropForeignKey, DropCheck, etc.) during analysis,
	// so this is an error
	return nil, fmt.Errorf("%T does not have an execution iterator, this is a bug", n)
}

func (b *BaseBuilder) buildCreateView(ctx *sql.Context, n *plan.CreateView, row sql.Row) (sql.RowIter, error) {
	registry := ctx.GetViewRegistry()
	if n.IsReplace {
		if dropper, ok := n.Database().(sql.ViewDatabase); ok {
			err := dropper.DropView(ctx, n.Name)
			if err != nil && !sql.ErrViewDoesNotExist.Is(err) {
				return sql.RowsToRowIter(), err
			}
		} else {
			err := registry.Delete(n.Database().Name(), n.Name)
			if err != nil && !sql.ErrViewDoesNotExist.Is(err) {
				return sql.RowsToRowIter(), err
			}
		}
	}
	names, err := n.Database().GetTableNames(ctx)
	if err != nil {
		return nil, err
	}
	for _, name := range names {
		if !strings.EqualFold(name, n.Name) {
			continue
		}
		if n.IfNotExists {
			return rowIterWithOkResultWithZeroRowsAffected(), nil
		}
		return nil, sql.ErrTableAlreadyExists.New(n)
	}

	// TODO: isUpdatable should be defined at CREATE VIEW time
	// isUpdatable := GetIsUpdatableFromCreateView(cv)
	creator, ok := n.Database().(sql.ViewDatabase)
	if !ok {
		err = registry.Register(n.Database().Name(), n.View())
		if err != nil {
			return nil, err
		}
		return rowIterWithOkResultWithZeroRowsAffected(), nil
	}
	err = creator.CreateView(ctx, n.Name, n.Definition.TextDefinition, n.CreateViewString)
	if err != nil {
		if !sql.ErrExistingView.Is(err) || !n.IfNotExists {
			return nil, err
		}
	}
	return rowIterWithOkResultWithZeroRowsAffected(), nil
}

func (b *BaseBuilder) buildCreateCheck(ctx *sql.Context, n *plan.CreateCheck, row sql.Row) (sql.RowIter, error) {
	err := b.executeCreateCheck(ctx, n)
	if err != nil {
		return nil, err
	}
	return rowIterWithOkResultWithZeroRowsAffected(), nil
}

func (b *BaseBuilder) buildAlterDefaultSet(ctx *sql.Context, n *plan.AlterDefaultSet, row sql.Row) (sql.RowIter, error) {
	// Grab the table fresh from the database.
	table, err := getTableFromDatabase(ctx, n.Database(), n.Table)
	if err != nil {
		return nil, err
	}

	alterable, ok := table.(sql.AlterableTable)
	if !ok {
		return nil, sql.ErrAlterTableNotSupported.New(n.Table)
	}

	if err != nil {
		return nil, err
	}
	loweredColName := strings.ToLower(n.ColumnName)
	var col *sql.Column
	for _, schCol := range alterable.Schema() {
		if strings.ToLower(schCol.Name) == loweredColName {
			col = schCol
			break
		}
	}
	if col == nil {
		return nil, sql.ErrTableColumnNotFound.New(n.Table, n.ColumnName)
	}
	newCol := &(*col)
	newCol.Default = n.Default
	return rowIterWithOkResultWithZeroRowsAffected(), alterable.ModifyColumn(ctx, n.ColumnName, newCol, nil)
}

func (b *BaseBuilder) buildDropCheck(ctx *sql.Context, n *plan.DropCheck, row sql.Row) (sql.RowIter, error) {
	err := b.executeDropCheck(ctx, n)
	if err != nil {
		return nil, err
	}
	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildRenameTable(ctx *sql.Context, n *plan.RenameTable, row sql.Row) (sql.RowIter, error) {
	return n.RowIter(ctx, row)
}

func (b *BaseBuilder) buildModifyColumn(ctx *sql.Context, n *plan.ModifyColumn, row sql.Row) (sql.RowIter, error) {
	tbl, err := getTableFromDatabase(ctx, n.Database(), n.Table)
	if err != nil {
		return nil, err
	}

	alterable, ok := tbl.(sql.AlterableTable)
	if !ok {
		return nil, sql.ErrAlterTableNotSupported.New(tbl.Name())
	}

	if err := n.ValidateDefaultPosition(n.TargetSchema()); err != nil {
		return nil, err
	}
	// MySQL assigns the column's type (which contains the collation) at column creation/modification. If a column has
	// an invalid collation, then one has not been assigned at this point, so we assign it the table's collation. This
	// does not create a reference to the table's collation, which may change at any point, and therefore will have no
	// relation to this column after assignment.
	if collatedType, ok := n.NewColumn().Type.(sql.TypeWithCollation); ok && collatedType.Collation() == sql.Collation_Unspecified {
		n.NewColumn().Type, err = collatedType.WithNewCollation(alterable.Collation())
		if err != nil {
			return nil, err
		}
	}
	for _, col := range n.TargetSchema() {
		if collatedType, ok := col.Type.(sql.TypeWithCollation); ok && collatedType.Collation() == sql.Collation_Unspecified {
			col.Type, err = collatedType.WithNewCollation(alterable.Collation())
			if err != nil {
				return nil, err
			}
		}
	}

	return &modifyColumnIter{
		m:         n,
		alterable: alterable,
	}, nil
}

func (b *BaseBuilder) buildSingleDropView(ctx *sql.Context, n *plan.SingleDropView, row sql.Row) (sql.RowIter, error) {
	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildCreateIndex(ctx *sql.Context, n *plan.CreateIndex, row sql.Row) (sql.RowIter, error) {
	table, ok := n.Table.(*plan.ResolvedTable)
	if !ok {
		return nil, plan.ErrNotIndexable.New()
	}

	indexable, err := getIndexableTable(table.Table)
	if err != nil {
		return nil, err
	}

	var driver sql.IndexDriver
	if n.Driver == "" {
		driver = ctx.GetIndexRegistry().DefaultIndexDriver()
	} else {
		driver = ctx.GetIndexRegistry().IndexDriver(n.Driver)
	}

	if driver == nil {
		return nil, plan.ErrInvalidIndexDriver.New(n.Driver)
	}

	columns, exprs, err := GetColumnsAndPrepareExpressions(n.Exprs)
	if err != nil {
		return nil, err
	}

	for _, e := range exprs {
		if types.IsBlobType(e.Type()) || types.IsJSON(e.Type()) {
			return nil, plan.ErrExprTypeNotIndexable.New(e, e.Type())
		}
	}

	if ch := getChecksumable(table.Table); ch != nil {
		n.Config[sql.ChecksumKey], err = ch.Checksum()
		if err != nil {
			return nil, err
		}
	}

	index, err := driver.Create(
		n.CurrentDatabase,
		table.Name(),
		n.Name,
		exprs,
		n.Config,
	)
	if err != nil {
		return nil, err
	}

	iter, err := indexable.IndexKeyValues(ctx, columns)
	if err != nil {
		return nil, err
	}

	iter = &EvalPartitionKeyValueIter{
		columns: columns,
		exprs:   exprs,
		iter:    iter,
	}

	created, ready, err := ctx.GetIndexRegistry().AddIndex(index)
	if err != nil {
		return nil, err
	}

	log := logrus.WithFields(logrus.Fields{
		"id":     index.ID(),
		"driver": index.Driver(),
	})

	createIndex := func() {
		createIndex(ctx, log, driver, index, iter, created, ready)
	}

	log.Info("starting to save the index")

	createIndex()

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildDeclareCondition(ctx *sql.Context, n *plan.DeclareCondition, row sql.Row) (sql.RowIter, error) {
	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildCreateDB(ctx *sql.Context, n *plan.CreateDB, row sql.Row) (sql.RowIter, error) {
	exists := n.Catalog.HasDatabase(ctx, n.DbName)
	rows := []sql.Row{{types.OkResult{RowsAffected: 1}}}

	if exists {
		if n.IfNotExists && ctx != nil && ctx.Session != nil {
			ctx.Session.Warn(&sql.Warning{
				Level:   "Note",
				Code:    mysql.ERDbCreateExists,
				Message: fmt.Sprintf("Can't create database %s; database exists ", n.DbName),
			})

			return sql.RowsToRowIter(rows...), nil
		} else {
			return nil, sql.ErrDatabaseExists.New(n.DbName)
		}
	}

	collation := n.Collation
	if collation == sql.Collation_Unspecified {
		collation = sql.Collation_Default
	}
	err := n.Catalog.CreateDatabase(ctx, n.DbName, collation)
	if err != nil {
		return nil, err
	}

	return sql.RowsToRowIter(rows...), nil
}

func (b *BaseBuilder) buildCreateSchema(ctx *sql.Context, n *plan.CreateSchema, row sql.Row) (sql.RowIter, error) {
	database := ctx.GetCurrentDatabase()

	// If no database is selected, first try to fall back to CREATE DATABASE
	// since CREATE SCHEMA is a synonym for CREATE DATABASE in MySQL
	// https://dev.mysql.com/doc/refman/8.4/en/create-database.html
	// TODO: For PostgreSQL, return an error if no database is selected.
	if database == "" {
		return b.buildCreateDB(ctx, &plan.CreateDB{
			Catalog:     n.Catalog,
			DbName:      n.DbName,
			IfNotExists: n.IfNotExists,
			Collation:   n.Collation,
		}, row)
	}

	db, err := n.Catalog.Database(ctx, database)
	if err != nil {
		return nil, err
	}

	sdb, ok := db.(sql.SchemaDatabase)
	if !ok {
		// If schemas aren't supported, treat CREATE SCHEMA as a synonym for CREATE DATABASE (as is the case in MySQL)
		return b.buildCreateDB(ctx, &plan.CreateDB{
			Catalog:     n.Catalog,
			DbName:      n.DbName,
			IfNotExists: n.IfNotExists,
			Collation:   n.Collation,
		}, row)
	}

	_, exists, err := sdb.GetSchema(ctx, n.DbName)
	if err != nil {
		return nil, err
	}

	rows := []sql.Row{{types.OkResult{RowsAffected: 1}}}

	if exists {
		if n.IfNotExists && ctx != nil && ctx.Session != nil {
			ctx.Session.Warn(&sql.Warning{
				Level:   "Note",
				Code:    mysql.ERDbCreateExists,
				Message: fmt.Sprintf("Can't create schema %s; schema exists ", n.DbName),
			})

			return sql.RowsToRowIter(rows...), nil
		} else {
			return nil, sql.ErrDatabaseSchemaExists.New(n.DbName)
		}
	}

	// TODO: collation
	err = sdb.CreateSchema(ctx, n.DbName)
	if err != nil {
		return nil, err
	}

	return sql.RowsToRowIter(rows...), nil
}

func (b *BaseBuilder) buildAlterDefaultDrop(ctx *sql.Context, n *plan.AlterDefaultDrop, row sql.Row) (sql.RowIter, error) {
	table, ok, err := n.Db.GetTableInsensitive(ctx, getTableName(n.Table))
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, sql.ErrTableNotFound.New(n.Table)
	}

	alterable, ok := table.(sql.AlterableTable)
	loweredColName := strings.ToLower(n.ColumnName)
	var col *sql.Column
	for _, schCol := range alterable.Schema() {
		if strings.ToLower(schCol.Name) == loweredColName {
			col = schCol
			break
		}
	}

	if col == nil {
		return nil, sql.ErrTableColumnNotFound.New(getTableName(n.Table), n.ColumnName)
	}
	newCol := &(*col)
	newCol.Default = nil
	return rowIterWithOkResultWithZeroRowsAffected(), alterable.ModifyColumn(ctx, n.ColumnName, newCol, nil)
}

func (b *BaseBuilder) buildDropView(ctx *sql.Context, n *plan.DropView, row sql.Row) (sql.RowIter, error) {
	for _, child := range n.Children() {
		drop, ok := child.(*plan.SingleDropView)
		if !ok {
			return sql.RowsToRowIter(), plan.ErrDropViewChild.New()
		}

		if dropper, ok := drop.Database().(sql.ViewDatabase); ok {
			err := dropper.DropView(ctx, drop.ViewName)
			if err != nil {
				allowedError := n.IfExists && sql.ErrViewDoesNotExist.Is(err)
				if !allowedError {
					return sql.RowsToRowIter(), err
				}
			}
		} else {
			err := ctx.GetViewRegistry().Delete(drop.Database().Name(), drop.ViewName)
			allowedError := n.IfExists && sql.ErrViewDoesNotExist.Is(err)
			if !allowedError {
				return sql.RowsToRowIter(), err
			}
		}
	}

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildAlterUser(ctx *sql.Context, a *plan.AlterUser, _ sql.Row) (sql.RowIter, error) {
	mysqlDb, ok := a.MySQLDb.(*mysql_db.MySQLDb)
	if !ok {
		return nil, sql.ErrDatabaseNotFound.New("mysql")
	}
	editor := mysqlDb.Editor()
	defer editor.Close()

	user := a.User
	// replace empty host with any host
	if user.UserName.Host == "" {
		user.UserName.Host = "%"
	}

	userPk := mysql_db.UserPrimaryKey{
		Host: user.UserName.Host,
		User: user.UserName.Name,
	}
	previousUserEntry, ok := editor.GetUser(userPk)
	if !ok {
		if a.IfExists {
			return sql.RowsToRowIter(sql.Row{types.NewOkResult(0)}), nil
		}
		return nil, sql.ErrUserAlterFailure.New(user.UserName.String("'"))
	}

	// Default the auth plugin and authorization string to the currently configured values.
	// We can only change the auth info if a new password was specified, otherwise, we don't
	// have a plaintext password to process into an authorization string for the auth plugin.
	plugin := previousUserEntry.Plugin
	authString := previousUserEntry.AuthString
	if user.Auth1 != nil {
		plugin = user.Auth1.Plugin()
		var err error
		authString, err = user.Auth1.AuthString()
		if err != nil {
			return nil, err
		}
	}
	if plugin != string(mysql.MysqlNativePassword) && plugin != string(mysql.CachingSha2Password) {
		if err := mysqlDb.VerifyPlugin(plugin); err != nil {
			return nil, sql.ErrUserAlterFailure.New(err)
		}
	}

	previousUserEntry.Plugin = plugin
	previousUserEntry.AuthString = authString
	previousUserEntry.PasswordLastChanged = time.Now().UTC()
	editor.PutUser(previousUserEntry)

	if err := mysqlDb.Persist(ctx, editor); err != nil {
		return nil, err
	}

	return sql.RowsToRowIter(sql.Row{types.NewOkResult(0)}), nil
}

func (b *BaseBuilder) buildCreateUser(ctx *sql.Context, n *plan.CreateUser, _ sql.Row) (sql.RowIter, error) {
	mysqlDb, ok := n.MySQLDb.(*mysql_db.MySQLDb)
	if !ok {
		return nil, sql.ErrDatabaseNotFound.New("mysql")
	}

	editor := mysqlDb.Editor()
	defer editor.Close()

	for _, user := range n.Users {
		// replace empty host with any host
		if user.UserName.Host == "" {
			user.UserName.Host = "%"
		}

		userPk := mysql_db.UserPrimaryKey{
			Host: user.UserName.Host,
			User: user.UserName.Name,
		}
		_, ok := editor.GetUser(userPk)
		if ok {
			if n.IfNotExists {
				continue
			}
			return nil, sql.ErrUserCreationFailure.New(user.UserName.String("'"))
		}

		if len(user.UserName.Name) > 32 {
			return nil, sql.ErrUserNameTooLong.New(user.UserName.Name)
		}

		if len(user.UserName.Host) > 255 {
			return nil, sql.ErrUserHostTooLong.New(user.UserName.Host)
		}

		plugin := string(mysql_db.DefaultAuthMethod)
		authString := ""
		if user.Auth1 != nil {
			plugin = user.Auth1.Plugin()
			var err error
			authString, err = user.Auth1.AuthString()
			if err != nil {
				return nil, err
			}
		}
		if plugin != string(mysql.MysqlNativePassword) && plugin != string(mysql.CachingSha2Password) {
			if err := mysqlDb.VerifyPlugin(plugin); err != nil {
				return nil, sql.ErrUserCreationFailure.New(err)
			}
		}

		// TODO: attributes should probably not be nil, but setting it to &n.Attribute causes unexpected behavior
		// TODO: validate all of the data
		editor.PutUser(&mysql_db.User{
			User:                user.UserName.Name,
			Host:                user.UserName.Host,
			PrivilegeSet:        mysql_db.NewPrivilegeSet(),
			Plugin:              plugin,
			AuthString:          authString,
			PasswordLastChanged: time.Now().UTC(),
			Locked:              false,
			Attributes:          nil,
			IsRole:              false,
			Identity:            user.Identity,
		})
	}
	if err := mysqlDb.Persist(ctx, editor); err != nil {
		return nil, err
	}
	return rowIterWithOkResultWithZeroRowsAffected(), nil
}

func (b *BaseBuilder) buildAlterPK(ctx *sql.Context, n *plan.AlterPK, row sql.Row) (sql.RowIter, error) {
	// We need to get the current table from the database because this statement could be one clause in an alter table
	// statement and the table may have changed since the analysis phase
	table, err := getTableFromDatabase(ctx, n.Database(), n.Table)
	if err != nil {
		return nil, err
	}

	// TODO: these validation checks belong in the analysis phase, not here
	pkAlterable, ok := table.(sql.PrimaryKeyAlterableTable)
	if !ok {
		return nil, plan.ErrNotPrimaryKeyAlterable.New(n.Table)
	}
	if err != nil {
		return nil, err
	}

	switch n.Action {
	case plan.PrimaryKeyAction_Create:
		if plan.HasPrimaryKeys(pkAlterable) {
			return sql.RowsToRowIter(), sql.ErrMultiplePrimaryKeysDefined.New()
		}

		for _, c := range n.Columns {
			if !pkAlterable.Schema().Contains(c.Name, pkAlterable.Name()) {
				return sql.RowsToRowIter(), sql.ErrKeyColumnDoesNotExist.New(c.Name)
			}
		}

		return &createPkIter{
			targetSchema: n.TargetSchema(),
			columns:      n.Columns,
			pkAlterable:  pkAlterable,
			db:           n.Database(),
		}, nil
	case plan.PrimaryKeyAction_Drop:
		return &dropPkIter{
			targetSchema: n.TargetSchema(),
			pkAlterable:  pkAlterable,
			db:           n.Database(),
		}, nil
	default:
		panic("unreachable")
	}
}

func (b *BaseBuilder) buildDropIndex(ctx *sql.Context, n *plan.DropIndex, row sql.Row) (sql.RowIter, error) {
	db, err := n.Catalog.Database(ctx, n.CurrentDatabase)
	if err != nil {
		return nil, err
	}

	nn, ok := n.Table.(sql.Nameable)
	if !ok {
		return nil, plan.ErrTableNotNameable.New()
	}

	table, ok, err := db.GetTableInsensitive(ctx, nn.Name())

	if err != nil {
		return nil, err
	}

	if !ok {
		tableNames, err := db.GetTableNames(ctx)

		if err != nil {
			return nil, err
		}

		similar := similartext.Find(tableNames, nn.Name())
		return nil, sql.ErrTableNotFound.New(nn.Name() + similar)
	}

	index := ctx.GetIndexRegistry().Index(db.Name(), n.Name)
	if index == nil {
		return nil, plan.ErrIndexNotFound.New(n.Name, nn.Name(), db.Name())
	}
	ctx.GetIndexRegistry().ReleaseIndex(index)

	if !ctx.GetIndexRegistry().CanRemoveIndex(index) {
		return nil, plan.ErrIndexNotAvailable.New(n.Name)
	}

	done, err := ctx.GetIndexRegistry().DeleteIndex(db.Name(), n.Name, true)
	if err != nil {
		return nil, err
	}

	driver := ctx.GetIndexRegistry().IndexDriver(index.Driver())
	if driver == nil {
		return nil, plan.ErrInvalidIndexDriver.New(index.Driver())
	}

	<-done

	partitions, err := table.Partitions(ctx)
	if err != nil {
		return nil, err
	}

	if err := driver.Delete(index, partitions); err != nil {
		return nil, err
	}

	return sql.RowsToRowIter(), nil
}

func (b *BaseBuilder) buildDropProcedure(ctx *sql.Context, n *plan.DropProcedure, row sql.Row) (sql.RowIter, error) {
	procDb, ok := n.Db.(sql.StoredProcedureDatabase)
	if !ok {
		if n.IfExists {
			return rowIterWithOkResultWithZeroRowsAffected(), nil
		} else {
			return nil, sql.ErrStoredProceduresNotSupported.New(n.ProcedureName)
		}
	}
	err := procDb.DropStoredProcedure(ctx, n.ProcedureName)
	if n.IfExists && sql.ErrStoredProcedureDoesNotExist.Is(err) {
		return rowIterWithOkResultWithZeroRowsAffected(), nil
	} else if err != nil {
		return nil, err
	}
	return rowIterWithOkResultWithZeroRowsAffected(), nil
}

func (b *BaseBuilder) buildDropDB(ctx *sql.Context, n *plan.DropDB, row sql.Row) (sql.RowIter, error) {
	exists := n.Catalog.HasDatabase(ctx, n.DbName)
	if !exists {
		if n.IfExists && ctx != nil && ctx.Session != nil {
			ctx.Session.Warn(&sql.Warning{
				Level:   "Note",
				Code:    mysql.ERDbDropExists,
				Message: fmt.Sprintf("Can't drop database %s; database doesn't exist ", n.DbName),
			})

			rows := []sql.Row{{types.OkResult{RowsAffected: 0}}}

			return sql.RowsToRowIter(rows...), nil
		} else {
			return nil, sql.ErrDatabaseNotFound.New(n.DbName)
		}
	}

	// make sure to notify the EventSchedulerStatus before dropping the database
	if n.Scheduler != nil {
		n.Scheduler.RemoveSchemaEvents(n.DbName)
	}

	err := n.Catalog.RemoveDatabase(ctx, n.DbName)
	if err != nil {
		return nil, err
	}

	// Unsets the current database. Database name is case-insensitive.
	if strings.ToLower(ctx.GetCurrentDatabase()) == strings.ToLower(n.DbName) {
		ctx.SetCurrentDatabase("")
	}

	rows := []sql.Row{{types.OkResult{RowsAffected: 1}}}

	return sql.RowsToRowIter(rows...), nil
}

func (b *BaseBuilder) buildRenameColumn(ctx *sql.Context, n *plan.RenameColumn, row sql.Row) (sql.RowIter, error) {
	tbl, err := getTableFromDatabase(ctx, n.Database(), n.Table)
	if err != nil {
		return nil, err
	}

	alterable, ok := tbl.(sql.AlterableTable)
	if !ok {
		return nil, sql.ErrAlterTableNotSupported.New(tbl.Name())
	}

	idx := n.TargetSchema().IndexOf(n.ColumnName, tbl.Name())
	if idx < 0 {
		return nil, sql.ErrTableColumnNotFound.New(tbl.Name(), n.ColumnName)
	}

	nc := *n.TargetSchema()[idx]
	nc.Name = n.NewColumnName
	col := &nc

	if err := updateDefaultsOnColumnRename(ctx, alterable, n.TargetSchema(), strings.ToLower(n.ColumnName), n.NewColumnName); err != nil {
		return nil, err
	}

	// Update the foreign key columns as well
	if fkTable, ok := alterable.(sql.ForeignKeyTable); ok {
		parentFks, err := fkTable.GetReferencedForeignKeys(ctx)
		if err != nil {
			return nil, err
		}
		fks, err := fkTable.GetDeclaredForeignKeys(ctx)
		if err != nil {
			return nil, err
		}
		if len(parentFks) > 0 || len(fks) > 0 {
			err = handleFkColumnRename(ctx, fkTable, n.Db, n.ColumnName, n.NewColumnName)
			if err != nil {
				return nil, err
			}
		}
	}

	return rowIterWithOkResultWithZeroRowsAffected(), alterable.ModifyColumn(ctx, n.ColumnName, col, nil)
}

func (b *BaseBuilder) buildAddColumn(ctx *sql.Context, n *plan.AddColumn, row sql.Row) (sql.RowIter, error) {
	table, err := getTableFromDatabase(ctx, n.Database(), n.Table)
	if err != nil {
		return nil, err
	}

	alterable, ok := table.(sql.AlterableTable)
	if !ok {
		return nil, sql.ErrAlterTableNotSupported.New(table.Name())
	}

	tbl := alterable.(sql.Table)
	tblSch := n.TargetSchema()
	if n.Order() != nil && !n.Order().First {
		idx := tblSch.IndexOf(n.Order().AfterColumn, tbl.Name())
		if idx < 0 {
			return nil, sql.ErrTableColumnNotFound.New(tbl.Name(), n.Order().AfterColumn)
		}
	}

	if err := n.ValidateDefaultPosition(tblSch); err != nil {
		return nil, err
	}
	// MySQL assigns the column's type (which contains the collation) at column creation/modification. If a column has
	// an invalid collation, then one has not been assigned at this point, so we assign it the table's collation. This
	// does not create a reference to the table's collation, which may change at any point, and therefore will have no
	// relation to this column after assignment.
	if collatedType, ok := n.Column().Type.(sql.TypeWithCollation); ok && collatedType.Collation() == sql.Collation_Unspecified {
		n.Column().Type, err = collatedType.WithNewCollation(alterable.Collation())
		if err != nil {
			return nil, err
		}
	}
	for _, col := range n.TargetSchema() {
		if collatedType, ok := col.Type.(sql.TypeWithCollation); ok && collatedType.Collation() == sql.Collation_Unspecified {
			col.Type, err = collatedType.WithNewCollation(alterable.Collation())
			if err != nil {
				return nil, err
			}
		}
	}

	return &addColumnIter{
		a:         n,
		alterable: alterable,
		b:         b,
	}, nil
}

func (b *BaseBuilder) buildAlterDB(ctx *sql.Context, n *plan.AlterDB, row sql.Row) (sql.RowIter, error) {
	dbName := n.Database(ctx)

	if !n.Catalog.HasDatabase(ctx, dbName) {
		return nil, sql.ErrDatabaseNotFound.New(dbName)
	}
	db, err := n.Catalog.Database(ctx, dbName)
	if err != nil {
		return nil, err
	}
	collatedDb, ok := db.(sql.CollatedDatabase)
	if !ok {
		return nil, sql.ErrDatabaseCollationsNotSupported.New(dbName)
	}

	collation := n.Collation
	if collation == sql.Collation_Unspecified {
		collation = sql.Collation_Default
	}
	if err = collatedDb.SetCollation(ctx, collation); err != nil {
		return nil, err
	}

	rows := []sql.Row{{types.OkResult{RowsAffected: 1}}}
	return sql.RowsToRowIter(rows...), nil
}

func (b *BaseBuilder) buildCreateTable(ctx *sql.Context, n *plan.CreateTable, row sql.Row) (sql.RowIter, error) {
	var err error

	// If it's set to Invalid, then no collation has been explicitly defined
	if n.Collation == sql.Collation_Unspecified {
		n.Collation = plan.GetDatabaseCollation(ctx, n.Db)
		// Need to set each type's collation to the correct type as well
		for _, col := range n.PkSchema().Schema {
			if collatedType, ok := col.Type.(sql.TypeWithCollation); ok && collatedType.Collation() == sql.Collation_Unspecified {
				col.Type, err = collatedType.WithNewCollation(n.Collation)
				if err != nil {
					return nil, err
				}
			}
		}
	}

	err = n.ValidateDefaultPosition()
	if err != nil {
		return sql.RowsToRowIter(), err
	}

	maybePrivDb := n.Db
	if privDb, ok := maybePrivDb.(mysql_db.PrivilegedDatabase); ok {
		maybePrivDb = privDb.Unwrap()
	}

	if n.Temporary() {
		creatable, ok := maybePrivDb.(sql.TemporaryTableCreator)
		if !ok {
			return sql.RowsToRowIter(), sql.ErrTemporaryTableNotSupported.New()
		}
		err = creatable.CreateTemporaryTable(ctx, n.Name(), n.PkSchema(), n.Collation)
	} else {
		switch creatable := maybePrivDb.(type) {
		case sql.IndexedTableCreator:
			var pkIdxDef *sql.IndexDef
			for _, idxDef := range n.Indexes() {
				if idxDef.IsPrimary() {
					pkIdxDef = &sql.IndexDef{
						Name:       idxDef.Name,
						Columns:    idxDef.Columns,
						Constraint: idxDef.Constraint,
						Storage:    idxDef.Storage,
						Comment:    idxDef.Comment,
					}
					break
				}
			}
			if pkIdxDef != nil {
				err = creatable.CreateIndexedTable(ctx, n.Name(), n.PkSchema(), *pkIdxDef, n.Collation)
				if sql.ErrUnsupportedIndexPrefix.Is(err) {
					return sql.RowsToRowIter(), err
				}
			} else {
				creatable, ok := maybePrivDb.(sql.TableCreator)
				if !ok {
					return sql.RowsToRowIter(), sql.ErrCreateTableNotSupported.New(n.Db.Name())
				}
				comment := ""
				if n.TableOpts != nil && n.TableOpts["comment"] != nil {
					comment = n.TableOpts["comment"].(string)
				}
				err = creatable.CreateTable(ctx, n.Name(), n.PkSchema(), n.Collation, comment)
			}
		case sql.TableCreator:
			comment := ""
			if n.TableOpts != nil && n.TableOpts["comment"] != nil {
				comment = n.TableOpts["comment"].(string)
			}
			err = creatable.CreateTable(ctx, n.Name(), n.PkSchema(), n.Collation, comment)
		default:
			return sql.RowsToRowIter(), sql.ErrCreateTableNotSupported.New(n.Db.Name())
		}
	}

	tableExists := sql.ErrTableAlreadyExists.Is(err)
	if tableExists && n.IfNotExists() {
		return rowIterWithOkResultWithZeroRowsAffected(), nil
	}

	if err != nil {
		return sql.RowsToRowIter(), err
	}

	if vdb, vok := n.Db.(sql.ViewDatabase); vok {
		_, ok, err := vdb.GetViewDefinition(ctx, n.Name())
		if err != nil {
			return nil, err
		}
		if ok {
			return nil, sql.ErrTableAlreadyExists.New(n.Name())
		}
	}

	//TODO: in the event that foreign keys or indexes aren't supported, you'll be left with a created table and no foreign keys/indexes
	//this also means that if a foreign key or index fails, you'll only have what was declared up to the failure
	tableNode, ok, err := n.Db.GetTableInsensitive(ctx, n.Name())
	if err != nil {
		return sql.RowsToRowIter(), err
	}
	if !ok {
		return sql.RowsToRowIter(), sql.ErrTableCreatedNotFound.New(n.Name())
	}

	if autoIncVal, hasAutoIncOpt := n.TableOpts["auto_increment"]; hasAutoIncOpt {
		aiVal := autoIncVal.(uint64)
		if aiVal > 1 {
			// TODO: lots of duplicate code from b.executeAlterAutoIncrement
			insertable, ok := tableNode.(sql.InsertableTable)
			if !ok {
				return sql.RowsToRowIter(), plan.ErrInsertIntoNotSupported.New()
			}
			autoTbl, ok := insertable.(sql.AutoIncrementTable)
			if !ok {
				return sql.RowsToRowIter(), plan.ErrAutoIncrementNotSupported.New(insertable.Name())
			}

			// No-op if the table doesn't already have an auto increment column.
			if autoTbl.Schema().HasAutoIncrement() {
				setter := autoTbl.AutoIncrementSetter(ctx)
				err = setter.SetAutoIncrementValue(ctx, aiVal)
				if err != nil {
					return sql.RowsToRowIter(), err
				}
				err = setter.Close(ctx)
				if err != nil {
					return sql.RowsToRowIter(), err
				}
			}
		}
	}

	var nonPrimaryIdxes sql.IndexDefs
	for _, def := range n.Indexes() {
		if !def.IsPrimary() {
			nonPrimaryIdxes = append(nonPrimaryIdxes, def)
		}
	}

	if len(nonPrimaryIdxes) > 0 {
		err = createIndexesForCreateTable(ctx, n.Db, tableNode, nonPrimaryIdxes)
		if err != nil {
			return sql.RowsToRowIter(), err
		}
	}

	if len(n.ForeignKeys()) > 0 {
		err = n.CreateForeignKeys(ctx, tableNode)
		if err != nil {
			return sql.RowsToRowIter(), err
		}
	}

	if len(n.Checks()) > 0 {
		err = n.CreateChecks(ctx, tableNode)
		if err != nil {
			return sql.RowsToRowIter(), err
		}
	}

	return rowIterWithOkResultWithZeroRowsAffected(), nil
}

func createIndexesForCreateTable(ctx *sql.Context, db sql.Database, tableNode sql.Table, idxes sql.IndexDefs) (err error) {
	idxAltTbl, ok := tableNode.(sql.IndexAlterableTable)
	if !ok {
		return plan.ErrNotIndexable.New()
	}

	indexMap := make(map[string]struct{})
	fulltextIndexes := make(sql.IndexDefs, 0)
	for _, idxDef := range idxes {
		if len(idxDef.Name) == 0 {
			idxDef.Name, err = generateIndexName(ctx, idxAltTbl, idxDef.ColumnNames())
			if err != nil {
				return err
			}
		} else if _, ok = indexMap[strings.ToLower(idxDef.Name)]; ok {
			return sql.ErrIndexIDAlreadyRegistered.New(idxDef.Name)
		}

		indexMap[strings.ToLower(idxDef.Name)] = struct{}{}

		// We'll create the Full-Text indexes after all others
		if idxDef.IsFullText() {
			fulltextIndexes = append(fulltextIndexes, idxDef)
			continue
		}

		err = idxAltTbl.CreateIndex(ctx, *idxDef)
		if err != nil {
			return err
		}

		err = warnOnDuplicateSecondaryIndex(ctx, idxDef.Name, idxAltTbl)
		if err != nil {
			return err
		}
	}

	// Evaluate our Full-Text indexes now
	if len(fulltextIndexes) > 0 {
		var database fulltext.Database
		database, err = getFulltextDatabase(db)
		if err != nil {
			return err
		}
		err = fulltext.CreateFulltextIndexes(ctx, database, idxAltTbl, nil, fulltextIndexes)
		if err != nil {
			return err
		}
	}

	return nil
}

func (b *BaseBuilder) buildCreateProcedure(ctx *sql.Context, n *plan.CreateProcedure, row sql.Row) (sql.RowIter, error) {
	return &createProcedureIter{
		spd: n.StoredProcDetails,
		db:  n.Database(),
	}, nil
}

func (b *BaseBuilder) buildCreateTrigger(ctx *sql.Context, n *plan.CreateTrigger, row sql.Row) (sql.RowIter, error) {
	sqlMode := sql.LoadSqlMode(ctx)
	return &createTriggerIter{
		definition: sql.TriggerDefinition{
			Name:            n.TriggerName,
			CreateStatement: n.CreateTriggerString,
			CreatedAt:       n.CreatedAt,
			SqlMode:         sqlMode.String(),
		},
		db: n.Database(),
	}, nil
}

func (b *BaseBuilder) buildDropColumn(ctx *sql.Context, n *plan.DropColumn, row sql.Row) (sql.RowIter, error) {
	tbl, err := getTableFromDatabase(ctx, n.Database(), n.Table)
	if err != nil {
		return nil, err
	}

	err = n.Validate(ctx, tbl)
	if err != nil {
		return nil, err
	}

	alterable, ok := tbl.(sql.AlterableTable)
	if !ok {
		return nil, sql.ErrAlterTableNotSupported.New(tbl.Name())
	}

	return &dropColumnIter{
		d:         n,
		alterable: alterable,
	}, nil
}

func (b *BaseBuilder) buildAlterTableCollation(ctx *sql.Context, n *plan.AlterTableCollation, row sql.Row) (sql.RowIter, error) {
	tbl, err := getTableFromDatabase(ctx, n.Database(), n.Table)
	if err != nil {
		return nil, err
	}

	alterable, ok := tbl.(sql.CollationAlterableTable)
	if !ok {
		return nil, sql.ErrAlterTableCollationNotSupported.New(tbl.Name())
	}

	return rowIterWithOkResultWithZeroRowsAffected(), alterable.ModifyDefaultCollation(ctx, n.Collation)
}

func (b *BaseBuilder) buildAlterTableComment(ctx *sql.Context, n *plan.AlterTableComment, row sql.Row) (sql.RowIter, error) {
	tbl, err := getTableFromDatabase(ctx, n.Database(), n.Table)
	if err != nil {
		return nil, err
	}
	alterable, ok := tbl.(sql.CommentAlterableTable)
	if !ok {
		return nil, sql.ErrAlterTableCommentNotSupported.New(tbl.Name())
	}
	return rowIterWithOkResultWithZeroRowsAffected(), alterable.ModifyComment(ctx, n.Comment)
}

func (b *BaseBuilder) buildCreateForeignKey(ctx *sql.Context, n *plan.CreateForeignKey, row sql.Row) (sql.RowIter, error) {
	db, err := n.DbProvider.Database(ctx, n.FkDef.Database)
	if err != nil {
		return nil, err
	}

	if n.FkDef.SchemaName != "" {
		sdb, ok := db.(sql.SchemaDatabase)
		if !ok {
			return nil, sql.ErrDatabaseSchemasNotSupported.New(n.FkDef.Database)
		}
		sch, schemaExists, err := sdb.GetSchema(ctx, n.FkDef.SchemaName)
		if err != nil {
			return nil, err
		}
		if !schemaExists {
			return nil, sql.ErrDatabaseSchemaNotFound.New(n.FkDef.SchemaName)
		}
		db = sch
	}

	tbl, ok, err := db.GetTableInsensitive(ctx, n.FkDef.Table)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, sql.ErrTableNotFound.New(n.FkDef.Table)
	}

	refDb, err := n.DbProvider.Database(ctx, n.FkDef.ParentDatabase)
	if err != nil {
		return nil, err
	}

	if n.FkDef.ParentSchema != "" {
		sdb, ok := refDb.(sql.SchemaDatabase)
		if !ok {
			return nil, sql.ErrDatabaseSchemasNotSupported.New(n.FkDef.ParentDatabase)
		}
		sch, schemaExists, err := sdb.GetSchema(ctx, n.FkDef.ParentSchema)
		if err != nil {
			return nil, err
		}
		if !schemaExists {
			return nil, sql.ErrDatabaseSchemaNotFound.New(n.FkDef.ParentSchema)
		}
		refDb = sch
	}

	refTbl, ok, err := refDb.GetTableInsensitive(ctx, n.FkDef.ParentTable)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, sql.ErrTableNotFound.New(n.FkDef.ParentTable)
	}

	// If we didn't have an explicit schema, fill in the resolved schema for the fk table defn
	if n.FkDef.ParentSchema == "" {
		dst, ok := refTbl.(sql.DatabaseSchemaTable)
		if ok {
			n.FkDef.ParentSchema = dst.DatabaseSchema().SchemaName()
		}
	}

	fkTbl, ok := tbl.(sql.ForeignKeyTable)
	if !ok {
		return nil, sql.ErrNoForeignKeySupport.New(n.FkDef.Table)
	}
	refFkTbl, ok := refTbl.(sql.ForeignKeyTable)
	if !ok {
		return nil, sql.ErrNoForeignKeySupport.New(n.FkDef.ParentTable)
	}

	fkChecks, err := ctx.GetSessionVariable(ctx, "foreign_key_checks")
	if err != nil {
		return nil, err
	}

	err = plan.ResolveForeignKey(ctx, fkTbl, refFkTbl, *n.FkDef, true, fkChecks.(int8) == 1, true)
	if err != nil {
		return nil, err
	}

	return rowIterWithOkResultWithZeroRowsAffected(), nil
}

func rowIterWithOkResultWithZeroRowsAffected() sql.RowIter {
	return sql.RowsToRowIter(sql.NewRow(types.NewOkResult(0)))
}
