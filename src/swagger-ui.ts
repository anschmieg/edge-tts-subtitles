export const swaggerHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Edge TTS Subtitles API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.20.0/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4.20.0/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function () {
        const ui = SwaggerUIBundle({
          url: '/openapi.json',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis],
        });
        window.ui = ui;
      };
    </script>
  </body>
</html>`;
