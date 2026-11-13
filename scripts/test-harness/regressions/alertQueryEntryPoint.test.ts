import { mockDataQuery, mockThresholdExpression } from 'app/features/alerting/unified/mocks';
import { areQueriesTransformableToSimpleCondition } from 'app/features/alerting/unified/rule-editor/formProcessing';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { mockDataSource } from 'app/features/alerting/unified/testSetup/mockDataSource';
import { getInstantFromDataQuery } from 'app/features/alerting/unified/utils/query';

jest.mock(
  'uwrap',
  () => jest.requireActual('../../../packages/grafana-ui/src/components/Table/TableNG/__mocks__/uwrap'),
  { virtual: true }
);

it.each(['prometheus', 'grafana-amazonprometheus-datasource', 'grafana-azureprometheus-datasource'])(
  'classifies %s queries without loading dashboard form conversion',
  (type) => {
    setupDataSources(mockDataSource({ type, uid: 'source', name: 'source' }));
    const query = { ...mockDataQuery({ refId: 'A' }), datasourceUid: 'source' };
    const threshold = mockThresholdExpression({ expression: 'A' });

    expect(getInstantFromDataQuery(query)).toBe(true);
    expect(areQueriesTransformableToSimpleCondition([query], [threshold])).toBe(true);
    expect(
      areQueriesTransformableToSimpleCondition([{ ...query, model: { ...query.model, instant: false } }], [threshold])
    ).toBe(false);

    const loaded = Object.keys(require.cache).map((file) => file.replace(/\\/g, '/'));
    expect(loaded).toContain(require.resolve('app/features/alerting/unified/utils/query').replace(/\\/g, '/'));
    expect(
      loaded.filter((file) =>
        /\/(?:alerting\/unified\/utils\/rule-form\.ts|dashboard-scene\/scene\/DashboardScene\.tsx)$/.test(file)
      )
    ).toEqual([]);
  }
);
