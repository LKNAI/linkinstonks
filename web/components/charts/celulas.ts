// Estados de uma célula do mapa de calor: um nível de cor ou um dos dois casos sem cor.
export const CELULA_SEM_NEGOCIOS = "vazia";
export const CELULA_SEM_REFERENCIA = "semref";
export type Celula = number | typeof CELULA_SEM_NEGOCIOS | typeof CELULA_SEM_REFERENCIA;
