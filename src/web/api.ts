let csrf = '';
let session: Promise<void> | undefined;
async function establish() {
  session ??= fetch('/api/session')
    .then(async (response) => {
      if (!response.ok) throw new Error('Local session could not be established.');
      csrf = (await response.json()).csrf;
    })
    .finally(() => {
      session = undefined;
    });
  await session;
}
export async function api<T = any>(path: string, input?: unknown, renewed = false): Promise<T> {
  if (!csrf) await establish();
  const response = await fetch(
    '/api/' + path,
    input === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tesslane-Csrf': csrf },
          body: JSON.stringify(input),
        },
  );
  const result = await response.json();
  if ([401, 403].includes(response.status) && !renewed) {
    csrf = '';
    await establish();
    return api<T>(path, input, true);
  }
  if (!response.ok) throw new Error(result.error ?? 'Request failed.');
  return result;
}
export function renewSession() {
  csrf = '';
  return establish();
}
