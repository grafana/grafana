# Redux framework

To reduce the amount of boilerplate code used to create a strongly typed redux solution with actions, action creators, reducers and tests we've introduced a small framework around Redux.

`+` Much less boilerplate code
`-` Non Redux standard api

## New core functionality

### actionCreatorFactory

Used to create an action creator with the following signature

```typescript
{ type: string , (payload: T): {type: string; payload: T;} }
```

where the `type` string will be ensured to be unique and `T` is the type supplied to the factory.

#### Example

```typescript
export const someAction = actionCreatorFactory<string>('SOME_ACTION').create();

// later when dispatched
someAction('this rocks!');
```

```typescript
// best practices, always use an interface as type
interface SomeAction {
  data: string;
}
export const someAction = actionCreatorFactory<SomeAction>('SOME_ACTION').create();

// later when dispatched
someAction({ data: 'best practices' });
```

```typescript
// declaring an action creator with a type string that has already been defined will throw
export const someAction = actionCreatorFactory<string>('SOME_ACTION').create();
export const theAction = actionCreatorFactory<string>('SOME_ACTION').create(); // will throw
```

### noPayloadActionCreatorFactory

Used when you don't need to supply a payload for your action. Will create an action creator with the following signature

```typescript
{ type: string , (): {type: string; payload: undefined;} }
```

where the `type` string will be ensured to be unique.

#### Example

```typescript
export const noPayloadAction = noPayloadActionCreatorFactory('NO_PAYLOAD').create();

// later when dispatched
noPayloadAction();
```

```typescript
// declaring an action creator with a type string that has already been defined will throw
export const noPayloadAction = noPayloadActionCreatorFactory('NO_PAYLOAD').create();
export const noAction = noPayloadActionCreatorFactory('NO_PAYLOAD').create(); // will throw
```

### reducerFactory

Fluent API used to create a reducer. (same as implementing the standard switch statement in Redux)

#### Example

```typescript
interface ExampleReducerState {
  data: string[];
}

const intialState: ExampleReducerState = { data: [] };

export const someAction = actionCreatorFactory<string>('SOME_ACTION').create();
export const otherAction = actionCreatorFactory<string[]>('Other_ACTION').create();

export const exampleReducer = reducerFactory<ExampleReducerState>(intialState)
  // addMapper is the function that ties an action creator to a state change
  .addMapper({
    // action creator to filter out which mapper to use
    filter: someAction,
    // mapper function where the state change occurs
    mapper: (state, action) => ({ ...state, data: state.data.concat(action.payload) }),
  })
  // a developer can just chain addMapper functions until reducer is done
  .addMapper({
    filter: otherAction,
    mapper: (state, action) => ({ ...state, data: action.payload }),
  })
  .create(); // this will return the reducer
```

#### Typing limitations

There is a challenge left with the mapper function that I can not solve with TypeScript. The signature of a mapper is

```typescript
<State, Payload>(state: State, action: ActionOf<Payload>) => State;
```

If you would to return an object that is not of the state type like the following mapper

```typescript
mapper: (state, action) => ({ nonExistingProperty: ''}),
```

Then you would receive the following compile error

```shell
[ts] Property 'data' is missing in type '{ nonExistingProperty: string; }' but required in type 'ExampleReducerState'. [2741]
```

But if you return an object that is spreading state and add a non existing property type like the following mapper

```typescript
mapper: (state, action) => ({ ...state, nonExistingProperty: ''}),
```

Then you would not receive any compile error.

If you want to make sure that never happens you can just supply the State type to the mapper callback like the following mapper:

```typescript
mapper: (state, action): ExampleReducerState => ({ ...state, nonExistingProperty: 'kalle' }),
```

Then you would receive the following compile error

```shell
[ts]
Type '{ nonExistingProperty: string; data: string[]; }' is not assignable to type 'ExampleReducerState'.
  Object literal may only specify known properties, and 'nonExistingProperty' does not exist in type 'ExampleReducerState'. [2322]
```

## New test functionality

### reducerTester

Fluent API that simplifies the testing of reducers

#### Example

```typescript
reducerTester()
  .givenReducer(someReducer, initialState)
  .whenActionIsDispatched(someAction('reducer tests'))
  .thenStateShouldEqual({ ...initialState, data: 'reducer tests' });
```
