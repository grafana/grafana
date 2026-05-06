# pgconn

Package pgconn is a low-level PostgreSQL database driver. It operates at nearly the same level as the C library libpq.
It is primarily intended to serve as the foundation for higher level libraries such as https://github.com/jackc/pgx.
Applications should handle normal queries with a higher level library and only use pgconn directly when required for
low-level access to PostgreSQL functionality.

## Example Usage

```go
pgConn, err := pgconn.Connect(context.Background(), os.Getenv("DATABASE_URL"))
if err != nil {
	log.Fatalln("pgconn failed to connect:", err)
}
defer pgConn.Close(context.Background())

result := pgConn.ExecParams(context.Background(), "SELECT email FROM users WHERE id=$1", [][]byte{[]byte("123")}, nil, nil, nil)
for result.NextRow() {
	fmt.Println("User 123 has email:", string(result.Values()[0]))
}
_, err = result.Close()
if err != nil {
	log.Fatalln("failed reading result:", err)
}
```

## Testing

See CONTRIBUTING.md for setup instructions.
