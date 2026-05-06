package en

import (
	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/registry"
)

const StopName = "stop_en"

// EnglishStopWords is the built-in list of stopwords used by the "stop_en" TokenFilter.
//
// this content was obtained from:
// lucene-4.7.2/analysis/common/src/resources/org/apache/lucene/analysis/snowball/
// ` was changed to ' to allow for literal string
var EnglishStopWords = []byte(` | From svn.tartarus.org/snowball/trunk/website/algorithms/english/stop.txt
 | This file is distributed under the BSD License.
 | See http://snowball.tartarus.org/license.php
 | Also see http://www.opensource.org/licenses/bsd-license.html
 |  - Encoding was converted to UTF-8.
 |  - This notice was added.
 |
 | NOTE: To use this file with StopFilterFactory, you must specify format="snowball"
 
 | An English stop word list. Comments begin with vertical bar. Each stop
 | word is at the start of a line.

 | Many of the forms below are quite rare (e.g. "yourselves") but included for
 |  completeness.

           | PRONOUNS FORMS
             | 1st person sing

i              | subject, always in upper case of course

me             | object
my             | possessive adjective
               | the possessive pronoun 'mine' is best suppressed, because of the
               | sense of coal-mine etc.
myself         | reflexive
             | 1st person plural
we             | subject

| us           | object
               | care is required here because US = United States. It is usually
               | safe to remove it if it is in lower case.
our            | possessive adjective
ours           | possessive pronoun
ourselves      | reflexive
             | second person (archaic 'thou' forms not included)
you            | subject and object
your           | possessive adjective
yours          | possessive pronoun
yourself       | reflexive (singular)
yourselves     | reflexive (plural)
             | third person singular
he             | subject
him            | object
his            | possessive adjective and pronoun
himself        | reflexive

she            | subject
her            | object and possessive adjective
hers           | possessive pronoun
herself        | reflexive

it             | subject and object
its            | possessive adjective
itself         | reflexive
             | third person plural
they           | subject
them           | object
their          | possessive adjective
theirs         | possessive pronoun
themselves     | reflexive
             | other forms (demonstratives, interrogatives)
what
which
who
whom
this
that
these
those

           | VERB FORMS (using F.R. Palmer's nomenclature)
             | BE
am             | 1st person, present
is             | -s form (3rd person, present)
are            | present
was            | 1st person, past
were           | past
be             | infinitive
been           | past participle
being          | -ing form
             | HAVE
have           | simple
has            | -s form
had            | past
having         | -ing form
             | DO
do             | simple
does           | -s form
did            | past
doing          | -ing form

 | The forms below are, I believe, best omitted, because of the significant
 | homonym forms:

 |  He made a WILL
 |  old tin CAN
 |  merry month of MAY
 |  a smell of MUST
 |  fight the good fight with all thy MIGHT

 | would, could, should, ought might however be included

 |          | AUXILIARIES
 |            | WILL
 |will

would

 |            | SHALL
 |shall

should

 |            | CAN
 |can

could

 |            | MAY
 |may
 |might
 |            | MUST
 |must
 |            | OUGHT

ought

           | COMPOUND FORMS, increasingly encountered nowadays in 'formal' writing
              | pronoun + verb

i'm
you're
he's
she's
it's
we're
they're
i've
you've
we've
they've
i'd
you'd
he'd
she'd
we'd
they'd
i'll
you'll
he'll
she'll
we'll
they'll

              | verb + negation

isn't
aren't
wasn't
weren't
hasn't
haven't
hadn't
doesn't
don't
didn't

              | auxiliary + negation

won't
wouldn't
shan't
shouldn't
can't
cannot
couldn't
mustn't

             | miscellaneous forms

let's
that's
who's
what's
here's
there's
when's
where's
why's
how's

              | rarer forms

 | daren't needn't

              | doubtful forms

 | oughtn't mightn't

           | ARTICLES
a
an
the

           | THE REST (Overlap among prepositions, conjunctions, adverbs etc is so
           | high, that classification is pointless.)
and
but
if
or
because
as
until
while

of
at
by
for
with
about
against
between
into
through
during
before
after
above
below
to
from
up
down
in
out
on
off
over
under

again
further
then
once

here
there
when
where
why
how

all
any
both
each
few
more
most
other
some
such

no
nor
not
only
own
same
so
than
too
very

 | Just for the record, the following words are among the commonest in English

    | one
    | every
    | least
    | less
    | many
    | now
    | ever
    | never
    | say
    | says
    | said
    | also
    | get
    | go
    | goes
    | just
    | made
    | make
    | put
    | see
    | seen
    | whether
    | like
    | well
    | back
    | even
    | still
    | way
    | take
    | since
    | another
    | however
    | two
    | three
    | four
    | five
    | first
    | second
    | new
    | old
    | high
    | long
`)

func TokenMapConstructor(config map[string]interface{}, cache *registry.Cache) (analysis.TokenMap, error) {
	rv := analysis.NewTokenMap()
	err := rv.LoadBytes(EnglishStopWords)
	return rv, err
}

func init() {
	err := registry.RegisterTokenMap(StopName, TokenMapConstructor)
	if err != nil {
		panic(err)
	}
}
