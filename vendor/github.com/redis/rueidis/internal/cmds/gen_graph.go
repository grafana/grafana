// Code generated DO NOT EDIT

package cmds

import "strconv"

type GraphConfigGet Incomplete

func (b Builder) GraphConfigGet() (c GraphConfigGet) {
	c = GraphConfigGet{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GRAPH.CONFIG", "GET")
	return c
}

func (c GraphConfigGet) Name(name string) GraphConfigGetName {
	c.cs.s = append(c.cs.s, name)
	return (GraphConfigGetName)(c)
}

type GraphConfigGetName Incomplete

func (c GraphConfigGetName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphConfigSet Incomplete

func (b Builder) GraphConfigSet() (c GraphConfigSet) {
	c = GraphConfigSet{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GRAPH.CONFIG", "SET")
	return c
}

func (c GraphConfigSet) Name(name string) GraphConfigSetName {
	c.cs.s = append(c.cs.s, name)
	return (GraphConfigSetName)(c)
}

type GraphConfigSetName Incomplete

func (c GraphConfigSetName) Value(value string) GraphConfigSetValue {
	c.cs.s = append(c.cs.s, value)
	return (GraphConfigSetValue)(c)
}

type GraphConfigSetValue Incomplete

func (c GraphConfigSetValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphConstraintCreate Incomplete

func (b Builder) GraphConstraintCreate() (c GraphConstraintCreate) {
	c = GraphConstraintCreate{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GRAPH.CONSTRAINT", "CREATE")
	return c
}

func (c GraphConstraintCreate) Key(key string) GraphConstraintCreateKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GraphConstraintCreateKey)(c)
}

type GraphConstraintCreateEntityNode Incomplete

func (c GraphConstraintCreateEntityNode) Properties(properties int64) GraphConstraintCreateProperties {
	c.cs.s = append(c.cs.s, "PROPERTIES", strconv.FormatInt(properties, 10))
	return (GraphConstraintCreateProperties)(c)
}

type GraphConstraintCreateEntityRelationship Incomplete

func (c GraphConstraintCreateEntityRelationship) Properties(properties int64) GraphConstraintCreateProperties {
	c.cs.s = append(c.cs.s, "PROPERTIES", strconv.FormatInt(properties, 10))
	return (GraphConstraintCreateProperties)(c)
}

type GraphConstraintCreateKey Incomplete

func (c GraphConstraintCreateKey) Mandatory() GraphConstraintCreateModeMandatory {
	c.cs.s = append(c.cs.s, "MANDATORY")
	return (GraphConstraintCreateModeMandatory)(c)
}

func (c GraphConstraintCreateKey) Unique() GraphConstraintCreateModeUnique {
	c.cs.s = append(c.cs.s, "UNIQUE")
	return (GraphConstraintCreateModeUnique)(c)
}

type GraphConstraintCreateModeMandatory Incomplete

func (c GraphConstraintCreateModeMandatory) Node(node string) GraphConstraintCreateEntityNode {
	c.cs.s = append(c.cs.s, "NODE", node)
	return (GraphConstraintCreateEntityNode)(c)
}

func (c GraphConstraintCreateModeMandatory) Relationship(relationship string) GraphConstraintCreateEntityRelationship {
	c.cs.s = append(c.cs.s, "RELATIONSHIP", relationship)
	return (GraphConstraintCreateEntityRelationship)(c)
}

type GraphConstraintCreateModeUnique Incomplete

func (c GraphConstraintCreateModeUnique) Node(node string) GraphConstraintCreateEntityNode {
	c.cs.s = append(c.cs.s, "NODE", node)
	return (GraphConstraintCreateEntityNode)(c)
}

func (c GraphConstraintCreateModeUnique) Relationship(relationship string) GraphConstraintCreateEntityRelationship {
	c.cs.s = append(c.cs.s, "RELATIONSHIP", relationship)
	return (GraphConstraintCreateEntityRelationship)(c)
}

type GraphConstraintCreateProp Incomplete

func (c GraphConstraintCreateProp) Prop(prop ...string) GraphConstraintCreateProp {
	c.cs.s = append(c.cs.s, prop...)
	return c
}

func (c GraphConstraintCreateProp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphConstraintCreateProperties Incomplete

func (c GraphConstraintCreateProperties) Prop(prop ...string) GraphConstraintCreateProp {
	c.cs.s = append(c.cs.s, prop...)
	return (GraphConstraintCreateProp)(c)
}

type GraphConstraintDrop Incomplete

func (b Builder) GraphConstraintDrop() (c GraphConstraintDrop) {
	c = GraphConstraintDrop{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GRAPH.CONSTRAINT", "DROP")
	return c
}

func (c GraphConstraintDrop) Key(key string) GraphConstraintDropKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (GraphConstraintDropKey)(c)
}

type GraphConstraintDropEntityNode Incomplete

func (c GraphConstraintDropEntityNode) Properties(properties int64) GraphConstraintDropProperties {
	c.cs.s = append(c.cs.s, "PROPERTIES", strconv.FormatInt(properties, 10))
	return (GraphConstraintDropProperties)(c)
}

type GraphConstraintDropEntityRelationship Incomplete

func (c GraphConstraintDropEntityRelationship) Properties(properties int64) GraphConstraintDropProperties {
	c.cs.s = append(c.cs.s, "PROPERTIES", strconv.FormatInt(properties, 10))
	return (GraphConstraintDropProperties)(c)
}

type GraphConstraintDropKey Incomplete

func (c GraphConstraintDropKey) Mandatory() GraphConstraintDropModeMandatory {
	c.cs.s = append(c.cs.s, "MANDATORY")
	return (GraphConstraintDropModeMandatory)(c)
}

func (c GraphConstraintDropKey) Unique() GraphConstraintDropModeUnique {
	c.cs.s = append(c.cs.s, "UNIQUE")
	return (GraphConstraintDropModeUnique)(c)
}

type GraphConstraintDropModeMandatory Incomplete

func (c GraphConstraintDropModeMandatory) Node(node string) GraphConstraintDropEntityNode {
	c.cs.s = append(c.cs.s, "NODE", node)
	return (GraphConstraintDropEntityNode)(c)
}

func (c GraphConstraintDropModeMandatory) Relationship(relationship string) GraphConstraintDropEntityRelationship {
	c.cs.s = append(c.cs.s, "RELATIONSHIP", relationship)
	return (GraphConstraintDropEntityRelationship)(c)
}

type GraphConstraintDropModeUnique Incomplete

func (c GraphConstraintDropModeUnique) Node(node string) GraphConstraintDropEntityNode {
	c.cs.s = append(c.cs.s, "NODE", node)
	return (GraphConstraintDropEntityNode)(c)
}

func (c GraphConstraintDropModeUnique) Relationship(relationship string) GraphConstraintDropEntityRelationship {
	c.cs.s = append(c.cs.s, "RELATIONSHIP", relationship)
	return (GraphConstraintDropEntityRelationship)(c)
}

type GraphConstraintDropProp Incomplete

func (c GraphConstraintDropProp) Prop(prop ...string) GraphConstraintDropProp {
	c.cs.s = append(c.cs.s, prop...)
	return c
}

func (c GraphConstraintDropProp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphConstraintDropProperties Incomplete

func (c GraphConstraintDropProperties) Prop(prop ...string) GraphConstraintDropProp {
	c.cs.s = append(c.cs.s, prop...)
	return (GraphConstraintDropProp)(c)
}

type GraphDelete Incomplete

func (b Builder) GraphDelete() (c GraphDelete) {
	c = GraphDelete{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GRAPH.DELETE")
	return c
}

func (c GraphDelete) Graph(graph string) GraphDeleteGraph {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(graph)
	} else {
		c.ks = check(c.ks, slot(graph))
	}
	c.cs.s = append(c.cs.s, graph)
	return (GraphDeleteGraph)(c)
}

type GraphDeleteGraph Incomplete

func (c GraphDeleteGraph) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphExplain Incomplete

func (b Builder) GraphExplain() (c GraphExplain) {
	c = GraphExplain{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GRAPH.EXPLAIN")
	return c
}

func (c GraphExplain) Graph(graph string) GraphExplainGraph {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(graph)
	} else {
		c.ks = check(c.ks, slot(graph))
	}
	c.cs.s = append(c.cs.s, graph)
	return (GraphExplainGraph)(c)
}

type GraphExplainGraph Incomplete

func (c GraphExplainGraph) Query(query string) GraphExplainQuery {
	c.cs.s = append(c.cs.s, query)
	return (GraphExplainQuery)(c)
}

type GraphExplainQuery Incomplete

func (c GraphExplainQuery) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphList Incomplete

func (b Builder) GraphList() (c GraphList) {
	c = GraphList{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GRAPH.LIST")
	return c
}

func (c GraphList) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphProfile Incomplete

func (b Builder) GraphProfile() (c GraphProfile) {
	c = GraphProfile{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GRAPH.PROFILE")
	return c
}

func (c GraphProfile) Graph(graph string) GraphProfileGraph {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(graph)
	} else {
		c.ks = check(c.ks, slot(graph))
	}
	c.cs.s = append(c.cs.s, graph)
	return (GraphProfileGraph)(c)
}

type GraphProfileGraph Incomplete

func (c GraphProfileGraph) Query(query string) GraphProfileQuery {
	c.cs.s = append(c.cs.s, query)
	return (GraphProfileQuery)(c)
}

type GraphProfileQuery Incomplete

func (c GraphProfileQuery) Timeout(timeout int64) GraphProfileTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (GraphProfileTimeout)(c)
}

func (c GraphProfileQuery) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphProfileTimeout Incomplete

func (c GraphProfileTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphQuery Incomplete

func (b Builder) GraphQuery() (c GraphQuery) {
	c = GraphQuery{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "GRAPH.QUERY")
	return c
}

func (c GraphQuery) Graph(graph string) GraphQueryGraph {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(graph)
	} else {
		c.ks = check(c.ks, slot(graph))
	}
	c.cs.s = append(c.cs.s, graph)
	return (GraphQueryGraph)(c)
}

type GraphQueryGraph Incomplete

func (c GraphQueryGraph) Query(query string) GraphQueryQuery {
	c.cs.s = append(c.cs.s, query)
	return (GraphQueryQuery)(c)
}

type GraphQueryQuery Incomplete

func (c GraphQueryQuery) Timeout(timeout int64) GraphQueryTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (GraphQueryTimeout)(c)
}

func (c GraphQueryQuery) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphQueryTimeout Incomplete

func (c GraphQueryTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphRoQuery Incomplete

func (b Builder) GraphRoQuery() (c GraphRoQuery) {
	c = GraphRoQuery{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GRAPH.RO_QUERY")
	return c
}

func (c GraphRoQuery) Graph(graph string) GraphRoQueryGraph {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(graph)
	} else {
		c.ks = check(c.ks, slot(graph))
	}
	c.cs.s = append(c.cs.s, graph)
	return (GraphRoQueryGraph)(c)
}

type GraphRoQueryGraph Incomplete

func (c GraphRoQueryGraph) Query(query string) GraphRoQueryQuery {
	c.cs.s = append(c.cs.s, query)
	return (GraphRoQueryQuery)(c)
}

type GraphRoQueryQuery Incomplete

func (c GraphRoQueryQuery) Timeout(timeout int64) GraphRoQueryTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (GraphRoQueryTimeout)(c)
}

func (c GraphRoQueryQuery) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GraphRoQueryQuery) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphRoQueryTimeout Incomplete

func (c GraphRoQueryTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c GraphRoQueryTimeout) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type GraphSlowlog Incomplete

func (b Builder) GraphSlowlog() (c GraphSlowlog) {
	c = GraphSlowlog{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "GRAPH.SLOWLOG")
	return c
}

func (c GraphSlowlog) Graph(graph string) GraphSlowlogGraph {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(graph)
	} else {
		c.ks = check(c.ks, slot(graph))
	}
	c.cs.s = append(c.cs.s, graph)
	return (GraphSlowlogGraph)(c)
}

type GraphSlowlogGraph Incomplete

func (c GraphSlowlogGraph) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
