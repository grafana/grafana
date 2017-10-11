// Copyright 2013 - 2016 The XORM Authors. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

/*

Package xorm is a simple and powerful ORM for Go.

Installation

Make sure you have installed Go 1.1+ and then:

    go get github.com/go-xorm/xorm

Create Engine

Firstly, we should new an engine for a database

    engine, err := xorm.NewEngine(driverName, dataSourceName)

Method NewEngine's parameters is the same as sql.Open. It depends
drivers' implementation.
Generally, one engine for an application is enough. You can set it as package variable.

Raw Methods

XORM also support raw SQL execution:

1. query a SQL string, the returned results is []map[string][]byte

    results, err := engine.Query("select * from user")

2. execute a SQL string, the returned results

    affected, err := engine.Exec("update user set .... where ...")

ORM Methods

There are 8 major ORM methods and many helpful methods to use to operate database.

1. Insert one or multiple records to database

    affected, err := engine.Insert(&struct)
    // INSERT INTO struct () values ()
    affected, err := engine.Insert(&struct1, &struct2)
    // INSERT INTO struct1 () values ()
    // INSERT INTO struct2 () values ()
    affected, err := engine.Insert(&sliceOfStruct)
    // INSERT INTO struct () values (),(),()
    affected, err := engine.Insert(&struct1, &sliceOfStruct2)
    // INSERT INTO struct1 () values ()
    // INSERT INTO struct2 () values (),(),()

2. Query one record from database

    has, err := engine.Get(&user)
    // SELECT * FROM user LIMIT 1

3. Query multiple records from database

    var sliceOfStructs []Struct
    err := engine.Find(&sliceOfStructs)
    // SELECT * FROM user

    var mapOfStructs = make(map[int64]Struct)
    err := engine.Find(&mapOfStructs)
    // SELECT * FROM user

    var int64s []int64
    err := engine.Table("user").Cols("id").Find(&int64s)
    // SELECT id FROM user

4. Query multiple records and record by record handle, there two methods, one is Iterate,
another is Rows

    err := engine.Iterate(...)
    // SELECT * FROM user

    rows, err := engine.Rows(...)
    // SELECT * FROM user
    defer rows.Close()
    bean := new(Struct)
    for rows.Next() {
        err = rows.Scan(bean)
    }

5. Update one or more records

    affected, err := engine.Id(...).Update(&user)
    // UPDATE user SET ...

6. Delete one or more records, Delete MUST has condition

    affected, err := engine.Where(...).Delete(&user)
    // DELETE FROM user Where ...

7. Count records

    counts, err := engine.Count(&user)
    // SELECT count(*) AS total FROM user

8. Sum records

    sumFloat64, err := engine.Sum(&user, "id")
    // SELECT sum(id) from user

    sumFloat64s, err := engine.Sums(&user, "id1", "id2")
    // SELECT sum(id1), sum(id2) from user

    sumInt64s, err := engine.SumsInt(&user, "id1", "id2")
    // SELECT sum(id1), sum(id2) from user

Conditions

The above 8 methods could use with condition methods chainable.
Attention: the above 8 methods should be the last chainable method.

1. ID, In

    engine.ID(1).Get(&user) // for single primary key
    // SELECT * FROM user WHERE id = 1
    engine.ID(core.PK{1, 2}).Get(&user) // for composite primary keys
    // SELECT * FROM user WHERE id1 = 1 AND id2 = 2
    engine.In("id", 1, 2, 3).Find(&users)
    // SELECT * FROM user WHERE id IN (1, 2, 3)
    engine.In("id", []int{1, 2, 3}).Find(&users)
    // SELECT * FROM user WHERE id IN (1, 2, 3)

2. Where, And, Or

    engine.Where().And().Or().Find()
    // SELECT * FROM user WHERE (.. AND ..) OR ...

3. OrderBy, Asc, Desc

    engine.Asc().Desc().Find()
    // SELECT * FROM user ORDER BY .. ASC, .. DESC
    engine.OrderBy().Find()
    // SELECT * FROM user ORDER BY ..

4. Limit, Top

    engine.Limit().Find()
    // SELECT * FROM user LIMIT .. OFFSET ..
    engine.Top(5).Find()
    // SELECT TOP 5 * FROM user // for mssql
    // SELECT * FROM user LIMIT .. OFFSET 0 //for other databases

5. SQL, let you custom SQL

    var users []User
    engine.SQL("select * from user").Find(&users)

6. Cols, Omit, Distinct

    var users []*User
    engine.Cols("col1, col2").Find(&users)
    // SELECT col1, col2 FROM user
    engine.Cols("col1", "col2").Where().Update(user)
    // UPDATE user set col1 = ?, col2 = ? Where ...
    engine.Omit("col1").Find(&users)
    // SELECT col2, col3 FROM user
    engine.Omit("col1").Insert(&user)
    // INSERT INTO table (non-col1) VALUES ()
    engine.Distinct("col1").Find(&users)
    // SELECT DISTINCT col1 FROM user

7. Join, GroupBy, Having

    engine.GroupBy("name").Having("name='xlw'").Find(&users)
    //SELECT * FROM user GROUP BY name HAVING name='xlw'
    engine.Join("LEFT", "userdetail", "user.id=userdetail.id").Find(&users)
    //SELECT * FROM user LEFT JOIN userdetail ON user.id=userdetail.id

More usage, please visit http://xorm.io/docs
*/
package xorm
