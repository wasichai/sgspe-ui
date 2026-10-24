// los valores de los enums del modelo en inglés (ASM-084, design-system.md §9.1): una clave por valor, con el valor tal como se
// guarda («RELACION ACTIVA»). los revisó un traductor profesional, nunca una herramienta automática (ASM-084), con el enum de
// origen al lado de cada grupo; un valor que aparece en varios enums se escribe una vez, con el texto que sirve a todos (VENCIDO
// de un plazo y de una vigencia: «Expired»). los códigos (PEN, USD, EPSG …) no se traducen y no están aquí. mientras un valor
// no esté aquí, la interfaz en inglés lo muestra con su rótulo en español («Relación activa»)
export const EN_OPCIONES: Readonly<Record<string, string>> = {
  // actor_relationship_type
  'AFILIADO A': 'Affiliated with',
  'COORDINA CON': 'Coordinates with',
  APOYA: 'Supports',
  'SE OPONE': 'Opposes',
  ASESORA: 'Advises',
  // administrative_level
  DEPARTAMENTO: 'Department',
  PROVINCIA: 'Province',
  DISTRITO: 'District',
  // affiliation
  AFILIADA: 'Affiliated',
  LIBRE: 'Independent',
  'NO RECONOCIDA': 'Not recognised',
  ESCINDIDA: 'Breakaway',
  EMERGENTE: 'Emerging',
  // agreement_type
  'ACTA DE ACUERDOS': 'Record of agreements',
  CONVENIO: 'Cooperation agreement',
  'PERMISO DE USO DE TERRENO': 'Land use permit',
  SERVIDUMBRE: 'Easement',
  'AUTORIZACION DE ASAMBLEA': 'Assembly authorisation',
  'ALIANZA FORMAL': 'Formal alliance',
  // ai_suggestion_kind
  EXTRACCION: 'Extraction',
  'BORRADOR DE ACTA': 'Draft minutes',
  'RESUMEN EJECUTIVO': 'Executive summary',
  'BORRADOR DE SECCION': 'Draft section',
  DUPLICADO: 'Duplicate',
  CLASIFICACION: 'Classification',
  // area_of_influence_type
  AIDS: 'Direct social area of influence',
  AIIS: 'Indirect social area of influence',
  'AID AMBIENTAL': 'Direct environmental area of influence',
  'AII AMBIENTAL': 'Indirect environmental area of influence',
  // assessment_basis
  ENTREVISTA: 'Interview',
  'INFORMACION SECUNDARIA': 'Secondary information',
  INFERIDA: 'Inferred',
  ENCUESTA: 'Survey',
  // campaign_activity_type
  CATEO: 'Prospecting',
  PERFORACION: 'Drilling',
  // campaign_status
  PREVISTA: 'Planned',
  'EN EJECUCION': 'In progress',
  SUSPENDIDA: 'Suspended',
  CONCLUIDA: 'Completed',
  CANCELADA: 'Cancelled',
  // commitment_formality
  FORMAL: 'Formal',
  VERBAL: 'Verbal',
  // commitment_theme
  AMBIENTAL: 'Environmental',
  SOCIAL: 'Social',
  // community_type
  'COMUNIDAD CAMPESINA': 'Peasant community',
  'COMUNIDAD NATIVA': 'Native community',
  // component_status
  PROGRAMADO: 'Scheduled',
  EJECUTADO: 'Completed',
  CANCELADO: 'Cancelled',
  CERRADO: 'Closed',
  // component_type
  SONDAJE: 'Drill hole',
  PLATAFORMA: 'Drill pad',
  ACCESO: 'Access road',
  CAMPAMENTO: 'Camp',
  CAPTACION: 'Water intake',
  // contact_channel
  TELEFONO: 'Telephone',
  'CORREO ELECTRONICO': 'Email',
  MENSAJERIA: 'Messaging',
  DIRECCION: 'Address',
  OTRO: 'Other',
  // content_origin
  HUMANO: 'Human',
  CALCULADO: 'Calculated',
  'ASISTIDO POR IA': 'AI-assisted',
  // contribution_type
  DONACION: 'Donation',
  'APOYO EN ESPECIE': 'In-kind support',
  // data_reliability
  REFERENCIAL: 'Indicative',
  VERIFICADO: 'Verified',
  // deadline_status
  'AL DIA': 'Up to date',
  'POR VENCER': 'Expiring soon',
  VENCIDO: 'Expired',
  // deliverable_section_kind
  NARRATIVA: 'Narrative',
  CALCULADA: 'Calculated',
  MIXTA: 'Mixed',
  ANEXO: 'Annex',
  // deliverable_type
  'DIAGNOSTICO SOCIAL': 'Social diagnosis',
  'INFORME DE CAMPO Y AVANCE': 'Field and progress report',
  // disclosure_level
  INTERNO: 'Internal',
  EXTERNO: 'External',
  PUBLICO: 'Public',
  // draft_generation_status
  'SIN GENERAR': 'Not generated',
  'EN COLA': 'Queued',
  'EN PROCESO': 'Processing',
  LISTO: 'Ready',
  FALLIDO: 'Failed',
  // engagement_type
  'CONTACTO CARA A CARA': 'Face-to-face contact',
  REUNION: 'Meeting',
  'REUNION INFORMATIVA': 'Information meeting',
  TALLER: 'Workshop',
  ASAMBLEA: 'Assembly',
  'MESA DE DIALOGO': 'Dialogue roundtable',
  'VISITA GUIADA': 'Guided visit',
  LLAMADA: 'Call',
  'COMUNICACION FORMAL': 'Formal communication',
  'FICHA DE OBSERVACION': 'Observation form',
  'MONITOREO PARTICIPATIVO': 'Participatory monitoring',
  'FAENA COMUNITARIA': 'Community work day',
  AUDIENCIA: 'Public hearing',
  // environmental_feature_type
  'ZONA DE PROTECCION': 'Protected zone',
  'FUENTE DE AGUA': 'Water source',
  MICROCUENCA: 'Micro-watershed',
  CERRO: 'Hill',
  'SITIO SAGRADO': 'Sacred site',
  'RESTO ARQUEOLOGICO': 'Archaeological site',
  // evidence_classification
  PUBLICA: 'Public',
  INTERNA: 'Internal',
  CONFIDENCIAL: 'Confidential',
  'DATOS PERSONALES': 'Personal data',
  // evidence_type
  ACTA: 'Minutes',
  'LISTA DE ASISTENTES': 'Attendance list',
  'ACTA DE ENTREGA': 'Handover record',
  'ACTA DE RECEPCION': 'Receipt record',
  FOTO: 'Photo',
  COMPROBANTE: 'Proof of payment',
  CARTA: 'Letter',
  'PARTIDA REGISTRAL': 'Registry entry',
  MAPA: 'Map',
  'RECORTE DE PRENSA': 'Press clipping',
  FORMULARIO: 'Form',
  // exploration_phase
  'EXPLORACION INICIAL': 'Early-stage exploration',
  'EXPLORACION AVANZADA': 'Advanced exploration',
  // grievance_severity
  BAJA: 'Low',
  MEDIA: 'Medium',
  ALTA: 'High',
  CRITICA: 'Critical',
  // impact_nature
  REAL: 'Actual',
  PERCIBIDO: 'Perceived',
  // impact_sign
  POSITIVO: 'Positive',
  NEGATIVO: 'Negative',
  // incident_type
  EXPULSION: 'Expulsion',
  'RETENCION DE VEHICULO O EQUIPOS': 'Seizure of vehicles or equipment',
  'BLOQUEO DE VIA': 'Road blockade',
  PROTESTA: 'Protest',
  AMENAZA: 'Threat',
  // influence_group
  ESTRATEGICO: 'Strategic',
  POLITICO: 'Political',
  'PARA MONITOREO': 'For monitoring',
  VULNERABLE: 'Vulnerable',
  // information_priority
  'MUY ALTA': 'Very high',
  // instrument_type
  'ENTREVISTA SEMIESTRUCTURADA': 'Semi-structured interview',
  'FICHA DE OBSERVACION LOCAL': 'Local observation form',
  // interview_status
  ENTREVISTADO: 'Interviewed',
  'SE NEGO': 'Declined',
  'NO UBICADO': 'Not located',
  'NO PROGRAMADO': 'Not scheduled',
  // item_kind
  BIEN: 'Goods',
  SERVICIO: 'Service',
  DINERO: 'Cash',
  'MANO DE OBRA': 'Labour',
  // local_conflict_status
  ACTIVO: 'Active',
  RESUELTO: 'Resolved',
  // local_conflict_type
  AGUA: 'Water',
  LIMITES: 'Boundaries',
  TERRENOS: 'Land',
  SEPARACION: 'Secession',
  // locality_type
  CASERIO: 'Hamlet',
  SECTOR: 'Sector',
  'CENTRO POBLADO': 'Village',
  CIUDAD: 'Town',
  // member_condition
  INCLUIDO: 'Included',
  PROVISIONAL: 'Provisional',
  // mention_tone
  NEUTRO: 'Neutral',
  // network_contact_status
  'SIN CONTACTO': 'No contact',
  'CONTACTO ESTABLECIDO': 'Contact established',
  PENETRADA: 'Reached',
  // node_role
  LIDER: 'Leader',
  SECRETARIO: 'Secretary',
  MIEMBRO: 'Member',
  // organic_status
  ACTIVA: 'Active',
  'SIN JUNTA ACTIVA': 'No active board',
  INACTIVA: 'Inactive',
  // organization_type
  'RONDA CAMPESINA': 'Peasant patrol (ronda campesina)',
  JASS: 'Water and sanitation board (JASS)',
  'COMITE DE REGANTES': "Irrigation users' committee",
  'COMITE DE AUTODEFENSA': 'Self-defence committee',
  APAFA: "Parents' association (APAFA)",
  'VASO DE LECHE': 'Vaso de Leche committee',
  'CLUB DE MADRES': "Mothers' club",
  'ASOCIACION DE AGRICULTORES': "Farmers' association",
  FEDERACION: 'Federation',
  MUNICIPALIDAD: 'Municipality',
  'ENTIDAD DEL ESTADO': 'Government agency',
  IGLESIA: 'Church',
  ONG: 'NGO',
  EMPRESA: 'Company',
  'PARTIDO POLITICO': 'Political party',
  'MEDIO DE COMUNICACION': 'Media outlet',
  OTRA: 'Other',
  // party_role
  CLIENTE: 'Client',
  OPERADOR: 'Operator',
  'TITULAR DE CONCESION': 'Concession holder',
  CONSULTORA: 'Consultancy',
  CONTRATISTA: 'Contractor',
  // perception_polarity
  POSITIVA: 'Positive',
  NEGATIVA: 'Negative',
  // perception_subject
  MINERIA: 'Mining',
  PROYECTO: 'Project',
  // position_status
  VIGENTE: 'Current',
  CONCLUIDO: 'Ended',
  PREVISTO: 'Planned',
  VACANTE: 'Vacant',
  'EN LICENCIA': 'On leave',
  // presentation_audience
  CAMPO: 'Field',
  INVESTIGACION: 'Research',
  INSTITUCIONES: 'Institutions',
  COMUNIDAD: 'Community',
  // project_stage
  EXPLORACION: 'Exploration',
  FACTIBILIDAD: 'Feasibility',
  CONSTRUCCION: 'Construction',
  OPERACION: 'Operation',
  CIERRE: 'Closure',
  'POST CIERRE': 'Post-closure',
  // project_type
  HIDROCARBUROS: 'Oil and gas',
  ENERGIA: 'Energy',
  // qcs_category
  'AGUA Y MEDIO AMBIENTE': 'Water and environment',
  EMPLEO: 'Employment',
  TIERRAS: 'Land',
  'VIAS Y TRANSITO': 'Roads and traffic',
  'APOYO SOCIAL': 'Social support',
  COMPROMISOS: 'Commitments',
  'INFORMACION DEL PROYECTO': 'Project information',
  'CONDUCTA DEL PERSONAL': 'Staff conduct',
  // qcs_channel
  PRESENCIAL: 'In person',
  CORREO: 'Email',
  // receipt_type
  'BOLETA DE VENTA': 'Sales receipt (boleta)',
  FACTURA: 'Invoice',
  RECIBO: 'Receipt',
  // recognition_status
  RECONOCIDO: 'Recognised',
  'EN TRAMITE': 'Pending',
  'NO RECONOCIDO': 'Not recognised',
  'EN SEPARACION': 'Seceding',
  // relationship_status
  'RELACION ACTIVA': 'Active relationship',
  'RELACION DETERIORADA': 'Strained relationship',
  // request_medium
  'CARTA DE SOLICITUD': 'Request letter',
  'ACUERDO EN REUNION': 'Agreement at a meeting',
  // resource_type
  MATERIAL: 'Material',
  'NO MATERIAL': 'Non-material',
  // review_status
  'POR REVISAR': 'Review due',
  'REVISION VENCIDA': 'Review overdue',
  // risk_category
  'EXPECTATIVAS Y BENEFICIOS': 'Expectations and benefits',
  'TIERRAS Y TERRITORIO': 'Land and territory',
  'POLITICO ELECTORAL': 'Political and electoral',
  'MOVILIZACION SOCIAL': 'Social mobilisation',
  COMUNICACION: 'Communication',
  // risk_level
  BAJO: 'Low',
  MEDIO: 'Medium',
  ALTO: 'High',
  CRITICO: 'Critical',
  // risk_trend
  AUMENTA: 'Increasing',
  'SE MANTIENE': 'Stable',
  DISMINUYE: 'Decreasing',
  // sex
  FEMENINO: 'Female',
  MASCULINO: 'Male',
  // signal_source
  'MAPEO DE ACTORES': 'Stakeholder mapping',
  'MEDIOS LOCALES': 'Local media',
  'OBSERVATORIO DE CONFLICTOS': 'Conflict observatory',
  'DEFENSORIA DEL PUEBLO': "Ombudsman's Office",
  'EQUIPO SOCIAL': 'Social team',
  // stakeholder_scope
  REGIONAL: 'Regional',
  NACIONAL: 'National',
  // stakeholder_type
  'AUTORIDAD LOCAL': 'Local authority',
  'ORGANIZACION SOCIAL LOCAL': 'Local social organisation',
  'ORGANIZACION COMUNAL': 'Community organisation',
  'LIDER LOCAL': 'Local leader',
  'ORGANIZACION SOCIAL DISTRITAL': 'District social organisation',
  'AUTORIDAD PROVINCIAL': 'Provincial authority',
  'ORGANIZACION SOCIAL PROVINCIAL': 'Provincial social organisation',
  'LIDER POLITICO': 'Political leader',
  'PROGRAMA SOCIAL': 'Social programme',
  'AUTORIDAD REGIONAL': 'Regional authority',
  'ORGANIZACION SOCIAL REGIONAL': 'Regional social organisation',
  // stance
  'A FAVOR': 'In favour',
  NEUTRAL: 'Neutral',
  'EN CONTRA PERO ABIERTO A ESCUCHAR': 'Opposed but open to dialogue',
  'EN CONTRA': 'Opposed',
  // tenure_type
  PROPIEDAD: 'Ownership',
  POSESION: 'Possession',
  COMUNAL: 'Communal',
  'PROPIEDAD DE LA EMPRESA': 'Company-owned',
  // territorial_level
  LOCAL: 'Local',
  DISTRITAL: 'District',
  PROVINCIAL: 'Provincial',
  INTERNACIONAL: 'International',
  // treatment_decision
  MITIGAR: 'Mitigate',
  MONITOREAR: 'Monitor',
  ACEPTAR: 'Accept',
  // warning_rule_kind
  'CONTEO DE SEÑALES': 'Signal count',
  'CONTEO DE QCS': 'Grievance, inquiry and request count',
  'COMPROMISOS VENCIDOS': 'Overdue commitments',
  'MENCIONES NEGATIVAS': 'Negative mentions',
  INCIDENTES: 'Incidents',
  'NIVEL DE RIESGO': 'Risk level'
}
