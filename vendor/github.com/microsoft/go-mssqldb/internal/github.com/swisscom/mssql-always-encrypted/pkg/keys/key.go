package keys

type Key interface {
	RootKey() []byte
}
