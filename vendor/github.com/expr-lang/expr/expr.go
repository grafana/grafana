package expr

import (
	"errors"
	"fmt"
	"reflect"
	"time"

	"github.com/expr-lang/expr/ast"
	"github.com/expr-lang/expr/builtin"
	"github.com/expr-lang/expr/checker"
	"github.com/expr-lang/expr/compiler"
	"github.com/expr-lang/expr/conf"
	"github.com/expr-lang/expr/file"
	"github.com/expr-lang/expr/optimizer"
	"github.com/expr-lang/expr/parser"
	"github.com/expr-lang/expr/patcher"
	"github.com/expr-lang/expr/vm"
)

// Option for configuring config.
type Option func(c *conf.Config)

// Env specifies expected input of env for type checks.
// If struct is passed, all fields will be treated as variables,
// as well as all fields of embedded structs and struct itself.
// If map is passed, all items will be treated as variables.
// Methods defined on this type will be available as functions.
func Env(env any) Option {
	return func(c *conf.Config) {
		c.WithEnv(env)
	}
}

// AllowUndefinedVariables allows to use undefined variables inside expressions.
// This can be used with expr.Env option to partially define a few variables.
func AllowUndefinedVariables() Option {
	return func(c *conf.Config) {
		c.Strict = false
	}
}

// Operator allows to replace a binary operator with a function.
func Operator(operator string, fn ...string) Option {
	return func(c *conf.Config) {
		p := &patcher.OperatorOverloading{
			Operator:  operator,
			Overloads: fn,
			Env:       &c.Env,
			Functions: c.Functions,
			NtCache:   &c.NtCache,
		}
		c.Visitors = append(c.Visitors, p)
	}
}

// ConstExpr defines func expression as constant. If all argument to this function is constants,
// then it can be replaced by result of this func call on compile step.
func ConstExpr(fn string) Option {
	return func(c *conf.Config) {
		c.ConstExpr(fn)
	}
}

// AsAny tells the compiler to expect any result.
func AsAny() Option {
	return func(c *conf.Config) {
		c.ExpectAny = true
	}
}

// AsKind tells the compiler to expect kind of the result.
func AsKind(kind reflect.Kind) Option {
	return func(c *conf.Config) {
		c.Expect = kind
		c.ExpectAny = true
	}
}

// AsBool tells the compiler to expect a boolean result.
func AsBool() Option {
	return func(c *conf.Config) {
		c.Expect = reflect.Bool
		c.ExpectAny = true
	}
}

// AsInt tells the compiler to expect an int result.
func AsInt() Option {
	return func(c *conf.Config) {
		c.Expect = reflect.Int
		c.ExpectAny = true
	}
}

// AsInt64 tells the compiler to expect an int64 result.
func AsInt64() Option {
	return func(c *conf.Config) {
		c.Expect = reflect.Int64
		c.ExpectAny = true
	}
}

// AsFloat64 tells the compiler to expect a float64 result.
func AsFloat64() Option {
	return func(c *conf.Config) {
		c.Expect = reflect.Float64
		c.ExpectAny = true
	}
}

// DisableIfOperator disables the `if ... else ...` operator syntax so a custom
// function named `if(...)` can be used without conflicts.
func DisableIfOperator() Option {
	return func(c *conf.Config) {
		c.DisableIfOperator = true
	}
}

// WarnOnAny tells the compiler to warn if expression return any type.
func WarnOnAny() Option {
	return func(c *conf.Config) {
		if c.Expect == reflect.Invalid {
			panic("WarnOnAny() works only with combination with AsInt(), AsBool(), etc. options")
		}
		c.ExpectAny = false
	}
}

// Optimize turns optimizations on or off.
func Optimize(b bool) Option {
	return func(c *conf.Config) {
		c.Optimize = b
	}
}

// DisableShortCircuit turns short circuit off.
func DisableShortCircuit() Option {
	return func(c *conf.Config) {
		c.ShortCircuit = false
	}
}

// Patch adds visitor to list of visitors what will be applied before compiling AST to bytecode.
func Patch(visitor ast.Visitor) Option {
	return func(c *conf.Config) {
		c.Visitors = append(c.Visitors, visitor)
	}
}

// Function adds function to list of functions what will be available in expressions.
func Function(name string, fn func(params ...any) (any, error), types ...any) Option {
	return func(c *conf.Config) {
		ts := make([]reflect.Type, len(types))
		for i, t := range types {
			t := reflect.TypeOf(t)
			if t.Kind() == reflect.Ptr {
				t = t.Elem()
			}
			if t.Kind() != reflect.Func {
				panic(fmt.Sprintf("expr: type of %s is not a function", name))
			}
			ts[i] = t
		}
		c.Functions[name] = &builtin.Function{
			Name:  name,
			Func:  fn,
			Types: ts,
		}
	}
}

// DisableAllBuiltins disables all builtins.
func DisableAllBuiltins() Option {
	return func(c *conf.Config) {
		for name := range c.Builtins {
			c.Disabled[name] = true
		}
	}
}

// DisableBuiltin disables builtin function.
func DisableBuiltin(name string) Option {
	return func(c *conf.Config) {
		c.Disabled[name] = true
	}
}

// EnableBuiltin enables builtin function.
func EnableBuiltin(name string) Option {
	return func(c *conf.Config) {
		delete(c.Disabled, name)
	}
}

// WithContext passes context to all functions calls with a context.Context argument.
func WithContext(name string) Option {
	return Patch(patcher.WithContext{
		Name: name,
	})
}

// Timezone sets default timezone for date() and now() builtin functions.
func Timezone(name string) Option {
	tz, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return Patch(patcher.WithTimezone{
		Location: tz,
	})
}

// MaxNodes sets the maximum number of nodes allowed in the expression.
// By default, the maximum number of nodes is conf.DefaultMaxNodes.
// If MaxNodes is set to 0, the node budget check is disabled.
func MaxNodes(n uint) Option {
	return func(c *conf.Config) {
		c.MaxNodes = n
	}
}

// Compile parses and compiles given input expression to bytecode program.
func Compile(input string, ops ...Option) (*vm.Program, error) {
	config := conf.CreateNew()
	for _, op := range ops {
		op(config)
	}
	for name := range config.Disabled {
		delete(config.Builtins, name)
	}
	config.Check()

	tree, err := checker.ParseCheck(input, config)
	if err != nil {
		return nil, err
	}

	if config.Optimize {
		err = optimizer.Optimize(&tree.Node, config)
		if err != nil {
			var fileError *file.Error
			if errors.As(err, &fileError) {
				return nil, fileError.Bind(tree.Source)
			}
			return nil, err
		}
	}

	program, err := compiler.Compile(tree, config)
	if err != nil {
		return nil, err
	}

	return program, nil
}

// Run evaluates given bytecode program.
func Run(program *vm.Program, env any) (any, error) {
	return vm.Run(program, env)
}

// Eval parses, compiles and runs given input.
func Eval(input string, env any) (any, error) {
	if _, ok := env.(Option); ok {
		return nil, fmt.Errorf("misused expr.Eval: second argument (env) should be passed without expr.Env")
	}

	tree, err := parser.Parse(input)
	if err != nil {
		return nil, err
	}

	program, err := compiler.Compile(tree, nil)
	if err != nil {
		return nil, err
	}

	output, err := Run(program, env)
	if err != nil {
		return nil, err
	}

	return output, nil
}
