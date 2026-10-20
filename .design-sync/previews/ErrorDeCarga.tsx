import { ErrorDeCarga } from 'sgspe-kit'

export const ConReintento = () => (
  <div className="max-w-xl p-4">
    <ErrorDeCarga error={new TypeError('Failed to fetch')} alReintentar={() => {}} />
  </div>
)
