// @vitest-environment happy-dom
import { createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { typeRef } from '../src/injected/actions';
import { chooseOption } from '../src/injected/input';
(globalThis as any).__sendaInput = { chooseOption };
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function Form() {
  const [role, setRole] = useState('');
  const [langs, setLangs] = useState<string[]>([]);
  return h(
    'form',
    null,
    h(
      'select',
      { name: 'role', 'data-senda-ref': '1', value: role, onChange: (e: any) => setRole(e.target.value) },
      h('option', { value: '' }, 'Choose'),
      h('option', { value: 'm' }, 'Gerente'),
    ),
    h(
      'select',
      {
        name: 'langs',
        multiple: true,
        'data-senda-ref': '2',
        value: langs,
        onChange: (e: any) => setLangs([...e.target.selectedOptions].map((o: HTMLOptionElement) => o.value)),
      },
      h('option', { value: 'en' }, 'English'),
      h('option', { value: 'es' }, 'Español'),
      h('option', { value: 'fr' }, 'Français'),
    ),
    h('output', null, `${role}|${langs.join(',')}`),
  );
}

describe('dropdowns in React forms', () => {
  it('updates controlled single and multiple selects', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const root = createRoot(document.querySelector('#app')!);
    await act(async () => root.render(h(Form)));
    await act(async () => void (await typeRef('1', 'Gerente')));
    await act(async () => void (await typeRef('2', ['es', 'English'])));
    expect(document.querySelector('output')!.textContent).toBe('m|en,es');
    const [role, langs] = [...document.querySelectorAll('select')];
    expect([role!.value, [...langs!.selectedOptions].map((o) => o.value)]).toEqual(['m', ['en', 'es']]);
    await act(async () => root.unmount());
  });
});
