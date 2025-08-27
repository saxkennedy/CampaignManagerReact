using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace api
{
    public class DocHtml
    {
        private readonly HttpClient _http;
        private readonly ILogger<DocHtml> _log;

        public DocHtml(IHttpClientFactory httpFactory, ILogger<DocHtml> log)
        {
            _http = httpFactory.CreateClient();
            _log = log;
        }

        [Function("DocHtml")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "doc-html/{id}")]
            HttpRequestData req,
            string id)
        {
            // Public docs work; private docs require auth (not covered here)
            var google = $"https://docs.google.com/document/d/{id}/export?format=html";
            string html;
            try
            {
                html = await _http.GetStringAsync(google);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to fetch doc {Id}", id);
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { error = "Cannot fetch document HTML." });
                return bad;
            }

            // Inject tiny style to set background; after <head>
            var inject = """
<style>
  html, body { background:#F2E8D5 !important; margin:0; }
  /* Optional: constrain content width for nicer reading */
  body > * { margin-left:auto; margin-right:auto; max-width: 900px; }
</style>
""";
            html = Regex.Replace(html, "<head(.*?)>", m => m.Value + inject, RegexOptions.IgnoreCase);

            var res = req.CreateResponse(HttpStatusCode.OK);
            res.Headers.Add("Content-Type", "text/html; charset=utf-8");
            // For local dev; lock this down to your SWA origin in prod
            res.Headers.Add("Access-Control-Allow-Origin", "*");
            await res.WriteStringAsync(html, Encoding.UTF8);
            return res;
        }
    }
}