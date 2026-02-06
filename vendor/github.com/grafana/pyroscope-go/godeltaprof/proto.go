package godeltaprof

type ProfileOptions struct {
	// for go1.21+ if true - use runtime_FrameSymbolName - produces frames with generic types, for example [go.shape.int]
	// for go1.21+ if false - use runtime.Frame->Function - produces frames with generic types omitted [...]
	// pre 1.21 - always use runtime.Frame->Function - produces frames with generic types omitted [...]
	GenericsFrames bool
	LazyMappings   bool
}
