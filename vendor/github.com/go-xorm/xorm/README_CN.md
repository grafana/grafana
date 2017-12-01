# xorm

[English](https://github.com/go-xorm/xorm/blob/master/README.md)

xorm是一个简单而强大的Go语言ORM库. 通过它可以使数据库操作非常简便。

[![CircleCI](https://circleci.com/gh/go-xorm/xorm/tree/master.svg?style=svg)](https://circleci.com/gh/go-xorm/xorm/tree/master)  [![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/go-xorm/xorm?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

# 注意

最新的版本有不兼容的更新，您必须使用 `engine.ShowSQL()` 和 `engine.Logger().SetLevel()` 来替代 `engine.ShowSQL = `, `engine.ShowInfo = ` 等等。

## 特性

* 支持Struct和数据库表之间的灵活映射，并支持自动同步

* 事务支持

* 同时支持原始SQL语句和ORM操作的混合执行

* 使用连写来简化调用

* 支持使用Id, In, Where, Limit, Join, Having, Table, Sql, Cols等函数和结构体等方式作为条件

* 支持级联加载Struct

* 支持缓存

* 支持根据数据库自动生成xorm的结构体

* 支持记录版本（即乐观锁）

* 内置SQL Builder支持

## 驱动支持

目前支持的Go数据库驱动和对应的数据库如下：

* Mysql: [github.com/go-sql-driver/mysql](https://github.com/go-sql-driver/mysql)

* MyMysql: [github.com/ziutek/mymysql/godrv](https://github.com/ziutek/mymysql/godrv)

* Postgres: [github.com/lib/pq](https://github.com/lib/pq)

* Tidb: [github.com/pingcap/tidb](https://github.com/pingcap/tidb)

* SQLite: [github.com/mattn/go-sqlite3](https://github.com/mattn/go-sqlite3)

* MsSql: [github.com/denisenkom/go-mssqldb](https://github.com/denisenkom/go-mssqldb)

* MsSql: [github.com/lunny/godbc](https://github.com/lunny/godbc)

* Oracle: [github.com/mattn/go-oci8](https://github.com/mattn/go-oci8) (试验性支持)

## 更新日志

* **v0.6.0**
    * 去除对 ql 的支持
    * 新增条件查询分析器 [github.com/go-xorm/builder](https://github.com/go-xorm/builder), 从因此 `Where, And, Or` 函数
将可以用 `builder.Cond` 作为条件组合
    * 新增 Sum, SumInt, SumInt64 和 NotIn 函数
    * Bug修正

* **v0.5.0**
    * logging接口进行不兼容改变
    * Bug修正

* **v0.4.5**
    * bug修正
    * extends 支持无限级
    * Delete Limit 支持

* **v0.4.4**
    * Tidb 数据库支持
    * QL 试验性支持
    * sql.NullString支持
    * ForUpdate 支持
    * bug修正

[更多更新日志...](https://github.com/go-xorm/manual-zh-CN/tree/master/chapter-16)

## 安装

	go get github.com/go-xorm/xorm

## 文档

* [操作指南](http://xorm.io/docs)

* [GoWalker代码文档](http://gowalker.org/github.com/go-xorm/xorm)

* [Godoc代码文档](http://godoc.org/github.com/go-xorm/xorm)

# 快速开始

* 第一步创建引擎，driverName, dataSourceName和database/sql接口相同

```Go
engine, err := xorm.NewEngine(driverName, dataSourceName)
```

* 定义一个和表同步的结构体，并且自动同步结构体到数据库

```Go
type User struct {
    Id int64
    Name string
    Salt string
    Age int
    Passwd string `xorm:"varchar(200)"`
    Created time.Time `xorm:"created"`
    Updated time.Time `xorm:"updated"`
}

err := engine.Sync2(new(User))
```

* 最原始的也支持SQL语句查询，返回的结果类型为 []map[string][]byte

```Go
results, err := engine.Query("select * from user")
```

* 执行一个SQL语句

```Go
affected, err := engine.Exec("update user set age = ? where name = ?", age, name)
```

* 插入一条或者多条记录

```Go
affected, err := engine.Insert(&user)
// INSERT INTO struct () values ()
affected, err := engine.Insert(&user1, &user2)
// INSERT INTO struct1 () values ()
// INSERT INTO struct2 () values ()
affected, err := engine.Insert(&users)
// INSERT INTO struct () values (),(),()
affected, err := engine.Insert(&user1, &users)
// INSERT INTO struct1 () values ()
// INSERT INTO struct2 () values (),(),()
```

* 查询单条记录

```Go
has, err := engine.Get(&user)
// SELECT * FROM user LIMIT 1
has, err := engine.Where("name = ?", name).Desc("id").Get(&user)
// SELECT * FROM user WHERE name = ? ORDER BY id DESC LIMIT 1
```

* 查询多条记录，当然可以使用Join和extends来组合使用

```Go
var users []User
err := engine.Where("name = ?", name).And("age > 10").Limit(10, 0).Find(&users)
// SELECT * FROM user WHERE name = ? AND age > 10 limit 0 offset 10

type Detail struct {
    Id int64
    UserId int64 `xorm:"index"`
}

type UserDetail struct {
    User `xorm:"extends"`
    Detail `xorm:"extends"`
}

var users []UserDetail
err := engine.Table("user").Select("user.*, detail.*")
    Join("INNER", "detail", "detail.user_id = user.id").
    Where("user.name = ?", name).Limit(10, 0).
    Find(&users)
// SELECT user.*, detail.* FROM user INNER JOIN detail WHERE user.name = ? limit 0 offset 10
```

* 根据条件遍历数据库，可以有两种方式: Iterate and Rows

```Go
err := engine.Iterate(&User{Name:name}, func(idx int, bean interface{}) error {
    user := bean.(*User)
    return nil
})
// SELECT * FROM user

rows, err := engine.Rows(&User{Name:name})
// SELECT * FROM user
defer rows.Close()
bean := new(Struct)
for rows.Next() {
    err = rows.Scan(bean)
}
```

* 更新数据，除非使用Cols,AllCols函数指明，默认只更新非空和非0的字段

```Go
affected, err := engine.Id(1).Update(&user)
// UPDATE user SET ... Where id = ?

affected, err := engine.Update(&user, &User{Name:name})
// UPDATE user SET ... Where name = ?

var ids = []int64{1, 2, 3}
affected, err := engine.In(ids).Update(&user)
// UPDATE user SET ... Where id IN (?, ?, ?)

// force update indicated columns by Cols
affected, err := engine.Id(1).Cols("age").Update(&User{Name:name, Age: 12})
// UPDATE user SET age = ?, updated=? Where id = ?

// force NOT update indicated columns by Omit
affected, err := engine.Id(1).Omit("name").Update(&User{Name:name, Age: 12})
// UPDATE user SET age = ?, updated=? Where id = ?

affected, err := engine.Id(1).AllCols().Update(&user)
// UPDATE user SET name=?,age=?,salt=?,passwd=?,updated=? Where id = ?
```

* 删除记录，需要注意，删除必须至少有一个条件，否则会报错。要清空数据库可以用EmptyTable

```Go
affected, err := engine.Where(...).Delete(&user)
// DELETE FROM user Where ...
```

* 获取记录条数

```Go
counts, err := engine.Count(&user)
// SELECT count(*) AS total FROM user
```

* 条件编辑器

```Go
err := engine.Where(builder.NotIn("a", 1, 2).And(builder.In("b", "c", "d", "e"))).Find(&users)
// SELECT id, name ... FROM user WHERE a NOT IN (?, ?) AND b IN (?, ?, ?)
```

# 案例

* [github.com/m3ng9i/qreader](https://github.com/m3ng9i/qreader)

* [Wego](http://github.com/go-tango/wego)

* [Docker.cn](https://docker.cn/)

* [Gogs](http://try.gogits.org) - [github.com/gogits/gogs](http://github.com/gogits/gogs)

* [Gowalker](http://gowalker.org) - [github.com/Unknwon/gowalker](http://github.com/Unknwon/gowalker)

* [Gobuild.io](http://gobuild.io) - [github.com/shxsun/gobuild](http://github.com/shxsun/gobuild)

* [Sudo China](http://sudochina.com) - [github.com/insionng/toropress](http://github.com/insionng/toropress)

* [Godaily](http://godaily.org) - [github.com/govc/godaily](http://github.com/govc/godaily)

* [YouGam](http://www.yougam.com/)

* [GoCMS - github.com/zzboy/GoCMS](https://github.com/zzdboy/GoCMS)

* [GoBBS - gobbs.domolo.com](http://gobbs.domolo.com/)

* [go-blog](http://wangcheng.me) - [github.com/easykoo/go-blog](https://github.com/easykoo/go-blog)

## 讨论

请加入QQ群：280360085 进行讨论。

## 贡献

如果您也想为Xorm贡献您的力量，请查看 [CONTRIBUTING](https://github.com/go-xorm/xorm/blob/master/CONTRIBUTING.md)

## LICENSE

BSD License
[http://creativecommons.org/licenses/BSD/](http://creativecommons.org/licenses/BSD/)
