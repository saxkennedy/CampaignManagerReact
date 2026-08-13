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

            html = CollapseParagraphSpacing(html);

            // Injected *after* the export's own <style> so these rules win, hence the
            // end of <head> rather than the start.
            var inject = """
<base target="_blank">
<style>
  html { background:#F2E8D5; }
  body { background:transparent !important; margin:0 auto; }

  /* Docs applies paragraph spacing to a list as a whole, not to each item, but
     the export stamps every <li> with the same spacing class as a <p>. Zeroing
     it here leaves the space around the list (contributed by the neighbouring
     paragraphs) while items sit flush, the way they do in Docs. */
  li {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }

  img { max-width: 100%; height: auto; }
</style>
""";

            if (Regex.IsMatch(html, "</head>", RegexOptions.IgnoreCase))
            {
                html = Regex.Replace(html, "</head>", m => inject + m.Value, RegexOptions.IgnoreCase);
            }
            else if (Regex.IsMatch(html, "<body[^>]*>", RegexOptions.IgnoreCase))
            {
                html = Regex.Replace(html, "<body[^>]*>", m => m.Value + inject, RegexOptions.IgnoreCase);
            }
            else
            {
                html = inject + html;
            }

            var res = req.CreateResponse(HttpStatusCode.OK);
            res.Headers.Add("Content-Type", "text/html; charset=utf-8");
            // For local dev; lock this down to your SWA origin in prod
            res.Headers.Add("Access-Control-Allow-Origin", "*");
            await res.WriteStringAsync(html, Encoding.UTF8);
            return res;
        }

        /// <summary>
        /// Google Docs lays paragraphs out with collapsing "space above/below", but the
        /// HTML export emits that spacing as padding — which never collapses. Two
        /// adjacent paragraphs styled "12pt above, 12pt below" therefore render with a
        /// 24pt gap in a browser where Docs itself shows 12pt, and the whole document
        /// reads as double-spaced.
        ///
        /// Rewriting those declarations as margins restores the collapsing. The swap is
        /// limited to rules carrying "orphans", which is the signature of the export's
        /// paragraph and heading styles — table-cell and page-frame padding (emitted as
        /// the `padding` shorthand) is left untouched.
        /// </summary>
        internal static string CollapseParagraphSpacing(string html) =>
            Regex.Replace(
                html,
                @"(<style[^>]*>)(.*?)(</style>)",
                m => m.Groups[1].Value + SwapBlockPadding(m.Groups[2].Value) + m.Groups[3].Value,
                RegexOptions.IgnoreCase | RegexOptions.Singleline);

        private static string SwapBlockPadding(string css) =>
            Regex.Replace(css, @"\{[^{}]*\}", m =>
            {
                var block = m.Value;
                if (block.IndexOf("orphans", StringComparison.OrdinalIgnoreCase) < 0) return block;

                block = Regex.Replace(block, @"padding-top\s*:", "margin-top:", RegexOptions.IgnoreCase);
                block = Regex.Replace(block, @"padding-bottom\s*:", "margin-bottom:", RegexOptions.IgnoreCase);
                return block;
            });
    }
}