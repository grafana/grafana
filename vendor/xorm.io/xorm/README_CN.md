# xorm

[English](https://gitea.com/xorm/xorm/src/branch/master/README.md)

xorm是一个简单而强大的Go语言ORM库. 通过它可以使数据库操作非常简便。

[![Build Status](https://drone.gitea.com/api/badges/xorm/builder/status.svg)](https://drone.gitea.com/xorm/builder) [![](http://gocover.io/_badge/xorm.io/xorm)](https://gocover.io/xorm.io/xorm)
[![](https://goreportcard.com/badge/xorm.io/xorm)](https://goreportcard.com/report/xorm.io/xorm)
[![Join the chat at https://img.shields.io/discord/323460943201959939.svg](https://img.shields.io/discord/323460943201959939.svg)](https://discord.gg/HuR2CF3)

## 特性

* 支持Struct和数据库表之间的灵活映射，并支持自动同步

* 事务支持

* 同时支持原始SQL语句和ORM操作的混合执行

* 使用连写来简化调用

* 支持使用Id, In, Where, Limit, Join, Having, Table, Sql, Cols等函数和结构体等方式作为条件

* 支持级联加载Struct

* Schema支持（仅Postgres）

* 支持缓存

* 支持根据数据库自动生成xorm的结构体

* 支持记录版本（即乐观锁）

* 内置SQL Builder支持

* 上下文缓存支持

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

## 安装

	go get xorm.io/xorm

## 文档

* [操作指南](http://xorm.io/docs)

* [Godoc代码文档](http://godoc.org/xorm.io/xorm)

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

* 创建Engine组

```Go
dataSourceNameSlice := []string{masterDataSourceName, slave1DataSourceName, slave2DataSourceName}
engineGroup, err := xorm.NewEngineGroup(driverName, dataSourceNameSlice)
```

```Go
masterEngine, err := xorm.NewEngine(driverName, masterDataSourceName)
slave1Engine, err := xorm.NewEngine(driverName, slave1DataSourceName)
slave2Engine, err := xorm.NewEngine(driverName, slave2DataSourceName)
engineGroup, err := xorm.NewEngineGroup(masterEngine, []*Engine{slave1Engine, slave2Engine})
```

所有使用 `engine` 都可以简单的用 `engineGroup` 来替换。

* `Query` 最原始的也支持SQL语句查询，返回的结果类型为 []map[string][]byte。`QueryString` 返回 []map[string]string, `QueryInterface` 返回 `[]map[string]interface{}`.

```Go
results, err := engine.Query("select * from user")
results, err := engine.Where("a = 1").Query()

results, err := engine.QueryString("select * from user")
results, err := engine.Where("a = 1").QueryString()

results, err := engine.QueryInterface("select * from user")
results, err := engine.Where("a = 1").QueryInterface()
```

* `Exec` 执行一个SQL语句

```Go
affected, err := engine.Exec("update user set age = ? where name = ?", age, name)
```

* `Insert` 插入一条或者多条记录

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

* `Get` 查询单条记录

```Go
has, err := engine.Get(&user)
// SELECT * FROM user LIMIT 1

has, err := engine.Where("name = ?", name).Desc("id").Get(&user)
// SELECT * FROM user WHERE name = ? ORDER BY id DESC LIMIT 1

var name string
has, err := engine.Table(&user).Where("id = ?", id).Cols("name").Get(&name)
// SELECT name FROM user WHERE id = ?

var id int64
has, err := engine.Table(&user).Where("name = ?", name).Cols("id").Get(&id)
has, err := engine.SQL("select id from user").Get(&id)
// SELECT id FROM user WHERE name = ?

var valuesMap = make(map[string]string)
has, err := engine.Table(&user).Where("id = ?", id).Get(&valuesMap)
// SELECT * FROM user WHERE id = ?

var valuesSlice = make([]interface{}, len(cols))
has, err := engine.Table(&user).Where("id = ?", id).Cols(cols...).Get(&valuesSlice)
// SELECT col1, col2, col3 FROM user WHERE id = ?
```

* `Exist` 检测记录是否存在

```Go
has, err := testEngine.Exist(new(RecordExist))
// SELECT * FROM record_exist LIMIT 1

has, err = testEngine.Exist(&RecordExist{
		Name: "test1",
	})
// SELECT * FROM record_exist WHERE name = ? LIMIT 1

has, err = testEngine.Where("name = ?", "test1").Exist(&RecordExist{})
// SELECT * FROM record_exist WHERE name = ? LIMIT 1

has, err = testEngine.SQL("select * from record_exist where name = ?", "test1").Exist()
// select * from record_exist where name = ?

has, err = testEngine.Table("record_exist").Exist()
// SELECT * FROM record_exist LIMIT 1

has, err = testEngine.Table("record_exist").Where("name = ?", "test1").Exist()
// SELECT * FROM record_exist WHERE name = ? LIMIT 1
```

* `Find` 查询多条记录，当然可以使用Join和extends来组合使用

```Go
var users []User
err := engine.Where("name = ?", name).And("age > 10").Limit(10, 0).Find(&users)
// SELECT * FROM user WHERE name = ? AND age > 10 limit 10 offset 0

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
// SELECT user.*, detail.* FROM user INNER JOIN detail WHERE user.name = ? limit 10 offset 0
```

* `Iterate` 和 `Rows` 根据条件遍历数据库，可以有两种方式: Iterate and Rows

```Go
err := engine.Iterate(&User{Name:name}, func(idx int, bean interface{}) error {
    user := bean.(*User)
    return nil
})
// SELECT * FROM user

err := engine.BufferSize(100).Iterate(&User{Name:name}, func(idx int, bean interface{}) error {
    user := bean.(*User)
    return nil
})
// SELECT * FROM user Limit 0, 100
// SELECT * FROM user Limit 101, 100

rows, err := engine.Rows(&User{Name:name})
// SELECT * FROM user
defer rows.Close()
bean := new(Struct)
for rows.Next() {
    err = rows.Scan(bean)
}
```

* `Update` 更新数据，除非使用Cols,AllCols函数指明，默认只更新非空和非0的字段

```Go
affected, err := engine.ID(1).Update(&user)
// UPDATE user SET ... Where id = ?

affected, err := engine.Update(&user, &User{Name:name})
// UPDATE user SET ... Where name = ?

var ids = []int64{1, 2, 3}
affected, err := engine.In(ids).Update(&user)
// UPDATE user SET ... Where id IN (?, ?, ?)

// force update indicated columns by Cols
affected, err := engine.ID(1).Cols("age").Update(&User{Name:name, Age: 12})
// UPDATE user SET age = ?, updated=? Where id = ?

// force NOT update indicated columns by Omit
affected, err := engine.ID(1).Omit("name").Update(&User{Name:name, Age: 12})
// UPDATE user SET age = ?, updated=? Where id = ?

affected, err := engine.ID(1).AllCols().Update(&user)
// UPDATE user SET name=?,age=?,salt=?,passwd=?,updated=? Where id = ?
```

* `Delete` 删除记录，需要注意，删除必须至少有一个条件，否则会报错。要清空数据库可以用EmptyTable

```Go
affected, err := engine.Where(...).Delete(&user)
// DELETE FROM user Where ...

affected, err := engine.ID(2).Delete(&user)
// DELETE FROM user Where id = ?
```

* `Count` 获取记录条数

```Go
counts, err := engine.Count(&user)
// SELECT count(*) AS total FROM user
```

* `Sum` 求和函数

```Go
agesFloat64, err := engine.Sum(&user, "age")
// SELECT sum(age) AS total FROM user

agesInt64, err := engine.SumInt(&user, "age")
// SELECT sum(age) AS total FROM user

sumFloat64Slice, err := engine.Sums(&user, "age", "score")
// SELECT sum(age), sum(score) FROM user

sumInt64Slice, err := engine.SumsInt(&user, "age", "score")
// SELECT sum(age), sum(score) FROM user
```

* 条件编辑器

```Go
err := engine.Where(builder.NotIn("a", 1, 2).And(builder.In("b", "c", "d", "e"))).Find(&users)
// SELECT id, name ... FROM user WHERE a NOT IN (?, ?) AND b IN (?, ?, ?)
```

* 在一个Go程中多次操作数据库，但没有事务

```Go
session := engine.NewSession()
defer session.Close()

user1 := Userinfo{Username: "xiaoxiao", Departname: "dev", Alias: "lunny", Created: time.Now()}
if _, err := session.Insert(&user1); err != nil {
    return err
}

user2 := Userinfo{Username: "yyy"}
if _, err := session.Where("id = ?", 2).Update(&user2); err != nil {
    return err
}

if _, err := session.Exec("delete from userinfo where username = ?", user2.Username); err != nil {
    return err
}

return nil
```

* 在一个Go程中有事务

```Go
session := engine.NewSession()
defer session.Close()

// add Begin() before any action
if err := session.Begin(); err != nil {
    // if returned then will rollback automatically
    return err
}

user1 := Userinfo{Username: "xiaoxiao", Departname: "dev", Alias: "lunny", Created: time.Now()}
if _, err := session.Insert(&user1); err != nil {
    return err
}

user2 := Userinfo{Username: "yyy"}
if _, err := session.Where("id = ?", 2).Update(&user2); err != nil {
    return err
}

if _, err := session.Exec("delete from userinfo where username = ?", user2.Username); err != nil {
    return err
}

// add Commit() after all actions
return session.Commit()
```

* 事务的简写方法

```Go
res, err := engine.Transaction(func(session *xorm.Session) (interface{}, error) {
    user1 := Userinfo{Username: "xiaoxiao", Departname: "dev", Alias: "lunny", Created: time.Now()}
    if _, err := session.Insert(&user1); err != nil {
        return nil, err
    }

    user2 := Userinfo{Username: "yyy"}
    if _, err := session.Where("id = ?", 2).Update(&user2); err != nil {
        return nil, err
    }

    if _, err := session.Exec("delete from userinfo where username = ?", user2.Username); err != nil {
        return nil, err
    }
    return nil, nil
})
```

* 上下文缓存，如果启用，那么针对单个对象的查询将会被缓存到系统中，可以被下一个查询使用。

```Go
	sess := engine.NewSession()
	defer sess.Close()

	var context = xorm.NewMemoryContextCache()

	var c2 ContextGetStruct
	has, err := sess.ID(1).ContextCache(context).Get(&c2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, 1, c2.Id)
	assert.EqualValues(t, "1", c2.Name)
	sql, args := sess.LastSQL()
	assert.True(t, len(sql) > 0)
	assert.True(t, len(args) > 0)

	var c3 ContextGetStruct
	has, err = sess.ID(1).ContextCache(context).Get(&c3)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, 1, c3.Id)
	assert.EqualValues(t, "1", c3.Name)
	sql, args = sess.LastSQL()
	assert.True(t, len(sql) == 0)
	assert.True(t, len(args) == 0)
```

## 贡献

如果您也想为Xorm贡献您的力量，请查看 [CONTRIBUTING](https://gitea.com/xorm/xorm/src/branch/master/CONTRIBUTING.md)。您也可以加入QQ群  技术帮助和讨论。
群一：280360085 （已满）
群二：795010183

## Credits

### Contributors

感谢所有的贡献者. [[Contribute](CONTRIBUTING.md)].
<a href="graphs/contributors"><img src="https://opencollective.com/xorm/contributors.svg?width=890&button=false" /></a>

### Backers

感谢我们所有的 backers! 🙏 [[成为 backer](https://opencollective.com/xorm#backer)]

<a href="https://opencollective.com/xorm#backers" target="_blank"><img src="https://opencollective.com/xorm/backers.svg?width=890"></a>

### Sponsors

成为 sponsor 来支持 xorm。您的 logo 将会被显示并被链接到您的网站。 [[成为 sponsor](https://opencollective.com/xorm#sponsor)]

# 案例

* [Go语言中文网](http://studygolang.com/) - [github.com/studygolang/studygolang](https://github.com/studygolang/studygolang)

* [Gitea](http://gitea.io) - [github.com/go-gitea/gitea](http://github.com/go-gitea/gitea)

* [Gogs](http://try.gogits.org) - [github.com/gogits/gogs](http://github.com/gogits/gogs)

* [grafana](https://grafana.com/) - [github.com/grafana/grafana](http://github.com/grafana/grafana)

* [github.com/m3ng9i/qreader](https://github.com/m3ng9i/qreader)

* [Wego](http://github.com/go-tango/wego)

* [Docker.cn](https://docker.cn/)

* [Xorm Adapter](https://github.com/casbin/xorm-adapter) for [Casbin](https://github.com/casbin/casbin) - [github.com/casbin/xorm-adapter](https://github.com/casbin/xorm-adapter)

* [Gowalker](http://gowalker.org) - [github.com/Unknwon/gowalker](http://github.com/Unknwon/gowalker)

* [Gobuild.io](http://gobuild.io) - [github.com/shxsun/gobuild](http://github.com/shxsun/gobuild)

* [Sudo China](http://sudochina.com) - [github.com/insionng/toropress](http://github.com/insionng/toropress)

* [Godaily](http://godaily.org) - [github.com/govc/godaily](http://github.com/govc/godaily)

* [YouGam](http://www.yougam.com/)

* [GoCMS - github.com/zzboy/GoCMS](https://github.com/zzdboy/GoCMS)

* [GoBBS - gobbs.domolo.com](http://gobbs.domolo.com/)

* [go-blog](http://wangcheng.me) - [github.com/easykoo/go-blog](https://github.com/easykoo/go-blog)


## 更新日志

* **v0.7.0**
    * 修正部分Bug

* **v0.6.6**
    * 修正部分Bug

* **v0.6.5**
    * 通过 engine.SetSchema 来支持 schema，当前仅支持Postgres
    * vgo 支持
    * 新增 `FindAndCount` 函数
    * 通过 `NewEngineWithParams` 支持数据库特别参数
    * 修正部分Bug

* **v0.6.4**
    * 自动读写分离支持
    * Query/QueryString/QueryInterface 支持与 Where/And 合用
    * `Get` 支持获取非结构体变量
    * `Iterate` 支持 `BufferSize` 
    * 修正部分Bug

[更多更新日志...](https://github.com/go-xorm/manual-zh-CN/tree/master/chapter-16)

## LICENSE

BSD License
[http://creativecommons.org/licenses/BSD/](http://creativecommons.org/licenses/BSD/)
