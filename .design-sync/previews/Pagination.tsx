import { Pagination } from 'sgspe-kit'

export const Paginas = () => (
  <div className="p-4">
    <Pagination page={2} totalPages={7} totalElements={128} onPage={() => {}} />
  </div>
)
