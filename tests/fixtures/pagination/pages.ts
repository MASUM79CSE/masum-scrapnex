import type { IncomingMessage, ServerResponse } from "node:http";
const title = "Fieldwork inventory";
const rows = (index: number) =>
  `<tr><td>Shared equipment</td><td>12</td></tr><tr><td>Source record ${index}</td><td>${index}</td></tr>`;
function doc(content: string, head = "") {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${title}</title>${head}<style>body{font:16px system-ui;margin:34px;background:#edf6f0;color:#163139}td,th{padding:8px 14px;background:white;text-align:left}nav,button{margin-top:14px}</style>${content}</html>`;
}
const grid = (index: number) =>
  `<table><thead><tr><th>Item</th><th>Stock</th></tr></thead><tbody>${rows(index)}</tbody></table>`;
export function servePagination(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://fixture.example");
  const mode = url.pathname.match(
    /^\/paging\/(next|numbered|url|more|scroll|redirect|wrong|bad|stuck)$/,
  )?.[1];
  if (!mode) return false;
  const page = Number(url.searchParams.get("page") ?? 1);
  const common = `<main><h1>${title} — ${page}</h1>${grid(page)}`;
  const send = (markup: string) =>
    res
      .writeHead(200, { "Content-Type": "text/html;charset=utf-8" })
      .end(markup);
  if (mode === "redirect" && page === 2) {
    res.writeHead(302, { Location: "/paging/wrong" }).end();
    return true;
  }
  if (mode === "more" || mode === "stuck") {
    const behavior =
      mode === "more"
        ? `const button=document.querySelector('button');const main=document.querySelector('main');button.addEventListener('click',()=>{const count=Number(button.dataset.clicks||0)+1;button.dataset.clicks=String(count);button.disabled=true;main.setAttribute('aria-busy','true');setTimeout(()=>{document.querySelector('tbody').insertAdjacentHTML('beforeend','<tr><td>Loaded gear '+count+'</td><td>'+count+'</td></tr>');button.disabled=false;main.setAttribute('aria-busy','false');},720);});`
        : `document.querySelector('button').addEventListener('click',(event)=>event.currentTarget.dataset.clicks=String(Number(event.currentTarget.dataset.clicks||0)+1));`;
    send(
      doc(
        `${common}<button type="button">Load More</button></main><script>${behavior}</script>`,
      ),
    );
    return true;
  }
  if (mode === "scroll") {
    const extra = Array.from(
      { length: 14 },
      (_, i) => `<tr><td>Initial inventory ${i}</td><td>${i + 20}</td></tr>`,
    ).join("");
    send(
      doc(
        `${common.replace("</tbody>", extra + "</tbody>")}<p style="height:1300px" aria-hidden="true"></p></main><script>let calls=0;window.addEventListener('scroll',()=>{if(calls>=2)return;calls++;const id=calls;const main=document.querySelector('main');main.setAttribute('aria-busy','true');setTimeout(()=>{document.querySelector('tbody').insertAdjacentHTML('beforeend','<tr><td>Scrolled gear '+id+'</td><td>'+id+'</td></tr>');main.setAttribute('aria-busy','false');},230);},{passive:true});</script>`,
      ),
    );
    return true;
  }
  if (mode === "bad") {
    send(
      doc(
        `${common}<a href="?page=2">Next</a><footer><nav aria-label="Pagination"><a rel="next" href="?page=2">Next page</a></nav></footer><nav aria-label="Pagination"><a rel="next" href="https://other.example/page2">Next page</a><a aria-label="Sign in" rel="next" href="/account/?page=2">Continue</a></nav><form><button type="submit">Load More</button></form></main>`,
      ),
    );
    return true;
  }
  const forward = page < 3 ? `?page=${page + 1}` : null;
  let control = "";
  let head = "";
  if ((mode === "next" || mode === "redirect") && forward) {
    control = `<nav aria-label="Pagination"><a rel="next" href="${forward}">Next page</a></nav>`;
    head = `<link rel="next" href="${forward}">`;
  }
  if (mode === "numbered")
    control = `<nav aria-label="Pagination">${[1, 2, 3].map((n) => (n === page ? `<span aria-current="page">${n}</span>` : `<a aria-label="Page ${n}" href="?page=${n}">${n}</a>`)).join(" ")}</nav>`;
  if (mode === "url" && forward)
    control = `<nav class="pager"><a href="${forward}">More inventory pages</a></nav>`;
  send(doc(`${common}${control}</main>`, head));
  return true;
}
