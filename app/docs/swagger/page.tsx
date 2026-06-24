export const dynamic = "force-static";

export default function SwaggerPage() {
  return (
    <html><head>
      <title>UTH API Reference</title>
      <meta charSet="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css"/>
      <style>{`body{margin:0;padding:0;background:#18181b;color:#e4e4e7}.swagger-ui .topbar{background:#09090b!important;border-bottom:1px solid #27272a}.swagger-ui .topbar-wrapper img,.swagger-ui .topbar a{display:none!important}.swagger-ui .topbar::after{content:"UTH — API Reference";color:#a5b4fc;font-weight:900;font-size:1rem;letter-spacing:-.02em;padding:12px 16px;display:block}.swagger-ui .info .title{color:#f4f4f5!important}.swagger-ui .info p,.swagger-ui .info li{color:#a1a1aa!important}.swagger-ui .scheme-container{background:#09090b!important;box-shadow:none!important;border-bottom:1px solid #27272a}.swagger-ui select,.swagger-ui textarea,.swagger-ui input[type=text]{background:#27272a!important;color:#e4e4e7!important;border:1px solid #3f3f46!important}.swagger-ui .btn{background:#4f46e5!important;border-color:#4f46e5!important;color:#fff!important;box-shadow:none!important}.swagger-ui .opblock-tag{color:#a1a1aa!important;border-color:#27272a!important}.swagger-ui .opblock.opblock-get .opblock-summary-method{background:#16a34a!important}.swagger-ui .opblock.opblock-post .opblock-summary-method{background:#2563eb!important}.swagger-ui .opblock.opblock-put .opblock-summary-method{background:#b45309!important}.swagger-ui .opblock.opblock-delete .opblock-summary-method{background:#dc2626!important}.swagger-ui .opblock-body pre.microlight{background:#09090b!important;color:#86efac!important}.swagger-ui .responses-inner h4,.swagger-ui .responses-inner h5{color:#a1a1aa!important}.swagger-ui .model-box{background:#09090b!important}.swagger-ui section.models h4{color:#a1a1aa!important}`}</style>
    </head><body>
      <div id="swagger-ui"/>
      <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossOrigin="anonymous"/>
      <script dangerouslySetInnerHTML={{__html:`
        window.onload=function(){
          SwaggerUIBundle({
            url:"/api/openapi",
            dom_id:"#swagger-ui",
            presets:[SwaggerUIBundle.presets.apis,SwaggerUIBundle.SwaggerUIStandalonePreset],
            layout:"BaseLayout",
            deepLinking:true,
            defaultModelsExpandDepth:-1,
            tryItOutEnabled:true,
            withCredentials:true,
          });
        };
      `}}/>
    </body></html>
  );
}
