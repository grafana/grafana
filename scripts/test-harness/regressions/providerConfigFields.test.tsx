import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { addResourceBundle, changeLanguage, getI18nInstance, initializeI18n } from '@grafana/i18n/internal';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { FieldRenderer } from 'app/features/auth-config/FieldRenderer';
import { fieldMap, getField } from 'app/features/auth-config/fields';
import { type SSOProviderDTO } from 'app/features/auth-config/types';

function ClientIdField() {
  const form = useForm<SSOProviderDTO>({ defaultValues: { clientId: 'client-123' } });
  return <FieldRenderer {...form} field="clientId" provider="github" errors={{}} secretConfigured={false} />;
}

const formValues: SSOProviderDTO = { teamIds: [], allowedOrganizations: [] };
const originalFileSystemAvailability = config.localFileSystemAvailable;

beforeAll(async () => {
  await initializeI18n({ language: 'en-US', ns: ['translation'] });
});

afterEach(async () => {
  jest.restoreAllMocks();
  config.localFileSystemAvailable = originalFileSystemAvailability;
  getI18nInstance().removeResourceBundle('fr-FR', 'translation');
  await changeLanguage('en-US');
});

it('renders a field without constructing descriptions for unrelated fields', () => {
  const translate = jest.spyOn(getI18nInstance(), 't');

  render(<ClientIdField />);

  expect(screen.getByRole('textbox', { name: /Client ID/ })).toHaveValue('client-123');
  expect(screen.getByText('The Client ID of your OAuth2 app.')).toBeInTheDocument();
  const descriptions = translate.mock.calls
    .map(([key]) => key)
    .filter((key) => typeof key === 'string' && key.startsWith('auth-config.fields.') && key.includes('description'));
  expect([...new Set(descriptions)]).toEqual(['auth-config.fields.client-id-description']);
});

it('keeps the eager map enumerable with the select metadata used by DTO conversions', () => {
  jest.replaceProperty(contextSrv, 'isGrafanaAdmin', false);
  const fields = fieldMap('github');

  expect(
    Object.entries(fields)
      .filter(([, field]) => field.type === 'select')
      .map(([name, field]) => [name, field.multi])
  ).toEqual([
    ['clientAuthentication', false],
    ['allowedOrganizations', true],
    ['allowedDomains', true],
    ['authStyle', false],
    ['scopes', true],
    ['allowedGroups', true],
    ['orgMapping', true],
    ['teamIds', true],
    ['loginPrompt', false],
  ]);
  expect(fields.clientId).toEqual({
    label: 'Client ID',
    type: 'text',
    description: 'The Client ID of your OAuth2 app.',
    validation: { required: true, message: 'This field is required' },
  });

  jest.replaceProperty(contextSrv, 'isGrafanaAdmin', true);
  expect(fields.orgMapping.hidden).toBe(true);
  expect(getField('github', 'orgMapping').hidden).toBe(false);
});

it('uses the requested provider for options and validation on successive lookups', () => {
  expect(getField('azuread', 'clientAuthentication').options).toEqual([
    { value: 'none', label: 'None' },
    { value: 'client_secret_post', label: 'Client secret' },
    { value: 'managed_identity', label: 'Managed identity' },
    { value: 'workload_identity', label: 'Workload identity' },
  ]);
  expect(getField('github', 'clientAuthentication').options).toEqual([
    { value: 'none', label: 'None' },
    { value: 'client_secret_post', label: 'Client secret' },
  ]);

  const teamIds = getField('github', 'teamIds');
  expect(teamIds.validation?.validate?.('42', formValues)).toBe(true);
  expect(teamIds.validation?.validate?.('not-a-number', formValues)).toBe(false);
  expect(teamIds.validation?.validate?.([{ value: '42' }, { value: 'invalid' }], formValues)).toBe(false);
  expect(teamIds.validation?.message).toBe('Team IDs must be numbers.');
  expect(getField('gitlab', 'teamIds').validation).toBeUndefined();

  const allowedGroups = getField('azuread', 'allowedGroups');
  expect(allowedGroups.validation?.validate?.('300f9b7c-0488-40db-9763-a22ce8bf6b3e', formValues)).toBe(true);
  expect(allowedGroups.validation?.validate?.('not-a-uuid', formValues)).toBe(false);
  expect(getField('github', 'allowedGroups').validation).toBeUndefined();
});

it('returns fresh option arrays and defaults instead of sharing mutable field data', () => {
  const scopes = getField('github', 'scopes');
  scopes.options?.push({ label: 'user:email', value: 'user:email' });
  expect(getField('github', 'scopes').options).toEqual([]);
  expect(fieldMap('github').scopes.options).toEqual([]);

  const authentication = getField('azuread', 'clientAuthentication');
  if (!authentication.defaultValue) {
    throw new Error('Client authentication must have a default value');
  }
  authentication.defaultValue.value = 'workload_identity';
  expect(getField('azuread', 'clientAuthentication').defaultValue).toEqual({ value: 'none', label: 'None' });
});

describe.each([
  { name: 'selective lookup', read: getField },
  { name: 'eager map', read: (provider: string, name: string) => fieldMap(provider)[name] },
])('$name', ({ read }) => {
  it('rereads admin permissions and filesystem availability on each call', () => {
    jest.replaceProperty(contextSrv, 'isGrafanaAdmin', false);
    config.localFileSystemAvailable = false;

    expect(read('generic_oauth', 'orgMapping').hidden).toBe(true);
    expect(read('generic_oauth', 'allowAssignGrafanaAdmin').hidden).toBe(true);
    expect(read('generic_oauth', 'orgAttributePath').hidden).toBe(true);
    expect(read('generic_oauth', 'tlsClientCa').hidden).toBe(true);
    expect(read('generic_oauth', 'tlsClientCert').hidden).toBe(true);
    expect(read('generic_oauth', 'tlsClientKey').hidden).toBe(true);

    jest.replaceProperty(contextSrv, 'isGrafanaAdmin', true);
    config.localFileSystemAvailable = true;

    expect(read('generic_oauth', 'orgMapping').hidden).toBe(false);
    expect(read('generic_oauth', 'allowAssignGrafanaAdmin').hidden).toBe(false);
    expect(read('generic_oauth', 'orgAttributePath').hidden).toBe(false);
    expect(read('generic_oauth', 'tlsClientCa').hidden).toBe(false);
    expect(read('generic_oauth', 'tlsClientCert').hidden).toBe(false);
    expect(read('generic_oauth', 'tlsClientKey').hidden).toBe(false);
    expect(read('github', 'orgAttributePath').hidden).toBe(true);
  });

  it('refreshes translated labels and interpolation after a locale change', async () => {
    const english = read('generic_oauth', 'orgAttributePath');
    expect(english.label).toBe('Organization attribute path');

    addResourceBundle('fr-FR', 'translation', {
      'auth-config': {
        fields: {
          'organization-mapping-label': 'Correspondance des organisations',
          'organization-attribute-path-label': 'Chemin de l’attribut d’organisation',
          'organization-attribute-path-description': '{{ orgMappingLabel }} / {{ orgAttributePathLabel }}',
        },
      },
    });
    await changeLanguage('fr-FR');

    const french = read('generic_oauth', 'orgAttributePath');
    expect(french.label).toBe('Chemin de l’attribut d’organisation');
    expect(french.description).toBe('Correspondance des organisations / Chemin de l’attribut d’organisation');
    expect(english.label).toBe('Organization attribute path');

    await changeLanguage('en-US');
    expect(read('generic_oauth', 'orgAttributePath').label).toBe('Organization attribute path');
  });
});
