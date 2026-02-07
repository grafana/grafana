# HCL Changelog

## v2.24.0 (July 7, 2025)

### Enhancements

* Add support for decoding block and attribute source ranges when using `gohcl`. ([#703](https://github.com/hashicorp/hcl/pull/703))
* hclsyntax: Detect and reject invalid nested splat result. ([#724](https://github.com/hashicorp/hcl/pull/724))

### Bugs Fixed

* Correct handling of unknown objects in Index function. ([#763](https://github.com/hashicorp/hcl/pull/763))

## v2.23.0 (November 15, 2024)

### Bugs Fixed

* Preserve marks when traversing through unknown values. ([#699](https://github.com/hashicorp/hcl/pull/699))
* Retain marks through conditional and for expressions. ([#710](https://github.com/hashicorp/hcl/pull/710))

## v2.22.0 (August 26, 2024)

### Enhancements

* feat: return an ExprSyntaxError for invalid references that end in a dot ([#692](https://github.com/hashicorp/hcl/pull/692))

## v2.21.0 (June 19, 2024)

### Enhancements

* Introduce `ParseTraversalPartial`, which allows traversals that include the splat (`[*]`) index operator.  ([#673](https://github.com/hashicorp/hcl/pull/673))
* ext/dynblock: Now accepts marked values in `for_each`, and will transfer those marks (as much as technically possible) to values in the generated blocks. ([#679](https://github.com/hashicorp/hcl/pull/679))

### Bugs Fixed

* Expression evaluation will no longer panic if the splat operator is applied to an unknown value that has cty marks. ([#678](https://github.com/hashicorp/hcl/pull/678))

## v2.20.1 (March 26, 2024)

### Bugs Fixed

* Return `ExprSyntaxError` when an invalid namespaced function is encountered during parsing ([#668](https://github.com/hashicorp/hcl/pull/668))

### Internal

* Standardize on only two value dumping/diffing libraries ([#669](https://github.com/hashicorp/hcl/pull/669))

## v2.20.0 (February 29, 2024)

### Enhancements

* Support for namespaced functions ([#639](https://github.com/hashicorp/hcl/pull/639))

### Bugs Fixed

* ext/dynblock: if `iterator` is invalid return this error instead of consequential errors ([#656](https://github.com/hashicorp/hcl/pull/656))

## v2.19.0 (October 16, 2023)

### Enhancements

* ext/dynblock: `dynblock.Expand` now supports an optional hook for calling applications to check and potentially veto (by returning error diagnostics) particular `for_each` values. The behavior is unchanged for callers that don't set the new option. ([#634](https://github.com/hashicorp/hcl/pull/634))

### Bugs Fixed

* hclsyntax: Further fixes for treatment of "marked" values in the conditional expression, and better tracking of refined values into the conditional expression results, building on the fixes from v2.18.1. ([#633](https://github.com/hashicorp/hcl/pull/633))

## v2.18.1 (October 5, 2023)

### Bugs Fixed

* hclsyntax: Conditional expressions will no longer panic when one or both of their results are "marked", as is the case for situations like how HashiCorp Terraform tracks its concept of "sensitive values". ([#630](https://github.com/hashicorp/hcl/pull/630))

## v2.18.0 (August 30, 2023)

### Enhancements

* HCL now uses the tables from Unicode 15 when performing string normalization and character segmentation. HCL was previously using the Unicode 13 tables.

    For calling applications where consistent Unicode support is important, consider also upgrading to Go 1.21 at the same time as adopting HCL v2.18.0 so that the standard library unicode tables (used for case folding, etc) will also be from Unicode 15.

## v2.17.1 (August 30, 2023)

### Enhancements

* hclsyntax: When evaluating string templates that have a long known constant prefix, HCL will truncate the known prefix to avoid creating excessively-large refinements. String prefix refinements are intended primarily for relatively-short fixed prefixes, such as `https://` at the start of a URL known to use that scheme. ([#617](https://github.com/hashicorp/hcl/pull/617))
* ext/tryfunc: The "try" and "can" functions now handle unknown values slightly more precisely, and so can return known values in more situations when given expressions referring to unknown symbols. ([#622](https://github.com/hashicorp/hcl/pull/622))

### Bugs Fixed

* ext/typeexpr: Will no longer try to refine unknown values of unknown type when dealing with a user-specified type constraint containing the `any` keyword, avoiding an incorrect panic at runtime. ([#625](https://github.com/hashicorp/hcl/pull/625))
* ext/typeexpr: Now correctly handles attempts to declare the same object type attribute multiple times by returning an error. Previously this could potentially panic by creating an incoherent internal state. ([#624](https://github.com/hashicorp/hcl/pull/624))

## v2.17.0 (May 31, 2023)

### Enhancements

* HCL now uses a newer version of the upstream `cty` library which has improved treatment of unknown values: it can now track additional optional information that reduces the range of an unknown value, which allows some operations against unknown values to return known or partially-known results. ([#590](https://github.com/hashicorp/hcl/pull/590))

    **Note:** This change effectively passes on [`cty`'s notion of backward compatibility](https://github.com/zclconf/go-cty/blob/main/COMPATIBILITY.md) whereby unknown values can become "more known" in later releases. In particular, if your caller is using `cty.Value.RawEquals` in its tests against the results of operations with unknown values then you may see those tests begin failing after upgrading, due to the values now being more "refined".

    If so, you should review the refinements with consideration to [the `cty` refinements docs](https://github.com/zclconf/go-cty/blob/7dcbae46a6f247e983efb1fa774d2bb68781a333/docs/refinements.md) and update your expected results to match only if the reported refinements seem correct for the given situation. The `RawEquals` method is intended only for making exact value comparisons in test cases, so main application code should not use it; use `Equals` instead for real logic, which will take refinements into account automatically.

## v2.16.2 (March 9, 2023)

### Bugs Fixed

* ext/typeexpr: Verify type assumptions when applying default values, and ignore input values that do not match type assumptions. ([#594](https://github.com/hashicorp/hcl/pull/594))

## v2.16.1 (February 13, 2023)

### Bugs Fixed

* hclsyntax: Report correct `Range.End` for `FunctionCall` with incomplete argument ([#588](https://github.com/hashicorp/hcl/pull/588))

## v2.16.0 (January 30, 2023)

### Enhancements

* ext/typeexpr: Modify the `Defaults` functionality to implement additional flexibility. HCL will now upcast lists and sets into tuples, and maps into objects, when applying default values if the applied defaults cause the elements within a target collection to have differing types. Previously, this would have resulted in a panic, now HCL will return a modified overall type. ([#574](https://github.com/hashicorp/hcl/pull/574))

    Users should return to the advice provided by v2.14.0, and apply the go-cty convert functionality *after* setting defaults on a given `cty.Value`, rather than before.
* hclfmt: Avoid rewriting unchanged files. ([#576](https://github.com/hashicorp/hcl/pull/576))
* hclsyntax: Simplify the AST for certain string expressions. ([#584](https://github.com/hashicorp/hcl/pull/584))

### Bugs Fixed

* hclwrite: Fix data race in `formatSpaces`. ([#511](https://github.com/hashicorp/hcl/pull/511))

## v2.15.0 (November 10, 2022)

### Bugs Fixed

* ext/typeexpr: Skip null objects when applying defaults. This prevents crashes when null objects are creating inside collections, and stops incomplete objects being created with only optional attributes set. ([#567](https://github.com/hashicorp/hcl/pull/567))
* ext/typeexpr: Ensure default values do not have optional metadata attached. This prevents crashes when default values are inserted into concrete go-cty values that have also been stripped of their optional metadata. ([#568](https://github.com/hashicorp/hcl/pull/568))

### Enhancements

* ext/typeexpr: With the [go-cty](https://github.com/zclconf/go-cty) upstream depenendency updated to v1.12.0, the `Defaults` struct and associated functions can apply additional and more flexible 'unsafe' conversions (examples include tuples into collections such as lists and sets, and additional safety around null and dynamic values). ([#564](https://github.com/hashicorp/hcl/pull/564))
* ext/typeexpr: With the [go-cty](https://github.com/zclconf/go-cty) upstream depenendency updated to v1.12.0, users should now apply the go-cty convert functionality *before* setting defaults on a given `cty.Value`, rather than after, if they require a specific `cty.Type`.  ([#564](https://github.com/hashicorp/hcl/pull/564))

## v2.14.1 (September 23, 2022)

### Bugs Fixed

* ext/typeexpr: Type convert defaults for optional object attributes when applying them. This prevents crashes in certain cases when the objects in question are part of a collection. ([#555](https://github.com/hashicorp/hcl/pull/555))

## v2.14.0 (September 1, 2022)

### Enhancements

* ext/typeexpr: Added support for optional object attributes to `TypeConstraint`. Attributes can be wrapped in the special `optional(…)` modifier, allowing the attribute to be omitted while still meeting the type constraint. For more information, [cty's documentation on conversion between object types](https://github.com/zclconf/go-cty/blob/main/docs/convert.md#conversion-between-object-types). ([#549](https://github.com/hashicorp/hcl/pull/549))
* ext/typeexpr: New function: `TypeConstraintWithDefaults`. In this mode, the `optional(…)` modifier accepts a second argument which can be used as the default value for omitted object attributes. The function returns both a `cty.Type` and associated `Defaults`, the latter of which has an `Apply` method to apply defaults to a given value. ([#549](https://github.com/hashicorp/hcl/pull/549))

## v2.13.0 (June 22, 2022)

### Enhancements

* hcl: `hcl.Diagnostic` now has an additional field `Extra` which is intended for carrying arbitrary supporting data ("extra information") related to the diagnostic message, intended to allow diagnostic renderers to optionally tailor the presentation of messages for particular situations. ([#539](https://github.com/hashicorp/hcl/pull/539))
* hclsyntax: When an error occurs during a function call, the returned diagnostics will include _extra information_ (as described in the previous point) about which function was being called and, if the message is about an error returned by the function itself, that raw `error` value without any post-processing. ([#539](https://github.com/hashicorp/hcl/pull/539))

### Bugs Fixed

* hclwrite: Fixed a potential data race for any situation where `hclwrite.Format` runs concurrently with itself. ([#534](https://github.com/hashicorp/hcl/pull/534))

## v2.12.0 (April 22, 2022)

### Enhancements

* hclsyntax: Evaluation of conditional expressions will now produce more precise error messages about inconsistencies between the types of the true and false result expressions, particularly in cases where both are of the same structural type kind but differ in their nested elements. ([#530](https://github.com/hashicorp/hcl/pull/530))
* hclsyntax: The lexer will no longer allocate a small object on the heap for each token. Instead, in that situation it will allocate only when needed to return a diagnostic message with source location information. ([#490](https://github.com/hashicorp/hcl/pull/490))
* hclwrite: New functions `TokensForTuple`, `TokensForObject`, and `TokensForFunctionCall` allow for more easily constructing the three constructs which are supported for static analysis and which HCL-based languages typically use in contexts where an expression is used only for its syntax, and not evaluated to produce a real value. For example, these new functions together are sufficient to construct all valid type constraint expressions from [the Type Expressions Extension](./ext/typeexpr/), which is the basis of variable type constraints in the Terraform language at the time of writing. ([#502](https://github.com/hashicorp/hcl/pull/502))
* json: New functions `IsJSONExpression` and `IsJSONBody` to determine if a given expression or body was created by the JSON syntax parser. In normal situations it's better not to worry about what syntax a particular expression/body originated in, but this can be useful in some trickier cases where an application needs to shim for backwards-compatibility or for static analysis that needs to have special handling of the JSON syntax's embedded expression/template conventions. ([#524](https://github.com/hashicorp/hcl/pull/524))

### Bugs Fixed

* gohcl: Fix docs about supported types for blocks. ([#507](https://github.com/hashicorp/hcl/pull/507))

## v2.11.1 (December 1, 2021)

### Bugs Fixed

* hclsyntax: The type for an upgraded unknown value with a splat expression cannot be known ([#495](https://github.com/hashicorp/hcl/pull/495))

## v2.11.0 (December 1, 2021)

### Enhancements

* hclsyntax: Various error messages related to unexpectedly reaching end of file while parsing a delimited subtree will now return specialized messages describing the opening tokens as "unclosed", instead of returning a generic diagnostic that just happens to refer to the empty source range at the end of the file. This gives better feedback when error messages are being presented alongside a source code snippet, as is common in HCL-based applications, because it shows which innermost container the parser was working on when it encountered the error. ([#492](https://github.com/hashicorp/hcl/pull/492))

### Bugs Fixed

* hclsyntax: Upgrading an unknown single value to a list using a splat expression must return unknown ([#493](https://github.com/hashicorp/hcl/pull/493))

## v2.10.1 (July 21, 2021)

* dynblock: Decode unknown dynamic blocks in order to obtain any diagnostics even though the decoded value is not used ([#476](https://github.com/hashicorp/hcl/pull/476))
* hclsyntax: Calling functions is now more robust in the face of an incorrectly-implemented function which returns a `function.ArgError` whose argument index is out of range for the length of the arguments. Previously this would often lead to a panic, but now it'll return a less-precice error message instead. Functions that return out-of-bounds argument indices still ought to be fixed so that the resulting error diagnostics can be as precise as possible. ([#472](https://github.com/hashicorp/hcl/pull/472))
* hclsyntax: Ensure marks on unknown values are maintained when processing string templates. ([#478](https://github.com/hashicorp/hcl/pull/478))
* hcl: Improved error messages for various common error situtions in `hcl.Index` and `hcl.GetAttr`. These are part of the implementation of indexing and attribute lookup in the native syntax expression language too, so the new error messages will apply to problems using those operators. ([#474](https://github.com/hashicorp/hcl/pull/474))

## v2.10.0 (April 20, 2021)

### Enhancements

* dynblock,hcldec: Using dynblock in conjunction with hcldec can now decode blocks with unknown dynamic for_each arguments as entirely unknown values ([#461](https://github.com/hashicorp/hcl/pull/461))
* hclsyntax: Some syntax errors during parsing of the inside of `${` ... `}` template interpolation sequences will now produce an extra hint message about the need to escape as `$${` when trying to include interpolation syntax for other languages like shell scripting, AWS IAM policies, etc. ([#462](https://github.com/hashicorp/hcl/pull/462))

## v2.9.1 (March 10, 2021)

### Bugs Fixed

* hclsyntax: Fix panic for marked index value. ([#451](https://github.com/hashicorp/hcl/pull/451))

## v2.9.0 (February 23, 2021)

### Enhancements

* HCL's native syntax and JSON scanners -- and thus all of the other parsing components that build on top of them -- are now using Unicode 13 rules for text segmentation when counting text characters for the purpose of reporting source location columns. Previously HCL was using Unicode 12. Unicode 13 still uses the same algorithm but includes some additions to the character tables the algorithm is defined in terms of, to properly categorize new characters defined in Unicode 13.

## v2.8.2 (January 6, 2021)

### Bugs Fixed

* hclsyntax: Fix panic for marked collection splat. ([#436](https://github.com/hashicorp/hcl/pull/436))
* hclsyntax: Fix panic for marked template loops. ([#437](https://github.com/hashicorp/hcl/pull/437))
* hclsyntax: Fix `for` expression marked conditional. ([#438](https://github.com/hashicorp/hcl/pull/438))
* hclsyntax: Mark objects with keys that are sensitive. ([#440](https://github.com/hashicorp/hcl/pull/440))

## v2.8.1 (December 17, 2020)

### Bugs Fixed

* hclsyntax: Fix panic when expanding marked function arguments. ([#429](https://github.com/hashicorp/hcl/pull/429))
* hclsyntax: Error when attempting to use a marked value as an object key. ([#434](https://github.com/hashicorp/hcl/pull/434))
* hclsyntax: Error when attempting to use a marked value as an object key in expressions. ([#433](https://github.com/hashicorp/hcl/pull/433))

## v2.8.0 (December 7, 2020)

### Enhancements

* hclsyntax: Expression grouping parentheses will now be reflected by an explicit node in the AST, whereas before they were only considered during parsing. ([#426](https://github.com/hashicorp/hcl/pull/426))

### Bugs Fixed

* hclwrite: The parser will now correctly include the `(` and `)` tokens when an expression is surrounded by parentheses. Previously it would incorrectly recognize those tokens as being extraneous tokens outside of the expression. ([#426](https://github.com/hashicorp/hcl/pull/426))
* hclwrite: The formatter will now remove (rather than insert) spaces between the `!` (unary boolean "not") operator and its subsequent operand. ([#403](https://github.com/hashicorp/hcl/pull/403))
* hclsyntax: Unmark conditional values in expressions before checking their truthfulness ([#427](https://github.com/hashicorp/hcl/pull/427))

## v2.7.2 (November 30, 2020)

### Bugs Fixed

* gohcl: Fix panic when decoding into type containing value slices. ([#335](https://github.com/hashicorp/hcl/pull/335))
* hclsyntax: The unusual expression `null[*]` was previously always returning an unknown value, even though the rules for `[*]` normally call for it to return an empty tuple when applied to a null. As well as being a surprising result, it was particularly problematic because it violated the rule that a calling application may assume that an expression result will always be known unless the application itself introduces unknown values via the evaluation context. `null[*]` will now produce an empty tuple. ([#416](https://github.com/hashicorp/hcl/pull/416))
* hclsyntax: Fix panic when traversing a list, tuple, or map with cty "marks" ([#424](https://github.com/hashicorp/hcl/pull/424))

## v2.7.1 (November 18, 2020)

### Bugs Fixed

* hclwrite: Correctly handle blank quoted string block labels, instead of dropping them ([#422](https://github.com/hashicorp/hcl/pull/422))

## v2.7.0 (October 14, 2020)

### Enhancements

* json: There is a new function `ParseWithStartPos`, which allows overriding the starting position for parsing in case the given JSON bytes are a fragment of a larger document, such as might happen when decoding with `encoding/json` into a `json.RawMessage`. ([#389](https://github.com/hashicorp/hcl/pull/389))
* json: There is a new function `ParseExpression`, which allows parsing a JSON string directly in expression mode, whereas previously it was only possible to parse a JSON string in body mode. ([#381](https://github.com/hashicorp/hcl/pull/381))
* hclwrite: `Block` type now supports `SetType` and `SetLabels`, allowing surgical changes to the type and labels of an existing block without having to reconstruct the entire block. ([#340](https://github.com/hashicorp/hcl/pull/340))

### Bugs Fixed

* hclsyntax: Fix confusing error message for bitwise OR operator ([#380](https://github.com/hashicorp/hcl/pull/380))
* hclsyntax: Several bug fixes for using HCL with values containing cty "marks" ([#404](https://github.com/hashicorp/hcl/pull/404), [#406](https://github.com/hashicorp/hcl/pull/404), [#407](https://github.com/hashicorp/hcl/pull/404))

## v2.6.0 (June 4, 2020)

### Enhancements

* hcldec: Add a new `Spec`, `ValidateSpec`, which allows custom validation of values at decode-time. ([#387](https://github.com/hashicorp/hcl/pull/387))

### Bugs Fixed

* hclsyntax: Fix panic with combination of sequences and null arguments ([#386](https://github.com/hashicorp/hcl/pull/386))
* hclsyntax: Fix handling of unknown values and sequences ([#386](https://github.com/hashicorp/hcl/pull/386))

## v2.5.1 (May 14, 2020)

### Bugs Fixed

* hclwrite: handle legacy dot access of numeric indexes. ([#369](https://github.com/hashicorp/hcl/pull/369))
* hclwrite: Fix panic for dotted full splat (`foo.*`) ([#374](https://github.com/hashicorp/hcl/pull/374))

## v2.5.0 (May 6, 2020)

### Enhancements

* hclwrite: Generate multi-line objects and maps. ([#372](https://github.com/hashicorp/hcl/pull/372))

## v2.4.0 (Apr 13, 2020)

### Enhancements

* The Unicode data tables that HCL uses to produce user-perceived "column" positions in diagnostics and other source ranges are now updated to Unicode 12.0.0, which will cause HCL to produce more accurate column numbers for combining characters introduced to Unicode since Unicode 9.0.0.

### Bugs Fixed

* json: Fix panic when parsing malformed JSON. ([#358](https://github.com/hashicorp/hcl/pull/358))

## v2.3.0 (Jan 3, 2020)

### Enhancements

* ext/tryfunc: Optional functions `try` and `can` to include in your `hcl.EvalContext` when evaluating expressions, which allow users to make decisions based on the success of expressions. ([#330](https://github.com/hashicorp/hcl/pull/330))
* ext/typeexpr: Now has an optional function `convert` which you can include in your `hcl.EvalContext` when evaluating expressions, allowing users to convert values to specific type constraints using the type constraint expression syntax. ([#330](https://github.com/hashicorp/hcl/pull/330))
* ext/typeexpr: A new `cty` capsule type `typeexpr.TypeConstraintType` which, when used as either a type constraint for a function parameter or as a type constraint for a `hcldec` attribute specification will cause the given expression to be interpreted as a type constraint expression rather than a value expression. ([#330](https://github.com/hashicorp/hcl/pull/330))
* ext/customdecode: An optional extension that allows overriding the static decoding behavior for expressions either in function arguments or `hcldec` attribute specifications. ([#330](https://github.com/hashicorp/hcl/pull/330))
* ext/customdecode: New `cty` capsuletypes `customdecode.ExpressionType` and `customdecode.ExpressionClosureType` which, when used as either a type constraint for a function parameter or as a type constraint for a `hcldec` attribute specification will cause the given expression (and, for the closure type, also the `hcl.EvalContext` it was evaluated in) to be captured for later analysis, rather than immediately evaluated. ([#330](https://github.com/hashicorp/hcl/pull/330))

## v2.2.0 (Dec 11, 2019)

### Enhancements

* hcldec: Attribute evaluation (as part of `AttrSpec` or `BlockAttrsSpec`) now captures expression evaluation metadata in any errors it produces during type conversions, allowing for better feedback in calling applications that are able to make use of this metadata when printing diagnostic messages. ([#329](https://github.com/hashicorp/hcl/pull/329))

### Bugs Fixed

* hclsyntax: `IndexExpr`, `SplatExpr`, and `RelativeTraversalExpr` will now report a source range that covers all of their child expression  nodes. Previously they would report only the operator part, such as `["foo"]`, `[*]`, or `.foo`, which was problematic for callers using source ranges for code analysis. ([#328](https://github.com/hashicorp/hcl/pull/328))
* hclwrite: Parser will no longer panic when the input includes index, splat, or relative traversal syntax.  ([#328](https://github.com/hashicorp/hcl/pull/328))

## v2.1.0 (Nov 19, 2019)

### Enhancements

* gohcl: When decoding into a struct value with some fields already populated, those values will be retained if not explicitly overwritten in the given HCL body, with similar overriding/merging behavior as `json.Unmarshal` in the Go standard library.
* hclwrite: New interface to set the expression for an attribute to be a raw token sequence, with no special processing. This has some caveats, so if you intend to use it please refer to the godoc comments. ([#320](https://github.com/hashicorp/hcl/pull/320))

### Bugs Fixed

* hclwrite: The `Body.Blocks` method was returing the blocks in an indefined order, rather than preserving the order of declaration in the source input. ([#313](https://github.com/hashicorp/hcl/pull/313))
* hclwrite: The `TokensForTraversal` function (and thus in turn the `Body.SetAttributeTraversal` method) was not correctly handling index steps in traversals, and thus producing invalid results. ([#319](https://github.com/hashicorp/hcl/pull/319))

## v2.0.0 (Oct 2, 2019)

Initial release of HCL 2, which is a new implementating combining the HCL 1
language with the HIL expression language to produce a single language
supporting both nested configuration structures and arbitrary expressions.

HCL 2 has an entirely new Go library API and so is _not_ a drop-in upgrade
relative to HCL 1. It's possible to import both versions of HCL into a single
program using Go's _semantic import versioning_ mechanism:

```
import (
    hcl1 "github.com/hashicorp/hcl"
    hcl2 "github.com/hashicorp/hcl/v2"
)
```

---

Prior to v2.0.0 there was not a curated changelog. Consult the git history
from the latest v1.x.x tag for information on the changes to HCL 1.
