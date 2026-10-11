// un ENUM de DynamicForm (@wasichai/core) no es un <select> nativo: es un Select de Radix, un <button role="combobox"> que dice la
// opción elegida, con un <select> nativo oculto (aria-hidden) a su lado que Radix sincroniza. en jsdom la opción se elige con
// userEvent.selectOptions sobre ese select oculto; el valor que se ve se comprueba con toHaveTextContent en el combobox
export const selectNativo = (combobox: HTMLElement): HTMLSelectElement => {
  const select = combobox.parentElement?.querySelector('select')
  if (!select) throw new Error('el combobox no tiene un select nativo a su lado')
  return select
}
