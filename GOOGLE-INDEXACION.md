# Cómo solucionar "URL no está en Google" y "robots.txt unreachable"

## Qué está pasando

1. **"Robots.txt unreachable"** – Google no puede leer tu `robots.txt` cuando inspecciona la URL. Eso hace que la página no se indexe (problema de sitio).
2. **"No referring sitemaps detected"** – El sitemap no está asociado a la propiedad correcta o no se ha enviado.
3. Estás usando **prediccionloteria.com** (sin www); tu sitio redirige a **www.prediccionloteria.com**. Hay que trabajar siempre con la URL **con www** en Search Console.

## Pasos a seguir

### 1. Usar la propiedad con www

En Google Search Console:

- Si tienes una propiedad **Por prefijo de URL**, usa exactamente:  
  **https://www.prediccionloteria.com**
- No uses **https://prediccionloteria.com** para inspeccionar ni para enviar sitemap. Esa URL redirige; Google debe indexar la canónica (www).

### 2. Comprobar robots.txt en vivo

Abre en el navegador (o con `curl`):

- **https://www.prediccionloteria.com/robots.txt**

Debe verse algo así:

```
User-agent: *
Allow: /

Sitemap: https://www.prediccionloteria.com/sitemap.xml
```

Si ves eso, `robots.txt` está bien servido. Si ves HTML de la web o error 404, el despliegue en Firebase no está sirviendo el fichero.

### 3. Desplegar de nuevo

Asegúrate de que en tu proyecto están los archivos:

- `sitio/robots.txt`
- `sitio/sitemap.xml`
- `firebase.json` con las reglas que sirven estos ficheros

Luego:

```bash
firebase deploy --only hosting
```

### 4. En Search Console (propiedad www)

1. Entra en la propiedad **https://www.prediccionloteria.com**.
2. **Sitemaps**: Añade o comprueba el sitemap:  
   **https://www.prediccionloteria.com/sitemap.xml**
3. **Inspección de URLs**: Pega **https://www.prediccionloteria.com/** (con www).
4. Si la inspección muestra que la página es correcta y que `robots.txt` es accesible, usa **Solicitar indexación**.

### 5. Si sigues viendo "robots.txt unreachable"

- Vuelve a comprobar **https://www.prediccionloteria.com/robots.txt** en navegador o con:
  ```bash
  curl -I https://www.prediccionloteria.com/robots.txt
  ```
  Debe ser **200 OK** y `Content-Type: text/plain`.
- Si usas **prediccionloteria.com** (sin www) en la inspección, deja de usarla: inspecciona siempre **https://www.prediccionloteria.com/**.
- Espera 24–48 h tras el deploy y vuelve a inspeccionar la URL con www.

### 6. Canonical

Tu `index.html` ya tiene:

```html
<link rel="canonical" href="https://www.prediccionloteria.com/">
```

Así, cuando Google indexe, lo hará con la URL con www. No hace falta cambiar nada más por esto.

---

**Resumen:** Trabaja solo con **https://www.prediccionloteria.com** en Search Console, verifica que **https://www.prediccionloteria.com/robots.txt** responda 200, despliega de nuevo si hace falta y envía el sitemap y la indexación para la URL con www.
