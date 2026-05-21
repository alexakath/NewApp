export async function fetchUser(id) {
  const res = await fetch(buildUrl(`/customers/${id}`));
  const text = await res.text();

  const customers = parseXml(text, 'customer', {
    id: '@id',
    firstname: 'firstname',
    lastname: 'lastname',
    email: 'email',
    active: 'active',
    note: 'note',
    is_guest: 'is_guest',
    id_shop: 'id_shop',
    id_shop_group: 'id_shop_group',
    date_add: 'date_add',
    date_upd: 'date_upd',
  });

  return customers[0] || null;
}


export async function fetchCustomers() {
  const res = await fetch(buildUrl('/customers'));
  const text = await res.text();

  return parseXml(text, 'customer', {
    id: '@id',
    href: '@xlink:href',
  });
}


export async function fetchClients() {
  const clients = await fetchCustomers();

  const fullClients = await Promise.all(
    clients.map(async (client) => {
      const user = await fetchUser(client.id);
      return {
        ...client,
        ...user,
      };
    })
  );

  return fullClients;
}