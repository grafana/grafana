package mg

import (
	"context"
	"fmt"
	"log"
	"os"
	"reflect"
	"runtime"
	"strings"
	"sync"
)

var logger = log.New(os.Stderr, "", 0)

type onceMap struct {
	mu *sync.Mutex
	m  map[onceKey]*onceFun
}

type onceKey struct {
	Name string
	ID   string
}

func (o *onceMap) LoadOrStore(f Fn) *onceFun {
	defer o.mu.Unlock()
	o.mu.Lock()

	key := onceKey{
		Name: f.Name(),
		ID:   f.ID(),
	}
	existing, ok := o.m[key]
	if ok {
		return existing
	}
	one := &onceFun{
		once:        &sync.Once{},
		fn:          f,
		displayName: displayName(f.Name()),
	}
	o.m[key] = one
	return one
}

var onces = &onceMap{
	mu: &sync.Mutex{},
	m:  map[onceKey]*onceFun{},
}

// SerialDeps is like Deps except it runs each dependency serially, instead of
// in parallel. This can be useful for resource intensive dependencies that
// shouldn't be run at the same time.
func SerialDeps(fns ...interface{}) {
	funcs := checkFns(fns)
	ctx := context.Background()
	for i := range fns {
		runDeps(ctx, funcs[i:i+1])
	}
}

// SerialCtxDeps is like CtxDeps except it runs each dependency serially,
// instead of in parallel. This can be useful for resource intensive
// dependencies that shouldn't be run at the same time.
func SerialCtxDeps(ctx context.Context, fns ...interface{}) {
	funcs := checkFns(fns)
	for i := range fns {
		runDeps(ctx, funcs[i:i+1])
	}
}

// CtxDeps runs the given functions as dependencies of the calling function.
// Dependencies must only be of type:
//     func()
//     func() error
//     func(context.Context)
//     func(context.Context) error
// Or a similar method on a mg.Namespace type.
// Or an mg.Fn interface.
//
// The function calling Deps is guaranteed that all dependent functions will be
// run exactly once when Deps returns.  Dependent functions may in turn declare
// their own dependencies using Deps. Each dependency is run in their own
// goroutines. Each function is given the context provided if the function
// prototype allows for it.
func CtxDeps(ctx context.Context, fns ...interface{}) {
	funcs := checkFns(fns)
	runDeps(ctx, funcs)
}

// runDeps assumes you've already called checkFns.
func runDeps(ctx context.Context, fns []Fn) {
	mu := &sync.Mutex{}
	var errs []string
	var exit int
	wg := &sync.WaitGroup{}
	for _, f := range fns {
		fn := onces.LoadOrStore(f)
		wg.Add(1)
		go func() {
			defer func() {
				if v := recover(); v != nil {
					mu.Lock()
					if err, ok := v.(error); ok {
						exit = changeExit(exit, ExitStatus(err))
					} else {
						exit = changeExit(exit, 1)
					}
					errs = append(errs, fmt.Sprint(v))
					mu.Unlock()
				}
				wg.Done()
			}()
			if err := fn.run(ctx); err != nil {
				mu.Lock()
				errs = append(errs, fmt.Sprint(err))
				exit = changeExit(exit, ExitStatus(err))
				mu.Unlock()
			}
		}()
	}

	wg.Wait()
	if len(errs) > 0 {
		panic(Fatal(exit, strings.Join(errs, "\n")))
	}
}

func checkFns(fns []interface{}) []Fn {
	funcs := make([]Fn, len(fns))
	for i, f := range fns {
		if fn, ok := f.(Fn); ok {
			funcs[i] = fn
			continue
		}

		// Check if the target provided is a not function so we can give a clear warning
		t := reflect.TypeOf(f)
		if t == nil || t.Kind() != reflect.Func {
			panic(fmt.Errorf("non-function used as a target dependency: %T. The mg.Deps, mg.SerialDeps and mg.CtxDeps functions accept function names, such as mg.Deps(TargetA, TargetB)", f))
		}

		funcs[i] = F(f)
	}
	return funcs
}

// Deps runs the given functions in parallel, exactly once. Dependencies must
// only be of type:
//     func()
//     func() error
//     func(context.Context)
//     func(context.Context) error
// Or a similar method on a mg.Namespace type.
// Or an mg.Fn interface.
//
// This is a way to build up a tree of dependencies with each dependency
// defining its own dependencies.  Functions must have the same signature as a
// Mage target, i.e. optional context argument, optional error return.
func Deps(fns ...interface{}) {
	CtxDeps(context.Background(), fns...)
}

func changeExit(old, new int) int {
	if new == 0 {
		return old
	}
	if old == 0 {
		return new
	}
	if old == new {
		return old
	}
	// both different and both non-zero, just set
	// exit to 1. Nothing more we can do.
	return 1
}

// funcName returns the unique name for the function
func funcName(i interface{}) string {
	return runtime.FuncForPC(reflect.ValueOf(i).Pointer()).Name()
}

func displayName(name string) string {
	splitByPackage := strings.Split(name, ".")
	if len(splitByPackage) == 2 && splitByPackage[0] == "main" {
		return splitByPackage[len(splitByPackage)-1]
	}
	return name
}

type onceFun struct {
	once *sync.Once
	fn   Fn
	err  error

	displayName string
}

// run will run the function exactly once and capture the error output. Further runs simply return
// the same error output.
func (o *onceFun) run(ctx context.Context) error {
	o.once.Do(func() {
		if Verbose() {
			logger.Println("Running dependency:", displayName(o.fn.Name()))
		}
		o.err = o.fn.Run(ctx)
	})
	return o.err
}
