export async function fetchCustomersMulti(filters = {}) {
  if (!API_KEY) {
    throw new Error('VITE_API_KEY is required');
  }

  const params = new URLSearchParams({
    ws_key: API_KEY,
  });

  // ajouter les filtres dynamiques
  Object.entries(filters).forEach(([key, value]) => {
    params.append(`filter[${key}]`, `[${value}]`);
  });

  const url = `${API_BASE}/customers?${params.toString()}`;

  const res = await fetch(url);
  const text = await res.text();

  return parseXml(text, 'customer', {
    id: '@id',
    firstname: 'firstname',
    lastname: 'lastname',
    email: 'email',
  });
}