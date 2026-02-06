// Copyright 2018 The CUE Authors
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

package tool

// A Command specifies a user-defined command.
//
// Descriptions are derived from the doc comment, if they are not provided
// structurally, using the following format:
//
//    // short description on one line
//    //
//    // Usage: <name> usage (optional)
//    //
//    // long description covering the remainder of the doc comment.
//
Command: {
	// Tasks specifies the things to run to complete a command. Tasks are
	// typically underspecified and completed by the particular internal
	// handler that is running them. Tasks can be a single task, or a full
	// hierarchy of tasks.
	//
	// Tasks that depend on the output of other tasks are run after such tasks.
	// Use `$after` if a task needs to run after another task but does not
	// otherwise depend on its output.
	Tasks

	//
	// Example:
	//     mycmd [-n] names
	$usage?: string

	// short is short description of what the command does.
	$short?: string

	// long is a longer description that spans multiple lines and
	// likely contain examples of usage of the command.
	$long?: string
}

// TODO:
// - child commands?

// Tasks defines a hierarchy of tasks. A command completes if all tasks have
// run to completion.
Tasks: Task | {
	[name=Name]: Tasks
}

// #Name defines a valid task or command name.
Name: =~#"^\PL([-](\PL|\PN))*$"#

// A Task defines a step in the execution of a command.
Task: {
	$type: "tool.Task" // legacy field 'kind' still supported for now.

	// kind indicates the operation to run. It must be of the form
	// packagePath.Operation.
	$id: =~#"\."#

	// $after can be used to specify a task is run after another one, when
	// it does not otherwise refer to an output of that task.
	$after?: Task | [...Task]
}

// TODO: consider these options:
//   $success: bool
//   $runif: a.b.$success or $guard: a.b.$success
// With this `$after: a.b` would just be a shorthand for `$guard: a.b.$success`.
