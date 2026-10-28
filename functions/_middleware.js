export async function onRequest(context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();
  if (!html.includes('/paymo-d1.js')) {
    html = html.replace('</body>', '<script src="/paymo-d1.js"></script>\n</body>');
  }
  if (!html.includes('/paymo-design.js')) {
    html = html.replace('</body>', '<script src="/paymo-design.js"></script>\n</body>');
  }
  if (!html.includes('/paymo-items.js')) {
    html = html.replace('</body>', '<script src="/paymo-items.js"></script>\n</body>');
  }
  if (!html.includes('/paymo-labels.js')) {
    html = html.replace('</body>', '<script src="/paymo-labels.js"></script>\n</body>');
  }
  if (!html.includes('/paymo-periods.js')) {
    html = html.replace('</body>', '<script src="/paymo-periods.js"></script>\n</body>');
  }
  if (!html.includes('/paymo-history-payment.js')) {
    html = html.replace('</body>', '<script src="/paymo-history-payment.js"></script>\n</body>');
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
