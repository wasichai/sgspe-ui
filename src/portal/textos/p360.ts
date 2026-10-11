// Project 360: equipo y parámetros (S11), resumen (S08) y lo que comparten con el asistente de proyecto (S07)
export const ES_P360 = {
  resumen: {
    jefatura: 'Jefatura',
    jefaturaConError: 'No se pudo leer',
    etapa: 'Etapa',
    fase: 'Fase de exploración',
    completar: 'Completar proyecto',
    resumenIa: 'Resumen con IA',
    iaLlega: 'El resumen con IA llega en F7',
    registrarInteraccion: 'Registrar interacción',
    atencion: 'Atención requerida',
    sinAtencion: 'Nada pide atención hoy en lo que llega en F2.',
    actaPendiente: '{{titulo}}: acta por redactar',
    sinContacto: '{{nombre}}: sin contacto hace más de {{dias}} días',
    evaluacionVencida: '{{nombre}}: evaluación con más de {{dias}} días',
    nuncaContactado: '{{nombre}}: sin contacto registrado',
    fuentes: { interacciones: 'Interacciones', grupos: 'Grupos de interés' },
    salud: 'Salud del proyecto',
    kpis: {
      gruposVigentes: 'Grupos de interés vigentes',
      interacciones: 'Interacciones realizadas este mes',
      compromisos: 'Compromisos abiertos',
      qcs: 'QCS abiertas',
      riesgos: 'Riesgos altos'
    },
    paisaje: 'Paisaje de grupos de interés',
    posturas: 'Posturas',
    matriz: 'Interés × poder',
    sinEvaluar: '{{n}} sin evaluar',
    verMatriz: 'Ver la matriz',
    reuniones: 'Reuniones al mes frente a la meta',
    reunionesMes: '{{mes}}: {{valor}} de {{meta}}',
    sinReuniones: 'Aún no hay meses con reuniones que comparar con la meta.',
    areas: 'Áreas de influencia vigentes',
    sinAreas: 'Aún no hay un área aprobada',
    verMapa: 'Ver en el mapa',
    actividad: 'Actividad reciente',
    sinActividad: 'Este proyecto aún no tiene actividad registrada.'
  },
  asignacion: {
    titulo: 'Asignar persona',
    usuario: 'Usuario',
    aMano: 'Su cuenta no lee el directorio de usuarios: escriba el correo y el identificador que le dio la administración.',
    correo: 'Correo del usuario',
    idUsuario: 'Identificador del usuario',
    rol: 'Rol en el proyecto',
    desde: 'Desde',
    hasta: 'Hasta',
    asignar: 'Asignar',
    asignarme: 'Asignarme al proyecto',
    invalido: 'Revise este dato',
    terminar: 'Terminar asignación',
    vencida: 'Vencida: no da acceso de escritura',
    programada: 'Programada: aún no da acceso de escritura',
    terminarDe: 'Terminar asignación de {{correo}}',
    confirmarTerminar: '¿Terminar la asignación de {{correo}}? Dejará de dar acceso de escritura.',
    terminarSi: 'Sí, terminar'
  },
  equipo: {
    titulo: 'Equipo y parámetros',
    pestanas: { equipo: 'Equipo', campanas: 'Campañas', partes: 'Partes y concesiones', parametros: 'Parámetros y políticas' },
    columnas: { correo: 'Persona', rol: 'Rol', periodo: 'Periodo', estado: 'Estado' },
    activa: 'Vigente',
    inactiva: 'Terminada',
    ejecutado: '{{ejecutado}} de {{tope}} {{moneda}}',
    otraMoneda: '{{n}} registros en otra moneda no se suman',
    sinTope: 'Sin tope definido',
    concesiones: 'Concesiones del proyecto',
    guardarParametros: 'Guardar parámetros',
    guardados: 'Parámetros guardados'
  },
  asistente: {
    noEncontrado: 'No se encontró este borrador. Puede que otra persona lo haya borrado.',
    noEsBorrador: 'Este proyecto ya salió de borrador: el asistente solo completa borradores.',
    eligeElRol: 'Elija el rol de la parte antes de agregar la organización.',
    latitudFuera: 'Escriba la latitud como número entre -90 y 90.',
    longitudFuera: 'Escriba la longitud como número entre -180 y 180.',
    ubicacionIncompleta: 'Escriba latitud y longitud, o deje ambas vacías.'
  },
  parametros: {
    interest_threshold: 'Umbral de interés',
    power_threshold: 'Umbral de poder',
    stakeholder_review_days: 'Días entre evaluaciones',
    inactivity_days: 'Días sin contacto para sugerir seguimiento',
    meetings_per_month_target: 'Meta de reuniones al mes',
    policy_minutes_only_formal_types: 'Solo los tipos formales necesitan acta aprobada',
    policy_activation_preconditions: 'Exigir CRS de trabajo y una parte CLIENTE u OPERADOR para activar',
    grievance_ack_days: 'Días hábiles para acusar recibo de una queja',
    grievance_resolution_days: 'Días para resolver una queja',
    inquiry_response_days: 'Días para responder una consulta',
    policy_high_severity_requires_approver: 'Una queja ALTA o CRITICA la resuelve quien aprueba',
    risk_review_days: 'Días entre revisiones de un riesgo',
    risk_medium_min_score: 'Puntaje desde el que un riesgo es MEDIO',
    risk_high_min_score: 'Puntaje desde el que un riesgo es ALTO',
    risk_critical_min_score: 'Puntaje desde el que un riesgo es CRITICO',
    policy_internal_approval: 'Aprobación interna con segregación de funciones',
    policy_cap_blocks_approval: 'El tope de la campaña bloquea la aprobación',
    policy_no_paid_labor: 'No financiar mano de obra',
    policy_non_monetary_donations: 'Donaciones no monetarias',
    policy_synergy_requires_agreement: 'Las sinergias exigen un acuerdo vigente',
    policy_priority_warning: 'Advertir si un aporte no atiende los temas priorizados',
    grupos: {
      grupos: 'Grupos de interés',
      relacionamiento: 'Relacionamiento',
      proyecto: 'Proyecto',
      quejas: 'Quejas, consultas y solicitudes',
      riesgos: 'Riesgos',
      inversion: 'Inversión social y aprobaciones'
    },
    ayudas: {
      quejas:
        'El acuse cuenta días hábiles (de lunes a viernes, sin feriados) desde el día siguiente a la recepción; la resolución y la respuesta, días calendario. Un cambio no recalcula los plazos ya puestos.',
      riesgos:
        'El puntaje es probabilidad por impacto, de 1 a 25. Un cambio de umbrales no recalcula los niveles guardados: los cambia la revisión siguiente de cada riesgo.',
      inversion:
        'Los lineamientos se evalúan al aprobar un aporte: uno incumplido exige una justificación, que los cubre todos. La sinergia sin acuerdo vigente no se justifica.'
    },
    ayuda: {
      policy_internal_approval:
        'Activada: compromisos, aportes y programas pasan por la aprobación de otra persona. Desactivada: se permite la vía directa sin revisión interna.',
      policy_cap_blocks_approval:
        'Activada: una aprobación que supera el tope de apoyo social de la campaña se bloquea, salvo para quien tiene permiso para superarlo. Desactivada: solo advierte.',
      policy_no_paid_labor: 'Activada: un aporte con ítems de mano de obra se aparta de los lineamientos y exige una justificación para aprobarse.',
      policy_non_monetary_donations: 'Activada: una donación con ítems de dinero se aparta de los lineamientos y exige una justificación para aprobarse.',
      policy_synergy_requires_agreement:
        'Activada: un aporte con sinergia institucional, o un programa con socio, se aprueba solo con un acuerdo activo y no vencido. La justificación no lo reemplaza.',
      policy_priority_warning:
        'Activada: un aporte cuyo tema no es uno de los temas priorizados del proyecto, ni desciende de uno, se aparta de los lineamientos y exige una justificación.',
      interest_threshold:
        'Puntaje de interés (de 1 a 5) desde el cual un grupo de interés cuenta con interés alto en la matriz de poder e interés. Puede llevar decimales.',
      power_threshold:
        'Puntaje de poder (de 1 a 5) desde el cual un grupo de interés cuenta con poder alto en la matriz de poder e interés. Puede llevar decimales.',
      stakeholder_review_days:
        'Días calendario que pasan antes de que la evaluación de un grupo de interés se considere vencida y toque evaluarlo de nuevo. Número entero.',
      inactivity_days: 'Días calendario sin contacto con un grupo de interés tras los cuales el sistema crea una tarea de seguimiento. Número entero.',
      meetings_per_month_target:
        'Cantidad de reuniones que el proyecto se propone realizar cada mes; los tableros de relacionamiento la comparan con las realizadas, salvo que un plan de relacionamiento vigente fije la suya. Número entero.',
      policy_minutes_only_formal_types:
        'Activada: solo los tipos formales de interacción necesitan un acta aprobada. Desactivada: toda interacción la necesita.',
      policy_activation_preconditions:
        'Activada: para activar el proyecto hacen falta el CRS de trabajo y una parte con rol de cliente u operador. Desactivada: se puede activar sin ellos.',
      grievance_ack_days:
        'Días hábiles (de lunes a viernes, sin feriados nacionales) para acusar recibo de una queja, contados desde el día siguiente a la recepción. De 1 a 365.',
      grievance_resolution_days: 'Días calendario para resolver una queja desde su recepción. De 1 a 365.',
      inquiry_response_days: 'Días calendario para responder una consulta desde su recepción. De 1 a 365.',
      policy_high_severity_requires_approver:
        'Activada: una queja de severidad alta o crítica solo la resuelve una persona con permiso de aprobar. Desactivada: la resuelve quien la atiende.',
      risk_review_days: 'Días calendario entre una revisión de un riesgo y la siguiente, salvo que el riesgo tenga su propia cadencia. De 1 a 365.',
      risk_medium_min_score: 'Puntaje (probabilidad por impacto, de 1 a 25) desde el que un riesgo pasa a nivel medio. Debe ser menor que el del nivel alto.',
      risk_high_min_score:
        'Puntaje (probabilidad por impacto, de 1 a 25) desde el que un riesgo pasa a nivel alto. Debe estar entre el del nivel medio y el del crítico.',
      risk_critical_min_score:
        'Puntaje (probabilidad por impacto, de 1 a 25) desde el que un riesgo pasa a nivel crítico. Debe ser mayor que el del nivel alto.'
    },
    porDefecto: 'Por defecto: {{valor}}.',
    activada: 'activada',
    desactivada: 'desactivada',
    fueraDeRango: 'Escriba un número entero de {{min}} a {{max}}.',
    umbralesEnOrden: 'Los umbrales deben crecer: medio menor que alto y alto menor que crítico.'
  },
  temas: {
    titulo: 'Temas priorizados para aportes',
    ayuda: 'Un aporte cumple la prioridad si su tema es uno de estos o desciende de uno. Sin temas priorizados, la prioridad no se evalúa.',
    vacio: 'El proyecto no tiene temas priorizados: la prioridad de los aportes no se evalúa.',
    agregar: 'Agregar un tema priorizado',
    quitarDe: 'Quitar {{tema}}'
  }
}

