## Core changes

JS is the primary source of theme variables for Grafana. Theme definitions are located in `packages/grafana-ui/src/themes` directory.

#### Themes are implemented in pure js.

That's because our goal is to share variables between Grafana app and SASS files.

#### Themes are available to React components via `ThemeContext`

ThemeContext is available via `import { ThemeContext } from '@grafana/ui';`

## Using themes in Grafana's React components

#### Using `ThemeContext` directly

```ts
import { ThemeContext } from '@grafana/ui';

<ThemeContext.Consumer>{theme => <Foo theme={theme} />}</ThemeContext.Consumer>;
```

or

```ts
import React, { useContext } from 'react';
import { ThemeContext } from '@grafana/ui';

const Foo: React.FunctionComponent<FooProps> = () => {
  const theme = useContext(ThemeContext);

  // Your component has access to the theme variables now
}

```

#### Using `withTheme` HOC

With this method your component will be automatically wrapped in `ThemeContext.Consumer` and provided with current theme via `theme` prop. Component used with `withTheme` must implement `Themeable` interface.

```ts
import  { ThemeContext, Themeable } from '@grafana/ui';

interface FooProps extends Themeable {}

const Foo: React.FunctionComponent<FooProps> = () => ...

export default withTheme(Foo);
```

### Storybook

All stories are wrapped with `ThemeContext.Provider` using global decorator. To render `Themeable` component that's not wrapped by `withTheme` HOC you either create a new component in your story:

```tsx
// Foo.story.tsx
const FooWithTheme = withTheme(Foo);

FooStories.add('Story' () => {
  return <FooWithTheme />
});
```

or use `renderComponentWithTheme` helper:

```tsx
// Bar.story.tsx

BarStories.add('Story' () => {
  return renderComponentWithTheme(Bar, /* pass props here */)
});
```

### Angular

There should be very few cases where theme would be used in Angular context. For this purpise there is a function available that retrieves current theme: `import { getCurrentTheme } from app/core/utils/ConfigProvider`

## Limitations

- #### Hot updates
  Changes in JS theme files _are not subject of hot updates_ during development. This applies to styles that comes from SASS files (which means 100% until we introduce css in js approach). This is a consequence of the fact that `getThemeVariable` util is executed during webpack pipeline.
- #### You must ensure ThemeContext provider is available in a React tree
  By default all react2angular directives have `ThemeContext.Provider` ensured. But, there are cases where we create another React tree via `ReactDOM.render`. This happens in case of graph legend rendering and `ReactContainer` directive. In such cases theme consumption will fail. To make sure theme context is available in such cases, you need to wrap your rendered component with ThemeContext.Provider using `provideTheme` function:

```typescript
// graph.ts
import { provideTheme } from 'app/core/utils/ConfigProvider';

// Create component with ThemeContext.Provider first.
// Otherwise React will create new components every time it renders!
const LegendWithThemeProvider = provideTheme(Legend);

const legendReactElem = React.createElement(LegendWithThemeProvider, legendProps);
ReactDOM.render(legendReactElem, this.legendElem, () => this.renderPanel());
```

`provideTheme` makes current theme available via ThemeContext by checking if user has `lightTheme` set in her boot data.
