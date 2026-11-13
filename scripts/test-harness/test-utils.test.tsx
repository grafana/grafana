import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { configureStore as configureReduxStore, type Store } from '@reduxjs/toolkit';
import { Fragment, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { Provider, useStore } from 'react-redux';
// eslint-disable-next-line no-restricted-imports
import { MemoryRouter, useLocation as useLegacyLocation } from 'react-router-dom';
import { useLocation } from 'react-router-dom-v5-compat';
import { act, cleanup, getConfig, getWrapper, render, renderHook, screen, waitFor } from 'test/test-utils';

import { config, locationService, useChromeHeaderHeight, useLocationService } from '@grafana/runtime';
import { testWithFlags } from '@grafana/test-utils/feature-flags';
import { ModalsContext } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { appNotificationsReducer, readAllNotifications } from 'app/core/reducers/appNotification';
import * as storeModule from 'app/store/configureStore';
import * as appStore from 'app/store/store';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

// Harness-only roots do not discover the source suites' manual mock.
jest.mock('uwrap', () => jest.requireActual('../../packages/grafana-ui/src/components/Table/TableNG/__mocks__/uwrap'), {
  virtual: true,
});

function customStore() {
  // The probe only reads notifications; use a real reducer without the application's other slices.
  return configureReduxStore({
    reducer: { appNotifications: appNotificationsReducer },
    preloadedState: { appNotifications: { byId: {}, lastRead: 17 } },
  }) as Store<StoreState>;
}

function NotificationsProbe() {
  const lastRead = useSelector((state: StoreState) => state.appNotifications.lastRead);
  const dispatch = useDispatch();
  const headerHeight = useChromeHeaderHeight();
  return (
    <>
      <output aria-label="Last read">{lastRead}</output>
      <output aria-label="Header height">{headerHeight}</output>
      <button onClick={() => dispatch(readAllNotifications(23))}>Mark read</button>
    </>
  );
}

const preloadedState = { appNotifications: { byId: {}, lastRead: 19 } };

afterEach(() => {
  jest.restoreAllMocks();
});

it('renders with the supplied store and updates it without creating a default store', async () => {
  const configureStore = jest.spyOn(storeModule, 'configureStore');
  const store = customStore();
  const rendered = render(<NotificationsProbe />, { store });

  expect(screen.getByLabelText('Last read')).toHaveTextContent('17');
  expect(screen.getByLabelText('Header height')).toHaveTextContent('40');
  await rendered.user.click(screen.getByRole('button', { name: 'Mark read' }));
  expect(screen.getByLabelText('Last read')).toHaveTextContent('23');
  expect(store.getState().appNotifications.lastRead).toBe(23);
  expect(configureStore).not.toHaveBeenCalled();
  // The existing API returns only the store created from preloadedState, not the provider's fallback/custom store.
  expect(rendered.store).toBeUndefined();
});

it('creates a fresh real application store for each default render', async () => {
  const configureStore = jest.spyOn(storeModule, 'configureStore');
  const first = render(<NotificationsProbe />);
  const firstStore = appStore.store;
  const initialLastRead = firstStore.getState().appNotifications.lastRead;

  expect(configureStore).toHaveBeenNthCalledWith(1);
  expect(configureStore.mock.results[0].value).toBe(firstStore);
  await first.user.click(screen.getByRole('button', { name: 'Mark read' }));
  expect(screen.getByLabelText('Last read')).toHaveTextContent('23');
  expect(firstStore.getState().appNotifications.lastRead).toBe(23);
  expect(first.store).toBeUndefined();
  first.unmount();

  render(<NotificationsProbe />);
  expect(configureStore).toHaveBeenCalledTimes(2);
  expect(configureStore).toHaveBeenNthCalledWith(2);
  expect(appStore.store).not.toBe(firstStore);
  expect(appStore.store.getState().appNotifications.lastRead).toBe(initialLastRead);
  expect(screen.getByLabelText('Last read')).toHaveTextContent(String(initialLastRead));
});

it('returns the real preloaded store used by the providers', async () => {
  const configureStore = jest.spyOn(storeModule, 'configureStore');
  const rendered = render(<NotificationsProbe />, { preloadedState });

  expect(configureStore).toHaveBeenCalledTimes(1);
  expect(configureStore).toHaveBeenCalledWith(preloadedState);
  expect(rendered.store).toBe(appStore.store);
  expect(screen.getByLabelText('Last read')).toHaveTextContent('19');
  await rendered.user.click(screen.getByRole('button', { name: 'Mark read' }));
  expect(screen.getByLabelText('Last read')).toHaveTextContent('23');
  expect(rendered.store?.getState().appNotifications.lastRead).toBe(23);
});

it('preserves custom-store precedence when preloadedState is also supplied', async () => {
  const store = customStore();
  const rendered = render(<NotificationsProbe />, { store, preloadedState });

  expect(screen.getByLabelText('Last read')).toHaveTextContent('17');
  expect(rendered.store?.getState().appNotifications.lastRead).toBe(19);
  await rendered.user.click(screen.getByRole('button', { name: 'Mark read' }));
  expect(screen.getByLabelText('Last read')).toHaveTextContent('23');
  expect(store.getState().appNotifications.lastRead).toBe(23);
  expect(rendered.store?.getState().appNotifications.lastRead).toBe(19);
});

it('honors an explicit wrapper without creating the application providers or store', async () => {
  const configureStore = jest.spyOn(storeModule, 'configureStore');
  const store = customStore();
  const previousLocation = locationService;
  const wrapper = ({ children }: PropsWithChildren) => <Provider store={store}>{children}</Provider>;
  const rendered = render(<NotificationsProbe />, { wrapper });

  expect(screen.getByLabelText('Last read')).toHaveTextContent('17');
  await rendered.user.click(screen.getByRole('button', { name: 'Mark read' }));
  expect(screen.getByLabelText('Last read')).toHaveTextContent('23');
  expect(locationService).toBe(previousLocation);
  expect(configureStore).not.toHaveBeenCalled();
});

describe('getWrapper providers', () => {
  // Unmount flag subscribers before testWithFlags resets the provider in its inner afterEach.
  afterEach(cleanup);
  testWithFlags({ 'test-utils-provider': true });

  it('shares a custom store, routing history, context overrides, modals, and feature flags', async () => {
    const store = customStore();
    const contextConfig = { ...config, featureToggles: {} };
    const wrapper = getWrapper({
      store,
      renderWithRouter: true,
      historyOptions: { initialEntries: ['/initial?query=one'] },
      grafanaContext: { config: contextConfig },
    });
    const { result } = renderHook(
      () => ({
        store: useStore(),
        service: useLocationService(),
        legacyLocation: useLegacyLocation(),
        location: useLocation(),
        context: useGrafana(),
        modals: useContext(ModalsContext),
        enabled: useBooleanFlagValue('test-utils-provider', false),
      }),
      { wrapper }
    );

    expect(result.current.store).toBe(store);
    expect(result.current.context.config).toBe(contextConfig);
    expect(result.current.service).toBe(locationService);
    expect(result.current.legacyLocation.pathname).toBe('/initial');
    expect(result.current.location.search).toBe('?query=one');
    await waitFor(() => expect(result.current.enabled).toBe(true));

    act(() => result.current.modals.showModal(NotificationsProbe, {}));
    expect(result.current.modals.component).toBe(NotificationsProbe);
    act(() => result.current.service.push('/next'));
    expect(result.current.legacyLocation.pathname).toBe('/next');
    expect(result.current.location.pathname).toBe('/next');
    expect(result.current.modals.component).toBeNull();
  });

  it('uses a real default store when getWrapper receives no store', () => {
    const configureStore = jest.spyOn(storeModule, 'configureStore');
    const { result } = renderHook(() => useStore(), { wrapper: getWrapper({}) });

    expect(configureStore).toHaveBeenCalledTimes(1);
    expect(configureStore).toHaveBeenCalledWith();
    expect(result.current).toBe(appStore.store);
    act(() => result.current.dispatch(readAllNotifications(29)));
    expect(appStore.store.getState().appNotifications.lastRead).toBe(29);
  });
});

it('allows callers to own routing when renderWithRouter is false', () => {
  function LocationProbe() {
    return <output aria-label="Path">{useLegacyLocation().pathname}</output>;
  }

  render(
    <MemoryRouter initialEntries={['/caller-router']}>
      <LocationProbe />
    </MemoryRouter>,
    { store: customStore(), renderWithRouter: false }
  );

  expect(screen.getByLabelText('Path')).toHaveTextContent('/caller-router');
  expect(locationService.getLocation().pathname).toBe('/');
});

it('keeps Testing Library async wrapping for effect updates, user events, and waitFor', async () => {
  function AsyncProbe() {
    const [status, setStatus] = useState('loading');
    useEffect(() => {
      Promise.resolve().then(() => setStatus('ready'));
    }, []);
    return (
      <button
        onClick={async () => {
          await Promise.resolve();
          setStatus('finished');
        }}
      >
        {status}
      </button>
    );
  }

  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const rendered = render(<AsyncProbe />, { wrapper: Fragment });
  expect(getConfig().asyncUtilTimeout).toBe(2000);
  await rendered.user.click(await screen.findByRole('button', { name: 'ready' }));
  await waitFor(() => {
    expect(environment.IS_REACT_ACT_ENVIRONMENT).toBe(false);
    expect(screen.getByRole('button', { name: 'finished' })).toBeInTheDocument();
  });
  expect(environment.IS_REACT_ACT_ENVIRONMENT).toBe(true);
});
