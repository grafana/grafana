# SQL builder

[![GitCI.cn](https://gitci.cn/api/badges/go-xorm/builder/status.svg)](https://gitci.cn/go-xorm/builder)  [![codecov](https://codecov.io/gh/go-xorm/builder/branch/master/graph/badge.svg)](https://codecov.io/gh/go-xorm/builder)
[![](https://goreportcard.com/badge/github.com/go-xorm/builder)](https://goreportcard.com/report/github.com/go-xorm/builder)

Package builder is a lightweight and fast SQL builder for Go and XORM.

Make sure you have installed Go 1.8+ and then:

    go get github.com/go-xorm/builder

# Insert

```Go
sql, args, err := builder.Insert(Eq{"c": 1, "d": 2}).Into("table1").ToSQL()

// INSERT INTO table1 SELECT * FROM table2
sql, err := builder.Insert().Into("table1").Select().From("table2").ToBoundSQL()

// INSERT INTO table1 (a, b) SELECT b, c FROM table2
sql, err = builder.Insert("a, b").Into("table1").Select("b, c").From("table2").ToBoundSQL()
```

# Select

```Go
// Simple Query
sql, args, err := Select("c, d").From("table1").Where(Eq{"a": 1}).ToSQL()
// With join
sql, args, err = Select("c, d").From("table1").LeftJoin("table2", Eq{"table1.id": 1}.And(Lt{"table2.id": 3})).
		RightJoin("table3", "table2.id = table3.tid").Where(Eq{"a": 1}).ToSQL()
// From sub query
sql, args, err := Select("sub.id").From(Select("c").From("table1").Where(Eq{"a": 1}), "sub").Where(Eq{"b": 1}).ToSQL()
// From union query
sql, args, err = Select("sub.id").From(
	Select("id").From("table1").Where(Eq{"a": 1}).Union("all", Select("id").From("table1").Where(Eq{"a": 2})),"sub").
	Where(Eq{"b": 1}).ToSQL()
// With order by
sql, args, err = Select("a", "b", "c").From("table1").Where(Eq{"f1": "v1", "f2": "v2"}).
		OrderBy("a ASC").ToSQL()
// With limit.
// Be careful! You should set up specific dialect for builder before performing a query with LIMIT
sql, args, err = Dialect(MYSQL).Select("a", "b", "c").From("table1").OrderBy("a ASC").
		Limit(5, 10).ToSQL()
```

# Update

```Go
sql, args, err := Update(Eq{"a": 2}).From("table1").Where(Eq{"a": 1}).ToSQL()
```

# Delete

```Go
sql, args, err := Delete(Eq{"a": 1}).From("table1").ToSQL()
```

# Union

```Go
sql, args, err := Select("*").From("a").Where(Eq{"status": "1"}).
		Union("all", Select("*").From("a").Where(Eq{"status": "2"})).
		Union("distinct", Select("*").From("a").Where(Eq{"status": "3"})).
		Union("", Select("*").From("a").Where(Eq{"status": "4"})).
		ToSQL()
```

# Conditions

* `Eq` is a redefine of a map, you can give one or more conditions to `Eq`

```Go
import . "github.com/go-xorm/builder"

sql, args, _ := ToSQL(Eq{"a":1})
// a=? [1]
sql, args, _ := ToSQL(Eq{"b":"c"}.And(Eq{"c": 0}))
// b=? AND c=? ["c", 0]
sql, args, _ := ToSQL(Eq{"b":"c", "c":0})
// b=? AND c=? ["c", 0]
sql, args, _ := ToSQL(Eq{"b":"c"}.Or(Eq{"b":"d"}))
// b=? OR b=? ["c", "d"]
sql, args, _ := ToSQL(Eq{"b": []string{"c", "d"}})
// b IN (?,?) ["c", "d"]
sql, args, _ := ToSQL(Eq{"b": 1, "c":[]int{2, 3}})
// b=? AND c IN (?,?) [1, 2, 3]
```

* `Neq` is the same to `Eq`

```Go
import . "github.com/go-xorm/builder"

sql, args, _ := ToSQL(Neq{"a":1})
// a<>? [1]
sql, args, _ := ToSQL(Neq{"b":"c"}.And(Neq{"c": 0}))
// b<>? AND c<>? ["c", 0]
sql, args, _ := ToSQL(Neq{"b":"c", "c":0})
// b<>? AND c<>? ["c", 0]
sql, args, _ := ToSQL(Neq{"b":"c"}.Or(Neq{"b":"d"}))
// b<>? OR b<>? ["c", "d"]
sql, args, _ := ToSQL(Neq{"b": []string{"c", "d"}})
// b NOT IN (?,?) ["c", "d"]
sql, args, _ := ToSQL(Neq{"b": 1, "c":[]int{2, 3}})
// b<>? AND c NOT IN (?,?) [1, 2, 3]
```

* `Gt`, `Gte`, `Lt`, `Lte`

```Go
import . "github.com/go-xorm/builder"

sql, args, _ := ToSQL(Gt{"a", 1}.And(Gte{"b", 2}))
// a>? AND b>=? [1, 2]
sql, args, _ := ToSQL(Lt{"a", 1}.Or(Lte{"b", 2}))
// a<? OR b<=? [1, 2]
```

* `Like`

```Go
import . "github.com/go-xorm/builder"

sql, args, _ := ToSQL(Like{"a", "c"})
// a LIKE ? [%c%]
```

* `Expr` you can customerize your sql with `Expr`

```Go
import . "github.com/go-xorm/builder"

sql, args, _ := ToSQL(Expr("a = ? ", 1))
// a = ? [1]
sql, args, _ := ToSQL(Eq{"a": Expr("select id from table where c = ?", 1)})
// a=(select id from table where c = ?) [1]
```

* `In` and `NotIn`

```Go
import . "github.com/go-xorm/builder"

sql, args, _ := ToSQL(In("a", 1, 2, 3))
// a IN (?,?,?) [1,2,3]
sql, args, _ := ToSQL(In("a", []int{1, 2, 3}))
// a IN (?,?,?) [1,2,3]
sql, args, _ := ToSQL(In("a", Expr("select id from b where c = ?", 1))))
// a IN (select id from b where c = ?) [1]
```

* `IsNull` and `NotNull`

```Go
import . "github.com/go-xorm/builder"

sql, args, _ := ToSQL(IsNull{"a"})
// a IS NULL []
sql, args, _ := ToSQL(NotNull{"b"})
	// b IS NOT NULL []
```

* `And(conds ...Cond)`, And can connect one or more condtions via And

```Go
import . "github.com/go-xorm/builder"

sql, args, _ := ToSQL(And(Eq{"a":1}, Like{"b", "c"}, Neq{"d", 2}))
// a=? AND b LIKE ? AND d<>? [1, %c%, 2]
```

* `Or(conds ...Cond)`, Or can connect one or more conditions via Or

```Go
import . "github.com/go-xorm/builder"

sql, args, _ := ToSQL(Or(Eq{"a":1}, Like{"b", "c"}, Neq{"d", 2}))
// a=? OR b LIKE ? OR d<>? [1, %c%, 2]
sql, args, _ := ToSQL(Or(Eq{"a":1}, And(Like{"b", "c"}, Neq{"d", 2})))
// a=? OR (b LIKE ? AND d<>?) [1, %c%, 2]
```

* `Between`

```Go
import . "github.com/go-xorm/builder"

sql, args, _ := ToSQL(Between{"a", 1, 2})
// a BETWEEN 1 AND 2
```

* Define yourself conditions

Since `Cond` is an interface.

```Go
type Cond interface {
	WriteTo(Writer) error
	And(...Cond) Cond
	Or(...Cond) Cond
	IsValid() bool
}
```

You can define yourself conditions and compose with other `Cond`.