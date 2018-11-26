package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addTempUserMigrations(mg *Migrator) {
	tempUserV1 := Table{
		Name: "temp_user",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "version", Type: DB_Int, Nullable: false},
			{Name: "email", Type: DB_NVarchar, Length: 190},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
			{Name: "role", Type: DB_NVarchar, Length: 20, Nullable: true},
			{Name: "code", Type: DB_NVarchar, Length: 190},
			{Name: "status", Type: DB_Varchar, Length: 20},
			{Name: "invited_by_user_id", Type: DB_BigInt, Nullable: true},
			{Name: "email_sent", Type: DB_Bool},
			{Name: "email_sent_on", Type: DB_DateTime, Nullable: true},
			{Name: "remote_addr", Type: DB_Varchar, Length: 255, Nullable: true},
			{Name: "created", Type: DB_DateTime},
			{Name: "updated", Type: DB_DateTime},
		},
		Indices: []*Index{
			{Cols: []string{"email"}, Type: IndexType},
			{Cols: []string{"org_id"}, Type: IndexType},
			{Cols: []string{"code"}, Type: IndexType},
			{Cols: []string{"status"}, Type: IndexType},
		},
	}

	// addDropAllIndicesMigrations(mg, "v7", tempUserV1)
	// mg.AddMigration("Drop old table tempUser v7", NewDropTableMigration("temp_user"))

	// create table
	mg.AddMigration("create temp user table v1-7", NewAddTableMigration(tempUserV1))
	addTableIndicesMigrations(mg, "v1-7", tempUserV1)

	mg.AddMigration("Update temp_user table charset", NewTableCharsetMigration("temp_user", []*Column{
		{Name: "email", Type: DB_NVarchar, Length: 190},
		{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: true},
		{Name: "role", Type: DB_NVarchar, Length: 20, Nullable: true},
		{Name: "code", Type: DB_NVarchar, Length: 190},
		{Name: "status", Type: DB_Varchar, Length: 20},
		{Name: "remote_addr", Type: DB_Varchar, Length: 255, Nullable: true},
	}))
}
