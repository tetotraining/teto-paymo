export async function onRequest(context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  let html = await response.text();
  if (!html.includes('/paymo-mobile-ui.js')) html = html.replace('</head>', '<script src="/paymo-mobile-ui.js"></script>\n</head>');
  if (!html.includes('/paymo-main-swipe.js')) html = html.replace('</head>', '<script src="/paymo-main-swipe.js"></script>\n</head>');
  if (!html.includes('/paymo-edge-shadow.js')) html = html.replace('</head>', '<script src="/paymo-edge-shadow.js"></script>\n</head>');
  if (!html.includes('/paymo-d1.js')) html = html.replace('</body>', '<script src="/paymo-d1.js"></script>\n</body>');
  if (!html.includes('/paymo-design.js')) html = html.replace('</body>', '<script src="/paymo-design.js"></script>\n</body>');
  if (!html.includes('/paymo-items.js')) html = html.replace('</body>', '<script src="/paymo-items.js"></script>\n</body>');
  if (!html.includes('/paymo-labels.js')) html = html.replace('</body>', '<script src="/paymo-labels.js"></script>\n</body>');
  if (!html.includes('/paymo-periods.js')) html = html.replace('</body>', '<script src="/paymo-periods.js"></script>\n</body>');
  if (!html.includes('/paymo-history-payment.js')) html = html.replace('</body>', '<script src="/paymo-history-payment.js"></script>\n</body>');
  if (!html.includes('/paymo-installments.js')) html = html.replace('</body>', '<script src="/paymo-installments.js"></script>\n</body>');
  if (!html.includes('/paymo-installments-layout.js')) html = html.replace('</body>', '<script src="/paymo-installments-layout.js"></script>\n</body>');
  if (!html.includes('/paymo-history-api.js')) html = html.replace('</body>', '<script src="/paymo-history-api.js"></script>\n</body>');
  if (!html.includes('/paymo-history-edit.js')) html = html.replace('</body>', '<script src="/paymo-history-edit.js"></script>\n</body>');
  if (!html.includes('/paymo-paid.js')) html = html.replace('</body>', '<script src="/paymo-paid.js"></script>\n</body>');
  if (!html.includes('/paymo-history-delete-confirm.js')) html = html.replace('</body>', '<script src="/paymo-history-delete-confirm.js"></script>\n</body>');
  if (!html.includes('/paymo-ui-rules.js')) html = html.replace('</body>', '<script src="/paymo-ui-rules.js"></script>\n</body>');
  if (!html.includes('/paymo-bulk-history-delete.js')) html = html.replace('</body>', '<script src="/paymo-bulk-history-delete.js"></script>\n</body>');

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
