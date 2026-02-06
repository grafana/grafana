// Copyright 2019 Gregory Petrosyan <gregory.petrosyan@gmail.com>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

package rapid

import (
	"reflect"
	"sort"
	"testing"
)

const (
	actionLabel       = "action"
	validActionTries  = 100 // hack, but probably good enough for now
	checkMethodName   = "Check"
	noValidActionsMsg = "can't find a valid (non-skipped) action"
)

// Repeat executes a random sequence of actions (often called a "state machine" test).
// actions[""], if set, is executed before/after every other action invocation
// and should only contain invariant checking code.
//
// For complex state machines, it can be more convenient to specify actions as
// methods of a special state machine type. In this case, [StateMachineActions]
// can be used to create an actions map from state machine methods using reflection.
func (t *T) Repeat(actions map[string]func(*T)) {
	t.Helper()

	check := func(*T) {}
	actionKeys := make([]string, 0, len(actions))
	for key, action := range actions {
		if key != "" {
			actionKeys = append(actionKeys, key)
		} else {
			check = action
		}
	}
	if len(actionKeys) == 0 {
		return
	}
	sort.Strings(actionKeys)

	steps := flags.steps
	if testing.Short() {
		steps /= 2
	}

	repeat := newRepeat(-1, -1, float64(steps), "Repeat")
	sm := stateMachine{
		check:      check,
		actionKeys: SampledFrom(actionKeys),
		actions:    actions,
	}

	sm.check(t)
	t.failOnError()
	for repeat.more(t.s) {
		ok := sm.executeAction(t)
		if ok {
			sm.check(t)
			t.failOnError()
		} else {
			repeat.reject()
		}
	}
}

type StateMachine interface {
	// Check is ran after every action and should contain invariant checks.
	//
	// All other public methods should have a form ActionName(t *rapid.T)
	// or ActionName(t rapid.TB) and are used as possible actions.
	// At least one action has to be specified.
	Check(*T)
}

// StateMachineActions creates an actions map for [*T.Repeat]
// from methods of a [StateMachine] type instance using reflection.
func StateMachineActions(sm StateMachine) map[string]func(*T) {
	var (
		v = reflect.ValueOf(sm)
		t = v.Type()
		n = t.NumMethod()
	)

	actions := make(map[string]func(*T), n)
	for i := 0; i < n; i++ {
		name := t.Method(i).Name

		if name == checkMethodName {
			continue
		}

		m, ok := v.Method(i).Interface().(func(*T))
		if ok {
			actions[name] = m
		}

		m2, ok := v.Method(i).Interface().(func(TB))
		if ok {
			actions[name] = func(t *T) {
				m2(t)
			}
		}
	}

	assertf(len(actions) > 0, "state machine of type %v has no actions specified", t)
	actions[""] = sm.Check

	return actions
}

type stateMachine struct {
	check      func(*T)
	actionKeys *Generator[string]
	actions    map[string]func(*T)
}

func (sm *stateMachine) executeAction(t *T) bool {
	t.Helper()

	for n := 0; n < validActionTries; n++ {
		i := t.s.beginGroup(actionLabel, false)
		action := sm.actions[sm.actionKeys.Draw(t, "action")]
		invalid, skipped := runAction(t, action)
		t.s.endGroup(i, false)

		if skipped {
			continue
		} else {
			return !invalid
		}
	}

	panic(stopTest(noValidActionsMsg))
}

func runAction(t *T, action func(*T)) (invalid bool, skipped bool) {
	defer func(draws int) {
		if r := recover(); r != nil {
			if _, ok := r.(invalidData); ok {
				invalid = true
				skipped = t.draws == draws
			} else {
				panic(r)
			}
		}
	}(t.draws)

	action(t)
	t.failOnError()

	return false, false
}
