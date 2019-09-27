# Theming Grafana

## Overview

**Themes are implemented in Typescript.** That's because our goal is to share variables between Grafana Typescript code and SASS files. Theme definitions are located in `packages/grafana-ui/src/themes/[default|dark|light].ts` files. `default.ts` file holds common variables like typography and spacing definitions, while `[light|dark].ts` primarily specify colors used in themes.

## Usage
### Using themes in React components

#### Using `ThemeContext` directly

```tsx
import { ThemeContext } from '@grafana/ui';

<ThemeContext.Consumer>{theme => <Foo theme={theme} />}</ThemeContext.Consumer>;
```

or

```tsx
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

### Using themes in Storybook

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

### Using themes in Angular code

There should be very few cases where theme would be used in Angular context. For this purpose there is a function available that retrieves current theme: `import { getCurrentTheme } from app/core/utils/ConfigProvider`. Angular components should be migrated to React, or if that's not possible at the moment, styled using SASS.


## FAQ
### How can I modify SASS variable files?
> For the following to apply you need to run `yarn dev` task.

`[_variables|_variables.dark|_variables.light].generated.scss` files are the ones that are referenced in the main SASS files for SASS variables to be available. **These files are automatically generated and should never be modified by hand!**.

#### If you need to modify *SASS variable value* you need to modify corresponding Typescript file that is a source of the variables:
- `_variables.generated.scss` - modify `grafana-ui/src/themes/default.ts`
- `_variables.light.generated.scss` - modify `grafana-ui/src/themes/light.ts`
- `_variables.dark.generated.scss` - modify `grafana-ui/src/themes/dark.ts`

#### If you need to *add new variable* to SASS variables you need to modify corresponding template file:
- `_variables.generated.scss` - modify `grafana-ui/src/themes/_variables.scss.tmpl.ts`
- `_variables.light.generated.scss` - modify `grafana-ui/src/themes/_variables.light.scss.tmpl.ts`
- `_variables.dark.generated.scss` - modify `grafana-ui/src/themes/_variables.dark.scss.tmpl.ts`


## Limitations
### You must ensure ThemeContext provider is available in a React tree
  By default all react2angular directives have `ThemeContext.Provider` ensured. But, there are cases where we create another React tree via `ReactDOM.render`. This happens in case of graph legend rendering and `ReactContainer` directive. In such cases theme consumption will fail. To make sure theme context is available in such cases, you need to wrap your rendered component with ThemeContext.Provider using `provideTheme` function:

```ts
// graph.ts
import { provideTheme } from 'app/core/utils/ConfigProvider';

// Create component with ThemeContext.Provider first.
// Otherwise React will create new components every time it renders!
const LegendWithThemeProvider = provideTheme(Legend);

const legendReactElem = React.createElement(LegendWithThemeProvider, legendProps);
ReactDOM.render(legendReactElem, this.legendElem, () => this.renderPanel());
```

`provideTheme` makes current theme available via ThemeContext by checking if user has `lightTheme` set in her boot data.
