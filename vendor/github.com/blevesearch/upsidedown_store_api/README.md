# Upsidedown Store API

Upsidedown supports a pluggable Key/Value storage interface.

By placing these interfaces in their own, *hopefully* slowly evolving module, it frees up Upsidedown and the underlying storage implementations to each introduce new major versions without interfering with one another.

With that in mind, we anticipate introducing non-breaking changes only to this module, and keeping the major version at 1.x for some time.
