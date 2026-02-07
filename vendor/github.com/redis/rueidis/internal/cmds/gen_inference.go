// Code generated DO NOT EDIT

package cmds

import "strconv"

type AiModelexecute Incomplete

func (b Builder) AiModelexecute() (c AiModelexecute) {
	c = AiModelexecute{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "AI.MODELEXECUTE")
	return c
}

func (c AiModelexecute) Key(key string) AiModelexecuteKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (AiModelexecuteKey)(c)
}

type AiModelexecuteInputsInput Incomplete

func (c AiModelexecuteInputsInput) Input(input ...string) AiModelexecuteInputsInput {
	c.cs.s = append(c.cs.s, input...)
	return c
}

func (c AiModelexecuteInputsInput) Outputs(outputCount int64) AiModelexecuteOutputsOutputs {
	c.cs.s = append(c.cs.s, "OUTPUTS", strconv.FormatInt(outputCount, 10))
	return (AiModelexecuteOutputsOutputs)(c)
}

type AiModelexecuteInputsInputs Incomplete

func (c AiModelexecuteInputsInputs) Input(input ...string) AiModelexecuteInputsInput {
	c.cs.s = append(c.cs.s, input...)
	return (AiModelexecuteInputsInput)(c)
}

type AiModelexecuteKey Incomplete

func (c AiModelexecuteKey) Inputs(inputCount int64) AiModelexecuteInputsInputs {
	c.cs.s = append(c.cs.s, "INPUTS", strconv.FormatInt(inputCount, 10))
	return (AiModelexecuteInputsInputs)(c)
}

type AiModelexecuteOutputsOutput Incomplete

func (c AiModelexecuteOutputsOutput) Output(output ...string) AiModelexecuteOutputsOutput {
	c.cs.s = append(c.cs.s, output...)
	return c
}

func (c AiModelexecuteOutputsOutput) Timeout(timeout int64) AiModelexecuteTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (AiModelexecuteTimeout)(c)
}

func (c AiModelexecuteOutputsOutput) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c AiModelexecuteOutputsOutput) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type AiModelexecuteOutputsOutputs Incomplete

func (c AiModelexecuteOutputsOutputs) Output(output ...string) AiModelexecuteOutputsOutput {
	c.cs.s = append(c.cs.s, output...)
	return (AiModelexecuteOutputsOutput)(c)
}

type AiModelexecuteTimeout Incomplete

func (c AiModelexecuteTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

func (c AiModelexecuteTimeout) Cache() Cacheable {
	c.cs.Build()
	return Cacheable{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type AiScriptexecute Incomplete

func (b Builder) AiScriptexecute() (c AiScriptexecute) {
	c = AiScriptexecute{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "AI.SCRIPTEXECUTE")
	return c
}

func (c AiScriptexecute) Key(key string) AiScriptexecuteKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (AiScriptexecuteKey)(c)
}

type AiScriptexecuteArgsArg Incomplete

func (c AiScriptexecuteArgsArg) Arg(arg ...string) AiScriptexecuteArgsArg {
	c.cs.s = append(c.cs.s, arg...)
	return c
}

func (c AiScriptexecuteArgsArg) Outputs(outputCount int64) AiScriptexecuteOutputsOutputs {
	c.cs.s = append(c.cs.s, "OUTPUTS", strconv.FormatInt(outputCount, 10))
	return (AiScriptexecuteOutputsOutputs)(c)
}

func (c AiScriptexecuteArgsArg) Timeout(timeout int64) AiScriptexecuteTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (AiScriptexecuteTimeout)(c)
}

func (c AiScriptexecuteArgsArg) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type AiScriptexecuteArgsArgs Incomplete

func (c AiScriptexecuteArgsArgs) Arg(arg ...string) AiScriptexecuteArgsArg {
	c.cs.s = append(c.cs.s, arg...)
	return (AiScriptexecuteArgsArg)(c)
}

type AiScriptexecuteFunction Incomplete

func (c AiScriptexecuteFunction) Keys(keyCount int64) AiScriptexecuteKeysKeys {
	c.cs.s = append(c.cs.s, "KEYS", strconv.FormatInt(keyCount, 10))
	return (AiScriptexecuteKeysKeys)(c)
}

func (c AiScriptexecuteFunction) Inputs(inputCount int64) AiScriptexecuteInputsInputs {
	c.cs.s = append(c.cs.s, "INPUTS", strconv.FormatInt(inputCount, 10))
	return (AiScriptexecuteInputsInputs)(c)
}

func (c AiScriptexecuteFunction) Args(argCount int64) AiScriptexecuteArgsArgs {
	c.cs.s = append(c.cs.s, "ARGS", strconv.FormatInt(argCount, 10))
	return (AiScriptexecuteArgsArgs)(c)
}

func (c AiScriptexecuteFunction) Outputs(outputCount int64) AiScriptexecuteOutputsOutputs {
	c.cs.s = append(c.cs.s, "OUTPUTS", strconv.FormatInt(outputCount, 10))
	return (AiScriptexecuteOutputsOutputs)(c)
}

func (c AiScriptexecuteFunction) Timeout(timeout int64) AiScriptexecuteTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (AiScriptexecuteTimeout)(c)
}

