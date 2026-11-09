// une clases de Tailwind sin tailwind-merge: cn (@wasichai/ui) toma los tamaños de texto de SGSPE (text-sg-caption, text-sg-body-sm…)
// por colores y quita uno de los dos cuando van con text-sg-danger o text-sg-text. aquí no se descarta nada: quien llama no repite
// una propiedad
export const unir = (...clases: (string | false | null | undefined)[]): string => clases.filter(Boolean).join(' ')