export const EN_P360: typeof ES_P360 = {
  resumen: {
    jefatura: 'Project lead',
    jefaturaConError: 'Could not be read',
    etapa: 'Stage',
    fase: 'Exploration phase',
    completar: 'Complete project',
    resumenIa: 'AI summary',
    iaLlega: 'The AI summary arrives in F7',
    registrarInteraccion: 'Register engagement',
    atencion: 'Needs attention',
    sinAtencion: 'Nothing needs attention today in what arrives in F2.',
    actaPendiente: '{{titulo}}: minutes to draft',
    sinContacto: '{{nombre}}: no contact for more than {{dias}} days',
    evaluacionVencida: '{{nombre}}: assessment older than {{dias}} days',
    nuncaContactado: '{{nombre}}: no contact recorded',
    fuentes: { interacciones: 'Engagements', grupos: 'Stakeholders' },
    salud: 'Project health',
    kpis: {
      gruposVigentes: 'Current stakeholders',
      interacciones: 'Engagements held this month',
      compromisos: 'Open commitments',
      qcs: 'Open grievances',
      riesgos: 'High risks'
    },
    paisaje: 'Stakeholder landscape',
    posturas: 'Stances',
    matriz: 'Interest × power',
    sinEvaluar: '{{n}} not assessed',
    verMatriz: 'Open the matrix',
    reuniones: 'Meetings per month against the target',
    reunionesMes: '{{mes}}: {{valor}} of {{meta}}',
    sinReuniones: 'There are no months with meetings to compare with the target yet.',
    areas: 'Current areas of influence',
    sinAreas: 'No approved area yet',
    verMapa: 'View on the map',
    actividad: 'Recent activity',
    sinActividad: 'This project has no recorded activity yet.'
  },
  asignacion: {
    titulo: 'Assign person',
    usuario: 'User',
    aMano: 'Your account cannot read the user directory: type the email and the id given by the administration.',
    correo: 'User email',
    idUsuario: 'User id',
    rol: 'Role in the project',
    desde: 'From',
    hasta: 'Until',
    asignar: 'Assign',
    asignarme: 'Assign me to the project',
    invalido: 'Check this value',
    terminar: 'End assignment',
    vencida: 'Expired: grants no write access',
    programada: 'Scheduled: grants no write access yet',
    terminarDe: 'End assignment of {{correo}}',
    confirmarTerminar: 'End the assignment of {{correo}}? It will stop granting write access.',
    terminarSi: 'Yes, end it'
  },
  equipo: {
    titulo: 'Team and parameters',
    pestanas: { equipo: 'Team', campanas: 'Campaigns', partes: 'Parties and concessions', parametros: 'Parameters and policies' },
    columnas: { correo: 'Person', rol: 'Role', periodo: 'Period', estado: 'Status' },
    activa: 'Current',
    inactiva: 'Ended',
    ejecutado: '{{ejecutado}} of {{tope}} {{moneda}}',
    otraMoneda: '{{n}} records in another currency are not added',
    sinTope: 'No cap set',
    concesiones: 'Project concessions',
    guardarParametros: 'Save parameters',
    guardados: 'Parameters saved'
  },
  asistente: {
    noEncontrado: 'This draft was not found. Someone else may have deleted it.',
    noEsBorrador: 'This project is no longer a draft: the wizard only completes drafts.',
    eligeElRol: 'Choose the role of the party before adding the organization.',
    latitudFuera: 'Type the latitude as a number between -90 and 90.',
    longitudFuera: 'Type the longitude as a number between -180 and 180.',
    ubicacionIncompleta: 'Type both latitude and longitude, or leave both empty.'
  },
  parametros: {
    interest_threshold: 'Interest threshold',
    power_threshold: 'Power threshold',
    stakeholder_review_days: 'Days between assessments',
    inactivity_days: 'Days without contact before a follow-up',
    meetings_per_month_target: 'Meetings per month target',
    policy_minutes_only_formal_types: 'Only formal types need approved minutes',
    policy_activation_preconditions: 'Require working CRS and a CLIENT or OPERATOR party to activate',
    grievance_ack_days: 'Business days to acknowledge a grievance',
    grievance_resolution_days: 'Days to resolve a grievance',
    inquiry_response_days: 'Days to answer an inquiry',
    policy_high_severity_requires_approver: 'An ALTA or CRITICA grievance is resolved by the approver',
    risk_review_days: 'Days between reviews of a risk',
    risk_medium_min_score: 'Score from which a risk is MEDIO',
    risk_high_min_score: 'Score from which a risk is ALTO',
    risk_critical_min_score: 'Score from which a risk is CRITICO',
    policy_internal_approval: 'Internal approval with segregation of duties',
    policy_cap_blocks_approval: 'The campaign cap blocks approval',
    policy_no_paid_labor: 'Do not fund labour',
    policy_non_monetary_donations: 'Non-monetary donations',
    policy_synergy_requires_agreement: 'Synergies need a current agreement',
    policy_priority_warning: 'Warn when a contribution does not serve the prioritised topics',
    grupos: {
      grupos: 'Stakeholders',
      relacionamiento: 'Engagement',
      proyecto: 'Project',
      quejas: 'Grievances, inquiries and requests',
      riesgos: 'Risks',
      inversion: 'Social investment and approvals'
    },
    ayudas: {
      quejas:
        'Acknowledgement counts business days (Monday to Friday, without holidays) from the day after reception; resolution and answer, calendar days. A change does not recompute deadlines already set.',
      riesgos: 'The score is probability times impact, from 1 to 25. A threshold change does not recompute stored levels: the next review of each risk does.',
      inversion:
        'The guidelines are assessed when approving a contribution: an unmet one needs a justification, which covers them all. A synergy without a current agreement is not justified.'
    },
    ayuda: {
      policy_internal_approval:
        'On: commitments, contributions and programs go through another person’s approval. Off: the direct path without internal review is allowed.',
      policy_cap_blocks_approval:
        'On: an approval that exceeds the campaign social support cap is blocked, except for whoever may exceed it. Off: it only warns.',
      policy_no_paid_labor: 'On: a contribution with labour items departs from the guidelines and needs a justification to be approved.',
      policy_non_monetary_donations: 'On: a donation with money items departs from the guidelines and needs a justification to be approved.',
      policy_synergy_requires_agreement:
        'On: a contribution with institutional synergy, or a program with a partner, is approved only with an active, unexpired agreement. The justification does not replace it.',
      policy_priority_warning:
        'On: a contribution whose topic is not one of the project’s prioritised topics, nor descends from one, departs from the guidelines and needs a justification.',
      interest_threshold: 'Interest score (1 to 5) from which a stakeholder counts as high interest in the power and interest matrix. May have decimals.',
      power_threshold: 'Power score (1 to 5) from which a stakeholder counts as high power in the power and interest matrix. May have decimals.',
      stakeholder_review_days: 'Calendar days before a stakeholder assessment is considered overdue and it is time to assess again. Whole number.',
      inactivity_days: 'Calendar days without contact with a stakeholder after which the system creates a follow-up task. Whole number.',
      meetings_per_month_target:
        'Number of meetings the project aims to hold each month; the engagement dashboards compare it with those held, unless a plan in force sets its own. Whole number.',
      policy_minutes_only_formal_types: 'On: only the formal engagement types need approved minutes. Off: every engagement needs them.',
      policy_activation_preconditions:
        'On: activating the project requires the working CRS and a party with a client or operator role. Off: it can be activated without them.',
      grievance_ack_days:
        'Business days (Monday to Friday, without national holidays) to acknowledge a grievance, counted from the day after reception. From 1 to 365.',
      grievance_resolution_days: 'Calendar days to resolve a grievance from its reception. From 1 to 365.',
      inquiry_response_days: 'Calendar days to answer an inquiry from its reception. From 1 to 365.',
      policy_high_severity_requires_approver:
        'On: a high or critical severity grievance can only be resolved by a person allowed to approve. Off: whoever handles it resolves it.',
      risk_review_days: 'Calendar days between one review of a risk and the next, unless the risk has its own cadence. From 1 to 365.',
      risk_medium_min_score: 'Score (probability times impact, 1 to 25) from which a risk reaches the medium level. Must be lower than the high level.',
      risk_high_min_score:
        'Score (probability times impact, 1 to 25) from which a risk reaches the high level. Must be between the medium and critical levels.',
      risk_critical_min_score: 'Score (probability times impact, 1 to 25) from which a risk reaches the critical level. Must be higher than the high level.'
    },
    porDefecto: 'Default: {{valor}}.',
    activada: 'on',
    desactivada: 'off',
    fueraDeRango: 'Type a whole number from {{min}} to {{max}}.',
    umbralesEnOrden: 'Thresholds must grow: medium lower than high and high lower than critical.'
  },
  temas: {
    titulo: 'Prioritised topics for contributions',
    ayuda: 'A contribution meets the priority if its topic is one of these or descends from one. Without prioritised topics, the priority is not assessed.',
    vacio: 'The project has no prioritised topics: the priority of contributions is not assessed.',
    agregar: 'Add a prioritised topic',
    quitarDe: 'Remove {{tema}}'
  }
}
