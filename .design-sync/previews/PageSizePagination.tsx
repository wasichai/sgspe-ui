import { PageSizePagination } from 'sgspe-kit'

export const ConTamano = () => (
  <div className="p-4">
    <PageSizePagination page={0} size={25} total={128} onPage={() => {}} onSize={() => {}} />
  </div>
)
