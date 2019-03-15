# Frontend Review Checklist

## High level checks

- [ ] The pull request adds value and the impact of the change is in line with [Frontend Style Guide](https://github.com/grafana/grafana/blob/master/style_guides/frontend.md).
- [ ] The pull request works the way it says it should do.
- [ ] The pull request does not increase the Angular code base.
  > We are in the process of migrating to React so any increment of Angular code is generally discouraged from. (there are a few exceptions)
- [ ] The pull request closes one issue if possible and does not fix unrelated issues within the same pull request.
- [ ] The pull request contains necessary tests.

## Low level checks

- [ ] The pull request contains a title that explains the PR.
- [ ] The pull request contains necessary link(s) to issue(s).
- [ ] The pull request contains commits with commit messages that are small and understandable.
- [ ] The pull request does not contain magic strings or numbers that could be replaced with an `Enum` or `const` instead.
- [ ] The pull request does not increase the number of `implicit any` errors.
- [ ] The pull request does not contain uses of `any` or `{}` that are unexplainable.
- [ ] The pull request does not contain large React component that could easily be split into several smaller components.
- [ ] The pull request does not contain back end calls directly from components, use actions and Redux instead.

### Bug specific checks

- [ ] The pull request contains only one commit if possible.
- [ ] The pull request contains `closes: #Issue` or `fixes: #Issue` in pull request description.

### Redux specific checks (skip if pull request does not contain Redux changes)

- [ ] The pull request does not contain code that mutate state in reducers or thunks.
- [ ] The pull request uses helpers `actionCreatorFactory` and `reducerFactory` instead of traditional `switch statement` reducers in Redux.
- [ ] The pull request uses `reducerTester` to test reducers.
- [ ] The pull request does not contain code that access reducers state slice directly, instead the code uses state selectors to access state.

## Common bad practices

### 1. Missing Props/State type

- React Component definitions

  ```jsx
  // good
  export class YourClass extends PureComponent<{},{}> { ... }

  // bad
  export class YourClass extends PureComponent { ... }
  ```

- React Component constructor

  ```typescript
  // good
  constructor(props:Props) {...}

  // bad
  constructor(props) {...}
  ```

- React Component defaultProps

  ```typescript
  // good
  static defaultProps: Partial<Props> = { ... }

  // bad
  static defaultProps = { ... }
  ```
