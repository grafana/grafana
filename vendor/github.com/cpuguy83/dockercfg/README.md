### github.com/cpuguy83/dockercfg
Go library to load docker CLI configs, auths, etc. with minimal deps.
So far the only deps are on the stdlib.

### Usage
See the [godoc](https://godoc.org/github.com/cpuguy83/dockercfg) for API details.

I'm currently using this in [zapp](https://github.com/cpuguy83/zapp/blob/d25c43d4cd7ccf29fba184aafbc720a753e1a15d/main.go#L58-L83) to handle registry auth instead of always asking the user to enter it.