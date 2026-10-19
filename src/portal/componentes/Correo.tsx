// un correo no tiene espacios y no se parte: en una columna estrecha empuja la tabla. se ofrece un corte antes de la «@» y se
// ve en dos líneas solo si no cabe; sin correo, «—»
export function Correo({ valor }: { valor: string | null | undefined }) {
  if (!valor) return <>—</>
  const arroba = valor.indexOf('@')
  if (arroba <= 0) return <>{valor}</>
  return (
    <>
      {valor.slice(0, arroba)}
      <wbr />
      {valor.slice(arroba)}
    </>
  )
}
