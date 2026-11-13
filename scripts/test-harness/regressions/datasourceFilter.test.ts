import { hasDatasourceClientSideFilters } from 'app/features/alerting/unified/rule-list/hooks/datasourceFilter';
import { RuleHealth, type RulesFilter } from 'app/features/alerting/unified/search/rulesSearchParser';
import { getDatasourceAPIUid } from 'app/features/alerting/unified/utils/datasource';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

jest.mock('app/features/alerting/unified/utils/datasource');

const getDatasourceAPIUidMock = jest.mocked(getDatasourceAPIUid);

getDatasourceAPIUidMock.mockImplementation((ruleSourceName) => {
  if (ruleSourceName === 'prometheus') {
    return 'datasource-uid-1';
  }
  if (ruleSourceName === 'loki') {
    return 'datasource-uid-3';
  }
  throw new Error(`Unknown datasource name: ${ruleSourceName}`);
});

describe('hasDatasourceClientSideFilters', () => {
  it.each<Partial<RulesFilter>>([
    {},
    { dataSourceNames: [] },
    { dataSourceNames: ['prometheus'] },
    { dataSourceNames: ['prometheus', 'loki'] },
  ])('does not require client-side filtering for source selection alone: %p', (filterState) => {
    expect(hasDatasourceClientSideFilters(filterState)).toBe(false);
  });

  it.each<Partial<RulesFilter>>([
    { freeFormWords: ['cpu'] },
    { ruleName: 'alert' },
    { ruleState: PromAlertingRuleState.Firing },
    { ruleType: PromRuleType.Alerting },
    { labels: ['severity=critical'] },
    { ruleHealth: RuleHealth.Ok },
    { dashboardUid: 'test-dashboard' },
    { plugins: 'hide' },
    { contactPoint: 'slack' },
    { namespace: 'production' },
    { groupName: 'test-group' },
  ])('requires client-side filtering with or without source selection: %p', (filterState) => {
    expect(hasDatasourceClientSideFilters(filterState)).toBe(true);
    expect(hasDatasourceClientSideFilters({ ...filterState, dataSourceNames: ['prometheus'] })).toBe(true);
  });
});
