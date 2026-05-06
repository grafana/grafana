package telemetry

// The following attributes are used by the UI to interpret spans and control
// their behavior in the UI.
const (
	// The base64-encoded, protobuf-marshalled callpbv1.Call that this span
	// represents.
	DagCallAttr = "dagger.io/dag.call"

	// The scope of the call.
	//
	// Examples: llm, graphql
	DagCallScopeAttr = "dagger.io/dag.call.scope"

	// The digest of the protobuf-marshalled Call that this span represents.
	//
	// This value acts as a node ID in the conceptual DAG.
	DagDigestAttr = "dagger.io/dag.digest"

	// The list of DAG digests that the span depends on.
	//
	// This is not currently used by the UI, but it could be used to drive higher
	// level DAG walking processes without having to unmarshal the full call.
	DagInputsAttr = "dagger.io/dag.inputs"

	// The DAG call digest that the call returned, if the call returned an
	// Object.
	//
	// This information is used to simplify values in the UI by showing their
	// highest-level creator. For example, if foo().bar() returns a().b().c(), we
	// will show foo().bar() instead of a().b().c() as it will be a more
	// recognizable value to the user.
	DagOutputAttr = "dagger.io/dag.output"

	// Indicates that this span is "internal" and can be hidden by default.
	//
	// Internal spans may typically be revealed with a toggle.
	UIInternalAttr = "dagger.io/ui.internal"

	// Reveal the span all the way up to the top-level parent.
	UIRevealAttr = "dagger.io/ui.reveal"

	// An emoji representing the conceptual source of the span.
	//
	// Example: 🧑, 🤖
	UIActorEmojiAttr = "dagger.io/ui.actor.emoji"

	// Indicates that the span represents a message, and that its logs should be displayed
	// immediately without requiring them to be expanded.
	//
	// The value indicates whether the message is being sent or received.
	//
	// Example: "sent", "received"
	UIMessageAttr = "dagger.io/ui.message"

	// Hide child spans by default.
	//
	// Encapsulated child spans may typically be revealed if the parent span errors.
	UIEncapsulateAttr = "dagger.io/ui.encapsulate"

	// Hide span by default.
	//
	// This is functionally the same as UIEncapsulateAttr, but is instead set
	// on a child instead of a parent.
	UIEncapsulatedAttr = "dagger.io/ui.encapsulated"

	// Substitute the span for its children and move its logs to its parent.
	UIPassthroughAttr = "dagger.io/ui.passthrough" //nolint: gosec // lol

	// NB: the following attributes are not currently used.

	// Indicates that this span was a cache hit and did nothing.
	CachedAttr = "dagger.io/dag.cached"

	// A list of completed effect IDs.
	//
	// This is primarily used for cached ops - since we don't see a span for a
	// cached op's inputs, we'll just say they completed by listing all of them
	// in this attribute.
	EffectsCompletedAttr = "dagger.io/effects.completed"

	// Indicates that this span was interrupted.
	CanceledAttr = "dagger.io/dag.canceled"

	// The IDs of effects which will be correlated to this span.
	//
	// This is typically a list of LLB operation digests, but can be any string.
	EffectIDsAttr = "dagger.io/effect.ids"

	// The ID of the effect that this span represents.
	EffectIDAttr = "dagger.io/effect.id"

	// The amount of progress that needs to be reached.
	ProgressTotalAttr = "dagger.io/progress.total"

	// Current value for the progress.
	ProgressCurrentAttr = "dagger.io/progress.current"

	// Indicates the units for the progress numbers.
	ProgressUnitsAttr = "dagger.io/progress.units"

	// The stdio stream a log corresponds to (1 for stdout, 2 for stderr).
	StdioStreamAttr = "stdio.stream"

	// Indicates whether the log stream has ended.
	StdioEOFAttr = "stdio.eof"

	// The MIME type of the associated content (i.e. log message).
	//
	// Example: text/plain, text/markdown, text/html
	ContentTypeAttr = "dagger.io/content.type"

	// Indicates whether the log should be shown globally.
	LogsGlobalAttr = "dagger.io/logs.global"

	// OTel metric attribute so we can correlate metrics with spans
	MetricsSpanIDAttr = "dagger.io/metrics.span"

	// OTel metric attribute so we can correlate metrics with traces
	MetricsTraceIDAttr = "dagger.io/metrics.trace"

	// The kind of the module, e.g. "LOCAL", "GIT"
	ModuleKindAttr = "dagger.io/module.kind"

	// The commit of the module, e.g. "abc123"
	ModuleCommitAttr = "dagger.io/module.commit"

	// The version of the module, e.g. tag, branch, or commit
	ModuleVersionAttr = "dagger.io/module.version"

	// The subpath of the module, relative to the root, e.g. "/modules/my-module"
	ModuleSubpathAttr = "dagger.io/module.subpath"

	// The HTML URL of the module, e.g. "https://github.com/dagger/dagger"
	ModuleHTMLRepoURLAttr = "dagger.io/module.htmlRepoURL"
)
