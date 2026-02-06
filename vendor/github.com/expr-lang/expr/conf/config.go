package conf

import (
	"fmt"
	"reflect"

	"github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/builtin"
	"github.com/expr-lang/expr/checker/nature"
	"github.com/expr-lang/expr/vm/runtime"
)

var (
	// DefaultMemoryBudget represents default maximum allowed memory usage by the vm.VM.
	DefaultMemoryBudget uint = 1e6

	// DefaultMaxNodes represents default maximum allowed AST nodes by the compiler.
	DefaultMaxNodes uint = 1e4
)

type FunctionsTable map[string]*builtin.Function

type Config struct {
	EnvObject    any
	Env          nature.Nature
	Expect       reflect.Kind
	ExpectAny    bool
	Optimize     bool
	Strict       bool
	ShortCircuit bool
	Profile      bool
	MaxNodes     uint
	ConstFns     map[string]reflect.Value
	Visitors     []ast.Visitor
	Functions    FunctionsTable
	Builtins     FunctionsTable
	Disabled     map[string]bool // disabled builtins
	NtCache      nature.Cache
	// DisableIfOperator disables the built-in `if ... { } else { }` operator syntax
	// so that users can use a custom function named `if(...)` without conflicts.
	// When enabled, the lexer treats `if`/`else` as identifiers and the parser
	// will not parse `if` statements.
	DisableIfOperator bool
}

// CreateNew creates new config with default values.
func CreateNew() *Config {
	c := &Config{
		Optimize:     true,
		ShortCircuit: true,
		MaxNodes:     DefaultMaxNodes,
		ConstFns:     make(map[string]reflect.Value),
		Functions:    make(map[string]*builtin.Function),
		Builtins:     make(map[string]*builtin.Function),
		Disabled:     make(map[string]bool),
	}
	for _, f := range builtin.Builtins {
		c.Builtins[f.Name] = f
	}
	return c
}

// New creates new config with environment.
func New(env any) *Config {
	c := CreateNew()
	c.WithEnv(env)
	return c
}

func (c *Config) WithEnv(env any) {
	c.EnvObject = env
	c.Env = EnvWithCache(&c.NtCache, env)
	c.Strict = c.Env.Strict
}

func (c *Config) ConstExpr(name string) {
	if c.EnvObject == nil {
		panic("no environment is specified for ConstExpr()")
	}
	fn := reflect.ValueOf(runtime.Fetch(c.EnvObject, name))
	if fn.Kind() != reflect.Func {
		panic(fmt.Errorf("const expression %q must be a function", name))
	}
	c.ConstFns[name] = fn
}

type Checker interface {
	Check()
}

func (c *Config) Check() {
	for _, v := range c.Visitors {
		if c, ok := v.(Checker); ok {
			c.Check()
		}
	}
}

func (c *Config) IsOverridden(name string) bool {
	if _, ok := c.Functions[name]; ok {
		return true
	}
	if _, ok := c.Env.Get(&c.NtCache, name); ok {
		return true
	}
	return false
}
