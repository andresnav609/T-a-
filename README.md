# 💍 Invitaciones de boda personalizadas

Una página web de invitación que se abre en el celular y muestra **el nombre de cada invitado**.
A cada persona le envías su propio link por WhatsApp y al abrirlo ve la invitación con su nombre.
No necesitan instalar ninguna app.

## ¿Qué incluye?

| Archivo | Para qué sirve |
|---|---|
| `config.js` | **Tus datos de la boda.** Es lo único que necesitas editar. |
| `index.html` | La invitación que ven tus invitados. |
| `crear.html` | Generador: pegas tu lista y te da el link de cada invitado + botón de WhatsApp. |

## Paso 1 — Pon tus datos

Abre `config.js` y cambia los valores entre comillas: nombres de los novios, fecha,
lugares, mapa, WhatsApp para confirmar asistencia, etc. Guarda.

## Paso 2 — Publícala gratis (GitHub Pages)

1. Sube estos archivos a tu repositorio de GitHub.
2. En GitHub ve a **Settings → Pages**.
3. En *Branch* elige tu rama y la carpeta `/ (root)`, y guarda.
4. En 1–2 minutos tu invitación estará en una dirección tipo:
   `https://tuusuario.github.io/tu-repo/`

> También funciona en Netlify, Vercel o cualquier hosting de archivos estáticos.

## Paso 3 — Genera los links de cada invitado

1. Abre `crear.html` (por ejemplo `https://tuusuario.github.io/tu-repo/crear.html`).
2. Pon la dirección donde publicaste la invitación.
3. Escribe tu lista, **un invitado por línea**. Puedes indicar cuántos pases entre `| ` :

   ```
   Familia González | 4
   María y José | 2
   Ana Torres
   ```
4. Presiona **Generar** y usa el botón verde para enviar cada invitación por WhatsApp.

## ¿Cómo se ve el link personalizado?

```
https://tuusuario.github.io/tu-repo/index.html?invitado=Ana%20Torres&pases=2
```

Al abrirlo, la invitación saluda por su nombre y le indica cuántos lugares reservaste.

---

### Preguntas frecuentes

**¿Puedo cambiar los colores o el texto?**
Sí. Los colores están al inicio de `index.html` (sección `:root`). Los textos salen de `config.js`.

**¿La confirmación de asistencia a dónde llega?**
Al WhatsApp que pongas en `config.js` (campo `whatsappRSVP`). El invitado presiona un botón
y te llega un mensaje ya escrito con su nombre.

**¿Necesito pagar algo?**
No. GitHub Pages es gratis y la invitación no usa ningún servicio de pago.
