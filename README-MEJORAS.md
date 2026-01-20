
# Cambios aplicados (Padeluminatis)

- Eliminado `clasificacion.html` y redirecciones automáticas a `evento.html?id=primera-liga`.
- Creado **evento.html** con secciones de Inscripción, Clasificación, Resultados y Eliminación.
- Refuerzo de reglas en **calendario**: ahora solo se puede reservar **amistosos** o **eventos** en los que el usuario está inscrito (comprobación en Firestore).
- Añadidos estilos **mobile-first** en `css/mobile.css` y mejoras para evento en `css/evento.css`.
- Limpieza de duplicados: eliminado `imagenes/ChatGPT Image 12 jun 2025, 13_26_46.png` por duplicar a `imagenes/fonndoheader.png`.
- Añadida navegación desde tarjetas de eventos en `js/eventos.js` (atributo `data-event-id`).
- **Firebase**: se aprovecha tu `js/firebase-config.js` y `js/firebase-service.js`. El evento renderiza datos desde `eventos/<id>` y subcolecciones:
  - `eventos/<id>/participantes`
  - `eventos/<id>/clasificacion`
  - `eventos/<id>/partidos`
  - `eventos/<id>/eliminatoria`

## Notas
- Asegúrate de crear el evento con id `primera-liga` en Firestore o ajusta los enlaces.
- Si tus tarjetas en `eventos.html` no tienen `data-event-id`, añade dicho atributo o enlaza manualmente.
