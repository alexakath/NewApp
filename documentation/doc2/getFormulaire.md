import { useState } from 'react';

export default function Form() {
  const [name, setName] = useState('');

  return (
    <div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <p>{name}</p>
    </div>
  );
}



import { useState } from 'react';

export default function Form() {
  const [form, setForm] = useState({
    firstname: '',
    lastname: '',
    email: '',
  });

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  return (
    <form>
      <input
        name="firstname"
        value={form.firstname}
        onChange={handleChange}
      />

      <input
        name="lastname"
        value={form.lastname}
        onChange={handleChange}
      />

      <input
        name="email"
        value={form.email}
        onChange={handleChange}
      />
    </form>
  );
}



<input
  type="checkbox"
  checked={active}
  onChange={(e) => setActive(e.target.checked)}
/>



<select
  value={country}
  onChange={(e) => setCountry(e.target.value)}
>
  <option value="mg">Madagascar</option>
  <option value="fr">France</option>
</select>