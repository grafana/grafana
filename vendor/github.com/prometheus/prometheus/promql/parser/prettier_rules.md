# Prettifying PromQL expressions
This files contains rules for prettifying PromQL expressions.

Note: The current version of prettier does not preserve comments.

### Keywords
`max_characters_per_line`: Maximum number of characters that will be allowed on a single line in a prettified PromQL expression.

### Rules
1. A node exceeding the `max_characters_per_line` will qualify for split unless
   1. It is a `MatrixSelector`
   2. It is a `VectorSelector`. Label sets in a `VectorSelector` will be in the same line as metric_name, separated by commas and a space
   Note: Label groupings like `by`, `without`, `on`, `ignoring` will remain on the same line as their parent node
2. Nodes that are nested within another node will be prettified only if they exceed the `max_characters_per_line`
3. Expressions like `sum(expression) without (label_matchers)` will be modified to `sum without(label_matchers) (expression)`
4. Functional call args will be split to different lines if they exceed the `max_characters_per_line`
