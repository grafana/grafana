import { type DashboardDTO } from 'app/types/dashboard';

const mockGetDashboardDTO = jest.fn<Promise<DashboardDTO>, [string]>();
const mockGetDashboardAPI = jest.fn(() => Promise.resolve({ getDashboardDTO: mockGetDashboardDTO }));
const mockLoadDashboardAPI = jest.fn(() => ({ getDashboardAPI: mockGetDashboardAPI }));

jest.mock('app/features/dashboard/api/dashboard_api', () => mockLoadDashboardAPI());

// Observe import-time loading before requests without resetting the module registry.
const { backendSrv } = jest.requireActual<typeof import('app/core/services/backend_srv')>('app/core/services/backend_srv');
const dashboardAPIWasLoadedOnImport = mockLoadDashboardAPI.mock.calls.length > 0;

describe('backendSrv.getDashboardByUid', () => {
  beforeEach(() => {
    mockGetDashboardDTO.mockReset();
    mockGetDashboardAPI.mockReset();
    mockGetDashboardAPI.mockImplementation(() => Promise.resolve({ getDashboardDTO: mockGetDashboardDTO }));

    const warn = console.warn;
    jest.spyOn(console, 'warn').mockImplementation((message, ...args) => {
      if (
        message !==
          '[Deprecation warning] backend_srv: getDashboardByUid(uid) is deprecated. Use getDashboardAPI().getDashboardDTO(uid) instead' ||
        args.length > 0
      ) {
        warn(message, ...args);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads the v1 API on demand and returns the dashboard for the supplied UID', async () => {
    const dashboard: DashboardDTO = {
      dashboard: { uid: 'dashboard-uid', title: 'Dashboard', schemaVersion: 41 },
      meta: { canSave: true },
    };
    mockGetDashboardDTO.mockResolvedValue(dashboard);

    await expect(backendSrv.getDashboardByUid('dashboard-uid')).resolves.toBe(dashboard);

    expect(dashboardAPIWasLoadedOnImport).toBe(false);
    expect(mockLoadDashboardAPI).toHaveBeenCalledTimes(1);
    expect(mockGetDashboardAPI).toHaveBeenCalledTimes(1);
    expect(mockGetDashboardAPI).toHaveBeenCalledWith('v1');
    expect(mockGetDashboardDTO).toHaveBeenCalledTimes(1);
    expect(mockGetDashboardDTO).toHaveBeenCalledWith('dashboard-uid');
  });

  it('propagates an API initialization failure without requesting a dashboard', async () => {
    const error = new Error('Dashboard API initialization failed');
    mockGetDashboardAPI.mockRejectedValueOnce(error);

    await expect(backendSrv.getDashboardByUid('dashboard-uid')).rejects.toBe(error);

    expect(mockGetDashboardAPI).toHaveBeenCalledWith('v1');
    expect(mockGetDashboardDTO).not.toHaveBeenCalled();
  });

  it('propagates a dashboard request failure', async () => {
    const error = new Error('Dashboard request failed');
    mockGetDashboardDTO.mockRejectedValueOnce(error);

    await expect(backendSrv.getDashboardByUid('dashboard-uid')).rejects.toBe(error);

    expect(mockGetDashboardAPI).toHaveBeenCalledWith('v1');
    expect(mockGetDashboardDTO).toHaveBeenCalledWith('dashboard-uid');
  });
});
