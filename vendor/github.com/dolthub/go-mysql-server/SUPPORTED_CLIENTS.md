# Supported clients

These are the clients we actively test against to check that they are
compatible with go-mysql-server. Other clients may also work, but we
don't check on every build if we remain compatible with them.

- Python
  - [pymysql](#pymysql)
  - [mysql-connector](#python-mysql-connector)
  - [sqlalchemy](#python-sqlalchemy)
- Ruby
  - [ruby-mysql](#ruby-mysql)
- [PHP](#php)
- Node.js
  - [mysqljs/mysql](#mysqljs)
- .NET Core
  - [MysqlConnector](#mysqlconnector)
- Java/JVM
  - [mariadb-java-client](#mariadb-java-client)
- Go
  - [go-mysql-driver/mysql](#go-sql-drivermysql)
- C
  - [mysql-connector-c](#mysql-connector-c)
- Grafana
- Tableau Desktop

## Example client usage

### pymysql

```python
import pymysql.cursors

connection = pymysql.connect(host='127.0.0.1',
                             user='root',
                             password='',
                             db='mydb',
                             cursorclass=pymysql.cursors.DictCursor)

try:
    with connection.cursor() as cursor:
        sql = "SELECT * FROM mytable LIMIT 1"
        cursor.execute(sql)
        rows = cursor.fetchall()

        # use rows
finally:
    connection.close()
```

### Python mysql-connector

```python
import mysql.connector

connection = mysql.connector.connect(host='127.0.0.1',
                                user='root',
                                passwd='',
                                port=3306,
                                database='mydb')

try:
    cursor = connection.cursor()
    sql = "SELECT * FROM mytable LIMIT 1"
    cursor.execute(sql)
    rows = cursor.fetchall()

    # use rows
finally:
    connection.close()
```

### Python sqlalchemy

```python
import pandas as pd
import sqlalchemy

engine = sqlalchemy.create_engine('mysql+pymysql://root:@127.0.0.1:3306/mydb')
with engine.connect() as conn:
     repo_df = pd.read_sql_table("mytable", con=conn)
     for table_name in repo_df.to_dict():
        print(table_name)
```

### ruby-mysql

```ruby
require "mysql"

conn = Mysql::new("127.0.0.1", "root", "", "mydb")
resp = conn.query "SELECT * FROM mytable LIMIT 1"

# use resp

conn.close()
```

### php

```php
try {
    $conn = new PDO("mysql:host=127.0.0.1:3306;dbname=mydb", "root", "");
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $conn->query('SELECT * FROM mytable LIMIT 1');
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // use result
} catch (PDOException $e) {
    // handle error
}
```

### mysqljs

```js
import mysql from 'mysql';

const connection = mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'mydb'
});
connection.connect();

const query = 'SELECT * FROM mytable LIMIT 1';
connection.query(query, function (error, results, _) {
    if (error) throw error;

    // use results
});

connection.end();
```

### MysqlConnector

```csharp
using MySql.Data.MySqlClient;
using System.Threading.Tasks;

namespace something
{
    public class Something
    {
        public async Task DoQuery()
        {
            var connectionString = "server=127.0.0.1;user id=root;password=;port=3306;database=mydb;";

            using (var conn = new MySqlConnection(connectionString))
            {
                await conn.OpenAsync();

                var sql = "SELECT * FROM mytable LIMIT 1";

                using (var cmd = new MySqlCommand(sql, conn))
                using (var reader = await cmd.ExecuteReaderAsync())
                while (await reader.ReadAsync()) {
                    // use reader
                }
            }
        }
    }
}
```

### mariadb-java-client

```java
package org.testing.mariadbjavaclient;

import java.sql.*;

class Main {
    public static void main(String[] args) {
        String dbUrl = "jdbc:mariadb://127.0.0.1:3306/mydb?user=root&password=";
        String query = "SELECT * FROM mytable LIMIT 1";

        try (Connection connection = DriverManager.getConnection(dbUrl)) {
            try (PreparedStatement stmt = connection.prepareStatement(query)) {
                try (ResultSet rs = stmt.executeQuery()) {
                    while (rs.next()) {
                        // use rs
                    }
                }
            }
        } catch (SQLException e) {
            // handle failure
        }
    }
}
```

### go-sql-driver/mysql

```go
package main

import (
	"database/sql"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
    db, err := sql.Open("mysql", "root:@tcp(127.0.0.1:3306)/mydb")
	if err != nil {
		// handle error
	}

	rows, err := db.Query("SELECT * FROM mytable LIMIT 1")
	if err != nil {
		// handle error
    }

    // use rows
}
```

### mysql-connector-c

```c
#include <my_global.h>
#include <mysql.h>

void finish_with_error(MYSQL *con)
{
    fprintf(stderr, "%s\n", mysql_error(con));
    mysql_close(con);
    exit(1);
}

int main(int argc, char **argv)
{
    MYSQL *con = NULL;
    MYSQL_RES *result = NULL;
    int num_fields = 0;
    MYSQL_ROW row;

    printf("MySQL client version: %s\n", mysql_get_client_info());

    con = mysql_init(NULL);
    if (con == NULL) {
        finish_with_error(con);
    }

    if (mysql_real_connect(con, "127.0.0.1", "root", "", "mydb", 3306, NULL, 0) == NULL) {
        finish_with_error(con);
    }

    if (mysql_query(con, "SELECT name, email, phone_numbers FROM mytable")) {
        finish_with_error(con);
    }

    result = mysql_store_result(con);
    if (result == NULL) {
        finish_with_error(con);
    }

    num_fields = mysql_num_fields(result);
    while ((row = mysql_fetch_row(result))) {
        for(int i = 0; i < num_fields; i++) {
            printf("%s ", row[i] ? row[i] : "NULL");
        }
        printf("\n");
    }

    mysql_free_result(result);
    mysql_close(con);

    return 0;
}
```
