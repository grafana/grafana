import { testWithFeatureToggles } from 'test/test-utils';

import {
  FILTERED_GROUPS_LARGE_API_PAGE_SIZE,
  RULE_LIMIT_WITH_BACKEND_FILTERS,
  getFilteredRulesLimits,
} from 'app/features/alerting/unified/rule-list/paginationLimits';
import { type RulesFilter } from 'app/features/alerting/unified/search/rulesSearchParser';
import { getFilter } from 'app/features/alerting/unified/utils/search';

describe('paginationLimits', () => {
  describe('getFilteredRulesLimits', () => {
    describe('when backend filters are disabled', () => {
      testWithFeatureToggles({ disable: ['alertingUIUseBackendFilters', 'alertingUIUseFullyCompatBackendFilters'] });

      it('should return large grafana limit + small datasource limit for source selection alone', () => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(
          getFilter({ dataSourceNames: ['prometheus'] })
        );

        expect(grafanaManagedLimit).toEqual({ groupLimit: 2000 });
        expect(datasourceManagedLimit).toEqual({ groupLimit: 100 });
      });

      it.each<Partial<RulesFilter>>([
        { dataSourceNames: ['prometheus'], ruleName: 'alert' },
        { dataSourceNames: ['prometheus'], groupName: 'test-group' },
      ])('should return large limits for both when frontend filters are used: %p', (filterState) => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

        expect(grafanaManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
        expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
      });
    });

    describe('when alertingUIUseBackendFilters is enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseBackendFilters'] });

      it('should return rule limit for grafana + small datasource limit for source selection alone', () => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(
          getFilter({ dataSourceNames: ['prometheus'] })
        );

        expect(grafanaManagedLimit).toEqual({ ruleLimit: 100 });
        expect(datasourceManagedLimit).toEqual({ groupLimit: 100 });
      });

      it.each<Partial<RulesFilter>>([
        { dataSourceNames: ['prometheus'], ruleName: 'alert' },
        { dataSourceNames: ['prometheus'], groupName: 'test-group' },
      ])(
        'should return rule limit for grafana + large limit for datasource when only backend filters are used: %p',
        (filterState) => {
          const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

          expect(grafanaManagedLimit).toEqual({ ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS });
          expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
        }
      );
    });

    describe('when alertingUIUseFullyCompatBackendFilters is enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseFullyCompatBackendFilters'] });

      it('should return rule limit for grafana + small datasource limit for source selection alone', () => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(
          getFilter({ dataSourceNames: ['prometheus'] })
        );

        expect(grafanaManagedLimit).toEqual({ ruleLimit: 100 });
        expect(datasourceManagedLimit).toEqual({ groupLimit: 100 });
      });

      it.each<Partial<RulesFilter>>([
        { dataSourceNames: ['prometheus'], ruleName: 'alert' },
        { dataSourceNames: ['prometheus'], groupName: 'test-group' },
      ])('should return large limits for both when frontend filters are used: %p', (filterState) => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

        expect(grafanaManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
        expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
      });
    });

    describe('when both backend filter toggles are enabled', () => {
      testWithFeatureToggles({ enable: ['alertingUIUseBackendFilters', 'alertingUIUseFullyCompatBackendFilters'] });

      it('should return rule limit for grafana + small datasource limit for source selection alone', () => {
        const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(
          getFilter({ dataSourceNames: ['prometheus'] })
        );

        expect(grafanaManagedLimit).toEqual({ ruleLimit: 100 });
        expect(datasourceManagedLimit).toEqual({ groupLimit: 100 });
      });

      it.each<Partial<RulesFilter>>([
        { dataSourceNames: ['prometheus'], ruleName: 'alert' },
        { dataSourceNames: ['prometheus'], groupName: 'test-group' },
      ])(
        'should return rule limit for grafana + large limit for datasource when only backend filters are used: %p',
        (filterState) => {
          const { grafanaManagedLimit, datasourceManagedLimit } = getFilteredRulesLimits(getFilter(filterState));

          expect(grafanaManagedLimit).toEqual({ ruleLimit: RULE_LIMIT_WITH_BACKEND_FILTERS });
          expect(datasourceManagedLimit).toEqual({ groupLimit: FILTERED_GROUPS_LARGE_API_PAGE_SIZE });
        }
      );
    });
  });
});
