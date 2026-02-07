// Copyright 2020-2021 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package analyzer

import (
	"fmt"
	"io"
	"os"
	"reflect"
	"runtime/trace"
	"strings"

	"github.com/pmezard/go-difflib/difflib"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/attribute"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/memo"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/rowexec"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

const debugAnalyzerKey = "DEBUG_ANALYZER"
const verboseAnalyzerKey = "VERBOSE_ANALYZER"

const maxAnalysisIterations = 8

// ErrMaxAnalysisIters is thrown when the analysis iterations are exceeded
var ErrMaxAnalysisIters = errors.NewKind("exceeded max analysis iterations (%d)")

// ErrInAnalysis is thrown for generic analyzer errors
var ErrInAnalysis = errors.NewKind("error in analysis: %s")

// ErrInvalidNodeType is thrown when the analyzer can't handle a particular kind of node type
var ErrInvalidNodeType = errors.NewKind("%s: invalid node of type: %T")

const disablePrepareStmtKey = "DISABLE_PREPARED_STATEMENTS"

var PreparedStmtDisabled bool

func init() {
	if v := os.Getenv(disablePrepareStmtKey); v != "" {
		PreparedStmtDisabled = true
	}
}

func SetPreparedStmts(v bool) {
	PreparedStmtDisabled = v
}

// Builder provides an easy way to generate Analyzer with custom rules and options.
type Builder struct {
	provider            sql.DatabaseProvider
	preAnalyzeRules     []Rule
	postAnalyzeRules    []Rule
	preValidationRules  []Rule
	postValidationRules []Rule
	onceBeforeRules     []Rule
	defaultRules        []Rule
	onceAfterRules      []Rule
	validationRules     []Rule
	afterAllRules       []Rule
	debug               bool
}

// NewBuilder creates a new Builder from a specific catalog.
// This builder allow us to add custom Rules and modify some internal properties.
func NewBuilder(pro sql.DatabaseProvider) *Builder {
	allBeforeDefault := make([]Rule, len(OnceBeforeDefault)+len(AlwaysBeforeDefault))
	copy(allBeforeDefault, OnceBeforeDefault)
	copy(allBeforeDefault[len(OnceBeforeDefault):], AlwaysBeforeDefault)
	return &Builder{
		provider:        pro,
		onceBeforeRules: allBeforeDefault,
		defaultRules:    DefaultRules,
		onceAfterRules:  OnceAfterDefault,
		validationRules: DefaultValidationRules,
		afterAllRules:   OnceAfterAll,
	}
}

// WithDebug activates debug on the Analyzer.
func (ab *Builder) WithDebug() *Builder {
	ab.debug = true

	return ab
}

// AddPreAnalyzeRule adds a new rule to the analyze before the standard analyzer rules.
func (ab *Builder) AddPreAnalyzeRule(id RuleId, fn RuleFunc) *Builder {
	ab.preAnalyzeRules = append(ab.preAnalyzeRules, Rule{Id: id, Apply: fn})

	return ab
}

// AddPostAnalyzeRule adds a new rule to the analyzer after standard analyzer rules.
func (ab *Builder) AddPostAnalyzeRule(id RuleId, fn RuleFunc) *Builder {
	ab.postAnalyzeRules = append(ab.postAnalyzeRules, Rule{Id: id, Apply: fn})

	return ab
}

// AddPreValidationRule adds a new rule to the analyzer before standard validation rules.
func (ab *Builder) AddPreValidationRule(id RuleId, fn RuleFunc) *Builder {
	ab.preValidationRules = append(ab.preValidationRules, Rule{Id: id, Apply: fn})

	return ab
}

// AddPostValidationRule adds a new rule to the analyzer after standard validation rules.
func (ab *Builder) AddPostValidationRule(id RuleId, fn RuleFunc) *Builder {
	ab.postValidationRules = append(ab.postValidationRules, Rule{Id: id, Apply: fn})

	return ab
}

func duplicateRulesWithout(rules []Rule, excludedRuleId RuleId) []Rule {
	newRules := make([]Rule, 0, len(rules))

	for _, rule := range rules {
		if rule.Id != excludedRuleId {
			newRules = append(newRules, rule)
		}
	}

	return newRules
}

// RemoveOnceBeforeRule removes a default rule from the analyzer which would occur before other rules
func (ab *Builder) RemoveOnceBeforeRule(id RuleId) *Builder {
	ab.onceBeforeRules = duplicateRulesWithout(ab.onceBeforeRules, id)

	return ab
}

// RemoveDefaultRule removes a default rule from the analyzer that is executed as part of the analysis
func (ab *Builder) RemoveDefaultRule(id RuleId) *Builder {
	ab.defaultRules = duplicateRulesWithout(ab.defaultRules, id)

	return ab
}

// RemoveOnceAfterRule removes a default rule from the analyzer which would occur just once after the default analysis
func (ab *Builder) RemoveOnceAfterRule(id RuleId) *Builder {
	ab.onceAfterRules = duplicateRulesWithout(ab.onceAfterRules, id)

	return ab
}

// RemoveValidationRule removes a default rule from the analyzer which would occur as part of the validation rules
func (ab *Builder) RemoveValidationRule(id RuleId) *Builder {
	ab.validationRules = duplicateRulesWithout(ab.validationRules, id)

	return ab
}

// RemoveAfterAllRule removes a default rule from the analyzer which would occur after all other rules
func (ab *Builder) RemoveAfterAllRule(id RuleId) *Builder {
	ab.afterAllRules = duplicateRulesWithout(ab.afterAllRules, id)

	return ab
}

var log = logrus.New()

func SetOutput(w io.Writer) {
	log.SetOutput(w)
}

func init() {
	// TODO: give the option for debug analyzer logging format to match the global one
	log.SetFormatter(simpleLogFormatter{})
}

type simpleLogFormatter struct{}

func (s simpleLogFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	lvl := ""
	switch entry.Level {
	case logrus.PanicLevel:
		lvl = "PANIC"
	case logrus.FatalLevel:
		lvl = "FATAL"
	case logrus.ErrorLevel:
		lvl = "ERROR"
	case logrus.WarnLevel:
		lvl = "WARN"
	case logrus.InfoLevel:
		lvl = "INFO"
	case logrus.DebugLevel:
		lvl = "DEBUG"
	case logrus.TraceLevel:
		lvl = "TRACE"
	}

	msg := fmt.Sprintf("%s: %s\n", lvl, entry.Message)
	return ([]byte)(msg), nil
}

// Build creates a new Analyzer from the builder parameters
func (ab *Builder) Build() *Analyzer {
	_, debug := os.LookupEnv(debugAnalyzerKey)
	_, verbose := os.LookupEnv(verboseAnalyzerKey)
	var batches = []*Batch{
		{
			Desc:       "pre-analyzer",
			Iterations: maxAnalysisIterations,
			Rules:      ab.preAnalyzeRules,
		},
		{
			Desc:       "once-before",
			Iterations: 1,
			Rules:      ab.onceBeforeRules,
		},
		{
			Desc:       "default-rules",
			Iterations: maxAnalysisIterations,
			Rules:      ab.defaultRules,
		},
		{
			Desc:       "once-after",
			Iterations: 1,
			Rules:      ab.onceAfterRules,
		},
		{
			Desc:       "post-analyzer",
			Iterations: maxAnalysisIterations,
			Rules:      ab.postAnalyzeRules,
		},
		{
			Desc:       "pre-validation",
			Iterations: 1,
			Rules:      ab.preValidationRules,
		},
		{
			Desc:       "validation",
			Iterations: 1,
			Rules:      ab.validationRules,
		},
		{
			Desc:       "post-validation",
			Iterations: 1,
			Rules:      ab.postValidationRules,
		},
		{
			Desc:       "after-all",
			Iterations: 1,
			Rules:      ab.afterAllRules,
		},
	}

	return &Analyzer{
		Debug:           debug || ab.debug,
		Verbose:         verbose,
		contextStack:    make([]string, 0),
		Batches:         batches,
		Catalog:         NewCatalog(ab.provider),
		Coster:          memo.NewDefaultCoster(),
		ExecBuilder:     rowexec.DefaultBuilder,
		Parser:          sql.GlobalParser,
		SchemaFormatter: sql.GlobalSchemaFormatter,
	}
}

// Analyzer analyzes nodes of the execution plan and applies rules and validations
// to them.
type Analyzer struct {
	// Coster estimates the incremental CPU+memory cost for execution operators.
	Coster memo.Coster
	// Parser is the parser used to parse SQL statements.
	Parser sql.Parser
	// ExecBuilder converts a sql.Node tree into an executable iterator.
	ExecBuilder sql.NodeExecBuilder
	// Runner represents the engine, which is represented as a separate interface to work around circular dependencies
	Runner sql.StatementRunner
	// SchemaFormatter is used to format the schema of a node to a string.
	SchemaFormatter sql.SchemaFormatter
	// Catalog of databases and registered functions.
	Catalog *Catalog
	// A stack of debugger context. See PushDebugContext, PopDebugContext
	contextStack []string
	// Batches of Rules to apply.
	Batches []*Batch
	// Whether to log various debugging messages
	Debug bool
	// Whether to output the query plan at each step of the analyzer
	Verbose bool
}

// NewDefault creates a default Analyzer instance with all default Rules and configuration.
// To add custom rules, the easiest way is use the Builder.
func NewDefault(provider sql.DatabaseProvider) *Analyzer {
	return NewBuilder(provider).Build()
}

// NewDefaultWithVersion creates a default Analyzer instance either
// experimental or
func NewDefaultWithVersion(provider sql.DatabaseProvider) *Analyzer {
	return NewBuilder(provider).Build()
}

// Log prints an INFO message to stdout with the given message and args
// if the analyzer is in debug mode.
func (a *Analyzer) Log(msg string, args ...interface{}) {
	if a != nil && a.Debug {
		if len(a.contextStack) > 0 {
			ctx := strings.Join(a.contextStack, "/")
			log.Infof("%s: "+msg, append([]interface{}{ctx}, args...)...)
		} else {
			log.Infof(msg, args...)
		}
	}
}

func (a *Analyzer) LogFn() func(string, ...any) {
	return func(msg string, args ...interface{}) {
		if a != nil && a.Debug {
			if len(a.contextStack) > 0 {
				ctx := strings.Join(a.contextStack, "/")
				log.Infof("%s: "+msg, append([]interface{}{ctx}, args...)...)
			} else {
				log.Infof(msg, args...)
			}
		}
	}
}

// LogNode prints the node given if Verbose logging is enabled.
func (a *Analyzer) LogNode(n sql.Node) {
	if a != nil && n != nil && a.Verbose {
		if len(a.contextStack) > 0 {
			ctx := strings.Join(a.contextStack, "/")
			log.Infof("%s:\n%s", ctx, sql.DebugString(n))
		} else {
			log.Infof("%s", sql.DebugString(n))
		}
	}
}

// LogDiff logs the diff between the query plans after a transformation rules has been applied.
// Only can print a diff when the string representations of the nodes differ, which isn't always the case.
func (a *Analyzer) LogDiff(prev, next sql.Node) {
	if a.Debug && a.Verbose {
		if !reflect.DeepEqual(next, prev) {
			diff, err := difflib.GetUnifiedDiffString(difflib.UnifiedDiff{
				A:        difflib.SplitLines(sql.DebugString(prev)),
				B:        difflib.SplitLines(sql.DebugString(next)),
				FromFile: "Prev",
				FromDate: "",
				ToFile:   "Next",
				ToDate:   "",
				Context:  1,
			})
			if err != nil {
				panic(err)
			}
			if len(diff) > 0 {
				a.Log("%s", diff)
			} else {
				a.Log("nodes are different, but no textual diff found (implement better DebugString?)")
			}
		}
	}
}

// PushDebugContext pushes the given context string onto the context stack, to use when logging debug messages.
func (a *Analyzer) PushDebugContext(msg string) {
	if a != nil && a.Debug {
		a.contextStack = append(a.contextStack, msg)
	}
}

// PopDebugContext pops a context message off the context stack.
func (a *Analyzer) PopDebugContext() {
	if a != nil && len(a.contextStack) > 0 {
		a.contextStack = a.contextStack[:len(a.contextStack)-1]
	}
}

func SelectAllBatches(string) bool { return true }

func DefaultRuleSelector(id RuleId) bool {
	return true
}

func NewProcRuleSelector(sel RuleSelector) RuleSelector {
	return func(id RuleId) bool {
		switch id {
		case pruneTablesId,
			unnestInSubqueriesId,
			// once after default rules should only be run once
			TrackProcessId:
			return false
		}
		return sel(id)
	}
}

func NewResolveSubqueryExprSelector(sel RuleSelector) RuleSelector {
	return func(id RuleId) bool {
		switch id {
		case
			// skip recursive finalize rules
			hoistOutOfScopeFiltersId,
			unnestExistsSubqueriesId,
			unnestInSubqueriesId,
			finalizeSubqueriesId,
			assignExecIndexesId:
			return false
		}
		return sel(id)
	}
}

func NewFinalizeSubquerySel(sel RuleSelector) RuleSelector {
	return func(id RuleId) bool {
		switch id {
		case
			// skip recursive resolve rules
			resolveSubqueriesId,
			resolveUnionsId,
			// skip redundant finalize rules
			finalizeSubqueriesId,
			hoistOutOfScopeFiltersId,
			TrackProcessId,
			assignExecIndexesId:
			return false
		}
		return sel(id)
	}
}

func NewFinalizeUnionSel(sel RuleSelector) RuleSelector {
	return func(id RuleId) bool {
		switch id {
		case
			// skip recursive resolve rules
			resolveSubqueriesId,
			resolveUnionsId,
			// skip redundant finalize rules
			assignExecIndexesId:
			return false
		case finalizeSubqueriesId,
			hoistOutOfScopeFiltersId:
			return true
		}
		return sel(id)
	}
}

func newInsertSourceSelector(sel RuleSelector) RuleSelector {
	return func(id RuleId) bool {
		switch id {
		case unnestInSubqueriesId,
			pushdownSubqueryAliasFiltersId:
			return false
		}
		return sel(id)
	}
}

// Analyze applies the transformation rules to the node given. In the case of an error, the last successfully
// transformed node is returned along with the error.
func (a *Analyzer) Analyze(ctx *sql.Context, node sql.Node, scope *plan.Scope, qFlags *sql.QueryFlags) (sql.Node, error) {
	switch n := node.(type) {
	case *plan.DescribeQuery:
		child, _, err := a.analyzeWithSelector(ctx, n.Query(), scope, SelectAllBatches, DefaultRuleSelector, qFlags)
		qFlags.Unset(sql.QFlagMax1Row) // the rule replaceCountStar can set this incorrectly for queries containing count(*).
		return n.WithQuery(child), err
	}
	node, _, err := a.analyzeWithSelector(ctx, node, scope, SelectAllBatches, DefaultRuleSelector, qFlags)
	return node, err
}

func (a *Analyzer) analyzeThroughBatch(ctx *sql.Context, n sql.Node, scope *plan.Scope, until string, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	stop := false
	return a.analyzeWithSelector(ctx, n, scope, func(desc string) bool {
		if stop {
			return false
		}
		if desc == until {
			stop = true
		}
		// we return true even for the matching description; only start
		// returning false after this batch.
		return true
	}, sel, qFlags)
}

// Every time we recursively invoke the analyzer we increment a depth counter to avoid analyzing queries that could
// cause infinite recursion. This limit is high but arbitrary
const maxBatchRecursion = 100

func (a *Analyzer) analyzeWithSelector(ctx *sql.Context, n sql.Node, scope *plan.Scope, batchSelector BatchSelector, ruleSelector RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("analyze")
	defer trace.StartRegion(ctx, "Analyzer.analyzeWithSelector").End()

	if scope.RecursionDepth() > maxBatchRecursion {
		return n, transform.SameTree, ErrMaxAnalysisIters.New(maxBatchRecursion)
	}

	var (
		same    = transform.SameTree
		allSame = transform.SameTree
		err     error
	)
	a.Log("starting analysis of node of type: %T", n)
	a.LogNode(n)

	batches := a.Batches
	if b, ok := getBatchesForNode(n); ok {
		batches = b
	}

	for _, batch := range batches {
		if batchSelector(batch.Desc) {
			a.PushDebugContext(batch.Desc)
			n, same, err = batch.Eval(ctx, a, n, scope, ruleSelector, qFlags)
			allSame = allSame && same
			if err != nil {
				a.Log("Encountered error: %v", err)
				a.PopDebugContext()
				return n, transform.SameTree, err
			}
			a.PopDebugContext()
		}
	}

	defer func() {
		if n != nil {
			span.SetAttributes(attribute.Bool("IsResolved", n.Resolved()))
		}
		span.End()
	}()

	return n, allSame, err
}

func (a *Analyzer) analyzeStartingAtBatch(ctx *sql.Context, n sql.Node, scope *plan.Scope, startAt string, sel RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	start := false
	return a.analyzeWithSelector(ctx, n, scope, func(desc string) bool {
		if desc == startAt {
			start = true
		}
		if start {
			return true
		}
		return false
	}, sel, qFlags)
}

func DeepCopyNode(node sql.Node) (sql.Node, error) {
	n, _, err := transform.NodeExprs(node, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		e, err := transform.Clone(e)
		return e, transform.NewTree, err
	})
	return n, err
}

// FlagIsSet returns whether a set of query flag has the |flag| bit marked,
// or a default value if |flags| is nil. Flags for rule selecting are
// enabled by default (true), flags for execution behavior are disabled by
// default (false).
func FlagIsSet(flags *sql.QueryFlags, flag int) bool {
	if flags == nil {
		switch flag {
		case sql.QFlagMax1Row:
			// no spooling shortcuts
			return false
		default:
			// default behavior with |nil| flags is execute all
			// analyzer rules
			return true

		}
	}
	return flags.IsSet(flag)
}
