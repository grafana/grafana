// Code generated DO NOT EDIT

package cmds

type RgAbortexecution Incomplete

func (b Builder) RgAbortexecution() (c RgAbortexecution) {
	c = RgAbortexecution{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.ABORTEXECUTION")
	return c
}

func (c RgAbortexecution) Id(id string) RgAbortexecutionId {
	c.cs.s = append(c.cs.s, id)
	return (RgAbortexecutionId)(c)
}

type RgAbortexecutionId Incomplete

func (c RgAbortexecutionId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgConfigget Incomplete

func (b Builder) RgConfigget() (c RgConfigget) {
	c = RgConfigget{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.CONFIGGET")
	return c
}

func (c RgConfigget) Key(key ...string) RgConfiggetKey {
	c.cs.s = append(c.cs.s, key...)
	return (RgConfiggetKey)(c)
}

type RgConfiggetKey Incomplete

func (c RgConfiggetKey) Key(key ...string) RgConfiggetKey {
	c.cs.s = append(c.cs.s, key...)
	return c
}

func (c RgConfiggetKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgConfigset Incomplete

func (b Builder) RgConfigset() (c RgConfigset) {
	c = RgConfigset{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.CONFIGSET")
	return c
}

func (c RgConfigset) KeyValue() RgConfigsetKeyValue {
	return (RgConfigsetKeyValue)(c)
}

type RgConfigsetKeyValue Incomplete

func (c RgConfigsetKeyValue) KeyValue(key string, value string) RgConfigsetKeyValue {
	c.cs.s = append(c.cs.s, key, value)
	return c
}

func (c RgConfigsetKeyValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgDropexecution Incomplete

func (b Builder) RgDropexecution() (c RgDropexecution) {
	c = RgDropexecution{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.DROPEXECUTION")
	return c
}

func (c RgDropexecution) Id(id string) RgDropexecutionId {
	c.cs.s = append(c.cs.s, id)
	return (RgDropexecutionId)(c)
}

type RgDropexecutionId Incomplete

func (c RgDropexecutionId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgDumpexecutions Incomplete

func (b Builder) RgDumpexecutions() (c RgDumpexecutions) {
	c = RgDumpexecutions{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.DUMPEXECUTIONS")
	return c
}

func (c RgDumpexecutions) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgDumpregistrations Incomplete

func (b Builder) RgDumpregistrations() (c RgDumpregistrations) {
	c = RgDumpregistrations{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.DUMPREGISTRATIONS")
	return c
}

func (c RgDumpregistrations) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgGetexecution Incomplete

func (b Builder) RgGetexecution() (c RgGetexecution) {
	c = RgGetexecution{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.GETEXECUTION")
	return c
}

func (c RgGetexecution) Id(id string) RgGetexecutionId {
	c.cs.s = append(c.cs.s, id)
	return (RgGetexecutionId)(c)
}

type RgGetexecutionId Incomplete

func (c RgGetexecutionId) Shard() RgGetexecutionModeShard {
	c.cs.s = append(c.cs.s, "SHARD")
	return (RgGetexecutionModeShard)(c)
}

func (c RgGetexecutionId) Cluster() RgGetexecutionModeCluster {
	c.cs.s = append(c.cs.s, "CLUSTER")
	return (RgGetexecutionModeCluster)(c)
}

func (c RgGetexecutionId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgGetexecutionModeCluster Incomplete

func (c RgGetexecutionModeCluster) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgGetexecutionModeShard Incomplete

func (c RgGetexecutionModeShard) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgGetresults Incomplete

func (b Builder) RgGetresults() (c RgGetresults) {
	c = RgGetresults{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.GETRESULTS")
	return c
}

func (c RgGetresults) Id(id string) RgGetresultsId {
	c.cs.s = append(c.cs.s, id)
	return (RgGetresultsId)(c)
}

type RgGetresultsId Incomplete

func (c RgGetresultsId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgGetresultsblocking Incomplete

func (b Builder) RgGetresultsblocking() (c RgGetresultsblocking) {
	c = RgGetresultsblocking{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.GETRESULTSBLOCKING")
	return c
}

func (c RgGetresultsblocking) Id(id string) RgGetresultsblockingId {
	c.cs.s = append(c.cs.s, id)
	return (RgGetresultsblockingId)(c)
}

type RgGetresultsblockingId Incomplete

func (c RgGetresultsblockingId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgInfocluster Incomplete

func (b Builder) RgInfocluster() (c RgInfocluster) {
	c = RgInfocluster{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.INFOCLUSTER")
	return c
}

func (c RgInfocluster) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgPydumpreqs Incomplete

func (b Builder) RgPydumpreqs() (c RgPydumpreqs) {
	c = RgPydumpreqs{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.PYDUMPREQS")
	return c
}

func (c RgPydumpreqs) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgPyexecute Incomplete

func (b Builder) RgPyexecute() (c RgPyexecute) {
	c = RgPyexecute{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.PYEXECUTE")
	return c
}

func (c RgPyexecute) Function(function string) RgPyexecuteFunction {
	c.cs.s = append(c.cs.s, function)
	return (RgPyexecuteFunction)(c)
}

type RgPyexecuteDescription Incomplete

func (c RgPyexecuteDescription) Upgrade() RgPyexecuteUpgrade {
	c.cs.s = append(c.cs.s, "UPGRADE")
	return (RgPyexecuteUpgrade)(c)
}

func (c RgPyexecuteDescription) ReplaceWith(replaceWith string) RgPyexecuteReplaceWith {
	c.cs.s = append(c.cs.s, "REPLACE_WITH", replaceWith)
	return (RgPyexecuteReplaceWith)(c)
}

func (c RgPyexecuteDescription) Requirements(requirement ...string) RgPyexecuteRequirementsRequirements {
	c.cs.s = append(c.cs.s, "REQUIREMENTS")
	c.cs.s = append(c.cs.s, requirement...)
	return (RgPyexecuteRequirementsRequirements)(c)
}

func (c RgPyexecuteDescription) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgPyexecuteFunction Incomplete

func (c RgPyexecuteFunction) Unblocking() RgPyexecuteUnblocking {
	c.cs.s = append(c.cs.s, "UNBLOCKING")
	return (RgPyexecuteUnblocking)(c)
}

func (c RgPyexecuteFunction) Id(id string) RgPyexecuteId {
	c.cs.s = append(c.cs.s, "ID", id)
	return (RgPyexecuteId)(c)
}

func (c RgPyexecuteFunction) Description(description string) RgPyexecuteDescription {
	c.cs.s = append(c.cs.s, "DESCRIPTION", description)
	return (RgPyexecuteDescription)(c)
}

func (c RgPyexecuteFunction) Upgrade() RgPyexecuteUpgrade {
	c.cs.s = append(c.cs.s, "UPGRADE")
	return (RgPyexecuteUpgrade)(c)
}

func (c RgPyexecuteFunction) ReplaceWith(replaceWith string) RgPyexecuteReplaceWith {
	c.cs.s = append(c.cs.s, "REPLACE_WITH", replaceWith)
	return (RgPyexecuteReplaceWith)(c)
}

func (c RgPyexecuteFunction) Requirements(requirement ...string) RgPyexecuteRequirementsRequirements {
	c.cs.s = append(c.cs.s, "REQUIREMENTS")
	c.cs.s = append(c.cs.s, requirement...)
	return (RgPyexecuteRequirementsRequirements)(c)
}

func (c RgPyexecuteFunction) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgPyexecuteId Incomplete

func (c RgPyexecuteId) Description(description string) RgPyexecuteDescription {
	c.cs.s = append(c.cs.s, "DESCRIPTION", description)
	return (RgPyexecuteDescription)(c)
}

func (c RgPyexecuteId) Upgrade() RgPyexecuteUpgrade {
	c.cs.s = append(c.cs.s, "UPGRADE")
	return (RgPyexecuteUpgrade)(c)
}

func (c RgPyexecuteId) ReplaceWith(replaceWith string) RgPyexecuteReplaceWith {
	c.cs.s = append(c.cs.s, "REPLACE_WITH", replaceWith)
	return (RgPyexecuteReplaceWith)(c)
}

func (c RgPyexecuteId) Requirements(requirement ...string) RgPyexecuteRequirementsRequirements {
	c.cs.s = append(c.cs.s, "REQUIREMENTS")
	c.cs.s = append(c.cs.s, requirement...)
	return (RgPyexecuteRequirementsRequirements)(c)
}

func (c RgPyexecuteId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgPyexecuteReplaceWith Incomplete

func (c RgPyexecuteReplaceWith) Requirements(requirement ...string) RgPyexecuteRequirementsRequirements {
	c.cs.s = append(c.cs.s, "REQUIREMENTS")
	c.cs.s = append(c.cs.s, requirement...)
	return (RgPyexecuteRequirementsRequirements)(c)
}

func (c RgPyexecuteReplaceWith) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgPyexecuteRequirementsRequirements Incomplete

func (c RgPyexecuteRequirementsRequirements) Requirements(requirement ...string) RgPyexecuteRequirementsRequirements {
	c.cs.s = append(c.cs.s, "REQUIREMENTS")
	c.cs.s = append(c.cs.s, requirement...)
	return c
}

func (c RgPyexecuteRequirementsRequirements) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgPyexecuteUnblocking Incomplete

func (c RgPyexecuteUnblocking) Id(id string) RgPyexecuteId {
	c.cs.s = append(c.cs.s, "ID", id)
	return (RgPyexecuteId)(c)
}

func (c RgPyexecuteUnblocking) Description(description string) RgPyexecuteDescription {
	c.cs.s = append(c.cs.s, "DESCRIPTION", description)
	return (RgPyexecuteDescription)(c)
}

func (c RgPyexecuteUnblocking) Upgrade() RgPyexecuteUpgrade {
	c.cs.s = append(c.cs.s, "UPGRADE")
	return (RgPyexecuteUpgrade)(c)
}

func (c RgPyexecuteUnblocking) ReplaceWith(replaceWith string) RgPyexecuteReplaceWith {
	c.cs.s = append(c.cs.s, "REPLACE_WITH", replaceWith)
	return (RgPyexecuteReplaceWith)(c)
}

func (c RgPyexecuteUnblocking) Requirements(requirement ...string) RgPyexecuteRequirementsRequirements {
	c.cs.s = append(c.cs.s, "REQUIREMENTS")
	c.cs.s = append(c.cs.s, requirement...)
	return (RgPyexecuteRequirementsRequirements)(c)
}

func (c RgPyexecuteUnblocking) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgPyexecuteUpgrade Incomplete

func (c RgPyexecuteUpgrade) ReplaceWith(replaceWith string) RgPyexecuteReplaceWith {
	c.cs.s = append(c.cs.s, "REPLACE_WITH", replaceWith)
	return (RgPyexecuteReplaceWith)(c)
}

func (c RgPyexecuteUpgrade) Requirements(requirement ...string) RgPyexecuteRequirementsRequirements {
	c.cs.s = append(c.cs.s, "REQUIREMENTS")
	c.cs.s = append(c.cs.s, requirement...)
	return (RgPyexecuteRequirementsRequirements)(c)
}

func (c RgPyexecuteUpgrade) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgPystats Incomplete

func (b Builder) RgPystats() (c RgPystats) {
	c = RgPystats{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.PYSTATS")
	return c
}

func (c RgPystats) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgRefreshcluster Incomplete

func (b Builder) RgRefreshcluster() (c RgRefreshcluster) {
	c = RgRefreshcluster{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.REFRESHCLUSTER")
	return c
}

func (c RgRefreshcluster) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgTrigger Incomplete

func (b Builder) RgTrigger() (c RgTrigger) {
	c = RgTrigger{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.TRIGGER")
	return c
}

func (c RgTrigger) Trigger(trigger string) RgTriggerTrigger {
	c.cs.s = append(c.cs.s, trigger)
	return (RgTriggerTrigger)(c)
}

type RgTriggerArgument Incomplete

func (c RgTriggerArgument) Argument(argument ...string) RgTriggerArgument {
	c.cs.s = append(c.cs.s, argument...)
	return c
}

func (c RgTriggerArgument) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type RgTriggerTrigger Incomplete

func (c RgTriggerTrigger) Argument(argument ...string) RgTriggerArgument {
	c.cs.s = append(c.cs.s, argument...)
	return (RgTriggerArgument)(c)
}

type RgUnregister Incomplete

func (b Builder) RgUnregister() (c RgUnregister) {
	c = RgUnregister{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RG.UNREGISTER")
	return c
}

func (c RgUnregister) Id(id string) RgUnregisterId {
	c.cs.s = append(c.cs.s, id)
	return (RgUnregisterId)(c)
}

type RgUnregisterId Incomplete

func (c RgUnregisterId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
