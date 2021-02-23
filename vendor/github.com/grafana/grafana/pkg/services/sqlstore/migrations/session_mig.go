package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addSessionMigration(mg *Migrator) {
	var sessionV1 = Table{
		Name: "session",
		Columns: []*Column{
			{Name: "key", Type: DB_Char, IsPrimaryKey: true, Length: 16},
			{Name: "data", Type: DB_Blob},
			{Name: "expiry", Type: DB_Integer, Length: 255, Nullable: false},
		},
	}

	mg.AddMigration("create session table", NewAddTableMigration(sessionV1))
}
