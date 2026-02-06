# This fork...

I'm maintaining this fork because the original author was not replying to issues or pull requests.  For now I plan on maintaining this fork as necessary.

## Status

[![Build Status](https://travis-ci.org/blevesearch/go-porterstemmer.svg?branch=master)](https://travis-ci.org/blevesearch/go-porterstemmer)

[![Coverage Status](https://coveralls.io/repos/blevesearch/go-porterstemmer/badge.png?branch=HEAD)](https://coveralls.io/r/blevesearch/go-porterstemmer?branch=HEAD)

# Go Porter Stemmer

A native Go clean room implementation of the Porter Stemming Algorithm.

This algorithm is of interest to people doing Machine Learning or
Natural Language Processing (NLP).

This is NOT a port. This is a native Go implementation from the human-readable
description of the algorithm.

I've tried to make it (more) efficient by NOT internally using string's, but
instead internally using []rune's and using the same (array) buffer used by
the []rune slice (and sub-slices) at all steps of the algorithm.

For Porter Stemmer algorithm, see:

http://tartarus.org/martin/PorterStemmer/def.txt      (URL #1)

http://tartarus.org/martin/PorterStemmer/             (URL #2)

# Departures

Also, since when I initially implemented it, it failed the tests at...

http://tartarus.org/martin/PorterStemmer/voc.txt      (URL #3)

http://tartarus.org/martin/PorterStemmer/output.txt   (URL #4)

... after reading the human-readble text over and over again to try to figure out
what the error I made was (and doing all sorts of things to debug it) I came to the
conclusion that the some of these tests were wrong according to the human-readable
description of the algorithm.

This led me to wonder if maybe other people's code that was passing these tests had
rules that were not in the human-readable description. Which led me to look at the source
code here...

http://tartarus.org/martin/PorterStemmer/c.txt        (URL #5)

... When I looked there I noticed that there are some items marked as a "DEPARTURE",
which differ from the original algorithm. (There are 2 of these.)

I implemented these departures, and the tests at URL #3 and URL #4 all passed.

## Usage

To use this Golang library, use with something like:

    package main
    
    import (
      "fmt"
      "github.com/reiver/go-porterstemmer"
    )
    
    func main() {
      
      word := "Waxes"
      
      stem := porterstemmer.StemString(word)
      
      fmt.Printf("The word [%s] has the stem [%s].\n", word, stem)
    }

Alternatively, if you want to be a bit more efficient, use []rune slices instead, with code like:

    package main
    
    import (
      "fmt"
      "github.com/reiver/go-porterstemmer"
    )
    
    func main() {
      
      word := []rune("Waxes")
      
      stem := porterstemmer.Stem(word)
      
      fmt.Printf("The word [%s] has the stem [%s].\n", string(word), string(stem))
    }

Although NOTE that the above code may modify original slice (named "word" in the example) as a side
effect, for efficiency reasons. And that the slice named "stem" in the example above may be a
sub-slice of the slice named "word".

Also alternatively, if you already know that your word is already lowercase (and you don't need
this library to lowercase your word for you) you can instead use code like:

    package main
    
    import (
      "fmt"
      "github.com/reiver/go-porterstemmer"
    )
    
    func main() {
      
      word := []rune("waxes")
      
      stem := porterstemmer.StemWithoutLowerCasing(word)
      
      fmt.Printf("The word [%s] has the stem [%s].\n", string(word), string(stem))
    }

Again NOTE (like with the previous example) that the above code may modify original slice (named
"word" in the example) as a side effect, for efficiency reasons. And that the slice named "stem"
in the example above may be a sub-slice of the slice named "word".