func (c AiScriptexecuteFunction) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type AiScriptexecuteInputsInput Incomplete

func (c AiScriptexecuteInputsInput) Input(input ...string) AiScriptexecuteInputsInput {
	c.cs.s = append(c.cs.s, input...)
	return c
}

func (c AiScriptexecuteInputsInput) Args(argCount int64) AiScriptexecuteArgsArgs {
	c.cs.s = append(c.cs.s, "ARGS", strconv.FormatInt(argCount, 10))
	return (AiScriptexecuteArgsArgs)(c)
}

func (c AiScriptexecuteInputsInput) Outputs(outputCount int64) AiScriptexecuteOutputsOutputs {
	c.cs.s = append(c.cs.s, "OUTPUTS", strconv.FormatInt(outputCount, 10))
	return (AiScriptexecuteOutputsOutputs)(c)
}

func (c AiScriptexecuteInputsInput) Timeout(timeout int64) AiScriptexecuteTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (AiScriptexecuteTimeout)(c)
}

func (c AiScriptexecuteInputsInput) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type AiScriptexecuteInputsInputs Incomplete

func (c AiScriptexecuteInputsInputs) Input(input ...string) AiScriptexecuteInputsInput {
	c.cs.s = append(c.cs.s, input...)
	return (AiScriptexecuteInputsInput)(c)
}

type AiScriptexecuteKey Incomplete

func (c AiScriptexecuteKey) Function(function string) AiScriptexecuteFunction {
	c.cs.s = append(c.cs.s, function)
	return (AiScriptexecuteFunction)(c)
}

type AiScriptexecuteKeysKey Incomplete

func (c AiScriptexecuteKeysKey) Key(key ...string) AiScriptexecuteKeysKey {
	c.cs.s = append(c.cs.s, key...)
	return c
}

func (c AiScriptexecuteKeysKey) Inputs(inputCount int64) AiScriptexecuteInputsInputs {
	c.cs.s = append(c.cs.s, "INPUTS", strconv.FormatInt(inputCount, 10))
	return (AiScriptexecuteInputsInputs)(c)
}

func (c AiScriptexecuteKeysKey) Args(argCount int64) AiScriptexecuteArgsArgs {
	c.cs.s = append(c.cs.s, "ARGS", strconv.FormatInt(argCount, 10))
	return (AiScriptexecuteArgsArgs)(c)
}

func (c AiScriptexecuteKeysKey) Outputs(outputCount int64) AiScriptexecuteOutputsOutputs {
	c.cs.s = append(c.cs.s, "OUTPUTS", strconv.FormatInt(outputCount, 10))
	return (AiScriptexecuteOutputsOutputs)(c)
}

func (c AiScriptexecuteKeysKey) Timeout(timeout int64) AiScriptexecuteTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (AiScriptexecuteTimeout)(c)
}

func (c AiScriptexecuteKeysKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type AiScriptexecuteKeysKeys Incomplete

func (c AiScriptexecuteKeysKeys) Key(key ...string) AiScriptexecuteKeysKey {
	c.cs.s = append(c.cs.s, key...)
	return (AiScriptexecuteKeysKey)(c)
}

type AiScriptexecuteOutputsOutput Incomplete

func (c AiScriptexecuteOutputsOutput) Output(output ...string) AiScriptexecuteOutputsOutput {
	c.cs.s = append(c.cs.s, output...)
	return c
}

func (c AiScriptexecuteOutputsOutput) Timeout(timeout int64) AiScriptexecuteTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (AiScriptexecuteTimeout)(c)
}

func (c AiScriptexecuteOutputsOutput) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type AiScriptexecuteOutputsOutputs Incomplete

func (c AiScriptexecuteOutputsOutputs) Output(output ...string) AiScriptexecuteOutputsOutput {
	c.cs.s = append(c.cs.s, output...)
	return (AiScriptexecuteOutputsOutput)(c)
}

type AiScriptexecuteTimeout Incomplete

func (c AiScriptexecuteTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
