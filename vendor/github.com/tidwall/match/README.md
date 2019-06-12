Match
=====
<a href="https://travis-ci.org/tidwall/match"><img src="https://img.shields.io/travis/tidwall/match.svg?style=flat-square" alt="Build Status"></a>
<a href="https://godoc.org/github.com/tidwall/match"><img src="https://img.shields.io/badge/api-reference-blue.svg?style=flat-square" alt="GoDoc"></a>

Match is a very simple pattern matcher where '*' matches on any 
number characters and '?' matches on any one character.

Installing
----------

```
go get -u github.com/tidwall/match
```

Example
-------

```go
match.Match("hello", "*llo") 
match.Match("jello", "?ello") 
match.Match("hello", "h*o") 
```


Contact
-------
Josh Baker [@tidwall](http://twitter.com/tidwall)

License
-------
Redcon source code is available under the MIT [License](/LICENSE).
