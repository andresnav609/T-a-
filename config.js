/* =========================================================================
   DATOS DE TU BODA  —  Edita SOLO los valores entre comillas.
   Al guardar, la invitación se actualiza sola. Lo que no uses, déjalo vacío
   ("" o []) y esa sección simplemente no aparece.
   ========================================================================= */
window.BODA = {
  /* -------- Novios y fecha -------- */
  novia: "María",
  novio: "Andrés",
  fechaISO: "2026-12-05T17:00:00",          // AAAA-MM-DDTHH:MM:SS (para la cuenta regresiva)
  fechaTexto: "Sábado 5 de diciembre de 2026",
  hora: "5:00 pm",
  hashtag: "#MaríaYAndrés2026",

  /* -------- Frase de bienvenida -------- */
  frase: "Con la bendición de Dios y de nuestros padres, queremos compartir contigo el día en que uniremos nuestras vidas.",

  /* -------- Nuestra historia (deja [] si no la quieres) -------- */
  historia: [
    { fecha: "2018", titulo: "Nos conocimos", texto: "Una tarde cualquiera que lo cambió todo." },
    { fecha: "2021", titulo: "El primer viaje", texto: "Descubrimos que juntos el mundo es más bonito." },
    { fecha: "2025", titulo: "La propuesta", texto: "Entre lágrimas y un sí que no dudó ni un segundo." }
  ],

  /* -------- Itinerario del día -------- */
  /* icono: anillos | iglesia | copas | cena | baile | pastel */
  itinerario: [
    { hora: "5:00 pm", titulo: "Ceremonia religiosa", icono: "iglesia" },
    { hora: "6:30 pm", titulo: "Cóctel de bienvenida", icono: "copas" },
    { hora: "8:00 pm", titulo: "Cena",                  icono: "cena" },
    { hora: "10:00 pm", titulo: "¡A bailar!",           icono: "baile" }
  ],

  /* -------- Ceremonia y recepción -------- */
  ceremoniaLugar: "Parroquia San José",
  ceremoniaDireccion: "Av. Principal 123, Ciudad",
  ceremoniaMapa: "https://maps.google.com/?q=Parroquia+San+Jose",
  recepcionLugar: "Salón Jardín Las Flores",
  recepcionDireccion: "Calle del Sol 456, Ciudad",
  recepcionHora: "7:00 pm",
  recepcionMapa: "https://maps.google.com/?q=Salon+Jardin+Las+Flores",

  /* -------- Código de vestimenta + paleta de colores -------- */
  vestimenta: "Formal / Etiqueta",
  vestimentaNota: "Te sugerimos estos tonos; el blanco resérvalo para la novia 🤍",
  paletaVestimenta: ["#20302a", "#7f8471", "#b3924f", "#c9a9a6", "#e7dcc2"],

  /* -------- Galería (pon URLs de fotos; deja [] para ver marcos de ejemplo) -------- */
  galeria: [],

  /* -------- Mesa de regalos / Lluvia de sobres -------- */
  regalos: {
    mensaje: "Tu presencia es nuestro mejor regalo. Si además quieres tener un detalle con nosotros, aquí te dejamos algunas opciones.",
    enlaceMesa: "",                          // link a tu mesa de regalos (Liverpool, Amazon, etc.)
    lluviaDeSobres: true,                    // sobre con dinero en el evento
    banco: { titular: "", banco: "", clabe: "" }  // opcional: transferencia
  },

  /* -------- Hospedaje sugerido (deja [] si no aplica) -------- */
  hospedaje: [
    { nombre: "Hotel Central", detalle: "A 5 min del salón · Tarifa especial con código BODA", enlace: "" }
  ],

  /* -------- Confirmación de asistencia -------- */
  whatsappRSVP: "5210000000000",             // código de país sin + ni espacios
  limiteRSVP: "1 de noviembre de 2026",

  /* -------- Música de fondo (opcional) -------- */
  musicaURL: "",                             // URL a un .mp3; vacío = sin botón de música
  musicaNombre: "Nuestra canción",

  /* -------- Dirección pública donde publicarás la web (para el generador) -------- */
  urlBase: ""
};
