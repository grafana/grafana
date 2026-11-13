import FingerprintJS, { load } from '@fingerprintjs/fingerprintjs';

it.each([
  ['default', FingerprintJS.load],
  ['named', load],
] as const)('keeps real fingerprint generation without installation telemetry through the %s export', async (_, load) => {
  const open = jest.spyOn(XMLHttpRequest.prototype, 'open');
  // A regression must not send real telemetry while exercising the sampled branch.
  const send = jest.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {});
  const random = jest.spyOn(Math, 'random').mockReturnValue(0);

  try {
    // Sampling happens synchronously during load; restore randomness for fingerprint collection.
    const pendingAgent = load({ monitoring: true, delayFallback: 0 });
    random.mockRestore();
    const agent = await pendingAgent;
    const result = await agent.get();

    expect(result.visitorId).toMatch(/^[a-f0-9]{32}$/);
    expect(result.visitorId).toBe(FingerprintJS.hashComponents(result.components));
    expect(result.components).toHaveProperty('canvas');
    expect(result.components).toHaveProperty('languages');
    expect(open).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  } finally {
    random.mockRestore();
    open.mockRestore();
    send.mockRestore();
  }
});
